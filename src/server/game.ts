import { computeSynergies, getUnitDef, UNITS } from '../shared/content';
import {
  BENCH_SIZE,
  MAX_LEVEL,
  POOL_COPIES,
  SHOP_ODDS,
  SHOP_SIZE,
  XP_FOR_LEVEL,
  type BattleSnapshot,
  type BenchUnitView,
  type GamePhase,
  type LobbySettings,
  type PublicPlayer,
  type RoomView,
  type SelfView,
  type UnitView,
} from '../shared/types';
import { planBotEconomy, planBotPlacement } from './bot';
import { Battle } from './battle';

export interface OwnedUnit {
  uid: string;
  defId: string;
  star: number;
  x: number;
  y: number;
}

export class GamePlayer {
  id: string;
  name: string;
  isBot: boolean;
  gold = 0;
  level = 2;
  xp = 0;
  lives = 30;
  alive = true;
  streak = 0;
  lastResult: 'win' | 'loss' | 'draw' | null = null;
  lastDamage = 0;
  board: OwnedUnit[] = [];
  bench: OwnedUnit[] = [];
  shop: (string | null)[] = [];
  locked = false;
  placement: number | null = null;
  eliminatedRound = 0;

  constructor(id: string, name: string, isBot: boolean) {
    this.id = id;
    this.name = name;
    this.isBot = isBot;
  }

  get xpNeeded(): number {
    return XP_FOR_LEVEL[this.level] ?? 0;
  }
}

interface BattleRuntime {
  battle: Battle;
  aId: string;
  bId: string | null;
  aName: string;
  bName: string;
  sendAccum: number;
  finalSent: boolean;
  applied: boolean;
}

interface Pairing {
  aId: string;
  bId: string | null;
  ghostId: string | null;
}

export interface GameCallbacks {
  roomUpdate: () => void;
  sendBattle: (playerId: string, snapshot: BattleSnapshot) => void;
  gameOver: (playerId: string, placement: number, totalPlayers: number, victory: boolean) => void;
  toast: (playerId: string, message: string) => void;
  isConnected: (playerId: string) => boolean;
}

interface GameOptions {
  code: string;
  roomName: string;
  hostId: string;
  players: { id: string; name: string; isBot: boolean }[];
  settings: LobbySettings;
  callbacks: GameCallbacks;
}

const PLAYER_ROWS = [4, 5, 6, 7];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickWeighted(odds: number[]): number {
  const total = odds.reduce((sum, value) => sum + value, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < odds.length; i++) {
    roll -= odds[i];
    if (roll <= 0) return i + 1;
  }
  return 1;
}

export class Game {
  code: string;
  roomName: string;
  hostId: string;
  settings: LobbySettings;
  players: GamePlayer[];
  phase: GamePhase = 'prep';
  round = 1;
  timeLeft = 0;
  private callbacks: GameCallbacks;
  private pool: Record<string, number> = {};
  private uidCounter = 0;
  private battles: BattleRuntime[] = [];
  private pairings: Pairing[] = [];
  private latestSnapshots = new Map<string, BattleSnapshot>();
  private broadcastAccum = 0;
  private spectatorAccum = 0;
  private featuredBattleIndex = 0;
  private finished = false;

  constructor(options: GameOptions) {
    this.code = options.code;
    this.roomName = options.roomName;
    this.hostId = options.hostId;
    this.settings = options.settings;
    this.callbacks = options.callbacks;
    this.players = options.players.map((p) => new GamePlayer(p.id, p.name, p.isBot));
    this.initPool();
  }

  private initPool(): void {
    this.pool = {};
    for (const def of UNITS) {
      this.pool[def.id] = (POOL_COPIES[def.cost] ?? 10) * Math.max(1, Math.ceil(this.players.length / 8));
    }
  }

  start(): void {
    for (const player of this.players) {
      player.gold = this.settings.startingGold;
      player.level = Math.min(MAX_LEVEL, Math.max(1, this.settings.startingLevel));
      player.xp = 0;
      player.lives = this.settings.startingLives;
      player.alive = true;
      this.rollShop(player);
    }
    this.phase = 'prep';
    this.round = 1;
    this.timeLeft = this.settings.prepSeconds;
    this.runBots();
    this.buildPairings();
    this.callbacks.roomUpdate();
  }

  tick(dtMs: number): void {
    if (this.finished) return;
    const dt = dtMs / 1000;
    this.broadcastAccum += dt;
    if (this.phase === 'prep') {
      this.timeLeft -= dt;
      if (this.broadcastAccum >= 1) {
        this.broadcastAccum = 0;
        this.callbacks.roomUpdate();
      }
      if (this.timeLeft <= 0) this.startCombat();
    } else if (this.phase === 'combat') {
      this.timeLeft -= dt;
      this.tickCombat(dt);
      if (this.broadcastAccum >= 1) {
        this.broadcastAccum = 0;
        this.callbacks.roomUpdate();
      }
    } else if (this.phase === 'result') {
      this.timeLeft -= dt;
      if (this.broadcastAccum >= 1) {
        this.broadcastAccum = 0;
        this.callbacks.roomUpdate();
      }
      if (this.timeLeft <= 0) {
        this.advanceRound();
      }
    }
  }

  private buildPairings(): void {
    const alive = this.players.filter((p) => p.alive);
    const order = shuffle(alive);
    this.pairings = [];
    for (let i = 0; i < order.length; i += 2) {
      const a = order[i];
      const b = order[i + 1] ?? null;
      const ghostPool = alive.filter((p) => p.id !== a.id);
      const ghost = b || ghostPool.length === 0 ? null : ghostPool[Math.floor(Math.random() * ghostPool.length)];
      this.pairings.push({ aId: a.id, bId: b?.id ?? null, ghostId: ghost?.id ?? null });
    }
  }

  private startCombat(): void {
    const alive = this.players.filter((p) => p.alive);
    if (alive.length <= 1) {
      this.finishGame();
      return;
    }
    const pairings = this.pairings.filter(
      (pairing) => alive.some((p) => p.id === pairing.aId) && (!pairing.bId || alive.some((p) => p.id === pairing.bId)),
    );
    if (pairings.length === 0) {
      this.buildPairings();
      this.startCombat();
      return;
    }
    this.battles = [];
    this.featuredBattleIndex = 0;
    this.spectatorAccum = 0;
    for (const pairing of pairings) {
      const a = this.players.find((p) => p.id === pairing.aId && p.alive);
      if (!a) continue;
      const b = pairing.bId ? this.players.find((p) => p.id === pairing.bId && p.alive) : null;
      if (b) {
        this.battles.push({
          battle: new Battle(this.round, this.boardSide(a), this.boardSide(b)),
          aId: a.id,
          bId: b.id,
          aName: a.name,
          bName: b.name,
          sendAccum: 0,
          finalSent: false,
          applied: false,
        });
      } else {
        const source = pairing.ghostId
          ? this.players.find((p) => p.id === pairing.ghostId && p.alive) ?? null
          : null;
        const fallback = alive.filter((p) => p.id !== a.id);
        const ghost = source ?? (fallback.length > 0 ? fallback[Math.floor(Math.random() * fallback.length)] : null);
        const ghostBoard = ghost ? ghost.board.map((u) => ({ ...u })) : [];
        const ghostName = ghost ? `Эхо ${ghost.name}` : 'Эхо Арены';
        this.battles.push({
          battle: new Battle(this.round, this.boardSide(a), {
            ownerId: 'ghost',
            name: ghostName,
            units: ghostBoard,
          }),
          aId: a.id,
          bId: null,
          aName: a.name,
          bName: ghostName,
          sendAccum: 0,
          finalSent: false,
          applied: false,
        });
      }
    }
    if (this.battles.length === 0) {
      this.buildPairings();
      this.startCombat();
      return;
    }
    this.phase = 'combat';
    this.timeLeft = 45;
    this.broadcastAccum = 0;
    this.callbacks.roomUpdate();
  }

  private boardSide(player: GamePlayer) {
    return {
      ownerId: player.id,
      name: player.name,
      units: player.board.map((u) => ({ ...u })),
    };
  }

  private tickCombat(dt: number): void {
    let allDone = true;
    for (const runtime of this.battles) {
      if (!runtime.battle.result) {
        runtime.battle.step(dt);
        runtime.sendAccum += dt;
        if (runtime.sendAccum >= 0.14) {
          runtime.sendAccum = 0;
          this.sendBattleSnapshots(runtime, false);
        }
      }
      if (runtime.battle.result) {
        if (!runtime.finalSent) {
          runtime.finalSent = true;
          this.sendBattleSnapshots(runtime, true);
        }
        if (!runtime.applied) {
          runtime.applied = true;
          this.applyBattleResult(runtime);
        }
      } else {
        allDone = false;
      }
    }
    this.spectatorAccum += dt;
    if (this.spectatorAccum >= 0.14) {
      this.spectatorAccum = 0;
      this.sendSpectatorSnapshots();
    }
    if (allDone) {
      this.phase = 'result';
      this.timeLeft = 4;
      this.callbacks.roomUpdate();
    }
  }

  private featuredBattle(): BattleRuntime | null {
    if (this.battles.length === 0) return null;
    if (this.featuredBattleIndex >= this.battles.length) this.featuredBattleIndex = 0;
    let runtime = this.battles[this.featuredBattleIndex];
    if (runtime.battle.result) {
      const nextIndex = this.battles.findIndex((b) => !b.battle.result);
      if (nextIndex >= 0) {
        this.featuredBattleIndex = nextIndex;
        runtime = this.battles[nextIndex];
      }
    }
    return runtime;
  }

  private sendSpectatorSnapshots(): void {
    const runtime = this.featuredBattle();
    if (!runtime) return;
    const snapshot = runtime.battle.snapshot(0, runtime.bName);
    for (const player of this.players) {
      if (player.isBot || player.alive) continue;
      if (!this.callbacks.isConnected(player.id)) continue;
      this.latestSnapshots.set(player.id, snapshot);
      this.callbacks.sendBattle(player.id, snapshot);
    }
  }

  private sendBattleSnapshots(runtime: BattleRuntime, final: boolean): void {
    const a = this.players.find((p) => p.id === runtime.aId);
    if (a && !a.isBot) {
      const snapshot = runtime.battle.snapshot(0, runtime.bName);
      this.latestSnapshots.set(a.id, snapshot);
      this.callbacks.sendBattle(a.id, snapshot);
    }
    if (runtime.bId) {
      const b = this.players.find((p) => p.id === runtime.bId);
      if (b && !b.isBot) {
        const snapshot = runtime.battle.snapshot(1, runtime.aName);
        this.latestSnapshots.set(b.id, snapshot);
        this.callbacks.sendBattle(b.id, snapshot);
      }
    }
    if (final) {
      runtime.sendAccum = 0;
    }
  }

  private applyBattleResult(runtime: BattleRuntime): void {
    const a = this.players.find((p) => p.id === runtime.aId);
    const b = runtime.bId ? this.players.find((p) => p.id === runtime.bId) : null;
    if (!a) return;
    const result = runtime.battle.result;
    const baseDamage = 2 + Math.floor(this.round / 5);

    if (b) {
      if (result === 'draw') {
        this.damagePlayer(a, baseDamage, 'draw');
        this.damagePlayer(b, baseDamage, 'draw');
      } else if (result === 'left') {
        const survivors = runtime.battle.survivors(0).length;
        this.damagePlayer(b, Math.min(12, baseDamage + survivors), 'loss');
        this.markWinner(a);
      } else if (result === 'right') {
        const survivors = runtime.battle.survivors(1).length;
        this.damagePlayer(a, Math.min(12, baseDamage + survivors), 'loss');
        this.markWinner(b);
      }
    } else if (result === 'left') {
      this.markWinner(a);
    } else {
      const survivors = result === 'right' ? runtime.battle.survivors(1).length : 0;
      this.damagePlayer(a, Math.min(12, baseDamage + survivors), result === 'draw' ? 'draw' : 'loss');
    }

    const dead = this.players.filter((p) => !p.alive && p.placement === null);
    for (const player of dead) {
      this.assignPlacement(player);
      if (!player.isBot) {
        this.callbacks.toast(player.id, 'Ваш отряд пал. Вы выбыли из матча.');
      }
    }
  }

  private assignPlacement(player: GamePlayer): void {
    const aliveCount = this.players.filter((p) => p.alive).length;
    player.placement = Math.max(2, aliveCount + 1);
    player.eliminatedRound = this.round;
  }

  private markWinner(player: GamePlayer): void {
    player.lastResult = 'win';
    player.lastDamage = 0;
    player.streak = player.streak >= 0 ? player.streak + 1 : 1;
  }

  private damagePlayer(player: GamePlayer, damage: number, result: 'loss' | 'draw'): void {
    if (!player.alive) return;
    player.lives = Math.max(0, player.lives - damage);
    player.lastResult = result;
    player.lastDamage = damage;
    if (result === 'loss') {
      player.streak = player.streak <= 0 ? player.streak - 1 : -1;
    } else {
      player.streak = 0;
    }
    if (player.lives <= 0) {
      player.alive = false;
    }
  }

  private advanceRound(): void {
    const alive = this.players.filter((p) => p.alive);
    if (alive.length <= 1 || this.round >= this.settings.maxRounds) {
      this.finishGame();
      return;
    }
    this.round += 1;
    this.battles = [];
    this.latestSnapshots.clear();
    for (const player of this.players) {
      if (!player.alive) continue;
      const interest = Math.min(5, Math.floor(player.gold / 10));
      const streakBonus = Math.abs(player.streak) >= 5 ? 2 : Math.abs(player.streak) >= 3 ? 1 : 0;
      const winBonus = player.lastResult === 'win' ? 1 : 0;
      player.gold += 5 + interest + streakBonus + winBonus;
      this.addXp(player, 2);
      if (!player.locked) {
        this.rollShop(player);
      } else {
        player.locked = false;
      }
    }
    this.phase = 'prep';
    this.timeLeft = this.settings.prepSeconds;
    this.broadcastAccum = 0;
    this.runBots();
    this.buildPairings();
    this.callbacks.roomUpdate();
  }

  private finishGame(): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'finished';
    this.timeLeft = 0;
    const alive = this.players.filter((p) => p.alive).sort((a, b) => b.lives - a.lives);
    const dead = this.players
      .filter((p) => !p.alive)
      .sort((a, b) => b.eliminatedRound - a.eliminatedRound || b.lives - a.lives);
    let place = 1;
    for (const player of alive) player.placement = place++;
    for (const player of dead) player.placement = place++;
    this.callbacks.roomUpdate();
    for (const player of this.players) {
      if (!player.isBot) {
        this.callbacks.gameOver(player.id, player.placement ?? this.players.length, this.players.length, player.placement === 1);
      }
    }
  }

  private addXp(player: GamePlayer, amount: number): void {
    if (player.level >= MAX_LEVEL) return;
    player.xp += amount;
    while (player.level < MAX_LEVEL && player.xp >= (XP_FOR_LEVEL[player.level] ?? 0)) {
      player.xp -= XP_FOR_LEVEL[player.level] ?? 0;
      player.level += 1;
    }
    if (player.level >= MAX_LEVEL) player.xp = 0;
  }

  private runBots(): void {
    for (const player of this.players) {
      if (!player.isBot || !player.alive) continue;
      this.runBotTurn(player);
    }
  }

  private runBotTurn(player: GamePlayer): void {
    const economy = planBotEconomy(player, this.round);
    for (const action of economy) {
      if (action.kind === 'buy' && action.index !== undefined) this.buyUnit(player.id, action.index, true);
      else if (action.kind === 'reroll') this.reroll(player.id, true);
      else if (action.kind === 'xp') this.buyXp(player.id, true);
      else if (action.kind === 'sell' && action.uid) this.sellUnit(player.id, action.uid, true);
    }
    const placement = planBotPlacement(player);
    for (const action of placement) {
      if (action.kind === 'place' && action.uid && action.x !== undefined && action.y !== undefined) {
        this.moveUnit(player.id, action.uid, { type: 'board', x: action.x, y: action.y }, true);
      } else if (action.kind === 'bench' && action.uid) {
        this.moveUnit(player.id, action.uid, { type: 'bench' }, true);
      }
    }
  }

  private initShop(player: GamePlayer): void {
    player.shop = Array.from({ length: SHOP_SIZE }, () => null);
  }

  private rollShop(player: GamePlayer): void {
    for (const offer of player.shop) {
      if (offer) this.returnToPool(offer);
    }
    this.initShop(player);
    const odds = SHOP_ODDS[Math.min(MAX_LEVEL, Math.max(1, player.level))] ?? SHOP_ODDS[1];
    for (let i = 0; i < SHOP_SIZE; i++) {
      let cost = pickWeighted(odds);
      let candidates = this.availableUnits(cost);
      let guard = 0;
      while (candidates.length === 0 && guard < 10) {
        cost = 1 + Math.floor(Math.random() * 5);
        candidates = this.availableUnits(cost);
        guard++;
      }
      if (candidates.length === 0) continue;
      const def = candidates[Math.floor(Math.random() * candidates.length)];
      this.pool[def.id] = Math.max(0, (this.pool[def.id] ?? 0) - 1);
      player.shop[i] = def.id;
    }
  }

  private availableUnits(cost: number) {
    return UNITS.filter((def) => def.cost === cost && (this.pool[def.id] ?? 0) > 0);
  }

  private returnToPool(defId: string): void {
    this.pool[defId] = (this.pool[defId] ?? 0) + 1;
  }

  buyUnit(playerId: string, index: number, silent = false): void {
    const player = this.getPlayer(playerId);
    if (!player || !this.canAct(player, silent)) return;
    if (this.phase !== 'prep') return this.fail(player, 'Покупки доступны только в фазе подготовки.', silent);
    const offer = player.shop[index];
    if (!offer) return this.fail(player, 'Этот слот магазина уже пуст.', silent);
    const def = getUnitDef(offer);
    if (player.gold < def.cost) return this.fail(player, 'Недостаточно золота.', silent);
    const copies = [...player.board, ...player.bench].filter((u) => u.defId === offer && u.star === 1).length;
    const willCombine = copies >= 2;
    if (player.bench.length >= BENCH_SIZE && !willCombine) {
      return this.fail(player, 'Скамья заполнена.', silent);
    }
    player.gold -= def.cost;
    player.shop[index] = null;
    const unit: OwnedUnit = { uid: `u-${++this.uidCounter}`, defId: offer, star: 1, x: 0, y: 0 };
    player.bench.push(unit);
    this.tryCombine(player, silent);
    this.callbacks.roomUpdate();
  }

  reroll(playerId: string, silent = false): void {
    const player = this.getPlayer(playerId);
    if (!player || !this.canAct(player, silent)) return;
    if (this.phase !== 'prep') return this.fail(player, 'Обновление доступно только в фазе подготовки.', silent);
    if (player.gold < 2) return this.fail(player, 'Нужно 2 золота для обновления.', silent);
    player.gold -= 2;
    player.locked = false;
    this.rollShop(player);
    this.callbacks.roomUpdate();
  }

  buyXp(playerId: string, silent = false): void {
    const player = this.getPlayer(playerId);
    if (!player || !this.canAct(player, silent)) return;
    if (this.phase !== 'prep') return this.fail(player, 'Опыт покупается только в фазе подготовки.', silent);
    if (player.level >= MAX_LEVEL) return this.fail(player, 'Достигнут максимальный уровень.', silent);
    if (player.gold < 4) return this.fail(player, 'Нужно 4 золота для покупки опыта.', silent);
    player.gold -= 4;
    const before = player.level;
    this.addXp(player, 4);
    if (player.level > before && !silent) {
      this.callbacks.toast(player.id, `Уровень ${player.level}! Теперь можно выставить ${player.level} бойцов.`);
    }
    this.callbacks.roomUpdate();
  }

  toggleLock(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player || !this.canAct(player, false)) return;
    if (this.phase !== 'prep') return;
    player.locked = !player.locked;
    this.callbacks.roomUpdate();
  }

  moveUnit(
    playerId: string,
    uid: string,
    to: { type: 'board'; x: number; y: number } | { type: 'bench' },
    silent = false,
  ): void {
    const player = this.getPlayer(playerId);
    if (!player || !this.canAct(player, silent)) return;
    if (this.phase !== 'prep') return this.fail(player, 'Расстановка доступна только в фазе подготовки.', silent);
    const boardUnit = player.board.find((u) => u.uid === uid);
    const benchUnit = player.bench.find((u) => u.uid === uid);
    if (!boardUnit && !benchUnit) return;

    if (to.type === 'bench') {
      if (!boardUnit) return;
      if (player.bench.length >= BENCH_SIZE) return this.fail(player, 'Скамья заполнена.', silent);
      player.board = player.board.filter((u) => u.uid !== uid);
      boardUnit.x = 0;
      boardUnit.y = 0;
      player.bench.push(boardUnit);
      this.callbacks.roomUpdate();
      return;
    }

    const x = Math.floor(to.x);
    const y = Math.floor(to.y);
    if (x < 0 || x > 7 || !PLAYER_ROWS.includes(y)) {
      return this.fail(player, 'Бойцов можно ставить только на свою половину поля.', silent);
    }
    const occupant = player.board.find((u) => u.uid !== uid && u.x === x && u.y === y);
    if (benchUnit) {
      if (player.board.length >= player.level && !occupant) {
        return this.fail(player, `Максимум бойцов на поле: ${player.level}. Повысьте уровень.`, silent);
      }
      player.bench = player.bench.filter((u) => u.uid !== uid);
      if (occupant) {
        player.board = player.board.filter((u) => u.uid !== occupant.uid);
        occupant.x = 0;
        occupant.y = 0;
        player.bench.push(occupant);
      }
      benchUnit.x = x;
      benchUnit.y = y;
      player.board.push(benchUnit);
    } else if (boardUnit) {
      if (occupant) {
        occupant.x = boardUnit.x;
        occupant.y = boardUnit.y;
      }
      boardUnit.x = x;
      boardUnit.y = y;
    }
    this.callbacks.roomUpdate();
  }

  sellUnit(playerId: string, uid: string, silent = false): void {
    const player = this.getPlayer(playerId);
    if (!player || !this.canAct(player, silent)) return;
    if (this.phase !== 'prep') return this.fail(player, 'Продажа доступна только в фазе подготовки.', silent);
    const unit = player.board.find((u) => u.uid === uid) ?? player.bench.find((u) => u.uid === uid);
    if (!unit) return;
    const def = getUnitDef(unit.defId);
    const copies = Math.pow(3, unit.star - 1);
    player.gold += def.cost * copies;
    for (let i = 0; i < copies; i++) this.returnToPool(unit.defId);
    player.board = player.board.filter((u) => u.uid !== uid);
    player.bench = player.bench.filter((u) => u.uid !== uid);
    this.callbacks.roomUpdate();
  }

  surrender(playerId: string): void {
    if (this.finished) return;
    const player = this.getPlayer(playerId);
    if (!player || !player.alive) return;
    player.lives = 0;
    player.alive = false;
    this.assignPlacement(player);
    this.callbacks.toast(playerId, 'Вы сдались и выбыли из матча.');

    const runtime = this.battles.find((battle) => battle.aId === playerId || battle.bId === playerId);
    if (runtime && !runtime.battle.result) {
      runtime.battle.result = runtime.aId === playerId ? 'right' : 'left';
    }
    if (this.phase !== 'combat') this.buildPairings();

    const alive = this.players.filter((p) => p.alive);
    if (alive.length <= 1) {
      this.finishGame();
      return;
    }
    this.callbacks.roomUpdate();
  }

  private tryCombine(player: GamePlayer, silent = false): void {
    let changed = true;
    while (changed) {
      changed = false;
      const all = [
        ...player.board.map((u) => ({ unit: u, onBoard: true })),
        ...player.bench.map((u) => ({ unit: u, onBoard: false })),
      ];
      const groups = new Map<string, typeof all>();
      for (const entry of all) {
        if (entry.unit.star >= 3) continue;
        const key = `${entry.unit.defId}:${entry.unit.star}`;
        const list = groups.get(key) ?? [];
        list.push(entry);
        groups.set(key, list);
      }
      for (const group of groups.values()) {
        if (group.length < 3) continue;
        const keep = group.find((entry) => entry.onBoard) ?? group[0];
        const remove = group.filter((entry) => entry !== keep).slice(0, 2);
        for (const entry of remove) {
          if (entry.onBoard) player.board = player.board.filter((u) => u.uid !== entry.unit.uid);
          else player.bench = player.bench.filter((u) => u.uid !== entry.unit.uid);
        }
        keep.unit.star += 1;
        if (!silent) {
          const def = getUnitDef(keep.unit.defId);
          this.callbacks.toast(player.id, `${def.name}: звёздность повышена до ${keep.unit.star}!`);
        }
        changed = true;
        break;
      }
    }
  }

  private getPlayer(playerId: string): GamePlayer | null {
    return this.players.find((p) => p.id === playerId) ?? null;
  }

  private canAct(player: GamePlayer, silent: boolean): boolean {
    if (!player.alive) {
      if (!silent) this.callbacks.toast(player.id, 'Вы выбыли из матча и наблюдаете за игрой.');
      return false;
    }
    return true;
  }

  private fail(player: GamePlayer, message: string, silent: boolean): void {
    if (!silent) this.callbacks.toast(player.id, message);
  }

  getBattleSnapshotFor(playerId: string): BattleSnapshot | null {
    return this.latestSnapshots.get(playerId) ?? null;
  }

  private opponentNameFor(playerId: string): string | undefined {
    if (this.phase === 'combat' || this.phase === 'result') {
      const runtime = this.battles.find((b) => b.aId === playerId || b.bId === playerId);
      if (runtime) return runtime.aId === playerId ? runtime.bName : runtime.aName;
    }
    const pairing = this.pairings.find((entry) => entry.aId === playerId || entry.bId === playerId);
    if (!pairing) return undefined;
    if (pairing.aId === playerId) {
      const opponent = pairing.bId ? this.players.find((p) => p.id === pairing.bId) : null;
      if (opponent) return opponent.name;
      const ghost = pairing.ghostId ? this.players.find((p) => p.id === pairing.ghostId) : null;
      return ghost ? `Эхо ${ghost.name}` : 'Эхо Арены';
    }
    return this.players.find((p) => p.id === pairing.aId)?.name;
  }

  viewFor(playerId: string): RoomView {
    const self = this.players.find((p) => p.id === playerId) ?? null;
    const publicPlayers: PublicPlayer[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      host: p.id === this.hostId,
      ready: false,
      connected: this.callbacks.isConnected(p.id) || p.isBot,
      alive: p.alive,
      lives: p.lives,
      level: p.level,
      streak: p.streak,
      placement: p.placement,
      board: p.board.map((u) => ({ uid: u.uid, defId: u.defId, star: u.star, x: u.x, y: u.y })),
      synergies: computeSynergies(p.board),
    }));

    let selfView: SelfView | null = null;
    if (self) {
      selfView = {
        id: self.id,
        name: self.name,
        isBot: self.isBot,
        gold: self.gold,
        level: self.level,
        xp: self.xp,
        xpNeeded: self.xpNeeded,
        lives: self.lives,
        alive: self.alive,
        streak: self.streak,
        board: self.board.map((u) => ({ uid: u.uid, defId: u.defId, star: u.star, x: u.x, y: u.y })),
        bench: self.bench.map((u) => ({ uid: u.uid, defId: u.defId, star: u.star })),
        shop: [...self.shop],
        locked: self.locked,
        synergies: computeSynergies(self.board),
        placement: self.placement,
        lastResult: self.lastResult,
        lastDamage: self.lastDamage,
      };
    }

    return {
      code: this.code,
      name: this.roomName,
      hostId: this.hostId,
      settings: this.settings,
      phase: this.phase,
      round: this.round,
      maxRounds: this.settings.maxRounds,
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
      selfId: playerId,
      players: publicPlayers,
      self: selfView,
      opponentName: this.opponentNameFor(playerId),
    };
  }
}

