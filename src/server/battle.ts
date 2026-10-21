import {
  applySynergiesToUnit,
  createTeamBonuses,
  getUnitDef,
  type TeamBonuses,
} from '../shared/content';
import {
  STAR_MULTIPLIER,
  type BattleEffectView,
  type BattleSnapshot,
  type BattleUnitView,
  type UnitView,
} from '../shared/types';

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
  stunTimer: number;
  buffTimer: number;
  buffSpeed: number;
  alive: boolean;
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
      stunTimer: 0,
      buffTimer: 0,
      buffSpeed: 0,
      alive: true,
    };
  }

  step(dt: number): void {
    if (this.result) return;
    this.time += dt;
    for (const unit of this.units) {
      if (!unit.alive) continue;
      this.updateTimers(unit, dt);
      if (unit.stunTimer > 0) continue;
      const target = this.nearestEnemy(unit);
      if (!target) continue;
      const distance = Math.hypot(target.x - unit.x, target.y - unit.y);
      if (distance <= unit.range + 0.4) {
        if (unit.attackTimer <= 0) {
          this.attack(unit, target);
          unit.attackTimer = 1 / Math.max(0.2, this.currentAttackSpeed(unit));
        }
      } else {
        const speed = 2.25;
        const travel = Math.min(speed * dt, Math.max(0, distance - unit.range * 0.8));
        if (distance > 0.001) {
          unit.x += ((target.x - unit.x) / distance) * travel;
          unit.y += ((target.y - unit.y) / distance) * travel;
        }
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
    if (unit.buffTimer > 0) unit.buffTimer = Math.max(0, unit.buffTimer - dt);
  }

  private nearestEnemy(unit: SimUnit): SimUnit | null {
    let best: SimUnit | null = null;
    let bestDist = Infinity;
    for (const other of this.units) {
      if (!other.alive || other.team === unit.team) continue;
      const dist = Math.hypot(other.x - unit.x, other.y - unit.y);
      if (dist < bestDist) {
        best = other;
        bestDist = dist;
      }
    }
    return best;
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
      this.addEffect('miss', target.x, target.y, attacker.team, undefined, attacker.x, attacker.y);
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
      this.addEffect('hit', target.x, target.y, source.team, 0, source.x, source.y);
      return 0;
    }
    target.hp -= remaining;
    if (!ability) {
      target.mana = Math.min(target.maxMana, target.mana + Math.min(18, remaining * 0.06));
    } else {
      target.mana = Math.min(target.maxMana, target.mana + Math.min(10, remaining * 0.02));
    }
    this.addEffect('hit', target.x, target.y, source.team, Math.round(remaining), source.x, source.y);
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
    const target = this.nearestEnemy(unit);
    if (!target) return;
    unit.mana = 0;
    this.addEffect('cast', unit.x, unit.y, unit.team);

    switch (ability.kind) {
      case 'nuke': {
        this.dealDamage(unit, target, power, true);
        break;
      }
      case 'aoe': {
        const radius = ability.radius ?? 1.5;
        const victims = this.enemiesOf(unit).filter((enemy) => Math.hypot(enemy.x - target.x, enemy.y - target.y) <= radius);
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
        const recipients = ability.secondary === 99 ? this.alliesOf(unit) : ability.secondary === 1 ? [unit] : [this.lowestAlly(unit)];
        for (const ally of recipients) this.heal(ally, healAmount);
        break;
      }
      case 'shield': {
        const shieldAmount = def.id === 'starweaver' ? (ability.secondary ?? 0) * starMult * unit.spellPower : power;
        const count = (ability.secondary ?? 1) >= 99 ? 99 : Math.max(1, Math.floor(ability.secondary ?? 1));
        const recipients = this.alliesOf(unit)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)
          .slice(0, count);
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
        const count = Math.max(1, Math.floor(ability.secondary ?? 3));
        const victims = this.enemiesOf(unit)
          .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
          .slice(0, count);
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
    const units: BattleUnitView[] = this.units.map((u) => ({
      uid: u.uid,
      defId: u.defId,
      star: u.star,
      team: (rotate ? 1 - u.team : u.team) as 0 | 1,
      x: rotate ? 7 - u.x : u.x,
      y: rotate ? 7 - u.y : u.y,
      hp: Math.max(0, Math.round(u.hp)),
      maxHp: u.maxHp,
      mana: Math.round(u.mana),
      maxMana: u.maxMana,
      shield: Math.round(u.shield),
      alive: u.alive,
    }));
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
