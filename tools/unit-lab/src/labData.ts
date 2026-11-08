import { getUnitPalette, type AttackStyle, type UnitPalette } from '../../../src/client/unitModels';
import { SYNERGIES, UNITS } from '../../../src/shared/content';
import type { TuningShape } from '../../../src/shared/tuning';
import {
  ATTACK_STYLE_BY_ID,
  DEFAULT_UNIT_ANIMATION,
  HOVER_BY_ID,
} from '../../../src/shared/unitAppearance';
import {
  CLASS_NAMES,
  POOL_COPIES,
  RACE_NAMES,
  SELL_VALUE,
  STAR_MULTIPLIER,
  type AbilityKind,
  type Race,
  type UnitClass,
  type UnitDef,
} from '../../../src/shared/types';
import type {
  LabAbility,
  LabAnimation,
  LabModel,
  LabState,
  LabStats,
  PartOverride,
  StatFieldMeta,
  UnitLabEntry,
} from './labTypes';

export const STORAGE_KEY = 'autoflow.unit-lab.v1';
export const STATE_VERSION = 1 as const;

export const ABILITY_KIND_NAMES: Record<AbilityKind, string> = {
  nuke: 'Одиночный урон',
  aoe: 'Урон по области',
  heal: 'Лечение',
  shield: 'Щит',
  stun: 'Оглушение',
  buff: 'Усиление',
  chain: 'Цепной урон',
  drain: 'Похищение жизни',
};

export const ABILITY_GLYPHS: Record<AbilityKind, string> = {
  nuke: '✦',
  aoe: '◎',
  heal: '✚',
  shield: '◈',
  stun: '✹',
  buff: '▲',
  chain: '⚡',
  drain: '☽',
};

const ABILITY_KINDS: AbilityKind[] = ['nuke', 'aoe', 'heal', 'shield', 'stun', 'buff', 'chain', 'drain'];
const RACES: Race[] = ['human', 'undead', 'mech', 'beast', 'demon', 'elf'];
const CLASSES: UnitClass[] = ['warrior', 'mage', 'hunter', 'assassin'];
const ATTACK_STYLES: AttackStyle[] = ['melee', 'ranged', 'magic', 'beast'];

export const STAT_FIELDS: StatFieldMeta[] = [
  { path: 'stats.hp', label: 'Здоровье', hint: 'Базовое HP до множителя звёзд и синергий.', min: 100, max: 4000, step: 10, unit: 'HP' },
  { path: 'stats.attack', label: 'Атака', hint: 'Урон базовой атаки до брони цели.', min: 5, max: 300, step: 1, unit: '' },
  { path: 'stats.armor', label: 'Броня', hint: 'Снижение физического урона: armor / (armor + 25).', min: 0, max: 60, step: 1, unit: '' },
  { path: 'stats.attackSpeed', label: 'Скорость атаки', hint: 'Атак в секунду. Интервал = 1 / значение.', min: 0.2, max: 3, step: 0.05, unit: '/с' },
  { path: 'stats.range', label: 'Дальность', hint: 'Радиус атаки в клетках (шахматное расстояние).', min: 1, max: 8, step: 1, unit: 'кл.' },
  { path: 'stats.maxMana', label: 'Мана', hint: 'Порог способности. Старт — 15% от значения.', min: 0, max: 300, step: 5, unit: 'MP' },
];

export const ABILITY_FIELDS: StatFieldMeta[] = [
  { path: 'stats.ability.power', label: 'Сила', hint: 'Базовое значение: урон, лечение или щит.', min: 0, max: 1200, step: 5, unit: '' },
  { path: 'stats.ability.radius', label: 'Радиус', hint: 'Радиус AoE в клетках, евклидова дистанция.', min: 0.5, max: 5, step: 0.1, unit: 'кл.' },
  { path: 'stats.ability.duration', label: 'Длительность', hint: 'Оглушение или усиление в секундах.', min: 0, max: 12, step: 0.1, unit: 'с' },
  { path: 'stats.ability.secondary', label: 'Второй параметр', hint: 'Цели лечения/щита, число цепей или размер щита звездочёта.', min: 0, max: 999, step: 1, unit: '' },
];

export const ANIMATION_SLIDERS: {
  path: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  { path: 'animation.speed', label: 'Скорость превью', min: 0.1, max: 2.5, step: 0.05, unit: '×' },
  { path: 'animation.attackDuration', label: 'Длительность атаки', min: 0.08, max: 1.5, step: 0.01, unit: 'с' },
  { path: 'animation.castDuration', label: 'Длительность каста', min: 0.1, max: 2.5, step: 0.01, unit: 'с' },
  { path: 'animation.idleBobSpeed', label: 'Скорость дыхания', min: 0, max: 8, step: 0.1, unit: 'Гц' },
  { path: 'animation.idleBobAmount', label: 'Амплитуда дыхания', min: 0, max: 0.12, step: 0.001, unit: '' },
  { path: 'animation.idleSwaySpeed', label: 'Скорость покачивания', min: 0, max: 8, step: 0.1, unit: 'Гц' },
  { path: 'animation.idleSwayAmount', label: 'Амплитуда покачивания', min: 0, max: 0.15, step: 0.001, unit: '' },
  { path: 'animation.lunge', label: 'Выпад корпуса', min: 0, max: 0.5, step: 0.005, unit: '' },
  { path: 'animation.bodyPitch', label: 'Наклон при касте', min: 0, max: 0.6, step: 0.01, unit: 'рад' },
  { path: 'animation.meleeRoll', label: 'Крен при атаке', min: 0, max: 0.5, step: 0.005, unit: 'рад' },
  { path: 'animation.beastPitch', label: 'Рывок головой', min: 0, max: 0.5, step: 0.005, unit: 'рад' },
  { path: 'animation.castScale', label: 'Раздувание при касте', min: 0, max: 0.3, step: 0.005, unit: '' },
  { path: 'animation.swingScale', label: 'Раздувание при атаке', min: 0, max: 0.15, step: 0.002, unit: '' },
  { path: 'animation.weaponPower', label: 'Амплитуда оружия', min: 0, max: 2.5, step: 0.05, unit: '×' },
  { path: 'animation.castWeapon', label: 'Оружие при касте', min: 0, max: 2.5, step: 0.05, unit: 'рад' },
  { path: 'animation.offhandPower', label: 'Амплитуда второй руки', min: 0, max: 2.5, step: 0.05, unit: '×' },
  { path: 'animation.headPower', label: 'Амплитуда головы', min: 0, max: 2.5, step: 0.05, unit: '×' },
  { path: 'animation.wingFlap', label: 'Взмах крыльев', min: 0, max: 0.8, step: 0.01, unit: 'рад' },
  { path: 'animation.wingCastFlap', label: 'Крылья при касте', min: 0, max: 1.2, step: 0.01, unit: 'рад' },
  { path: 'animation.wingSpeed', label: 'Скорость крыльев', min: 0, max: 16, step: 0.1, unit: 'Гц' },
  { path: 'animation.glowPulse', label: 'Пульс свечения', min: 0, max: 0.8, step: 0.01, unit: '' },
  { path: 'animation.glowPulseSpeed', label: 'Скорость свечения', min: 0, max: 14, step: 0.1, unit: 'Гц' },
  { path: 'animation.glowCast', label: 'Свечение при касте', min: 0, max: 2.5, step: 0.05, unit: '×' },
];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function round(value: number, digits = 0): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function formatNumber(value: number, digits = 0): string {
  return round(value, digits).toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function asString(value: unknown, fallback: string, maxLength = 400): string {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLength) : fallback;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function asColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

export function createDefaultAnimation(def: UnitDef): LabAnimation {
  return {
    ...DEFAULT_UNIT_ANIMATION,
    attackStyle: ATTACK_STYLE_BY_ID[def.id] ?? 'melee',
  };
}

export function createDefaultModel(def: UnitDef): LabModel {
  return {
    palette: { ...getUnitPalette(def) },
    scale: 1,
    hover: HOVER_BY_ID[def.id] ?? 0,
    yaw: 0,
    parts: {},
  };
}

export function createDefaultEntry(def: UnitDef): UnitLabEntry {
  const ability = def.ability;
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
      ability: {
        name: ability.name,
        kind: ability.kind,
        power: ability.power,
        radius: ability.radius ?? 1.5,
        duration: ability.duration ?? 1,
        secondary: ability.secondary ?? (ability.kind === 'chain' ? 3 : 1),
      },
    },
    model: createDefaultModel(def),
    animation: createDefaultAnimation(def),
  };
}

export function createDefaultState(): LabState {
  const units: Record<string, UnitLabEntry> = {};
  for (const def of UNITS) units[def.id] = createDefaultEntry(def);
  return { version: STATE_VERSION, savedAt: new Date().toISOString(), units };
}

function createDefaultPart(): PartOverride {
  return { visible: true, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 };
}

export const PART_SHAPE_OPTIONS: { value: TuningShape; label: string }[] = [
  { value: 'box', label: 'Куб' },
  { value: 'sphere', label: 'Сфера' },
  { value: 'cylinder', label: 'Цилиндр' },
  { value: 'cone', label: 'Конус' },
  { value: 'torus', label: 'Тор' },
  { value: 'plane', label: 'Плоскость' },
];

export function createCustomPart(color: string, shape: TuningShape = 'box'): PartOverride {
  return {
    ...createDefaultPart(),
    shape,
    width: 0.2,
    height: 0.2,
    depth: 0.2,
    color,
    glow: false,
    py: 0.5,
  };
}

export function nextCustomPartKey(parts: Record<string, PartOverride>): string {
  let index = 0;
  for (const key of Object.keys(parts)) {
    const match = key.match(/^detail-(\d+)$/);
    if (match) index = Math.max(index, Number(match[1]) + 1);
  }
  return `detail-${index}`;
}

export function partOrDefault(entry: UnitLabEntry, key: string): PartOverride {
  const existing = entry.model.parts[key];
  if (existing) return existing;
  const created = createDefaultPart();
  entry.model.parts[key] = created;
  return created;
}

export function isPartModified(part: PartOverride): boolean {
  return (
    Boolean(part.shape) ||
    !part.visible ||
    part.px !== 0 ||
    part.py !== 0 ||
    part.pz !== 0 ||
    part.rx !== 0 ||
    part.ry !== 0 ||
    part.rz !== 0 ||
    part.sx !== 1 ||
    part.sy !== 1 ||
    part.sz !== 1
  );
}

function normalizePart(raw: unknown): PartOverride {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fallback = createDefaultPart();
  const result: PartOverride = {
    visible: typeof source.visible === 'boolean' ? source.visible : fallback.visible,
    px: asNumber(source.px, fallback.px, -3, 3),
    py: asNumber(source.py, fallback.py, -3, 3),
    pz: asNumber(source.pz, fallback.pz, -3, 3),
    rx: asNumber(source.rx, fallback.rx, -720, 720),
    ry: asNumber(source.ry, fallback.ry, -720, 720),
    rz: asNumber(source.rz, fallback.rz, -720, 720),
    sx: asNumber(source.sx, fallback.sx, 0.05, 5),
    sy: asNumber(source.sy, fallback.sy, 0.05, 5),
    sz: asNumber(source.sz, fallback.sz, 0.05, 5),
  };
  if (typeof source.shape === 'string' && PART_SHAPE_OPTIONS.some((option) => option.value === source.shape)) {
    result.shape = source.shape as TuningShape;
    result.width = asNumber(source.width, 0.2, 0.01, 5);
    result.height = asNumber(source.height, 0.2, 0.01, 5);
    result.depth = asNumber(source.depth, 0.2, 0.01, 5);
    result.color = asColor(source.color, '#b9a267');
    result.glow = typeof source.glow === 'boolean' ? source.glow : false;
  }
  return result;
}

function normalizeAbility(raw: unknown, base: LabAbility): LabAbility {
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

function normalizeStats(raw: unknown, base: LabStats): LabStats {
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

function normalizeModel(raw: unknown, base: LabModel): LabModel {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const paletteSource = (source.palette && typeof source.palette === 'object' ? source.palette : {}) as Record<
    string,
    unknown
  >;
  const palette: UnitPalette = {
    body: asColor(paletteSource.body, base.palette.body),
    accent: asColor(paletteSource.accent, base.palette.accent),
    glow: asColor(paletteSource.glow, base.palette.glow),
  };
  const partsSource = (source.parts && typeof source.parts === 'object' ? source.parts : {}) as Record<string, unknown>;
  const parts: Record<string, PartOverride> = {};
  for (const [key, value] of Object.entries(partsSource)) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key)) continue;
    parts[key] = normalizePart(value);
  }
  return {
    palette,
    scale: asNumber(source.scale, base.scale, 0.2, 3),
    hover: asNumber(source.hover, base.hover, -0.5, 1),
    yaw: asNumber(source.yaw, base.yaw, -360, 360),
    parts,
  };
}

function normalizeAnimation(raw: unknown, base: LabAnimation): LabAnimation {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const result = { ...base };
  for (const field of ANIMATION_SLIDERS) {
    const key = field.path.split('.')[1] as keyof LabAnimation;
    if (key === 'attackStyle') continue;
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      (result[key] as number) = clamp(value, field.min, field.max);
    }
  }
  result.attackStyle = asEnum(source.attackStyle, ATTACK_STYLES, base.attackStyle);
  result.swapAttackCast =
    typeof source.swapAttackCast === 'boolean' ? source.swapAttackCast : base.swapAttackCast;
  return result;
}

export function normalizeImportedState(raw: unknown): LabState {
  const envelope = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  // Accepts both a raw lab state and the `{ tuning: ... }` envelope returned by the API.
  const source = (
    envelope.tuning && typeof envelope.tuning === 'object' ? envelope.tuning : envelope
  ) as Record<string, unknown>;
  const unitsSource =
    source.units && typeof source.units === 'object' ? (source.units as Record<string, unknown>) : {};
  const units: Record<string, UnitLabEntry> = {};
  for (const def of UNITS) {
    const base = createDefaultEntry(def);
    const rawEntry = unitsSource[def.id];
    const entry = (rawEntry && typeof rawEntry === 'object' ? rawEntry : {}) as Record<string, unknown>;
    units[def.id] = {
      id: def.id,
      stats: normalizeStats(entry.stats, base.stats),
      model: normalizeModel(entry.model, base.model),
      animation: normalizeAnimation(entry.animation, base.animation),
    };
  }
  return { version: STATE_VERSION, savedAt: new Date().toISOString(), units };
}

export function loadSavedState(): LabState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return normalizeImportedState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: LabState): void {
  state.savedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private mode; the UI keeps working in memory.
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function isEntryModified(entry: UnitLabEntry, def: UnitDef): boolean {
  return stableStringify(entry) !== stableStringify(createDefaultEntry(def));
}

export function modifiedUnitIds(state: LabState): Set<string> {
  const result = new Set<string>();
  for (const def of UNITS) {
    if (isEntryModified(state.units[def.id], def)) result.add(def.id);
  }
  return result;
}

export function unitDefFromEntry(def: UnitDef, entry: UnitLabEntry): UnitDef {
  return {
    ...def,
    name: entry.stats.name,
    race: entry.stats.race,
    unitClass: entry.stats.unitClass,
    cost: clamp(Math.round(entry.stats.cost), 1, 5) as UnitDef['cost'],
    hp: entry.stats.hp,
    attack: entry.stats.attack,
    armor: entry.stats.armor,
    attackSpeed: entry.stats.attackSpeed,
    range: entry.stats.range,
    maxMana: entry.stats.maxMana,
    ability: {
      name: entry.stats.ability.name,
      description: abilityDescription(entry),
      kind: entry.stats.ability.kind,
      power: entry.stats.ability.power,
      radius: entry.stats.ability.radius,
      duration: entry.stats.ability.duration,
      secondary: entry.stats.ability.secondary,
    },
    flavor: entry.stats.flavor,
  };
}

export function armorReduction(armor: number): number {
  return Math.max(0, armor) / (Math.max(0, armor) + 25);
}

export function abilityDescription(entry: UnitLabEntry): string {
  const stats = entry.stats;
  const ability = stats.ability;
  const power = formatNumber(ability.power);
  const duration = formatNumber(ability.duration, 1);
  const radius = formatNumber(ability.radius, 1);
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
      if (isStarweaverShield(entry)) {
        return `Наносит ${power} урона цели и даёт себе щит на ${formatNumber(ability.secondary)} ед.`;
      }
      if (ability.secondary >= 99) return `Даёт всем союзникам щит на ${power} ед.`;
      return `Даёт щит на ${power} ед. ${formatNumber(Math.max(1, Math.floor(ability.secondary)))} союзникам с наименьшим HP.`;
    case 'stun':
      return `Наносит ${power} урона и оглушает цель на ${duration} с.`;
    case 'buff':
      return `Даёт всем союзникам +${power}% скорости атаки на ${duration} с.`;
    case 'chain':
      return `Наносит ${power} урона ${formatNumber(Math.max(1, Math.floor(ability.secondary)))} ближайшим к цели врагам.`;
    case 'drain':
      return `Наносит ${power} урона и лечит себя на фактически нанесённый урон.`;
    default:
      return 'Способность без описания.';
  }
}

export function isStarweaverShield(entry: UnitLabEntry): boolean {
  return entry.id === 'starweaver' && entry.stats.ability.kind === 'shield';
}

export function abilityDescriptionAtStar(entry: UnitLabEntry, star: number): string {
  const multiplier = STAR_MULTIPLIER[Math.min(3, Math.max(1, star))] ?? 1;
  const scaled: UnitLabEntry = {
    ...entry,
    stats: {
      ...entry.stats,
      ability: {
        ...entry.stats.ability,
        power: Math.round(entry.stats.ability.power * multiplier),
        secondary:
          isStarweaverShield(entry) && entry.stats.ability.kind === 'shield'
            ? Math.round(entry.stats.ability.secondary * multiplier)
            : entry.stats.ability.secondary,
      },
    },
  };
  return abilityDescription(scaled);
}

export interface DerivedStats {
  attackInterval: number;
  rawDps: number;
  dpsVs10Armor: number;
  effectiveHp: number;
  mitigation: number;
  startMana: number;
  attacksToCast: number;
  secondsToCast: number;
  abilityPerMana: number;
  hp2: number;
  hp3: number;
  attack2: number;
  attack3: number;
  power2: number;
  power3: number;
}

export function deriveStats(entry: UnitLabEntry): DerivedStats {
  const stats = entry.stats;
  const interval = 1 / Math.max(0.05, stats.attackSpeed);
  const rawDps = stats.attack * stats.attackSpeed;
  const mitigation = armorReduction(stats.armor);
  const startMana = stats.maxMana * 0.15;
  const attacksToCast = Math.max(0, Math.ceil((stats.maxMana - startMana) / 10));
  return {
    attackInterval: interval,
    rawDps,
    dpsVs10Armor: rawDps * (1 - armorReduction(10)),
    effectiveHp: stats.hp / Math.max(0.01, 1 - mitigation),
    mitigation,
    startMana,
    attacksToCast,
    secondsToCast: attacksToCast * interval,
    abilityPerMana: stats.maxMana > 0 ? stats.ability.power / stats.maxMana : 0,
    hp2: Math.round(stats.hp * (STAR_MULTIPLIER[2] ?? 1)),
    hp3: Math.round(stats.hp * (STAR_MULTIPLIER[3] ?? 1)),
    attack2: Math.round(stats.attack * (STAR_MULTIPLIER[2] ?? 1)),
    attack3: Math.round(stats.attack * (STAR_MULTIPLIER[3] ?? 1)),
    power2: Math.round(stats.ability.power * (STAR_MULTIPLIER[2] ?? 1)),
    power3: Math.round(stats.ability.power * (STAR_MULTIPLIER[3] ?? 1)),
  };
}

const RACE_MECHANICS: Record<Race, string> = {
  human: 'Синергия людей повышает максимальный запас HP всех союзников: +15% на 2 юнитах и +30% на 4.',
  undead: 'Синергия нежити снижает броню всех врагов: −2 на 2 юнитах и −5 на 4. Эффект применяется до расчёта урона.',
  mech: 'Синергия мехов даёт мехам +5 брони на 2 юнитах и +12 на 4. Работает только на юнитов расы «мех».',
  beast: 'Синергия зверей ускоряет атаки всех союзников: +10% на 2 юнитах и +25% на 4.',
  demon: 'Синергия демонов даёт вампиризм демонам: 15% на 2 юнитах и 30% на 4. Лечение идёт от фактически нанесённого урона.',
  elf: 'Синергия эльфов даёт всем союзникам уклонение: 12% на 2 юнитах и 25% на 4. Уклонение проверяется отдельно на каждую атаку.',
};

const CLASS_MECHANICS: Record<UnitClass, string> = {
  warrior:
    'Воины — передняя линия без встроенной боевой механики. Их сила в высокой броне и синергии класса: +5 брони на 2 воинах, +12 на 4.',
  mage:
    'Маги масштабируют силу способностей: синергия магов умножает power на 1.25 при 2 магах и на 1.6 при 4. На базовые атаки это не влияет.',
  hunter:
    'Охотники обычно атакуют с дальней дистанции. Синергия охотников умножает урон базовых атак на 1.15 при 2 охотниках и на 1.35 при 4.',
  assassin:
    'Убийцы в начале боя совершают прыжок (0.7 с) к самому дальнему врагу и занимают свободную клетку рядом. После приземления цель сбрасывается и выбирается ближайший враг. Синергия убийц даёт +15% / +35% урона.',
};

function abilityTargeting(entry: UnitLabEntry): string[] {
  const ability = entry.stats.ability;
  const duration = formatNumber(ability.duration, 1);
  const radius = formatNumber(ability.radius, 1);
  const secondary = formatNumber(ability.secondary);
  const starweaver = isStarweaverShield(entry);
  switch (ability.kind) {
    case 'nuke':
      return [
        'Цель: текущая цель юнита. Если цель исчезла, выбирается ближайший живой враг.',
        'Урон способности не проходит через формулу брони (броня влияет только на базовые атаки), но поглощается щитами.',
      ];
    case 'aoe':
      return [
        `Область: все живые враги в радиусе ${radius} кл. от основной цели. Дистанция считается по прямой (евклидово расстояние), препятствия и союзники не мешают.`,
        ability.duration > 0
          ? `После урона каждый выживший в области получает оглушение на ${duration} с.`
          : 'Оглушения нет: способность наносит только урон.',
        'Основная цель всегда попадает в область, потому что находится в её центре.',
      ];
    case 'heal':
      if (ability.secondary === 1) return ['Цель: только сам заклинатель. Лечение не может превысить максимальный запас HP.'];
      if (ability.secondary >= 99) return ['Цели: все живые союзники, включая заклинателя. Лечение не может превысить максимум HP.'];
      return [
        'Цель: союзник с наименьшим соотношением текущего HP к максимуму (может быть сам заклинатель).',
        'Значение secondary, отличное от 1 и 99, в текущей логике не задаёт количество целей — выбирается один самый раненый союзник.',
      ];
    case 'shield':
      if (starweaver) {
        return [
          `Звездочёт — особый случай: щит получает только сама героиня, размер щита берётся из поля «Второй параметр» (${secondary}), а не из силы.`,
          'Одновременно наносится урон по основной цели, равный силе способности.',
          'Щит складывается с уже имеющимся и поглощает урон до уменьшения HP.',
        ];
      }
      if (ability.secondary >= 99) {
        return [
          'Цели: все живые союзники, включая заклинателя.',
          'Щит добавляется к текущему щиту и поглощает любой входящий урон до уменьшения HP.',
        ];
      }
      return [
        `Цели: ${formatNumber(Math.max(1, Math.floor(ability.secondary)))} союзника с наименьшим соотношением HP/максимум. Сортировка идёт по возрастанию, заклинатель тоже участвует.`,
        'Щит добавляется к текущему щиту и поглощает любой входящий урон до уменьшения HP.',
      ];
    case 'stun':
      return [
        `Сначала наносится ${formatNumber(ability.power)} урона, затем цель оглушается на ${duration} с, если осталась жива.`,
        'Оглушение полностью останавливает движение, базовые атаки и касты, но не снимает уже наложенные эффекты.',
      ];
    case 'buff':
      return [
        'Цели: все живые союзники на момент каста, включая заклинателя.',
        `Эффект: +${formatNumber(ability.power)}% к скорости атаки на ${duration} с. Складывается по принципу «сильнейший эффект», а не суммируется.`,
        'Усиление влияет только на скорость атак, но не на урон, ману или способности.',
      ];
    case 'chain':
      return [
        `Цели: ${formatNumber(Math.max(1, Math.floor(ability.secondary)))} живых врагов, ближайших к основной цели (включая саму основную цель).`,
        'Расстояние считается по прямой от основной цели, а не цепочкой «от предыдущей цели». Броня не снижает урон способности.',
      ];
    case 'drain':
      return [
        'Наносит урон основной цели, затем лечит заклинателя на фактически снятое количество HP.',
        'Если часть урона поглотил щит, лечение будет меньше. Лечение не может превысить максимальный запас HP.',
      ];
    default:
      return [];
  }
}

export function mechanicSections(entry: UnitLabEntry): { title: string; html: string }[] {
  const stats = entry.stats;
  const ability = stats.ability;
  const derived = deriveStats(entry);
  const raceSynergy = SYNERGIES.find((item) => item.group === 'race' && item.ref === stats.race);
  const classSynergy = SYNERGIES.find((item) => item.group === 'class' && item.ref === stats.unitClass);

  const combat = `
    <ul class="mech-list">
      <li>Сетка боя 8×8. Перемещение — одна клетка за 0.4 с; по диагонали можно идти только если обе соседние клетки свободны.</li>
      <li>Цель — ближайший живой враг по шахматному расстоянию (max(|dx|, |dy|)). При равенстве выбирается первый в списке.</li>
      <li>Дальность атаки: <b>${formatNumber(stats.range)} кл.</b> Если цель вне дальности, юнит идёт к ней по кратчайшему пути.</li>
      <li>Базовая атака: <b>${formatNumber(stats.attack)}</b> урона каждые <b>${formatNumber(derived.attackInterval, 2)} с</b>. Итоговый урон = атака × множители × (1 − броня/(броня+25)), минимум 1.</li>
      <li>Мана: старт <b>${formatNumber(derived.startMana)}</b>, +10 за атаку, +6% полученного урона (максимум +18) и +2% от урона способностей (максимум +10).</li>
      <li>Способность применяется при <b>${formatNumber(stats.maxMana)}</b> маны и обнуляет шкалу. Оглушение блокирует и атаки, и касты.</li>
    </ul>`;

  const abilityHtml = `
    <p class="mech-desc">${escapeHtml(abilityDescription(entry))}</p>
    <ul class="mech-list">
      ${abilityTargeting(entry)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('')}
      <li>Базовое значение: <b>${formatNumber(ability.power)}</b>. Со звёздами: 2★ — ${formatNumber(
        derived.power2,
      )}, 3★ — ${formatNumber(derived.power3)}. Сила магов дополнительно умножает способность.</li>
      ${
        isStarweaverShield(entry)
          ? `<li>Щит звездочёта: ${formatNumber(ability.secondary)} / 2★ ${formatNumber(
              ability.secondary * (STAR_MULTIPLIER[2] ?? 1),
            )} / 3★ ${formatNumber(ability.secondary * (STAR_MULTIPLIER[3] ?? 1))}.</li>`
          : ''
      }
    </ul>`;

  const roleHtml = `
    <p>${escapeHtml(RACE_MECHANICS[stats.race])}</p>
    <p>${escapeHtml(CLASS_MECHANICS[stats.unitClass])}</p>
    <p class="mech-note">Раса: <b>${escapeHtml(RACE_NAMES[stats.race])}</b> · Класс: <b>${escapeHtml(
    CLASS_NAMES[stats.unitClass],
  )}</b>. Синергии считают все копии юнитов на доске, включая duplicates и звёздные копии.</p>`;

  const synergyHtml = `
    <div class="synergy-line">
      <span class="synergy-name">${escapeHtml(RACE_NAMES[stats.race])}</span>
      <span class="synergy-threshold">${raceSynergy ? raceSynergy.thresholds.join(' / ') : '—'}</span>
      <span class="synergy-effect">${raceSynergy ? escapeHtml(raceSynergy.effects.join('  ·  ')) : '—'}</span>
    </div>
    <div class="synergy-line">
      <span class="synergy-name">${escapeHtml(CLASS_NAMES[stats.unitClass])}</span>
      <span class="synergy-threshold">${classSynergy ? classSynergy.thresholds.join(' / ') : '—'}</span>
      <span class="synergy-effect">${classSynergy ? escapeHtml(classSynergy.effects.join('  ·  ')) : '—'}</span>
    </div>
    <p class="mech-note">Порог срабатывает при количестве юнитов на доске. Промежуточные значения не дают бонуса.</p>`;

  const economy = `
    <ul class="mech-list">
      <li>Стоимость в магазине: <b>${formatNumber(stats.cost)}</b> золота. В пуле на 8 игроков: <b>${formatNumber(
        (POOL_COPIES[Math.round(stats.cost)] ?? 10) * 1,
      )}</b> копий (масштабируется числом игроков).</li>
      <li>Три одинаковых юнита 1★ объединяются в 2★: HP и атака ×1.8, сила способности ×1.8. Три 2★ → 3★: ×3.2.</li>
      <li>Продажа: 1★ — ${formatNumber(SELL_VALUE[stats.cost] ?? 0)}, 2★ — ${formatNumber(
        (SELL_VALUE[stats.cost] ?? 0) * 3,
      )}, 3★ — ${formatNumber((SELL_VALUE[stats.cost] ?? 0) * 9)} золота.</li>
      <li>Расчётные значения: DPS ${formatNumber(derived.rawDps, 1)} · эфф. HP ${formatNumber(
        derived.effectiveHp,
      )} · способность за ману ${formatNumber(derived.abilityPerMana, 2)}.</li>
    </ul>`;

  return [
    { title: 'Боевой цикл', html: combat },
    { title: 'Способность', html: abilityHtml },
    { title: 'Раса и класс', html: roleHtml },
    { title: 'Синергии', html: synergyHtml },
    { title: 'Звёзды и экономика', html: economy },
  ];
}
