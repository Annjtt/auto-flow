import { UNIT_BY_ID, UNITS } from './content';
import type { AbilityDef, AbilityKind, Race, UnitClass, UnitDef } from './types';
import {
  ATTACK_STYLE_BY_ID,
  DEFAULT_UNIT_ANIMATION,
  HOVER_BY_ID,
  authoredPalette,
  defaultAnimationFor,
  type AttackStyle,
  type UnitAnimationTuning,
  type UnitPalette,
} from './unitAppearance';

export type {
  AttackStyle,
  UnitAnimationTuning,
  UnitPalette,
} from './unitAppearance';

const ABILITY_KINDS: AbilityKind[] = ['nuke', 'aoe', 'heal', 'shield', 'stun', 'buff', 'chain', 'drain'];
const RACES: Race[] = ['human', 'undead', 'mech', 'beast', 'demon', 'elf'];
const CLASSES: UnitClass[] = ['warrior', 'mage', 'hunter', 'assassin'];
const ATTACK_STYLES: AttackStyle[] = ['melee', 'ranged', 'magic', 'beast'];

export interface TuningAbility {
  name: string;
  kind: AbilityKind;
  power: number;
  radius: number;
  duration: number;
  secondary: number;
}

export interface TuningStats {
  name: string;
  flavor: string;
  race: Race;
  unitClass: UnitClass;
  cost: number;
  hp: number;
  attack: number;
  armor: number;
  attackSpeed: number;
  range: number;
  maxMana: number;
  ability: TuningAbility;
}

export const TUNING_SHAPES = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane'] as const;
export type TuningShape = (typeof TUNING_SHAPES)[number];

export interface TuningPart {
  visible: boolean;
  /** Position offset added to the part's authored transform. */
  px: number;
  py: number;
  pz: number;
  /** Rotation offset in degrees. */
  rx: number;
  ry: number;
  rz: number;
  /** Multiplier applied on top of the part's authored scale. */
  sx: number;
  sy: number;
  sz: number;
  /** Present only on primitives added in the Unit Lab. */
  shape?: TuningShape;
  /** Base geometry width / diameter. */
  width?: number;
  /** Base geometry height. */
  height?: number;
  /** Base geometry depth / torus thickness. */
  depth?: number;
  /** Diffuse color of an added primitive. */
  color?: string;
  /** Emissive primitive that also feeds the glow layer. */
  glow?: boolean;
}

export interface TuningModel {
  palette: UnitPalette;
  scale: number;
  hover: number;
  /** Degrees. */
  yaw: number;
  parts: Record<string, TuningPart>;
}

export interface TuningAnimation extends UnitAnimationTuning {
  attackStyle: AttackStyle;
}

export interface TuningUnit {
  id: string;
  stats: TuningStats;
  model: TuningModel;
  animation: TuningAnimation;
}

export interface TuningState {
  version: 1;
  savedAt: string;
  units: Record<string, TuningUnit>;
}

export const TUNING_VERSION = 1 as const;

const AUTHORED_BY_ID: Record<string, UnitDef> = Object.fromEntries(
  UNITS.map((def) => [
    def.id,
    {
      ...def,
      ability: { ...def.ability },
    },
  ]),
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function asString(value: unknown, fallback: string, maxLength = 400): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function asColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function formatTuningNumber(value: number): string {
  return Math.round(value).toLocaleString('ru-RU');
}

export function describeTuningAbility(ability: TuningAbility, unitId: string): string {
  const power = formatTuningNumber(ability.power);
  const duration = ability.duration.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const radius = ability.radius.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  switch (ability.kind) {
    case 'nuke':
      return `Наносит ${power} урона цели.`;
    case 'aoe':
      return `Наносит ${power} урона всем врагам в радиусе ${radius} кл.${
        ability.duration > 0 ? ` и оглушает выживших на ${duration} с.` : '.'
      }`;
    case 'heal':
      if (ability.secondary === 1) return `Восстанавливает себе ${power} здоровья.`;
      if (ability.secondary >= 99) return `Лечит всех союзников на ${power} ед.`;
      return `Лечит самого раненого союзника на ${power} ед.`;
    case 'shield':
      if (unitId === 'starweaver') {
        return `Наносит ${power} урона цели и даёт себе щит на ${formatTuningNumber(ability.secondary)} ед.`;
      }
      if (ability.secondary >= 99) return `Даёт всем союзникам щит на ${power} ед.`;
      return `Даёт щит на ${power} ед. ${formatTuningNumber(
        Math.max(1, Math.floor(ability.secondary)),
      )} союзникам с наименьшим HP.`;
    case 'stun':
      return `Наносит ${power} урона и оглушает цель на ${duration} с.`;
    case 'buff':
      return `Даёт всем союзникам +${power}% скорости атаки на ${duration} с.`;
    case 'chain':
      return `Наносит ${power} урона ${formatTuningNumber(
        Math.max(1, Math.floor(ability.secondary)),
      )} ближайшим к цели врагам.`;
    case 'drain':
      return `Наносит ${power} урона и лечит себя на фактически нанесённый урон.`;
    default:
      return 'Способность без описания.';
  }
}

function defaultTuningAbility(def: UnitDef): TuningAbility {
  const ability = def.ability;
  return {
    name: ability.name,
    kind: ability.kind,
    power: ability.power,
    radius: ability.radius ?? 1.5,
    duration: ability.duration ?? 1,
    secondary: ability.secondary ?? (ability.kind === 'chain' ? 3 : 1),
  };
}

export function defaultTuningModel(def: UnitDef): TuningModel {
  return {
    palette: { ...authoredPalette(def) },
    scale: 1,
    hover: HOVER_BY_ID[def.id] ?? 0,
    yaw: 0,
    parts: {},
  };
}

export function defaultTuningEntry(def: UnitDef): TuningUnit {
  return {
    id: def.id,
    stats: {
      name: def.name,
      flavor: def.flavor,
      race: def.race,
      unitClass: def.unitClass,
      cost: def.cost,
      hp: def.hp,
      attack: def.attack,
      armor: def.armor,
      attackSpeed: def.attackSpeed,
      range: def.range,
      maxMana: def.maxMana,
      ability: defaultTuningAbility(def),
    },
    model: defaultTuningModel(def),
    animation: defaultAnimationFor(def.id),
  };
}

export function emptyTuning(): TuningState {
  return { version: TUNING_VERSION, savedAt: new Date().toISOString(), units: {} };
}

function normalizePart(raw: unknown): TuningPart {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const result: TuningPart = {
    visible: typeof source.visible === 'boolean' ? source.visible : true,
    px: asNumber(source.px, 0, -3, 3),
    py: asNumber(source.py, 0, -3, 3),
    pz: asNumber(source.pz, 0, -3, 3),
    rx: asNumber(source.rx, 0, -720, 720),
    ry: asNumber(source.ry, 0, -720, 720),
    rz: asNumber(source.rz, 0, -720, 720),
    sx: asNumber(source.sx, 1, 0.05, 5),
    sy: asNumber(source.sy, 1, 0.05, 5),
    sz: asNumber(source.sz, 1, 0.05, 5),
  };
  if (typeof source.shape === 'string' && (TUNING_SHAPES as readonly string[]).includes(source.shape)) {
    result.shape = source.shape as TuningShape;
    result.width = asNumber(source.width, 0.2, 0.01, 5);
    result.height = asNumber(source.height, 0.2, 0.01, 5);
    result.depth = asNumber(source.depth, 0.2, 0.01, 5);
    result.color = asColor(source.color, '#b9a267');
    result.glow = typeof source.glow === 'boolean' ? source.glow : false;
  }
  return result;
}

function normalizeAbility(raw: unknown, base: TuningAbility): TuningAbility {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    name: asString(source.name, base.name, 80),
    kind: asEnum(source.kind, ABILITY_KINDS, base.kind),
    power: asNumber(source.power, base.power, 0, 1200),
    radius: asNumber(source.radius, base.radius, 0.5, 5),
    duration: asNumber(source.duration, base.duration, 0, 12),
    secondary: Math.round(asNumber(source.secondary, base.secondary, 0, 999)),
  };
}

function normalizeStats(raw: unknown, base: TuningStats): TuningStats {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    name: asString(source.name, base.name, 40),
    flavor: asString(source.flavor, base.flavor, 240),
    race: asEnum(source.race, RACES, base.race),
    unitClass: asEnum(source.unitClass, CLASSES, base.unitClass),
    cost: Math.round(asNumber(source.cost, base.cost, 1, 5)),
    hp: asNumber(source.hp, base.hp, 1, 99999),
    attack: asNumber(source.attack, base.attack, 0, 9999),
    armor: asNumber(source.armor, base.armor, 0, 999),
    attackSpeed: asNumber(source.attackSpeed, base.attackSpeed, 0.05, 10),
    range: Math.round(asNumber(source.range, base.range, 1, 12)),
    maxMana: asNumber(source.maxMana, base.maxMana, 0, 999),
    ability: normalizeAbility(source.ability, base.ability),
  };
}

function normalizeModel(raw: unknown, base: TuningModel): TuningModel {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const paletteSource = (source.palette && typeof source.palette === 'object' ? source.palette : {}) as Record<
    string,
    unknown
  >;
  const partsSource = (source.parts && typeof source.parts === 'object' ? source.parts : {}) as Record<string, unknown>;
  const parts: Record<string, TuningPart> = {};
  for (const [key, value] of Object.entries(partsSource)) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key)) continue;
    parts[key] = normalizePart(value);
  }
  return {
    palette: {
      body: asColor(paletteSource.body, base.palette.body),
      accent: asColor(paletteSource.accent, base.palette.accent),
      glow: asColor(paletteSource.glow, base.palette.glow),
    },
    scale: asNumber(source.scale, base.scale, 0.2, 3),
    hover: asNumber(source.hover, base.hover, -0.5, 1),
    yaw: asNumber(source.yaw, base.yaw, -360, 360),
    parts,
  };
}

function normalizeAnimation(raw: unknown, base: TuningAnimation): TuningAnimation {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const result: TuningAnimation = {
    ...base,
    attackStyle: asEnum(source.attackStyle, ATTACK_STYLES, base.attackStyle),
    swapAttackCast:
      typeof source.swapAttackCast === 'boolean' ? source.swapAttackCast : base.swapAttackCast,
  };
  const numeric = (key: keyof UnitAnimationTuning, min: number, max: number): void => {
    const value = source[key as string];
    if (typeof value === 'number' && Number.isFinite(value)) {
      (result[key] as number) = clamp(value, min, max);
    }
  };
  numeric('speed', 0.1, 2.5);
  numeric('attackDuration', 0.08, 1.5);
  numeric('castDuration', 0.1, 2.5);
  numeric('idleBobSpeed', 0, 8);
  numeric('idleBobAmount', 0, 0.12);
  numeric('idleSwaySpeed', 0, 8);
  numeric('idleSwayAmount', 0, 0.15);
  numeric('lunge', 0, 0.5);
  numeric('bodyPitch', 0, 0.6);
  numeric('meleeRoll', 0, 0.5);
  numeric('beastPitch', 0, 0.5);
  numeric('castScale', 0, 0.3);
  numeric('swingScale', 0, 0.15);
  numeric('weaponPower', 0, 2.5);
  numeric('castWeapon', 0, 2.5);
  numeric('offhandPower', 0, 2.5);
  numeric('headPower', 0, 2.5);
  numeric('wingFlap', 0, 0.8);
  numeric('wingCastFlap', 0, 1.2);
  numeric('wingSpeed', 0, 16);
  numeric('glowPulse', 0, 0.8);
  numeric('glowPulseSpeed', 0, 14);
  numeric('glowCast', 0, 2.5);
  return result;
}

/**
 * Validates a lab/game tuning payload and keeps only entries that actually
 * differ from the authored content. Missing units mean "use authored values".
 */
export function normalizeTuning(raw: unknown): TuningState {
  const envelope = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const source = (
    envelope.tuning && typeof envelope.tuning === 'object' ? envelope.tuning : envelope
  ) as Record<string, unknown>;
  const unitsSource = (
    source.units && typeof source.units === 'object' ? source.units : {}
  ) as Record<string, unknown>;
  const units: Record<string, TuningUnit> = {};

  for (const def of UNITS) {
    const rawEntry = unitsSource[def.id];
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const entry = rawEntry as Record<string, unknown>;
    const base = defaultTuningEntry(def);
    const normalized: TuningUnit = {
      id: def.id,
      stats: normalizeStats(entry.stats, base.stats),
      model: normalizeModel(entry.model, base.model),
      animation: normalizeAnimation(entry.animation, base.animation),
    };
    if (stableStringify(normalized.stats) !== stableStringify(base.stats)) {
      units[def.id] = normalized;
      continue;
    }
    if (stableStringify(normalized.model) !== stableStringify(base.model)) {
      units[def.id] = normalized;
      continue;
    }
    if (stableStringify(normalized.animation) !== stableStringify(base.animation)) {
      units[def.id] = normalized;
    }
  }

  return {
    version: TUNING_VERSION,
    savedAt: typeof source.savedAt === 'string' ? source.savedAt : new Date().toISOString(),
    units,
  };
}

export function tunedUnitCount(tuning: TuningState): number {
  return Object.keys(tuning.units).length;
}

export function getTuningUnit(tuning: TuningState | null | undefined, defId: string): TuningUnit | null {
  if (!tuning) return null;
  return tuning.units[defId] ?? null;
}

export function getTuningModel(tuning: TuningState | null | undefined, defId: string): TuningModel {
  const tuned = getTuningUnit(tuning, defId);
  if (tuned) return tuned.model;
  const def = AUTHORED_BY_ID[defId] ?? UNIT_BY_ID[defId];
  if (!def) {
    return { palette: { body: '#b9a267', accent: '#8fa6c7', glow: '#ffe28a' }, scale: 1, hover: 0, yaw: 0, parts: {} };
  }
  return defaultTuningModel(def);
}

export function getTuningAnimation(tuning: TuningState | null | undefined, defId: string): TuningAnimation {
  const tuned = getTuningUnit(tuning, defId);
  if (tuned) return tuned.animation;
  return defaultAnimationFor(defId, ATTACK_STYLE_BY_ID[defId]);
}

/**
 * Resets every shared UnitDef to the authored content and then applies the
 * tuning overrides in place. Both the authoritative server and the client use
 * this so their copies stay identical.
 */
export function applyTuningToContent(tuning: TuningState): void {
  for (const def of UNITS) {
    const authored = AUTHORED_BY_ID[def.id];
    if (!authored) continue;
    def.name = authored.name;
    def.race = authored.race;
    def.unitClass = authored.unitClass;
    def.cost = authored.cost;
    def.hp = authored.hp;
    def.attack = authored.attack;
    def.armor = authored.armor;
    def.attackSpeed = authored.attackSpeed;
    def.range = authored.range;
    def.maxMana = authored.maxMana;
    def.flavor = authored.flavor;
    def.ability.name = authored.ability.name;
    def.ability.description = authored.ability.description;
    def.ability.kind = authored.ability.kind;
    def.ability.power = authored.ability.power;
    def.ability.radius = authored.ability.radius;
    def.ability.duration = authored.ability.duration;
    def.ability.secondary = authored.ability.secondary;
  }

  for (const [defId, entry] of Object.entries(tuning.units)) {
    const def = UNIT_BY_ID[defId];
    if (!def) continue;
    const stats = entry.stats;
    def.name = stats.name;
    def.race = stats.race;
    def.unitClass = stats.unitClass;
    def.cost = clamp(Math.round(stats.cost), 1, 5) as UnitDef['cost'];
    def.hp = stats.hp;
    def.attack = stats.attack;
    def.armor = stats.armor;
    def.attackSpeed = stats.attackSpeed;
    def.range = stats.range;
    def.maxMana = stats.maxMana;
    def.flavor = stats.flavor;
    def.ability.name = stats.ability.name;
    def.ability.kind = stats.ability.kind;
    def.ability.power = stats.ability.power;
    def.ability.radius = stats.ability.radius;
    def.ability.duration = stats.ability.duration;
    def.ability.secondary = stats.ability.secondary;
    def.ability.description = describeTuningAbility(stats.ability, def.id);
  }
}

export function authoredUnitById(defId: string): UnitDef | null {
  return AUTHORED_BY_ID[defId] ?? null;
}

export function authoredAbilityById(defId: string): AbilityDef | null {
  return AUTHORED_BY_ID[defId]?.ability ?? null;
}
