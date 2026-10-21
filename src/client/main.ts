import { getUnitDef } from '../shared/content';
import {
  BENCH_SIZE,
  CLASS_NAMES,
  DEFAULT_SETTINGS,
  PLAYER_ROWS,
  RACE_NAMES,
  STAR_MULTIPLIER,
  type BattleSnapshot,
  type LobbySettings,
  type RoomView,
  type SelfView,
  type ServerMessage,
  type UnitDef,
  type UnitView,
} from '../shared/types';
import { Net } from './net';
import { ArenaScene, type FloatTextKind } from './scene';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stars(count: number): string {
  return '★'.repeat(Math.max(0, count));
}

function livesWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'жизнь';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'жизни';
  return 'жизней';
}

function formatNumber(value: number): string {
  return String(Math.round(value));
}

let room: RoomView | null = null;
let battle: BattleSnapshot | null = null;
let selectedUid: string | null = null;
let lastRoomAt = 0;
let gameOverShown = false;
let surrenderPending = false;
let currentScreen: 'menu' | 'lobby' | 'game' = 'menu';
let lastTooltipDef: string | null = null;
let shopSig = '';
let benchSig = '';
let selectedSig = '';
let synergySig = '';
let playersSig = '';
let resultSig = '';
let phaseSig = '';

const playerNameInput = byId<HTMLInputElement>('playerName');
const codeInput = byId<HTMLInputElement>('codeInput');
const canvas = byId<HTMLCanvasElement>('renderCanvas');
const connectionBadge = byId('connection');
const lobbyList = byId('lobbyList');
const lobbyPlayers = byId('lobbyPlayers');
const lobbySettings = byId('lobbySettings');
const lobbyHint = byId('lobbyHint');
const readyBtn = byId<HTMLButtonElement>('readyBtn');
const startBtn = byId<HTMLButtonElement>('startBtn');
const shopCards = byId('shopCards');
const benchCards = byId('benchCards');
const selectedPanel = byId('selectedPanel');
const synergyPanel = byId('synergyPanel');
const playersPanel = byId('playersPanel');
const rulesBtn = byId<HTMLButtonElement>('rulesBtn');
const surrenderBtn = byId<HTMLButtonElement>('surrenderBtn');
const shopBar = byId('shopBar');
const benchBar = byId('benchBar');
const battleResult = byId('battleResult');
const phaseBanner = byId('phaseBanner');
const floatLayer = byId('floatLayer');
const tooltip = byId('tooltip');
const modalRoot = byId('modalRoot');
const spectatorBanner = byId('spectatorBanner');
const gameOver = byId('gameOver');
const gameOverTitle = byId('gameOverTitle');
const gameOverText = byId('gameOverText');
const gameOverEmblem = byId('gameOverEmblem');

const storedName = localStorage.getItem('autoflow.name') ?? '';
playerNameInput.value = storedName;

const net = new Net();
const scene = new ArenaScene(canvas, {
  onCellClick: (x, y) => {
    if (!room || room.phase !== 'prep' || !room.self?.alive) return;
    if (!selectedUid) return;
    net.send({ type: 'move_unit', uid: selectedUid, to: { type: 'board', x, y } });
    selectedUid = null;
    refreshSelection();
  },
  onUnitClick: (uid) => {
    if (!room || room.phase !== 'prep' || !room.self?.alive) return;
    const self = room.self;
    if (selectedUid && selectedUid !== uid) {
      const target = self.board.find((unit) => unit.uid === uid);
      if (target) {
        net.send({ type: 'move_unit', uid: selectedUid, to: { type: 'board', x: target.x, y: target.y } });
        selectedUid = null;
        refreshSelection();
        return;
      }
    }
    selectedUid = selectedUid === uid ? null : uid;
    refreshSelection();
  },
  onFloatText: spawnFloatText,
});

function spawnFloatText(text: string, x: number, y: number, kind: FloatTextKind): void {
  if (floatLayer.childElementCount > 40) floatLayer.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = `float-text ${kind}`;
  el.textContent = text;
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  floatLayer.appendChild(el);
  window.setTimeout(() => el.remove(), 1000);
}

function showScreen(name: 'menu' | 'lobby' | 'game'): void {
  currentScreen = name;
  for (const screen of document.querySelectorAll<HTMLElement>('.screen')) {
    screen.classList.toggle('active', screen.id === `${name}-screen`);
  }
  document.body.classList.toggle('in-game', name === 'game');
  if (name === 'game') scene.show();
}

function currentName(): string {
  const value = playerNameInput.value.trim().slice(0, 18);
  const name = value || 'Странник';
  localStorage.setItem('autoflow.name', name);
  net.setName(name);
  return name;
}

function syncName(): string {
  const name = currentName();
  if (net.playerId) net.send({ type: 'set_name', name });
  return name;
}

function requireOnline(): boolean {
  if (net.playerId) return true;
  toast('Сервер ещё не ответил. Подождите пару секунд.', 'error');
  return false;
}

function toast(message: string, kind: 'info' | 'error' | 'success' = 'info'): void {
  const container = byId('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind === 'info' ? '' : kind}`.trim();
  el.textContent = message;
  container.appendChild(el);
  while (container.children.length > 5) container.firstElementChild?.remove();
  window.setTimeout(() => el.remove(), 4200);
}

function setConnection(status: 'connecting' | 'online' | 'offline'): void {
  connectionBadge.classList.remove('online', 'offline');
  if (status === 'online') {
    connectionBadge.textContent = 'На связи';
    connectionBadge.classList.add('online');
  } else if (status === 'offline') {
    connectionBadge.textContent = 'Нет связи';
    connectionBadge.classList.add('offline');
  } else {
    connectionBadge.textContent = 'Соединение...';
  }
}

net.onStatus = setConnection;
net.onMessage = handleServerMessage;

function handleServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case 'auth':
      if (!playerNameInput.value.trim()) {
        playerNameInput.value = message.playerName;
      }
      break;
    case 'lobby_list':
      renderLobbyList(message.lobbies);
      break;
    case 'room':
      handleRoom(message.room);
      break;
    case 'battle':
      if (!room || (room.phase !== 'combat' && room.phase !== 'result')) return;
      battle = message.battle;
      scene.updateBattle(message.battle);
      renderBattleResult();
      break;
    case 'toast':
      toast(message.message);
      break;
    case 'error':
      surrenderPending = false;
      toast(message.message, 'error');
      break;
    case 'left':
      resetToMenu();
      break;
    case 'game_over':
      showGameOver(
        message.placement,
        message.totalPlayers,
        message.victory,
        surrenderPending ? 'surrender' : undefined,
      );
      surrenderPending = false;
      break;
  }
}

function handleRoom(nextRoom: RoomView): void {
  const previous = room;
  room = nextRoom;
  lastRoomAt = Date.now();
  if (drag && (nextRoom.phase !== 'prep' || !nextRoom.self?.alive)) cancelDrag();
  if (selectedUid && nextRoom.self) {
    const exists =
      nextRoom.self.board.some((unit) => unit.uid === selectedUid) ||
      nextRoom.self.bench.some((unit) => unit.uid === selectedUid);
    if (!exists) selectedUid = null;
  }
  if (nextRoom.self && !nextRoom.self.alive) selectedUid = null;

  if (nextRoom.phase === 'waiting') {
    battle = null;
    showScreen('lobby');
    renderLobby();
    return;
  }

  if (nextRoom.phase === 'prep' && previous?.phase !== 'prep') {
    battle = null;
    battleResult.classList.add('hidden');
  }

  showScreen('game');
  renderGame();
  syncScene();
  if (surrenderPending && nextRoom.self && !nextRoom.self.alive && nextRoom.phase !== 'finished') {
    showGameOver(
      nextRoom.self.placement ?? nextRoom.players.length,
      nextRoom.players.length,
      false,
      'surrender',
    );
    surrenderPending = false;
  }
  if (nextRoom.phase === 'finished' && nextRoom.self?.placement && !gameOverShown) {
    showGameOver(
      nextRoom.self.placement,
      nextRoom.players.length,
      nextRoom.self.placement === 1,
      surrenderPending ? 'surrender' : undefined,
    );
    surrenderPending = false;
  }
}

function resetToMenu(): void {
  cancelDrag();
  room = null;
  battle = null;
  selectedUid = null;
  gameOverShown = false;
  surrenderPending = false;
  scene.clearUnits();
  gameOver.classList.add('hidden');
  byId('spectatorBanner').classList.add('hidden');
  showScreen('menu');
  net.send({ type: 'list_lobbies' });
}

function syncScene(): void {
  if (!room || !room.self) return;
  if (room.phase === 'prep') {
    if (!room.self.alive) {
      const units = spectateBoard();
      if (units) {
        scene.updatePrep(units, null);
        scene.setPreparing(false);
      } else {
        scene.clearUnits();
      }
      return;
    }
    scene.setPreparing(true);
    scene.updatePrep(room.self.board, selectedUid);
  } else if ((room.phase === 'combat' || room.phase === 'result') && battle) {
    scene.setPreparing(false);
    scene.updateBattle(battle);
  }
}

function spectateBoard(): UnitView[] | null {
  if (!room || room.self?.alive !== false) return null;
  const alive = room.players.filter((player) => player.alive);
  if (alive.length === 0) return null;
  return alive.reduce((best, player) => (player.lives > best.lives ? player : best), alive[0]).board;
}

function refreshSelection(): void {
  if (room?.phase === 'prep' && room.self?.alive) {
    scene.updatePrep(room.self.board, selectedUid);
  }
  renderSelectedPanel();
  renderBench();
}

type DragSource = 'bench' | 'board';

interface DragState {
  uid: string;
  defId: string;
  star: number;
  source: DragSource;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  ghost: HTMLElement | null;
  cell: { x: number; y: number } | null;
  cellValid: boolean;
  overBench: boolean;
  benchValid: boolean;
}

let drag: DragState | null = null;
let suppressBenchClick = false;

function beginDrag(uid: string, source: DragSource, event: PointerEvent): void {
  const self = room?.self;
  if (!self || !self.alive || room?.phase !== 'prep') return;
  const unit =
    source === 'bench'
      ? self.bench.find((item) => item.uid === uid)
      : self.board.find((item) => item.uid === uid);
  if (!unit) return;
  drag = {
    uid,
    defId: unit.defId,
    star: unit.star,
    source,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    active: false,
    ghost: null,
    cell: null,
    cellValid: false,
    overBench: false,
    benchValid: false,
  };
  if (source === 'board') scene.setDragging(true);
}

function createDragGhost(defId: string, star: number): HTMLElement {
  const def = getUnitDef(defId);
  const el = document.createElement('div');
  el.className = `drag-ghost race-${def.race} cost-${def.cost}`;
  el.innerHTML = `
    <span class="drag-cost">${def.cost}</span>
    <span class="drag-stars">${star > 1 ? stars(star) : ''}</span>
    <span class="drag-name">${escapeHtml(def.name)}</span>
    <span class="drag-traits">${RACE_NAMES[def.race]} · ${CLASS_NAMES[def.unitClass]}</span>`;
  return el;
}

function activateDrag(): void {
  if (!drag || drag.active) return;
  drag.active = true;
  suppressBenchClick = true;
  hideTooltip();
  scene.setDragging(true);
  scene.setDraggedUnit(drag.uid);
  drag.ghost = createDragGhost(drag.defId, drag.star);
  document.body.appendChild(drag.ghost);
  document.body.classList.add('dragging-unit');
  if (drag.source === 'bench') {
    const card = benchCards.querySelector<HTMLElement>(`[data-bench-uid="${drag.uid}"]`);
    card?.classList.add('dragging');
  }
}

function updateGhostPosition(x: number, y: number): void {
  if (!drag?.ghost) return;
  drag.ghost.style.left = `${x}px`;
  drag.ghost.style.top = `${y}px`;
}

function pointInRect(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function canDropOnCell(cell: { x: number; y: number }): boolean {
  const self = room?.self;
  if (!self || !drag) return false;
  if (!PLAYER_ROWS.includes(cell.y)) return false;
  const fromBoard = self.board.some((unit) => unit.uid === drag?.uid);
  const occupant = self.board.find(
    (unit) => unit.uid !== drag?.uid && unit.x === cell.x && unit.y === cell.y,
  );
  if (!fromBoard && !occupant && self.board.length >= self.level) return false;
  return true;
}

function updateDropTarget(x: number, y: number): void {
  if (!drag) return;
  const self = room?.self;
  const overBench = drag.source === 'board' && !benchBar.classList.contains('hidden') && pointInRect(benchBar, x, y);
  drag.overBench = overBench;
  benchBar.classList.remove('drop-valid', 'drop-invalid');

  if (overBench) {
    drag.benchValid = Boolean(self && self.bench.length < BENCH_SIZE);
    drag.cell = null;
    drag.cellValid = false;
    benchBar.classList.add(drag.benchValid ? 'drop-valid' : 'drop-invalid');
    scene.setDropHighlight(null, false);
    return;
  }

  const cell = scene.pickCellAt(x, y);
  drag.cell = cell;
  drag.cellValid = cell ? canDropOnCell(cell) : false;
  scene.setDropHighlight(cell, drag.cellValid);
}

function cleanupDrag(): { state: DragState; wasActive: boolean } | null {
  if (!drag) return null;
  const state = drag;
  drag = null;
  const wasActive = state.active;
  state.ghost?.remove();
  document.body.classList.remove('dragging-unit');
  benchBar.classList.remove('drop-valid', 'drop-invalid');
  for (const card of benchCards.querySelectorAll('.bench-card.dragging')) card.classList.remove('dragging');
  scene.setDragging(false);
  scene.setDraggedUnit(null);
  scene.setDropHighlight(null, false);
  window.setTimeout(() => {
    suppressBenchClick = false;
  }, 0);
  return { state, wasActive };
}

function finishDrag(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const cell = drag.cell;
  const cellValid = drag.cellValid;
  const overBench = drag.overBench;
  const benchValid = drag.benchValid;
  const uid = drag.uid;
  const result = cleanupDrag();
  if (!result?.wasActive) return;

  if (overBench && benchValid) {
    net.send({ type: 'move_unit', uid, to: { type: 'bench' } });
    selectedUid = null;
    refreshSelection();
  } else if (cell && cellValid) {
    net.send({ type: 'move_unit', uid, to: { type: 'board', x: cell.x, y: cell.y } });
    selectedUid = null;
    refreshSelection();
  } else if (cell) {
    toast('Сюда ставить нельзя.', 'error');
  }
}

function cancelDrag(): void {
  cleanupDrag();
}


function renderGame(): void {
  if (!room || !room.self) return;
  const self = room.self;
  byId('hudLives').textContent = String(self.lives);
  byId('hudGold').textContent = String(self.gold);
  byId('hudLevel').textContent = String(self.level);
  const xpNeeded = Math.max(1, self.xpNeeded);
  byId('hudXpFill').style.width = `${Math.min(100, (self.xp / xpNeeded) * 100)}%`;
  byId('hudRound').textContent = String(room.round);
  byId('hudMaxRounds').textContent = String(room.maxRounds);
  updateClock();
  renderPlayers();
  renderSynergies();
  renderShop();
  renderBench();
  renderSelectedPanel();
  renderBattleResult();
  renderPhaseBanner();

  const canPrepare = self.alive && room.phase === 'prep';
  shopBar.classList.toggle('hidden', !canPrepare);
  benchBar.classList.toggle('hidden', !canPrepare);
  spectatorBanner.classList.toggle(
    'hidden',
    self.alive || room.phase === 'waiting' || room.phase === 'finished',
  );
  selectedPanel.classList.toggle('hidden', !canPrepare || !selectedUid);
  const xpBtn = byId<HTMLButtonElement>('xpBtn');
  const rerollBtn = byId<HTMLButtonElement>('rerollBtn');
  const lockBtn = byId<HTMLButtonElement>('lockBtn');
  xpBtn.disabled = !canPrepare || self.level >= 9 || self.gold < 4;
  rerollBtn.disabled = !canPrepare || self.gold < 2;
  lockBtn.disabled = !canPrepare;
  lockBtn.classList.toggle('active', self.locked);
  byId('lockState').textContent = self.locked ? 'закреплён' : '';
  byId('benchCount').textContent = `${self.bench.length} / 9`;
  const canSurrender = self.alive && room.phase !== 'finished';
  surrenderBtn.disabled = !canSurrender || surrenderPending;
  surrenderBtn.classList.toggle('hidden', !canSurrender);
}

function updateClock(): void {
  if (!room) return;
  const timer = byId('hudTimer');
  const label = byId('hudPhaseLabel');
  const elapsed = (Date.now() - lastRoomAt) / 1000;
  const remaining = Math.max(0, room.timeLeft - elapsed);
  if (room.phase === 'finished') {
    timer.textContent = '—';
    label.textContent = 'завершён';
    return;
  }
  timer.textContent = String(Math.ceil(remaining));
  label.textContent =
    room.phase === 'prep' ? 'подготовка' : room.phase === 'combat' ? 'бой' : room.phase === 'result' ? 'итоги' : 'ожидание';
}

function renderPlayers(): void {
  if (!room) return;
  const sig = `${room.selfId}|${JSON.stringify(room.players)}`;
  if (sig === playersSig) return;
  playersSig = sig;
  playersPanel.innerHTML = room.players
    .map((player) => {
      const classes = ['player-chip'];
      if (player.id === room?.selfId) classes.push('self');
      if (!player.alive) classes.push('dead');
      const place = player.placement ? `#${player.placement} ` : '';
      return `
        <div class="${classes.join(' ')}">
          <div>
            <div class="chip-name">${escapeHtml(player.name)}${player.isBot ? ' · ИИ' : ''}</div>
            <div class="chip-meta">${place}ур. ${player.level}${player.streak !== 0 ? ` · ${player.streak > 0 ? 'побед' : 'пораж.'} ${Math.abs(player.streak)}` : ''}</div>
          </div>
          <div class="chip-lives">${player.lives}</div>
        </div>`;
    })
    .join('');
}

function renderSynergies(): void {
  if (!room?.self) return;
  const list = room.self.synergies;
  const sig = JSON.stringify(list);
  if (sig === synergySig) return;
  synergySig = sig;
  if (list.length === 0) {
    synergyPanel.innerHTML = '<div class="synergy-title">Синергии</div><div class="synergy-item"><div class="synergy-head"><b>Пока пусто</b></div><div class="synergy-desc">Выставьте бойцов на поле, чтобы открыть бонусы рас и классов.</div></div>';
    return;
  }
  synergyPanel.innerHTML = `
    <div class="synergy-title">Синергии</div>
    ${list
      .map((synergy) => {
        const thresholdText = synergy.active
          ? `${synergy.count} / ${synergy.threshold}`
          : synergy.next
            ? `${synergy.count} / ${synergy.next}`
            : `${synergy.count}`;
        const effect = synergy.effects[Math.max(0, synergy.tier - 1)] ?? '';
        return `
          <div class="synergy-item ${synergy.active ? 'active' : ''}">
            <div class="synergy-head"><b>${escapeHtml(synergy.name)}</b><span>${thresholdText}</span></div>
            <div class="synergy-desc">${escapeHtml(effect)}</div>
          </div>`;
      })
      .join('')}`;
}

function unitCardMarkup(
  def: UnitDef,
  star: number,
  attributes: string,
  extraClass = '',
  upgradeReady = false,
): string {
  const mult = STAR_MULTIPLIER[star] ?? 1;
  const glow = `race-${def.race}`;
  return `
    <button class="unit-card cost-${def.cost} ${glow} ${extraClass}" ${attributes} data-def="${def.id}" data-star="${star}">
      ${upgradeReady ? '<span class="upgrade-tag">Триплет</span>' : ''}
      <span class="cost">${def.cost}</span>
      <div class="unit-stars">${star > 1 ? stars(star) : ''}</div>
      <div class="unit-name">${escapeHtml(def.name)}</div>
      <div class="unit-traits">${RACE_NAMES[def.race]} · ${CLASS_NAMES[def.unitClass]}</div>
      <div class="unit-stats">
        <span>HP <b>${formatNumber(def.hp * mult)}</b></span>
        <span>ATK <b>${formatNumber(def.attack * mult)}</b></span>
      </div>
      <div class="unit-ability">${escapeHtml(def.ability.name)}</div>
      <span class="buy-tag">Купить · ${def.cost}</span>
    </button>`;
}

function ownedStarOneCount(self: SelfView, defId: string): number {
  let count = 0;
  for (const unit of self.board) {
    if (unit.defId === defId && unit.star === 1) count++;
  }
  for (const unit of self.bench) {
    if (unit.defId === defId && unit.star === 1) count++;
  }
  return count;
}

function renderShop(): void {
  if (!room?.self) return;
  const self = room.self;
  const owned = [...self.board, ...self.bench]
    .filter((unit) => unit.star === 1)
    .map((unit) => unit.defId)
    .sort()
    .join(',');
  const sig = `${self.shop.join('|')}|${self.gold}|${owned}`;
  if (sig === shopSig) return;
  shopSig = sig;
  shopCards.innerHTML = self.shop
    .map((defId, index) => {
      if (!defId) {
        return '<div class="unit-card empty"><div class="unit-name">Пусто</div><div class="unit-traits">слот продан</div></div>';
      }
      const def = getUnitDef(defId);
      const upgradeReady = ownedStarOneCount(self, defId) >= 2;
      const classes = [self.gold < def.cost ? 'poor' : '', upgradeReady ? 'upgrade-ready' : '']
        .filter(Boolean)
        .join(' ');
      return unitCardMarkup(def, 1, `data-buy="${index}"`, classes, upgradeReady);
    })
    .join('');
}

function renderBench(): void {
  if (!room?.self) return;
  const self = room.self;
  const sig = `${selectedUid}|${self.bench.map((unit) => `${unit.uid}:${unit.defId}:${unit.star}`).join('|')}`;
  if (sig === benchSig) return;
  benchSig = sig;
  const cards: string[] = [];
  for (let i = 0; i < 9; i++) {
    const unit = self.bench[i];
    if (!unit) {
      cards.push('<div class="bench-card empty"></div>');
      continue;
    }
    const def = getUnitDef(unit.defId);
    cards.push(`
      <button class="bench-card race-${def.race} ${selectedUid === unit.uid ? 'selected' : ''}"
        data-bench-uid="${unit.uid}" data-def="${def.id}" data-star="${unit.star}">
        <span class="bench-stars">${unit.star > 1 ? stars(unit.star) : ''}</span>
        <span class="bench-cost">${def.cost}</span>
        <span class="bench-name">${escapeHtml(def.name)}</span>
      </button>`);
  }
  benchCards.innerHTML = cards.join('');
}

function renderSelectedPanel(): void {
  if (!room?.self || room.phase !== 'prep' || !selectedUid) {
    selectedSig = '';
    selectedPanel.classList.add('hidden');
    return;
  }
  const self = room.self;
  const boardUnit = self.board.find((unit) => unit.uid === selectedUid);
  const benchUnit = self.bench.find((unit) => unit.uid === selectedUid);
  const unit = boardUnit ?? benchUnit;
  if (!unit) {
    selectedUid = null;
    selectedSig = '';
    selectedPanel.classList.add('hidden');
    return;
  }
  const sig = `${selectedUid}|${unit.defId}|${unit.star}|${boardUnit ? 'board' : 'bench'}`;
  if (sig === selectedSig) {
    selectedPanel.classList.remove('hidden');
    return;
  }
  selectedSig = sig;
  const def = getUnitDef(unit.defId);
  const mult = STAR_MULTIPLIER[unit.star] ?? 1;
  const refund = def.cost * Math.pow(3, unit.star - 1);
  selectedPanel.classList.remove('hidden');
  selectedPanel.innerHTML = `
    <h3>${escapeHtml(def.name)}</h3>
    <div class="selected-meta">${RACE_NAMES[def.race]} · ${CLASS_NAMES[def.unitClass]} · ${stars(unit.star)}</div>
    <div class="selected-stats">
      <span>HP ${formatNumber(def.hp * mult)}</span>
      <span>ATK ${formatNumber(def.attack * mult)}</span>
      <span>ARM ${def.armor}</span>
    </div>
    <div class="selected-ability"><b>${escapeHtml(def.ability.name)}.</b> ${escapeHtml(def.ability.description)}</div>
    <div class="selected-actions">
      ${boardUnit ? '<button class="btn" data-selected-action="bench" type="button">На скамью</button>' : ''}
      <button class="btn" data-selected-action="sell" type="button">Продать +${refund}</button>
    </div>`;
}

function renderBattleResult(): void {
  if (
    !battle?.result ||
    !room ||
    !room.self?.alive ||
    (room.phase !== 'combat' && room.phase !== 'result')
  ) {
    resultSig = '';
    battleResult.classList.add('hidden');
    return;
  }
  const damage = room.self.lastDamage;
  const sig = `${battle.result}|${battle.opponentName}|${room.phase}|${damage}`;
  if (sig === resultSig) return;
  resultSig = sig;
  const word = battle.result === 'win' ? 'Победа' : battle.result === 'loss' ? 'Поражение' : 'Ничья';
  const damageLine =
    battle.result !== 'win' && damage > 0
      ? `<div class="result-damage">−${damage} ${livesWord(damage)}</div>`
      : '';
  battleResult.className = `battle-result ${battle.result}`;
  battleResult.innerHTML = `
    <div class="result-word">${word}</div>
    <div class="result-sub">${escapeHtml(battle.opponentName)}</div>
    ${damageLine}`;
}

function renderPhaseBanner(): void {
  if (!room) return;
  const observing = room.self?.alive === false;
  const lastResult = room.self?.lastResult ?? null;
  const lastDamage = room.self?.lastDamage ?? 0;
  const sig = `${room.phase}|${room.round}|${room.opponentName ?? ''}|${observing}|${lastResult}|${lastDamage}`;
  if (sig === phaseSig) return;
  phaseSig = sig;
  if (observing) {
    phaseBanner.innerHTML = `<div class="banner-main">Наблюдение</div><div class="banner-sub">Раунд ${room.round}</div>`;
  } else if (room.phase === 'prep') {
    const opponent = room.opponentName
      ? ` · соперник: ${escapeHtml(room.opponentName)}`
      : '';
    phaseBanner.innerHTML = `<div class="banner-main">Подготовка</div><div class="banner-sub">Раунд ${room.round}${opponent}</div>`;
  } else if (room.phase === 'combat') {
    phaseBanner.innerHTML = `<div class="banner-main">Бой</div><div class="banner-sub">против ${escapeHtml(room.opponentName ?? 'неизвестного соперника')}</div>`;
  } else if (room.phase === 'result') {
    const resultWord = lastResult === 'win' ? 'победа' : lastResult === 'loss' ? 'поражение' : lastResult === 'draw' ? 'ничья' : '';
    const damageText = lastResult && lastResult !== 'win' && lastDamage > 0 ? ` · −${lastDamage} ${livesWord(lastDamage)}` : '';
    const recap = resultWord ? `<div class="banner-sub">${resultWord}${damageText}</div>` : '';
    phaseBanner.innerHTML = `<div class="banner-main">Итоги раунда</div>${recap}`;
  } else {
    phaseBanner.innerHTML = '';
  }
}

function renderLobby(): void {
  if (!room) return;
  byId('roomName').textContent = room.name;
  byId('roomCode').textContent = room.code;
  byId('lobbyCount').textContent = `${room.players.length} / ${room.settings.maxPlayers}`;
  const me = room.players.find((player) => player.id === room?.selfId);
  const isHost = room.hostId === room.selfId;

  const slots: string[] = [];
  for (let i = 0; i < room.settings.maxPlayers; i++) {
    const player = room.players[i];
    if (!player) {
      slots.push('<div class="player-slot empty"><span>Свободное место</span></div>');
      continue;
    }
    const classes = ['player-slot'];
    if (player.id === room.selfId) classes.push('self');
    if (player.isBot) classes.push('bot');
    const role = player.isBot ? 'Бот' : player.host ? 'Хозяин зала' : 'Игрок';
    slots.push(`
      <div class="${classes.join(' ')}">
        <div class="player-avatar">${escapeHtml(player.name.slice(0, 1).toUpperCase())}</div>
        <div class="player-slot-info">
          <b>${escapeHtml(player.name)}</b>
          <span>${role}${player.id === room.selfId ? ' · вы' : ''}</span>
        </div>
        <span class="ready-pill ${player.ready || player.isBot ? '' : 'not'}">${player.isBot || player.ready ? 'готов' : 'не готов'}</span>
      </div>`);
  }
  lobbyPlayers.innerHTML = slots.join('');

  const settings = room.settings;
  const settingsTiles: [string, string][] = [
    ['Игроки', String(settings.maxPlayers)],
    ['Старт. золото', String(settings.startingGold)],
    ['Старт. уровень', String(settings.startingLevel)],
    ['Жизни', String(settings.startingLives)],
    ['Подготовка', `${settings.prepSeconds} сек`],
    ['Раунды', String(settings.maxRounds)],
    ['Боты', settings.aiFill ? 'добивают' : 'нет'],
    ['Доступ', settings.privateLobby ? 'по коду' : 'публичный'],
  ];
  lobbySettings.innerHTML = settingsTiles
    .map(([label, value]) => `<div class="setting-tile"><span>${label}</span><b>${value}</b></div>`)
    .join('');

  readyBtn.textContent = me?.ready ? 'Не готов' : 'Готов';
  readyBtn.disabled = false;
  startBtn.classList.toggle('hidden', !isHost);
  if (isHost) {
    const unready = room.players.filter((player) => !player.isBot && player.id !== room!.hostId && !player.ready);
    startBtn.disabled = unready.length > 0 || (room.players.length < 2 && !settings.aiFill);
  }
  if (isHost) {
    if (room.players.length < 2 && !settings.aiFill) {
      lobbyHint.textContent = 'Нужен ещё игрок или включите добивание ботами.';
    } else if (room.players.some((player) => !player.isBot && player.id !== room!.hostId && !player.ready)) {
      lobbyHint.textContent = 'Дождитесь готовности всех игроков.';
    } else if (settings.aiFill) {
      lobbyHint.textContent = 'Свободные места займут боты. Можно начинать.';
    } else {
      lobbyHint.textContent = 'Все готовы. Запускайте матч.';
    }
  } else {
    lobbyHint.textContent = me?.ready ? 'Вы готовы. Ждём хозяина зала.' : 'Нажмите «Готов», когда закончите с настройкой.';
  }
}

function renderLobbyList(lobbies: { code: string; name: string; hostName: string; players: number; maxPlayers: number; aiFill: boolean }[]): void {
  if (lobbies.length === 0) {
    lobbyList.innerHTML = '<div class="empty-state">Пока нет открытых лобби.<br />Создайте своё!</div>';
    return;
  }
  lobbyList.innerHTML = lobbies
    .map(
      (lobby) => `
        <div class="lobby-row">
          <div>
            <div class="lobby-code">${escapeHtml(lobby.code)}</div>
            <small>${lobby.players}/${lobby.maxPlayers}${lobby.aiFill ? ' · ИИ' : ''}</small>
          </div>
          <div>
            <div class="lobby-name">${escapeHtml(lobby.name)}</div>
            <small>хозяин: ${escapeHtml(lobby.hostName)}</small>
          </div>
          <button class="btn" data-join="${escapeHtml(lobby.code)}" type="button">Войти</button>
        </div>`,
    )
    .join('');
}

function openCreateModal(): void {
  const name = currentName();
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="createModal">
      <div class="modal">
        <h2>Создать лобби</h2>
        <p class="modal-sub">Настройте правила зала. Код можно отправить друзьям, а свободные места займут боты.</p>
        <form id="createForm">
          <div class="form-grid">
            <label class="form-field full">
              <span>Название зала</span>
              <input name="roomName" maxlength="30" value="${escapeHtml(`${name}: арена`)}" />
            </label>
            <label class="form-field">
              <span>Максимум игроков</span>
              <select name="maxPlayers">
                ${[2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}" ${n === DEFAULT_SETTINGS.maxPlayers ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </label>
            <label class="form-field">
              <span>Стартовое золото</span>
              <input name="startingGold" type="number" min="0" max="20" value="${DEFAULT_SETTINGS.startingGold}" />
            </label>
            <label class="form-field">
              <span>Стартовый уровень</span>
              <select name="startingLevel">
                ${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${n === DEFAULT_SETTINGS.startingLevel ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </label>
            <label class="form-field">
              <span>Жизни</span>
              <input name="startingLives" type="number" min="5" max="60" value="${DEFAULT_SETTINGS.startingLives}" />
            </label>
            <label class="form-field">
              <span>Подготовка, сек</span>
              <input name="prepSeconds" type="number" min="10" max="90" value="${DEFAULT_SETTINGS.prepSeconds}" />
            </label>
            <label class="form-field">
              <span>Максимум раундов</span>
              <input name="maxRounds" type="number" min="5" max="40" value="${DEFAULT_SETTINGS.maxRounds}" />
            </label>
            <div class="check-row full">
              <label class="check-field"><input type="checkbox" name="aiFill" checked /> Добивать свободные места ботами</label>
              <label class="check-field"><input type="checkbox" name="privateLobby" /> Приватное лобби (только по коду)</label>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn" type="button" id="cancelCreate">Отмена</button>
            <button class="btn btn-primary" type="submit">Создать зал</button>
          </div>
        </form>
      </div>
    </div>`;
  byId('cancelCreate').addEventListener('click', closeModal);
  byId('createModal').addEventListener('click', (event) => {
    if ((event.target as HTMLElement).id === 'createModal') closeModal();
  });
  byId<HTMLFormElement>('createForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const settings: Partial<LobbySettings> = {
      maxPlayers: Number(form.get('maxPlayers')),
      startingGold: Number(form.get('startingGold')),
      startingLevel: Number(form.get('startingLevel')),
      startingLives: Number(form.get('startingLives')),
      prepSeconds: Number(form.get('prepSeconds')),
      maxRounds: Number(form.get('maxRounds')),
      aiFill: form.get('aiFill') === 'on',
      privateLobby: form.get('privateLobby') === 'on',
    };
    gameOverShown = false;
    surrenderPending = false;
    net.send({ type: 'create_lobby', name: String(form.get('roomName') ?? 'Арена'), settings });
    closeModal();
  });
}

function openRulesModal(): void {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="rulesModal">
      <div class="modal rules-modal">
        <h2>Правила арены</h2>
        <p class="modal-sub">Короткая памятка по текущему матчу.</p>
        <div class="rules-grid">
          <div class="rule-card">
            <b>Экономика</b>
            <p>Каждый раунд вы получаете базовое золото, проценты с накоплений, бонус за серию и +1 за победу.</p>
          </div>
          <div class="rule-card">
            <b>Магазин</b>
            <p>Пять бойцов. Обновление стоит 2 золота, опыт — 4. Замок сохраняет магазин на следующий раунд.</p>
          </div>
          <div class="rule-card">
            <b>Объединение</b>
            <p>Три одинаковых бойца одного уровня объединяются в бойца следующей звезды. Подсвеченные карточки подскажут триплет.</p>
          </div>
          <div class="rule-card">
            <b>Бой</b>
            <p>Бойцы действуют автоматически. Побеждает отряд, который уничтожит соперника. Ничья ранит обоих.</p>
          </div>
          <div class="rule-card">
            <b>Жизни</b>
            <p>Поражение отнимает жизни. На нуле вы выбываете, но можете наблюдать за матчем до конца.</p>
          </div>
          <div class="rule-card">
            <b>Синергии</b>
            <p>Расы и классы на поле открывают бонусы при достижении порогов. Следите за панелью синергий.</p>
          </div>
          <div class="rule-card">
            <b>Сдача</b>
            <p>Кнопка «Сдаться» сразу завершает ваш матч и фиксирует текущее место. Отменить сдачу нельзя.</p>
          </div>
          <div class="rule-card">
            <b>Победа</b>
            <p>Последний выживший игрок занимает первое место. Общий пул бойцов не даёт собрать всё одним игрокам.</p>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="closeRules" type="button">Понятно</button>
        </div>
      </div>
    </div>`;
  byId('closeRules').addEventListener('click', closeModal);
  byId('rulesModal').addEventListener('click', (event) => {
    if ((event.target as HTMLElement).id === 'rulesModal') closeModal();
  });
}

function openSurrenderModal(): void {
  if (!room?.self?.alive || room.phase === 'finished') return;
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="surrenderModal">
      <div class="modal confirm-modal">
        <h2>Сдаться?</h2>
        <p class="modal-sub">Вы сразу выбудете из матча. Текущее место будет зафиксировано, вернуться в этот бой нельзя.</p>
        <div class="modal-actions">
          <button class="btn" id="cancelSurrender" type="button">Остаться</button>
          <button class="btn btn-danger" id="confirmSurrender" type="button">Сдаться</button>
        </div>
      </div>
    </div>`;
  byId('cancelSurrender').addEventListener('click', closeModal);
  byId('confirmSurrender').addEventListener('click', () => {
    closeModal();
    surrenderPending = true;
    surrenderBtn.disabled = true;
    net.send({ type: 'surrender' });
  });
  byId('surrenderModal').addEventListener('click', (event) => {
    if ((event.target as HTMLElement).id === 'surrenderModal') closeModal();
  });
}

function closeModal(): void {
  modalRoot.innerHTML = '';
}

function showGameOver(
  placement: number,
  totalPlayers: number,
  victory: boolean,
  reason?: 'surrender',
): void {
  if (gameOverShown) return;
  gameOverShown = true;
  if (reason === 'surrender') {
    gameOverTitle.textContent = 'Вы сдались';
    gameOverText.textContent = `Матч завершён для вас. Итоговое место — ${placement} из ${totalPlayers}.`;
  } else {
    gameOverTitle.textContent = victory ? 'Арена ваша' : 'Матч завершён';
    gameOverText.textContent = victory
      ? `Первое место из ${totalPlayers}. Отряд выстоял, синергии сработали, арена покорена.`
      : `Вы заняли ${placement} место из ${totalPlayers}. Соберите новый отряд и попробуйте снова.`;
  }
  gameOverEmblem.style.opacity = victory ? '1' : '0.55';
  gameOver.classList.remove('hidden');
}

function showTooltip(defId: string, star: number, x: number, y: number): void {
  const def = getUnitDef(defId);
  const mult = STAR_MULTIPLIER[star] ?? 1;
  tooltip.innerHTML = `
    <div class="tip-name">${escapeHtml(def.name)} ${star > 1 ? stars(star) : ''}</div>
    <div class="tip-meta">${RACE_NAMES[def.race]} · ${CLASS_NAMES[def.unitClass]} · ${def.cost} золота</div>
    <div class="tip-stats">
      <span>HP ${formatNumber(def.hp * mult)}</span>
      <span>ATK ${formatNumber(def.attack * mult)}</span>
      <span>ARM ${def.armor}</span>
      <span>MANA ${def.maxMana}</span>
    </div>
    <div class="tip-ability"><b>${escapeHtml(def.ability.name)}.</b> ${escapeHtml(def.ability.description)}</div>
    <div class="tip-flavor">${escapeHtml(def.flavor)}</div>`;
  tooltip.classList.remove('hidden');
  positionTooltip(x, y);
}

function positionTooltip(x: number, y: number): void {
  const width = 260;
  const height = 190;
  let left = x + 16;
  let top = y + 16;
  if (left + width > window.innerWidth - 10) left = x - width - 16;
  if (top + height > window.innerHeight - 10) top = y - height - 16;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function hideTooltip(): void {
  tooltip.classList.add('hidden');
  lastTooltipDef = null;
}

// ---------- Drag & drop ----------

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (!room || room.phase !== 'prep' || !room.self?.alive) return;
  const uid = scene.pickUnitAt(event.clientX, event.clientY);
  if (!uid || !room.self.board.some((unit) => unit.uid === uid)) return;
  beginDrag(uid, 'board', event);
});

benchCards.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (!room || room.phase !== 'prep' || !room.self?.alive) return;
  const target = (event.target as HTMLElement).closest('[data-bench-uid]') as HTMLElement | null;
  if (!target?.dataset.benchUid) return;
  beginDrag(target.dataset.benchUid, 'bench', event);
});

document.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.active) {
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
    activateDrag();
  }
  event.preventDefault();
  updateGhostPosition(event.clientX, event.clientY);
  updateDropTarget(event.clientX, event.clientY);
});

document.addEventListener('pointerup', finishDrag);
document.addEventListener('pointercancel', () => cancelDrag());
window.addEventListener('blur', () => cancelDrag());

// ---------- UI events ----------

playerNameInput.addEventListener('change', () => {
  const name = currentName();
  net.send({ type: 'set_name', name });
});

byId('quickPlay').addEventListener('click', () => {
  if (!requireOnline()) return;
  syncName();
  gameOverShown = false;
  surrenderPending = false;
  net.send({ type: 'quick_play' });
});

byId('openCreate').addEventListener('click', () => {
  if (!requireOnline()) return;
  syncName();
  openCreateModal();
});

byId('joinBtn').addEventListener('click', () => {
  if (!requireOnline()) return;
  syncName();
  const code = codeInput.value.trim().toUpperCase();
  if (code.length < 4) {
    toast('Введите код лобби.', 'error');
    return;
  }
  net.send({ type: 'join_lobby', code });
});

codeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') byId<HTMLButtonElement>('joinBtn').click();
});

codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
});

byId('refreshLobbies').addEventListener('click', () => net.send({ type: 'list_lobbies' }));

lobbyList.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('[data-join]') as HTMLElement | null;
  if (!target) return;
  syncName();
  net.send({ type: 'join_lobby', code: target.dataset.join ?? '' });
});

byId('copyCode').addEventListener('click', async () => {
  if (!room) return;
  try {
    await navigator.clipboard.writeText(room.code);
    toast('Код скопирован.', 'success');
  } catch {
    toast(`Код: ${room.code}`);
  }
});

readyBtn.addEventListener('click', () => {
  const me = room?.players.find((player) => player.id === room?.selfId);
  net.send({ type: 'ready', ready: !me?.ready });
});

startBtn.addEventListener('click', () => {
  net.send({ type: 'start_game' });
});

for (const id of ['leaveLobbyTop']) {
  byId(id).addEventListener('click', () => {
    net.send({ type: 'leave_lobby' });
    resetToMenu();
  });
}

byId('backToMenu').addEventListener('click', () => {
  net.send({ type: 'leave_lobby' });
  resetToMenu();
});

byId('spectatorLeave').addEventListener('click', () => {
  net.send({ type: 'leave_lobby' });
  resetToMenu();
});

rulesBtn.addEventListener('click', openRulesModal);
surrenderBtn.addEventListener('click', openSurrenderModal);

byId('xpBtn').addEventListener('click', () => net.send({ type: 'buy_xp' }));
byId('rerollBtn').addEventListener('click', () => net.send({ type: 'reroll' }));
byId('lockBtn').addEventListener('click', () => net.send({ type: 'toggle_lock' }));

shopCards.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('[data-buy]') as HTMLElement | null;
  if (!target) return;
  net.send({ type: 'buy_unit', index: Number(target.dataset.buy) });
  hideTooltip();
});

benchCards.addEventListener('click', (event) => {
  if (suppressBenchClick) {
    suppressBenchClick = false;
    return;
  }
  const target = (event.target as HTMLElement).closest('[data-bench-uid]') as HTMLElement | null;
  if (!target) return;
  const uid = target.dataset.benchUid ?? null;
  selectedUid = selectedUid === uid ? null : uid;
  refreshSelection();
});

selectedPanel.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('[data-selected-action]') as HTMLElement | null;
  if (!target || !selectedUid) return;
  const action = target.dataset.selectedAction;
  if (action === 'bench') {
    net.send({ type: 'move_unit', uid: selectedUid, to: { type: 'bench' } });
    selectedUid = null;
    refreshSelection();
  } else if (action === 'sell') {
    net.send({ type: 'sell_unit', uid: selectedUid });
    selectedUid = null;
    refreshSelection();
  }
});

document.addEventListener('pointerover', (event) => {
  const target = (event.target as HTMLElement).closest('[data-def]') as HTMLElement | null;
  if (!target || !target.dataset.def) return;
  const star = Number(target.dataset.star ?? 1);
  lastTooltipDef = target.dataset.def;
  const rect = target.getBoundingClientRect();
  showTooltip(target.dataset.def, star, rect.left + rect.width / 2, rect.top);
});

document.addEventListener('pointerout', (event) => {
  const target = (event.target as HTMLElement).closest('[data-def]') as HTMLElement | null;
  if (target && lastTooltipDef) hideTooltip();
});

document.addEventListener('pointermove', (event) => {
  if (!tooltip.classList.contains('hidden')) positionTooltip(event.clientX, event.clientY);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (drag) cancelDrag();
    else if (modalRoot.innerHTML) closeModal();
    else if (selectedUid) {
      selectedUid = null;
      refreshSelection();
    }
  }
});

window.setInterval(updateClock, 200);

if (storedName) {
  playerNameInput.value = storedName;
}
const initialName = currentName();
net.connect(initialName);
