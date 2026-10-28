import {
  applySynergiesToUnit,
  createTeamBonuses,
  getUnitDef,
  type TeamBonuses,
} from '../shared/content';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  STAR_MULTIPLIER,
  type AbilityDef,
  type BattleEffectView,
  type BattleSnapshot,
  type BattleUnitView,
  type UnitView,
} from '../shared/types';

/** Seconds a unit spends crossing one board cell. */
const CELL_STEP_TIME = 0.4;
/** Duration of the opening assassin leap. */
const ASSASSIN_JUMP_TIME = 0.7;
const CELL_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

interface BattleSideInput {
  ownerId: string;
  name: string;
  units: UnitView[];
}

interface SimUnit {
  uid: string;
  ownerId: string;
  defId: string;
  star: number;
  team: 0 | 1;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  armor: number;
  attackSpeed: number;
  baseAttackSpeed: number;
  range: number;
  mana: number;
  maxMana: number;
  spellPower: number;
  lifesteal: number;
  dodge: number;
  damageMult: number;
  shield: number;
  attackTimer: number;
  moveTimer: number;
  stunTimer: number;
  buffTimer: number;
  buffSpeed: number;
  alive: boolean;
  /** Enemy this assassin jumped onto at the start of the round. */
  huntTargetUid: string | null;
  jumpTimer: number;
  jumpDuration: number;
  jumpFromX: number;
  jumpFromY: number;
}

interface RawEffect extends BattleEffectView {
  time: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function armorMultiplier(armor: number): number {
  return 1 - Math.max(0, armor) / (Math.max(0, armor) + 25);
}

export class Battle {
  round: number;
  time = 0;
  maxTime = 45;
  units: SimUnit[] = [];
  result: 'left' | 'right' | 'draw' | null = null;
  leftOwnerId: string;
  rightOwnerId: string;
  leftName: string;
  rightName: string;
  private effects: RawEffect[] = [];
  private nextEffectId = 1;
  private rng: () => number;
  private lastDamageAt = new Map<string, number>();

  constructor(round: number, left: BattleSideInput, right: BattleSideInput, seed?: number) {
    this.round = round;
    this.leftOwnerId = left.ownerId;
    this.rightOwnerId = right.ownerId;
    this.leftName = left.name;
    this.rightName = right.name;
    this.rng = mulberry32(seed ?? ((round * 7919 + left.units.length * 131 + right.units.length * 71) >>> 0));

    const leftBonuses = this.computeBonusForTeam(left.units);
    const rightBonuses = this.computeBonusForTeam(right.units);
    const leftDebuff = leftBonuses.enemyArmorReduction;
    const rightDebuff = rightBonuses.enemyArmorReduction;

    for (const unit of left.units) {
      this.units.push(this.makeUnit(unit, 0, left.ownerId, left.units, rightDebuff));
    }
    for (const unit of right.units) {
      this.units.push(this.makeUnit(unit, 1, right.ownerId, right.units, leftDebuff));
    }
    this.assignAssassinJumps();
    this.checkEnd();
  }

  private computeBonusForTeam(units: UnitView[]): TeamBonuses {
    if (units.length === 0) return createTeamBonuses();
    const def = getUnitDef(units[0].defId);
    return applySynergiesToUnit(createTeamBonuses(), def.race, def.unitClass, units);
  }

  private makeUnit(unit: UnitView, team: 0 | 1, ownerId: string, teamUnits: UnitView[], enemyArmorDebuff: number): SimUnit {
    const def = getUnitDef(unit.defId);
    const starMult = STAR_MULTIPLIER[unit.star] ?? 1;
    const bonus = applySynergiesToUnit(createTeamBonuses(), def.race, def.unitClass, teamUnits);
    const maxHp = Math.round(def.hp * starMult * bonus.hpMult);
    const x = team === 0 ? unit.x : 7 - unit.x;
    const y = team === 0 ? unit.y : 7 - unit.y;
    return {
      uid: unit.uid,
      ownerId,
      defId: unit.defId,
      star: unit.star,
      team,
      name: def.name,
      x,
      y,
      hp: maxHp,
      maxHp,
      attack: def.attack * starMult,
      armor: Math.max(0, def.armor + bonus.armorAdd - enemyArmorDebuff),
      attackSpeed: def.attackSpeed * bonus.attackSpeedMult,
      baseAttackSpeed: def.attackSpeed * bonus.attackSpeedMult,
      range: def.range,
      mana: def.maxMana * 0.15,
      maxMana: def.maxMana,
      spellPower: bonus.spellPower,
      lifesteal: bonus.lifesteal,
      dodge: bonus.dodge,
      damageMult: bonus.damageMult,
      shield: 0,
      attackTimer: 0.2 + this.rng() * 0.25,
      moveTimer: 0.05 + this.rng() * 0.2,
      stunTimer: 0,
      buffTimer: 0,
      buffSpeed: 0,
      alive: true,
      huntTargetUid: null,
      jumpTimer: 0,
      jumpDuration: 0,
      jumpFromX: x,
      jumpFromY: y,
    };
  }

  step(dt: number): void {
    if (this.result) return;
    this.time += dt;
    for (const unit of this.units) {
      if (!unit.alive) continue;
      this.updateTimers(unit, dt);
      if (unit.stunTimer > 0 || unit.jumpTimer > 0) continue;
      const target = this.targetFor(unit);
      if (!target) continue;
      if (this.inAttackRange(unit, target)) {
        if (unit.attackTimer <= 0) {
          this.attack(unit, target);
          unit.attackTimer = 1 / Math.max(0.2, this.currentAttackSpeed(unit));
        }
      } else {
        this.advanceToward(unit, target, dt);
      }
      if (unit.alive && unit.mana >= unit.maxMana && this.nearestEnemy(unit)) {
        this.castAbility(unit);
      }
    }
    this.cleanupEffects();
    this.checkEnd();
    if (this.time >= this.maxTime && !this.result) {
      this.resolveByHealth();
    }
  }

  private currentAttackSpeed(unit: SimUnit): number {
    return unit.baseAttackSpeed * (unit.buffTimer > 0 ? 1 + unit.buffSpeed : 1);
  }

  private updateTimers(unit: SimUnit, dt: number): void {
    unit.attackTimer = Math.max(0, unit.attackTimer - dt);
    unit.stunTimer = Math.max(0, unit.stunTimer - dt);
    const wasJumping = unit.jumpTimer > 0;
    unit.jumpTimer = Math.max(0, unit.jumpTimer - dt);
    if (wasJumping && unit.jumpTimer === 0) {
      // The leap only decides where the assassin lands. After landing it fights
      // nearby enemies instead of chasing the original target across the board.
      unit.huntTargetUid = null;
    }
    if (unit.buffTimer > 0) unit.buffTimer = Math.max(0, unit.buffTimer - dt);
  }

  private nearestEnemy(unit: SimUnit): SimUnit | null {
    let best: SimUnit | null = null;
    let bestDist = Infinity;
    for (const other of this.units) {
      if (!other.alive || other.team === unit.team) continue;
      const dist = this.cellDistance(unit, other);
      if (dist < bestDist) {
        best = other;
        bestDist = dist;
      }
    }
    return best;
  }

  private targetFor(unit: SimUnit): SimUnit | null {
    if (unit.huntTargetUid) {
      const hunted = this.units.find(
        (other) => other.uid === unit.huntTargetUid && other.alive && other.team !== unit.team,
      );
      if (hunted) return hunted;
      unit.huntTargetUid = null;
    }
    return this.nearestEnemy(unit);
  }

  private cellDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  private inAttackRange(unit: SimUnit, target: SimUnit): boolean {
    return this.cellDistance(unit, target) <= unit.range;
  }

  private cellInAttackRange(x: number, y: number, target: SimUnit, range: number): boolean {
    return Math.max(Math.abs(x - target.x), Math.abs(y - target.y)) <= range;
  }

  private unitAt(x: number, y: number, ignore?: SimUnit): SimUnit | undefined {
    return this.units.find((other) => other.alive && other !== ignore && other.x === x && other.y === y);
  }

  private advanceToward(unit: SimUnit, target: SimUnit, dt: number): void {
    unit.moveTimer = Math.max(0, unit.moveTimer - dt);
    if (unit.moveTimer > 0) return;
    const next = this.nextStep(unit, target);
    if (!next) {
      unit.moveTimer = 0.15;
      return;
    }
    unit.x = next.x;
    unit.y = next.y;
    unit.moveTimer = CELL_STEP_TIME;
  }

  private nextStep(unit: SimUnit, target: SimUnit): { x: number; y: number } | null {
    const startKey = this.cellKey(unit.x, unit.y);
    const start = { x: unit.x, y: unit.y };
    const frontier: { x: number; y: number }[] = [start];
    const cameFrom = new Map<number, number>([[startKey, -1]]);
    let goalKey = -1;

    for (let head = 0; head < frontier.length && goalKey < 0; head++) {
      const current = frontier[head];
      for (const dir of CELL_DIRECTIONS) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;
        if (nx < 0 || ny < 0 || nx >= BOARD_WIDTH || ny >= BOARD_HEIGHT) continue;
        if (this.unitAt(nx, ny, unit)) continue;
        if (dir.x !== 0 && dir.y !== 0) {
          // Do not slip diagonally between two occupied cells.
          if (this.unitAt(current.x + dir.x, current.y, unit) || this.unitAt(current.x, current.y + dir.y, unit)) {
            continue;
          }
        }
        const key = this.cellKey(nx, ny);
        if (cameFrom.has(key)) continue;
        cameFrom.set(key, this.cellKey(current.x, current.y));
        if (this.cellInAttackRange(nx, ny, target, unit.range)) {
          goalKey = key;
          break;
        }
        frontier.push({ x: nx, y: ny });
      }
    }

    if (goalKey < 0) return null;
    let stepKey = goalKey;
    while (cameFrom.get(stepKey) !== startKey) {
      const parent = cameFrom.get(stepKey);
      if (parent === undefined) return null;
      stepKey = parent;
    }
    return { x: stepKey % BOARD_WIDTH, y: Math.floor(stepKey / BOARD_WIDTH) };
  }

  private cellKey(x: number, y: number): number {
    return y * BOARD_WIDTH + x;
  }

  private assignAssassinJumps(): void {
    const assassins = this.units.filter(
      (unit) => unit.alive && getUnitDef(unit.defId).unitClass === 'assassin',
    );
    for (const assassin of assassins) {
      const enemies = this.units
        .filter((unit) => unit.alive && unit.team !== assassin.team)
        .sort((a, b) => this.cellDistance(b, assassin) - this.cellDistance(a, assassin));
      for (const target of enemies) {
        const cell = this.findJumpCell(assassin, target);
        if (!cell) continue;
        const fromX = assassin.x;
        const fromY = assassin.y;
        assassin.x = cell.x;
        assassin.y = cell.y;
        assassin.huntTargetUid = target.uid;
        assassin.jumpTimer = ASSASSIN_JUMP_TIME;
        assassin.jumpDuration = ASSASSIN_JUMP_TIME;
        assassin.jumpFromX = fromX;
        assassin.jumpFromY = fromY;
        assassin.attackTimer = Math.max(assassin.attackTimer, ASSASSIN_JUMP_TIME);
        assassin.moveTimer = Math.max(assassin.moveTimer, ASSASSIN_JUMP_TIME);
        this.addEffect('jump', cell.x, cell.y, assassin.team, undefined, fromX, fromY, {
          sourceUid: assassin.uid,
          sourceDef: assassin.defId,
        });
        break;
      }
    }
  }

  private findJumpCell(assassin: SimUnit, target: SimUnit): { x: number; y: number } | null {
    const free: { x: number; y: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = target.x + dx;
        const y = target.y + dy;
        if (x < 0 || y < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) continue;
        if (this.unitAt(x, y, assassin)) continue;
        free.push({ x, y });
      }
    }
    if (free.length === 0) return null;
    // Prefer a real jump over standing on the cell the assassin already occupies.
    const awayFromStart = free.filter((cell) => cell.x !== assassin.x || cell.y !== assassin.y);
    const pool = awayFromStart.length > 0 ? awayFromStart : free;
    pool.sort(
      (a, b) =>
        Math.abs(b.x - assassin.x) + Math.abs(b.y - assassin.y) -
        (Math.abs(a.x - assassin.x) + Math.abs(a.y - assassin.y)),
    );
    return pool[0];
  }

  private enemiesOf(unit: SimUnit): SimUnit[] {
    return this.units.filter((u) => u.alive && u.team !== unit.team);
  }

  private alliesOf(unit: SimUnit): SimUnit[] {
    return this.units.filter((u) => u.alive && u.team === unit.team);
  }

  private attack(attacker: SimUnit, target: SimUnit): void {
    if (!target.alive) return;
    if (this.rng() < target.dodge) {
      this.addEffect('miss', target.x, target.y, attacker.team, undefined, attacker.x, attacker.y, {
        sourceUid: attacker.uid,
        sourceDef: attacker.defId,
      });
      attacker.mana = Math.min(attacker.maxMana, attacker.mana + 10);
      return;
    }
    const raw = attacker.attack * attacker.damageMult;
    const damage = Math.max(1, raw * armorMultiplier(target.armor));
    this.dealDamage(attacker, target, damage, false);
    attacker.mana = Math.min(attacker.maxMana, attacker.mana + 10);
    if (attacker.lifesteal > 0) {
      this.heal(attacker, damage * attacker.lifesteal);
    }
  }

  private dealDamage(source: SimUnit, target: SimUnit, amount: number, ability: boolean): number {
    if (!target.alive) return 0;
    let remaining = amount;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, remaining);
      target.shield -= absorbed;
      remaining -= absorbed;
      if (absorbed > 0) this.addEffect('shield', target.x, target.y, target.team, Math.round(absorbed));
    }
    if (remaining <= 0) {
      this.addEffect('hit', target.x, target.y, source.team, 0, source.x, source.y, {
        sourceUid: source.uid,
        sourceDef: source.defId,
      });
      return 0;
    }
    target.hp -= remaining;
    if (!ability) {
      target.mana = Math.min(target.maxMana, target.mana + Math.min(18, remaining * 0.06));
    } else {
      target.mana = Math.min(target.maxMana, target.mana + Math.min(10, remaining * 0.02));
    }
    this.addEffect('hit', target.x, target.y, source.team, Math.round(remaining), source.x, source.y, {
      sourceUid: source.uid,
      sourceDef: source.defId,
    });
    this.lastDamageAt.set(target.uid, this.time);
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      this.addEffect('death', target.x, target.y, target.team);
    }
    return remaining;
  }

  private heal(target: SimUnit, amount: number): void {
    if (!target.alive || amount <= 0) return;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = target.hp - before;
    if (healed > 1) this.addEffect('heal', target.x, target.y, target.team, Math.round(healed));
  }

  private castAbility(unit: SimUnit): void {
    const def = getUnitDef(unit.defId);
    const ability = def.ability;
    const starMult = STAR_MULTIPLIER[unit.star] ?? 1;
    const power = ability.power * starMult * unit.spellPower;
    const target = this.targetFor(unit);
    if (!target) return;
    unit.mana = 0;
    this.addEffect('cast', unit.x, unit.y, unit.team, undefined, undefined, undefined, {
      sourceUid: unit.uid,
      sourceDef: unit.defId,
      ability: ability.kind,
      radius: ability.radius,
      targets: this.collectAbilityTargets(unit, ability, target),
    });

    switch (ability.kind) {
      case 'nuke': {
        this.dealDamage(unit, target, power, true);
        break;
      }
      case 'aoe': {
        const victims = this.aoeVictims(unit, target, ability);
        for (const enemy of victims) {
          this.dealDamage(unit, enemy, power, true);
          if (ability.duration && enemy.alive) {
            enemy.stunTimer = Math.max(enemy.stunTimer, ability.duration);
          }
        }
        break;
      }
      case 'heal': {
        const healAmount = power;
        const recipients = this.healRecipients(unit, ability);
        for (const ally of recipients) this.heal(ally, healAmount);
        break;
      }
      case 'shield': {
        const shieldAmount = def.id === 'starweaver' ? (ability.secondary ?? 0) * starMult * unit.spellPower : power;
        const recipients = this.shieldRecipients(unit, ability);
        for (const ally of recipients) {
          ally.shield += shieldAmount;
          this.addEffect('shield', ally.x, ally.y, unit.team, Math.round(shieldAmount));
        }
        if (def.id === 'starweaver') this.dealDamage(unit, target, power, true);
        break;
      }
      case 'stun': {
        this.dealDamage(unit, target, power, true);
        if (target.alive) target.stunTimer = Math.max(target.stunTimer, ability.duration ?? 1);
        break;
      }
      case 'buff': {
        for (const ally of this.alliesOf(unit)) {
          ally.buffTimer = Math.max(ally.buffTimer, ability.duration ?? 4);
          ally.buffSpeed = Math.max(ally.buffSpeed, (ability.power ?? 30) / 100);
        }
        break;
      }
      case 'chain': {
        const victims = this.chainVictims(unit, target, ability);
        for (const enemy of victims) this.dealDamage(unit, enemy, power, true);
        break;
      }
      case 'drain': {
        const dealt = this.dealDamage(unit, target, power, true);
        this.heal(unit, dealt);
        break;
      }
    }
  }

  private aoeVictims(unit: SimUnit, target: SimUnit, ability: AbilityDef): SimUnit[] {
    const radius = ability.radius ?? 1.5;
    return this.enemiesOf(unit).filter((enemy) => Math.hypot(enemy.x - target.x, enemy.y - target.y) <= radius);
  }

  private healRecipients(unit: SimUnit, ability: AbilityDef): SimUnit[] {
    if (ability.secondary === 99) return this.alliesOf(unit);
    if (ability.secondary === 1) return [unit];
    return [this.lowestAlly(unit)];
  }

  private shieldRecipients(unit: SimUnit, ability: AbilityDef): SimUnit[] {
    const count = (ability.secondary ?? 1) >= 99 ? 99 : Math.max(1, Math.floor(ability.secondary ?? 1));
    return this.alliesOf(unit)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)
      .slice(0, count);
  }

  private chainVictims(unit: SimUnit, target: SimUnit, ability: AbilityDef): SimUnit[] {
    const count = Math.max(1, Math.floor(ability.secondary ?? 3));
    return this.enemiesOf(unit)
      .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
      .slice(0, count);
  }

  private collectAbilityTargets(unit: SimUnit, ability: AbilityDef, target: SimUnit): { x: number; y: number }[] {
    let targets: SimUnit[] = [];
    switch (ability.kind) {
      case 'nuke':
      case 'stun':
      case 'drain':
        targets = [target];
        break;
      case 'aoe':
        targets = this.aoeVictims(unit, target, ability);
        break;
      case 'heal':
        targets = this.healRecipients(unit, ability);
        break;
      case 'shield':
        targets = [...this.shieldRecipients(unit, ability), ...(unit.defId === 'starweaver' ? [target] : [])];
        break;
      case 'buff':
        targets = this.alliesOf(unit);
        break;
      case 'chain':
        targets = this.chainVictims(unit, target, ability);
        break;
    }
    return targets.map((entry) => ({ x: entry.x, y: entry.y }));
  }

  private lowestAlly(unit: SimUnit): SimUnit {
    const allies = this.alliesOf(unit);
    return allies.reduce((best, current) => (current.hp / current.maxHp < best.hp / best.maxHp ? current : best), unit);
  }

  private addEffect(
    kind: BattleEffectView['kind'],
    x: number,
    y: number,
    team: 0 | 1,
    value?: number,
    sx?: number,
    sy?: number,
    extra?: Pick<BattleEffectView, 'sourceUid' | 'sourceDef' | 'ability' | 'radius' | 'targets'>,
  ): void {
    this.effects.push({
      id: `fx-${this.nextEffectId++}`,
      kind,
      x,
      y,
      team,
      value,
      sx,
      sy,
      ...extra,
      time: this.time,
    });
  }

  private cleanupEffects(): void {
    this.effects = this.effects.filter((effect) => this.time - effect.time < 1.2);
  }

  private checkEnd(): void {
    if (this.result) return;
    const leftAlive = this.units.some((u) => u.alive && u.team === 0);
    const rightAlive = this.units.some((u) => u.alive && u.team === 1);
    if (!leftAlive && !rightAlive) this.result = 'draw';
    else if (!leftAlive) this.result = 'right';
    else if (!rightAlive) this.result = 'left';
  }

  private resolveByHealth(): void {
    const left = this.units.filter((u) => u.team === 0);
    const right = this.units.filter((u) => u.team === 1);
    const leftPct = left.reduce((sum, u) => sum + (u.alive ? u.hp / u.maxHp : 0), 0) / Math.max(1, left.length);
    const rightPct = right.reduce((sum, u) => sum + (u.alive ? u.hp / u.maxHp : 0), 0) / Math.max(1, right.length);
    if (Math.abs(leftPct - rightPct) < 0.04) this.result = 'draw';
    else this.result = leftPct > rightPct ? 'left' : 'right';
  }

  survivors(team: 0 | 1): SimUnit[] {
    return this.units.filter((u) => u.alive && u.team === team);
  }

  snapshot(perspective: 0 | 1, opponentName: string): BattleSnapshot {
    const rotate = perspective === 1;
    const units: BattleUnitView[] = this.units.map((u) => {
      const target = this.targetFor(u);
      const facing = target
        ? Math.atan2(target.x - u.x, target.y - u.y)
        : u.team === 0
          ? Math.PI
          : 0;
      return {
        uid: u.uid,
        defId: u.defId,
        star: u.star,
        team: (rotate ? 1 - u.team : u.team) as 0 | 1,
        x: rotate ? 7 - u.x : u.x,
        y: rotate ? 7 - u.y : u.y,
        facing: rotate ? facing + Math.PI : facing,
        jump:
          u.jumpTimer > 0
            ? {
                fromX: rotate ? 7 - u.jumpFromX : u.jumpFromX,
                fromY: rotate ? 7 - u.jumpFromY : u.jumpFromY,
                remaining: u.jumpTimer,
                duration: u.jumpDuration,
              }
            : undefined,
        hp: Math.max(0, Math.round(u.hp)),
        maxHp: u.maxHp,
        mana: Math.round(u.mana),
        maxMana: u.maxMana,
        shield: Math.round(u.shield),
        alive: u.alive,
      };
    });
    const effects: BattleEffectView[] = this.effects
      .filter((effect) => this.time - effect.time < 0.45)
      .map((effect) => ({
        id: effect.id,
        kind: effect.kind,
        x: rotate ? 7 - effect.x : effect.x,
        y: rotate ? 7 - effect.y : effect.y,
        team: (rotate ? 1 - effect.team : effect.team) as 0 | 1,
        value: effect.value,
        sx: effect.sx === undefined ? undefined : rotate ? 7 - effect.sx : effect.sx,
        sy: effect.sy === undefined ? undefined : rotate ? 7 - effect.sy : effect.sy,
        sourceUid: effect.sourceUid,
        sourceDef: effect.sourceDef,
        ability: effect.ability,
        radius: effect.radius,
        targets: effect.targets?.map((entry) => ({
          x: rotate ? 7 - entry.x : entry.x,
          y: rotate ? 7 - entry.y : entry.y,
        })),
      }));
    let result: BattleSnapshot['result'];
    if (this.result === 'draw') result = 'draw';
    else if (this.result === 'left') result = perspective === 0 ? 'win' : 'loss';
    else if (this.result === 'right') result = perspective === 1 ? 'win' : 'loss';
    return {
      round: this.round,
      time: this.time,
      units,
      effects,
      opponentName,
      result,
    };
  }
}
