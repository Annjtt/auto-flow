/**
 * Shared map schema for the game and the Map Lab editor.
 *
 * Built-in maps keep their handcrafted procedural decoration; a custom map is a
 * full editable document that reuses one built-in "base" for the surrounding
 * scenery and adds its own theme and primitive objects.
 */

export type BuiltinMapId = 'kara' | 'starry' | 'ruins' | 'jaddy';

/** A map can reuse a built-in biome or opt out of all procedural scenery. */
export type MapBase = BuiltinMapId | 'none';

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
  id: MapBase;
  name: string;
  subtitle: string;
  light: string;
  dark: string;
  glow: string;
}

export const BUILTIN_MAP_META = [
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
] as const satisfies readonly MapMeta[];

export const BUILTIN_MAP_IDS: BuiltinMapId[] = BUILTIN_MAP_META.map((entry) => entry.id);

/** Neutral metadata for maps that use no procedural scenery at all. */
export const EMPTY_MAP_META: MapMeta = {
  id: 'none',
  name: 'Без окружения',
  subtitle: 'Чистая доска без декораций',
  light: '#c9cde3',
  dark: '#373252',
  glow: '#9fb4d4',
};

/** Environment choices offered by the Map Lab inspector. */
export const MAP_BASE_OPTIONS: { value: MapBase; label: string }[] = [
  ...BUILTIN_MAP_META.map((meta) => ({ value: meta.id as MapBase, label: meta.name })),
  { value: 'none', label: 'Без окружения (чистая доска)' },
];

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

/**
 * Neutral theme for maps without a procedural base: a plain stone war table and
 * a classic high-contrast board. Deliberately not cloned from a built-in biome,
 * so an empty map never inherits another map's colours, sky or sea.
 */
export const EMPTY_MAP_THEME: MapTheme = {
  label: 'Без окружения',
  accent: '#c9cde3',
  // No atmosphere: the empty base is just the board on a neutral backdrop.
  sky: '#08080b',
  fog: '#08080b',
  fogDensity: 0,
  hemiDiffuse: '#cfd6e6',
  hemiGround: '#111318',
  hemiIntensity: 0.88,
  dirDiffuse: '#f4f6ff',
  dirIntensity: 1.32,
  glow: 0.26,
  tiles: {
    playerLight: '#e7e3d9',
    playerDark: '#2a2e35',
    enemyLight: '#d8d4c9',
    enemyDark: '#1e2229',
  },
  mats: {
    warStone: ['#3b3b40', '#0a0a0c'],
    warStoneDark: ['#252529', '#060608'],
    warBasalt: ['#17171a', '#040405'],
    warIron: ['#2d2d31', '#0a0a0c'],
    warRust: ['#4b3b30', '#140a05'],
    warBrass: ['#b9a06a', '#3a2a0c'],
    warEmber: ['#b07040', '#ff7b3c'],
    boardRivet: ['#8c8c94', '#2a2a30'],
    islandGround: ['#2b2b30', '#08080a'],
    islandCourt: ['#1c1c20', '#050506'],
    islandRock: ['#37373d', '#0b0b0d'],
    islandRockDark: ['#1e1e22', '#050506'],
    islandMoss: ['#3d443c', '#090f08'],
    shoreSand: ['#5f5a4e', '#0b0906'],
    ruinBone: ['#645f54', '#17130d'],
    ruinRust: ['#543a30', '#180704'],
    warMetal: ['#2b2b30', '#0a090c'],
    brazierFlame: ['#ffb45e', '#ff7b1c'],
    starMat: ['#9fc4ee', '#bcd8ff'],
    bloodMoon: ['#3b1b17', '#8a2b1d'],
    seaWater: ['#0a2630', '#031014'],
    moonHalo: ['#9fb4d4', '#556680'],
    moteEmber: ['#d9b56c', '#9a7434'],
    moteAsh: ['#8d8d96', '#6b6b74'],
    shoreFoam: ['#a6d8e8', '#d8f2fb'],
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

export interface MapEnvIsland {
  enabled: boolean;
  /** Radius of the island top disc. */
  radius: number;
  /** Height of the island body below the surface. */
  depth: number;
  topColor: string;
  sideColor: string;
  rimColor: string;
  /** Radius of the inner court disc, 0 hides it. */
  courtRadius: number;
}

export interface MapEnvSea {
  enabled: boolean;
  level: number;
  /** Width and depth of the water plane. */
  size: number;
  color: string;
  emissive: string;
  foam: boolean;
  foamColor: string;
}

export interface MapEnvSky {
  enabled: boolean;
  color: string;
  fogColor: string;
  fogDensity: number;
}

export type MapParticleKind = 'embers' | 'ash' | 'snow' | 'sparks';

export interface MapEnvParticles {
  enabled: boolean;
  kind: MapParticleKind;
  count: number;
  size: number;
  speed: number;
  color: string;
  /** Vertical travel distance. */
  height: number;
  /** Horizontal radius of the particle field. */
  spread: number;
}

export interface MapEnvStars {
  enabled: boolean;
  count: number;
  size: number;
  color: string;
  twinkle: boolean;
  /** How far behind the arena the star field sits. */
  distance: number;
}

export type MapSurfaceShape = 'disc' | 'box';

/** Free-standing platform/rock/floor added on top of the board environment. */
export interface MapEnvSurface {
  id: string;
  name: string;
  shape: MapSurfaceShape;
  position: Vec3;
  /** disc: [diameter, thickness, depthScale]; box: [width, height, depth]. */
  size: Vec3;
  color: string;
  emissive: string;
  alpha: number;
}

export interface MapEnv {
  island: MapEnvIsland;
  sea: MapEnvSea;
  sky: MapEnvSky;
  particles: MapEnvParticles;
  stars: MapEnvStars;
  surfaces: MapEnvSurface[];
}

/** A clean, empty environment: no island, no sea, no extra props. */
export function emptyMapEnv(): MapEnv {
  return {
    island: {
      enabled: false,
      radius: 16,
      depth: 3.2,
      topColor: '#2b2b30',
      sideColor: '#252529',
      rimColor: '#1c1c20',
      courtRadius: 6.2,
    },
    sea: {
      enabled: false,
      level: -2.55,
      size: 140,
      color: '#0a2630',
      emissive: '#031014',
      foam: true,
      foamColor: '#a6d8e8',
    },
    sky: { enabled: false, color: '#08080b', fogColor: '#08080b', fogDensity: 0 },
    particles: {
      enabled: false,
      kind: 'ash',
      count: 34,
      size: 0.06,
      speed: 0.06,
      color: '#8d8d96',
      height: 4.6,
      spread: 5.2,
    },
    stars: { enabled: false, count: 44, size: 0.15, color: '#9fc4ee', twinkle: true, distance: 60 },
    surfaces: [],
  };
}

export interface MapDoc {
  id: string;
  name: string;
  subtitle: string;
  /** Procedural biome, or 'none' for a clean board without scenery. */
  base: MapBase;
  theme: MapTheme;
  /** Composable environment parts (island, sea, sky, particles, stars, surfaces). */
  env: MapEnv;
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

export function isMapBase(value: unknown): value is MapBase {
  return value === 'none' || isBuiltinMapId(value);
}

export function mapMeta(id: MapBase): MapMeta {
  if (id === 'none') return EMPTY_MAP_META;
  return BUILTIN_MAP_META.find((entry) => entry.id === id) ?? BUILTIN_MAP_META[3];
}

export function builtinTheme(id: string): MapTheme {
  return BUILTIN_MAP_THEMES[(isBuiltinMapId(id) ? id : 'jaddy') as BuiltinMapId];
}

/** Theme for a map base, including the empty ("clean board") option. */
export function baseTheme(base: MapBase): MapTheme {
  return base === 'none' ? EMPTY_MAP_THEME : BUILTIN_MAP_THEMES[base];
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

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
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

function normalizeTheme(raw: unknown, base: MapBase): MapTheme {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fallback = baseTheme(base);
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

export function createMapEnvSurface(shape: MapSurfaceShape = 'disc'): MapEnvSurface {
  const preset =
    shape === 'box'
      ? { size: [4, 0.6, 4] as Vec3, color: '#6f7480', emissive: '#000000', label: 'Блок' }
      : { size: [6, 0.3, 1] as Vec3, color: '#4a515c', emissive: '#000000', label: 'Площадка' };
  return {
    id: uniqueId('surface'),
    name: preset.label,
    shape,
    position: [0, -1.15, 0],
    size: preset.size,
    color: preset.color,
    emissive: preset.emissive,
    alpha: 1,
  };
}

export function normalizeMapEnv(raw: unknown): MapEnv {
  const defaults = emptyMapEnv();
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const section = (key: keyof MapEnv): Record<string, unknown> => {
    const value = source[key];
    return (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  };
  const island = section('island');
  const sea = section('sea');
  const sky = section('sky');
  const particles = section('particles');
  const stars = section('stars');
  const surfacesSource = Array.isArray(source.surfaces) ? source.surfaces : [];
  const particleKinds: MapParticleKind[] = ['embers', 'ash', 'snow', 'sparks'];
  const defaultIsland = defaults.island;
  const defaultSea = defaults.sea;
  const defaultSky = defaults.sky;
  const defaultParticles = defaults.particles;
  const defaultStars = defaults.stars;
  return {
    island: {
      enabled: asBool(island.enabled, defaultIsland.enabled),
      radius: asNumber(island.radius, defaultIsland.radius, 4, 60),
      depth: asNumber(island.depth, defaultIsland.depth, 0.3, 14),
      topColor: asColor(island.topColor, defaultIsland.topColor),
      sideColor: asColor(island.sideColor, defaultIsland.sideColor),
      rimColor: asColor(island.rimColor, defaultIsland.rimColor),
      courtRadius: asNumber(island.courtRadius, defaultIsland.courtRadius, 0, 40),
    },
    sea: {
      enabled: asBool(sea.enabled, defaultSea.enabled),
      level: asNumber(sea.level, defaultSea.level, -12, 2),
      size: asNumber(sea.size, defaultSea.size, 20, 400),
      color: asColor(sea.color, defaultSea.color),
      emissive: asColor(sea.emissive, defaultSea.emissive),
      foam: asBool(sea.foam, defaultSea.foam),
      foamColor: asColor(sea.foamColor, defaultSea.foamColor),
    },
    sky: {
      enabled: asBool(sky.enabled, defaultSky.enabled),
      color: asColor(sky.color, defaultSky.color),
      fogColor: asColor(sky.fogColor, defaultSky.fogColor),
      fogDensity: asNumber(sky.fogDensity, defaultSky.fogDensity, 0, 0.12),
    },
    particles: {
      enabled: asBool(particles.enabled, defaultParticles.enabled),
      kind: particleKinds.includes(particles.kind as MapParticleKind)
        ? (particles.kind as MapParticleKind)
        : defaultParticles.kind,
      count: Math.round(asNumber(particles.count, defaultParticles.count, 4, 240)),
      size: asNumber(particles.size, defaultParticles.size, 0.01, 1),
      speed: asNumber(particles.speed, defaultParticles.speed, 0.01, 1.2),
      color: asColor(particles.color, defaultParticles.color),
      height: asNumber(particles.height, defaultParticles.height, 0.5, 30),
      spread: asNumber(particles.spread, defaultParticles.spread, 0.5, 40),
    },
    stars: {
      enabled: asBool(stars.enabled, defaultStars.enabled),
      count: Math.round(asNumber(stars.count, defaultStars.count, 4, 400)),
      size: asNumber(stars.size, defaultStars.size, 0.02, 1.5),
      color: asColor(stars.color, defaultStars.color),
      twinkle: asBool(stars.twinkle, defaultStars.twinkle),
      distance: asNumber(stars.distance, defaultStars.distance, 12, 140),
    },
    surfaces: surfacesSource.slice(0, 24).map((entry, index) => normalizeMapEnvSurface(entry, index)),
  };
}

function normalizeMapEnvSurface(raw: unknown, index = 0): MapEnvSurface {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const shape: MapSurfaceShape = source.shape === 'box' ? 'box' : 'disc';
  const fallback = createMapEnvSurface(shape);
  return {
    id: typeof source.id === 'string' && source.id.length > 0 ? source.id.slice(0, 48) : `surface-${index + 1}`,
    name: asString(source.name, fallback.name, 48),
    shape,
    position: asVec3(source.position, fallback.position, -MAP_LIMITS.position, MAP_LIMITS.position),
    size: asVec3(source.size, fallback.size, 0.1, 80),
    color: asColor(source.color, fallback.color),
    emissive: asColor(source.emissive, fallback.emissive),
    alpha: asNumber(source.alpha, 1, 0, 1),
  };
}

export function normalizeMapDoc(raw: unknown, fallbackBase: MapBase = 'jaddy'): MapDoc {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const base: MapBase = isMapBase(source.base) ? source.base : fallbackBase;
  const objectsSource = Array.isArray(source.objects) ? source.objects : [];
  const baseTheme = normalizeTheme(source.theme, base);
  // Maps created before the neutral empty theme existed cloned the Kara theme
  // (including its sky and atmosphere). Upgrade them to the board-only look.
  const theme =
    base === 'none' && baseTheme.sky === '#06070d' && baseTheme.fog === '#080a12'
      ? { ...EMPTY_MAP_THEME, label: baseTheme.label }
      : baseTheme;
  return {
    id: typeof source.id === 'string' && source.id.length > 0 ? source.id.slice(0, 48) : uniqueId('map'),
    name: asString(source.name, 'Новая карта', 48),
    subtitle: asString(source.subtitle, 'Пользовательская карта', 80),
    base,
    theme,
    env: normalizeMapEnv(source.env),
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

/** Default subtitle for a map base, used by the editor when the base changes. */
export function baseSubtitle(base: MapBase): string {
  return base === 'none' ? 'Чистая доска без декораций' : `На основе «${mapMeta(base).name}»`;
}

export function createEmptyMapDoc(base: MapBase = 'none'): MapDoc {
  return {
    id: uniqueId('map'),
    name: 'Новая карта',
    subtitle: baseSubtitle(base),
    base,
    theme: cloneTheme({ ...baseTheme(base), label: 'Новая карта' }),
    env: emptyMapEnv(),
    objects: [],
  };
}

export function duplicateMapDoc(doc: MapDoc): MapDoc {
  const normalized = normalizeMapDoc(doc);
  return {
    ...normalized,
    id: uniqueId('map'),
    name: `${doc.name} (копия)`.slice(0, 48),
    updatedAt: new Date().toISOString(),
    env: {
      ...normalized.env,
      island: { ...normalized.env.island },
      sea: { ...normalized.env.sea },
      sky: { ...normalized.env.sky },
      particles: { ...normalized.env.particles },
      stars: { ...normalized.env.stars },
      surfaces: normalized.env.surfaces.map((surface) => ({
        ...surface,
        id: uniqueId('surface'),
        position: [...surface.position],
        size: [...surface.size],
      })),
    },
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

/**
 * Resolves the backdrop for a map. An enabled environment sky overrides the
 * theme's sky/fog so the editor can add atmosphere to any base.
 */
export function envSky(
  theme: MapTheme,
  env: MapEnv | null | undefined,
): { sky: string; fog: string; fogDensity: number } {
  if (env?.sky.enabled) {
    return { sky: env.sky.color, fog: env.sky.fogColor, fogDensity: env.sky.fogDensity };
  }
  return { sky: theme.sky, fog: theme.fog, fogDensity: theme.fogDensity };
}
