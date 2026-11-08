/**
 * Shared map schema for the game and the Map Lab editor.
 *
 * Built-in maps keep their handcrafted procedural decoration; a custom map is a
 * full editable document that reuses one built-in "base" for the surrounding
 * scenery and adds its own theme and primitive objects.
 */

export type BuiltinMapId = 'kara' | 'starry' | 'ruins' | 'jaddy';

/** Map identifiers are plain strings so custom maps can be published at runtime. */
export type MapId = string;

export interface MapTheme {
  label: string;
  accent: string;
  sky: string;
  fog: string;
  fogDensity: number;
  hemiDiffuse: string;
  hemiGround: string;
  hemiIntensity: number;
  dirDiffuse: string;
  dirIntensity: number;
  glow: number;
  tiles: {
    playerLight: string;
    playerDark: string;
    enemyLight: string;
    enemyDark: string;
  };
  mats: Record<string, [string, string]>;
}

export interface MapMeta {
  id: BuiltinMapId;
  name: string;
  subtitle: string;
  light: string;
  dark: string;
  glow: string;
}

export const BUILTIN_MAP_META: MapMeta[] = [
  {
    id: 'kara',
    name: 'Upper Tower Kara',
    subtitle: 'Ночная башня',
    light: '#cfd3e8',
    dark: '#211f30',
    glow: '#b07cff',
  },
  {
    id: 'starry',
    name: 'Starry Court',
    subtitle: 'Звёздный двор',
    light: '#dfe9f2',
    dark: '#5f7489',
    glow: '#7fd7ff',
  },
  {
    id: 'ruins',
    name: 'Shatty Ruins',
    subtitle: 'Руины Шатти',
    light: '#d9c4a4',
    dark: '#6b5039',
    glow: '#e8ae63',
  },
  {
    id: 'jaddy',
    name: 'Jaddy Forest',
    subtitle: 'Лес Джадди',
    light: '#a7c994',
    dark: '#33503a',
    glow: '#7de09a',
  },
];

export const BUILTIN_MAP_IDS: BuiltinMapId[] = BUILTIN_MAP_META.map((entry) => entry.id);

export const BUILTIN_MAP_THEMES: Record<BuiltinMapId, MapTheme> = {
  kara: {
    label: 'Upper Tower Kara',
    accent: '#b07cff',
    sky: '#05050b',
    fog: '#080810',
    fogDensity: 0.016,
    hemiDiffuse: '#9a92d8',
    hemiGround: '#120f20',
    hemiIntensity: 0.78,
    dirDiffuse: '#ded8ff',
    dirIntensity: 1.1,
    glow: 0.5,
    tiles: {
      playerLight: '#c9cde3',
      playerDark: '#373252',
      enemyLight: '#acb1cc',
      enemyDark: '#27243d',
    },
    mats: {
      warStone: ['#2b2839', '#0a0910'],
      warStoneDark: ['#17161f', '#060509'],
      warBasalt: ['#110f18', '#040305'],
      warIron: ['#252230', '#09080c'],
      warRust: ['#3d2d50', '#120a1a'],
      warBrass: ['#b79952', '#3a2a0c'],
      warEmber: ['#6b3cc0', '#a76bff'],
      boardRivet: ['#c3a86a', '#2a1e08'],
      islandGround: ['#211e2c', '#07060b'],
      islandCourt: ['#14121d', '#040309'],
      islandRock: ['#2a2635', '#090810'],
      islandRockDark: ['#14121c', '#040308'],
      islandMoss: ['#2a3a39', '#080f0e'],
      shoreSand: ['#565068', '#0b0910'],
      ruinBone: ['#6c6682', '#171420'],
      ruinRust: ['#4a3354', '#170a1e'],
      warMetal: ['#282433', '#08070b'],
      brazierFlame: ['#c79aff', '#9b5cff'],
      starMat: ['#c1d2ff', '#bcd4ff'],
      bloodMoon: ['#3a2f57', '#8060c0'],
      seaWater: ['#0b1022', '#03050d'],
      moonHalo: ['#2f2548', '#6c4bb0'],
      moteEmber: ['#7c4ec0', '#c08bff'],
      moteAsh: ['#625d74', '#a9a3bf'],
      shoreFoam: ['#6b7fc4', '#8fa8e8'],
    },
  },
  starry: {
    label: 'Starry Court',
    accent: '#7fd7ff',
    sky: '#050e18',
    fog: '#071624',
    fogDensity: 0.012,
    hemiDiffuse: '#a9c6e6',
    hemiGround: '#101b26',
    hemiIntensity: 0.9,
    dirDiffuse: '#eaf3ff',
    dirIntensity: 1.32,
    glow: 0.42,
    tiles: {
      playerLight: '#e6edf5',
      playerDark: '#7f95ab',
      enemyLight: '#d6e2ee',
      enemyDark: '#6b8298',
    },
    mats: {
      warStone: ['#4a5666', '#141a21'],
      warStoneDark: ['#2c3542', '#0b1016'],
      warBasalt: ['#1c232c', '#06090d'],
      warIron: ['#39424f', '#10151b'],
      warRust: ['#6a5a3f', '#1c1409'],
      warBrass: ['#d2b064', '#3d2c08'],
      warEmber: ['#3b7fb5', '#7fd7ff'],
      boardRivet: ['#d8c07a', '#2c230d'],
      islandGround: ['#3d4a55', '#0c1116'],
      islandCourt: ['#22303c', '#080d12'],
      islandRock: ['#46525f', '#11171d'],
      islandRockDark: ['#26303a', '#090d11'],
      islandMoss: ['#38564a', '#0b1512'],
      shoreSand: ['#9aa6ad', '#1a2026'],
      ruinBone: ['#c6cbd2', '#282c31'],
      ruinRust: ['#7a6444', '#221809'],
      warMetal: ['#3c4553', '#10141a'],
      brazierFlame: ['#ffd98a', '#ffb84a'],
      starMat: ['#dbeaff', '#eaf4ff'],
      bloodMoon: ['#b9d4ea', '#e6f4ff'],
      seaWater: ['#0a2740', '#03101c'],
      moonHalo: ['#496f8a', '#8fd2ff'],
      moteEmber: ['#6aa0c4', '#aee6ff'],
      moteAsh: ['#7c8a95', '#c2d4de'],
      shoreFoam: ['#a6d8e8', '#d8f2fb'],
    },
  },
  ruins: {
    label: 'Shatty Ruins',
    accent: '#e8ae63',
    sky: '#140f0b',
    fog: '#1d1610',
    fogDensity: 0.015,
    hemiDiffuse: '#e0c49c',
    hemiGround: '#2a1c12',
    hemiIntensity: 0.86,
    dirDiffuse: '#ffe0ac',
    dirIntensity: 1.35,
    glow: 0.34,
    tiles: {
      playerLight: '#d9c4a4',
      playerDark: '#8a6a4c',
      enemyLight: '#cfb894',
      enemyDark: '#7d5f43',
    },
    mats: {
      warStone: ['#6b533c', '#1d140c'],
      warStoneDark: ['#4a3729', '#120c08'],
      warBasalt: ['#2e231b', '#0a0704'],
      warIron: ['#3a3029', '#0f0b08'],
      warRust: ['#7a4b2f', '#251006'],
      warBrass: ['#c29a58', '#3a2608'],
      warEmber: ['#a55a22', '#ff9a4a'],
      boardRivet: ['#c6a36a', '#2c1e08'],
      islandGround: ['#7a5e42', '#221508'],
      islandCourt: ['#4a3928', '#140d07'],
      islandRock: ['#6a533c', '#1c1209'],
      islandRockDark: ['#3e3024', '#0f0a06'],
      islandMoss: ['#4e5a35', '#141a0a'],
      shoreSand: ['#b59a70', '#241c10'],
      ruinBone: ['#cbb896', '#2a2419'],
      ruinRust: ['#7a4b2f', '#1f0e05'],
      warMetal: ['#453a31', '#120e0a'],
      brazierFlame: ['#ffb45e', '#ff7b1c'],
      starMat: ['#f5e0b0', '#ffe9b8'],
      bloodMoon: ['#d8b070', '#f2c27a'],
      seaWater: ['#2a3a3a', '#0b1414'],
      moonHalo: ['#6a533c', '#c69a58'],
      moteEmber: ['#a5702f', '#ffc46a'],
      moteAsh: ['#8a7a62', '#c9b696'],
      shoreFoam: ['#d8c3a2', '#efdfc0'],
    },
  },
  jaddy: {
    label: 'Jaddy Forest',
    accent: '#7de09a',
    sky: '#07120e',
    fog: '#0a1a12',
    fogDensity: 0.013,
    hemiDiffuse: '#9fd2ad',
    hemiGround: '#0c1c12',
    hemiIntensity: 0.92,
    dirDiffuse: '#e0ffd6',
    dirIntensity: 1.22,
    glow: 0.4,
    tiles: {
      playerLight: '#a7c994',
      playerDark: '#4f7350',
      enemyLight: '#9cbd8a',
      enemyDark: '#436446',
    },
    mats: {
      warStone: ['#3d4a37', '#0d130c'],
      warStoneDark: ['#26301f', '#080c07'],
      warBasalt: ['#18211a', '#050805'],
      warIron: ['#2c352a', '#0a0f0a'],
      warRust: ['#4d5a33', '#141a0a'],
      warBrass: ['#b39a4e', '#302606'],
      warEmber: ['#3c7d4a', '#7de09a'],
      boardRivet: ['#b7a35a', '#251e08'],
      islandGround: ['#2e452f', '#0a1209'],
      islandCourt: ['#1b2b1d', '#060c07'],
      islandRock: ['#3a4c38', '#0c110b'],
      islandRockDark: ['#202b21', '#070a07'],
      islandMoss: ['#4f7a3f', '#12220c'],
      shoreSand: ['#8d8a56', '#1c1a0c'],
      ruinBone: ['#9aa888', '#1d2418'],
      ruinRust: ['#59663a', '#181d0a'],
      warMetal: ['#2e3a2d', '#0a0e09'],
      brazierFlame: ['#b9ff8a', '#79e06a'],
      starMat: ['#cfefb0', '#e2ffc8'],
      bloodMoon: ['#9fd28a', '#c8f0a8'],
      seaWater: ['#0b2c2a', '#03100f'],
      moonHalo: ['#3f6a4a', '#7ed69c'],
      moteEmber: ['#4c8a4a', '#9aff8a'],
      moteAsh: ['#6a8a6a', '#b6d8b0'],
      shoreFoam: ['#7fd8b0', '#b0f0d4'],
    },
  },
};

export type MapShape = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane' | 'pyramid';

export const MAP_SHAPES: { value: MapShape; label: string; glyph: string }[] = [
  { value: 'box', label: 'Куб', glyph: '▣' },
  { value: 'sphere', label: 'Сфера', glyph: '●' },
  { value: 'cylinder', label: 'Цилиндр', glyph: '▮' },
  { value: 'cone', label: 'Конус', glyph: '▲' },
  { value: 'torus', label: 'Кольцо', glyph: '◎' },
  { value: 'plane', label: 'Плита', glyph: '▬' },
  { value: 'pyramid', label: 'Пирамида', glyph: '△' },
];

export type Vec3 = [number, number, number];

export interface MapObject {
  id: string;
  name: string;
  shape: MapShape;
  position: Vec3;
  /** Rotation in degrees, easier to edit in the inspector. */
  rotation: Vec3;
  scale: Vec3;
  color: string;
  emissive: string;
  alpha: number;
  visible: boolean;
  locked: boolean;
}

export interface MapDoc {
  id: string;
  name: string;
  subtitle: string;
  base: BuiltinMapId;
  theme: MapTheme;
  objects: MapObject[];
  updatedAt?: string;
}

export const MAP_LIMITS = {
  maxObjects: 1200,
  position: 40,
  rotation: 3600,
  scaleMin: 0.02,
  scaleMax: 40,
} as const;

export function isBuiltinMapId(value: unknown): value is BuiltinMapId {
  return typeof value === 'string' && (BUILTIN_MAP_IDS as string[]).includes(value);
}

export function mapMeta(id: BuiltinMapId): MapMeta {
  return BUILTIN_MAP_META.find((entry) => entry.id === id) ?? BUILTIN_MAP_META[3];
}

export function builtinTheme(id: string): MapTheme {
  return BUILTIN_MAP_THEMES[(isBuiltinMapId(id) ? id : 'jaddy') as BuiltinMapId];
}

/** Accent for a built-in map id or a custom document. */
export function mapAccent(id: string, doc?: MapDoc | null): string {
  if (doc) return doc.theme.accent;
  return builtinTheme(id).accent;
}

function cloneTheme(theme: MapTheme): MapTheme {
  return {
    ...theme,
    tiles: { ...theme.tiles },
    mats: Object.fromEntries(Object.entries(theme.mats).map(([key, value]) => [key, [value[0], value[1]] as [string, string]])),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function asString(value: unknown, fallback: string, maxLength = 80): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, maxLength) : fallback;
}

function asColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function asVec3(
  value: unknown,
  fallback: Vec3,
  min: number,
  max: number,
): Vec3 {
  if (!Array.isArray(value) || value.length < 3) return [...fallback];
  return [
    asNumber(value[0], fallback[0], min, max),
    asNumber(value[1], fallback[1], min, max),
    asNumber(value[2], fallback[2], min, max),
  ];
}

export function slugifyMapId(value: string, fallback = 'map'): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return slug || fallback;
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeTheme(raw: unknown, base: BuiltinMapId): MapTheme {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fallback = builtinTheme(base);
  const tiles = (source.tiles && typeof source.tiles === 'object' ? source.tiles : {}) as Record<string, unknown>;
  const matsSource = (source.mats && typeof source.mats === 'object' ? source.mats : {}) as Record<string, unknown>;
  const mats: Record<string, [string, string]> = {};
  for (const [key, value] of Object.entries(fallback.mats)) {
    const pair = Array.isArray(matsSource[key]) ? (matsSource[key] as unknown[]) : [];
    mats[key] = [asColor(pair[0], value[0]), asColor(pair[1], value[1])];
  }
  return {
    label: asString(source.label, fallback.label, 60),
    accent: asColor(source.accent, fallback.accent),
    sky: asColor(source.sky, fallback.sky),
    fog: asColor(source.fog, fallback.fog),
    fogDensity: asNumber(source.fogDensity, fallback.fogDensity, 0, 0.12),
    hemiDiffuse: asColor(source.hemiDiffuse, fallback.hemiDiffuse),
    hemiGround: asColor(source.hemiGround, fallback.hemiGround),
    hemiIntensity: asNumber(source.hemiIntensity, fallback.hemiIntensity, 0, 4),
    dirDiffuse: asColor(source.dirDiffuse, fallback.dirDiffuse),
    dirIntensity: asNumber(source.dirIntensity, fallback.dirIntensity, 0, 4),
    glow: asNumber(source.glow, fallback.glow, 0, 2),
    tiles: {
      playerLight: asColor(tiles.playerLight, fallback.tiles.playerLight),
      playerDark: asColor(tiles.playerDark, fallback.tiles.playerDark),
      enemyLight: asColor(tiles.enemyLight, fallback.tiles.enemyLight),
      enemyDark: asColor(tiles.enemyDark, fallback.tiles.enemyDark),
    },
    mats,
  };
}

export function normalizeMapObject(raw: unknown, index = 0): MapObject {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const shape = (MAP_SHAPES.find((entry) => entry.value === source.shape)?.value ?? 'box') as MapShape;
  return {
    id: typeof source.id === 'string' && source.id.length > 0 ? source.id.slice(0, 64) : `obj-${index + 1}`,
    name: asString(source.name, `Объект ${index + 1}`, 48),
    shape,
    position: asVec3(source.position, [0, 0.5, 0], -MAP_LIMITS.position, MAP_LIMITS.position),
    rotation: asVec3(source.rotation, [0, 0, 0], -MAP_LIMITS.rotation, MAP_LIMITS.rotation),
    scale: asVec3(source.scale, [1, 1, 1], MAP_LIMITS.scaleMin, MAP_LIMITS.scaleMax),
    color: asColor(source.color, '#8a8f9c'),
    emissive: asColor(source.emissive, '#000000'),
    alpha: asNumber(source.alpha, 1, 0, 1),
    visible: source.visible !== false,
    locked: source.locked === true,
  };
}

export function normalizeMapDoc(raw: unknown, fallbackBase: BuiltinMapId = 'jaddy'): MapDoc {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const base = isBuiltinMapId(source.base) ? source.base : fallbackBase;
  const objectsSource = Array.isArray(source.objects) ? source.objects : [];
  return {
    id: typeof source.id === 'string' && source.id.length > 0 ? source.id.slice(0, 48) : uniqueId('map'),
    name: asString(source.name, 'Новая карта', 48),
    subtitle: asString(source.subtitle, 'Пользовательская карта', 80),
    base,
    theme: normalizeTheme(source.theme, base),
    objects: objectsSource
      .slice(0, MAP_LIMITS.maxObjects)
      .map((entry, index) => normalizeMapObject(entry, index)),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
  };
}

export function createMapObject(shape: MapShape, position: Vec3 = [0, 0.5, 0]): MapObject {
  const palette: Record<MapShape, { color: string; emissive: string; scale: Vec3 }> = {
    box: { color: '#8f96a6', emissive: '#000000', scale: [1, 1, 1] },
    sphere: { color: '#a58fbe', emissive: '#000000', scale: [1, 1, 1] },
    cylinder: { color: '#8fa6a0', emissive: '#000000', scale: [1, 1, 1] },
    cone: { color: '#b09a7a', emissive: '#000000', scale: [1, 1, 1] },
    torus: { color: '#c9b06e', emissive: '#3a2a0c', scale: [1, 1, 1] },
    plane: { color: '#6f7f8f', emissive: '#000000', scale: [1, 0.12, 1] },
    pyramid: { color: '#9a8fc0', emissive: '#000000', scale: [1, 1, 1] },
  };
  const preset = palette[shape];
  const label = MAP_SHAPES.find((entry) => entry.value === shape)?.label ?? 'Объект';
  return {
    id: uniqueId('obj'),
    name: label,
    shape,
    position: [...position],
    rotation: [0, 0, 0],
    scale: [...preset.scale],
    color: preset.color,
    emissive: preset.emissive,
    alpha: 1,
    visible: true,
    locked: false,
  };
}

export function createEmptyMapDoc(base: BuiltinMapId = 'jaddy'): MapDoc {
  const meta = mapMeta(base);
  return {
    id: uniqueId('map'),
    name: 'Новая карта',
    subtitle: `На основе «${meta.name}»`,
    base,
    theme: cloneTheme({ ...BUILTIN_MAP_THEMES[base], label: 'Новая карта' }),
    objects: [],
  };
}

export function duplicateMapDoc(doc: MapDoc): MapDoc {
  return {
    ...normalizeMapDoc(doc),
    id: uniqueId('map'),
    name: `${doc.name} (копия)`.slice(0, 48),
    updatedAt: new Date().toISOString(),
    objects: doc.objects.map((object) => ({
      ...object,
      id: uniqueId('obj'),
      position: [...object.position],
      rotation: [...object.rotation],
      scale: [...object.scale],
    })),
  };
}

/** Normalizes a list of documents and keeps the last occurrence of every id. */
export function normalizeMapList(raw: unknown): MapDoc[] {
  const list = Array.isArray(raw) ? raw : [];
  const byId = new Map<string, MapDoc>();
  for (const entry of list) {
    const doc = normalizeMapDoc(entry);
    if (isBuiltinMapId(doc.id)) continue;
    byId.set(doc.id, doc);
  }
  return [...byId.values()];
}

export function themeForDoc(doc: MapDoc | null | undefined): MapTheme {
  return doc ? { ...doc.theme, label: doc.name } : BUILTIN_MAP_THEMES.jaddy;
}
