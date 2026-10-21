export type Race = 'human' | 'undead' | 'mech' | 'beast' | 'demon' | 'elf';
export type UnitClass = 'warrior' | 'mage' | 'hunter' | 'assassin';
export type AbilityKind = 'nuke' | 'aoe' | 'heal' | 'shield' | 'stun' | 'buff' | 'chain' | 'drain';

export type GamePhase = 'waiting' | 'prep' | 'combat' | 'result' | 'finished';

export interface AbilityDef {
  name: string;
  description: string;
  kind: AbilityKind;
  power: number;
  radius?: number;
  duration?: number;
  secondary?: number;
}

export interface UnitDef {
  id: string;
  name: string;
  race: Race;
  unitClass: UnitClass;
  cost: 1 | 2 | 3 | 4 | 5;
  hp: number;
  attack: number;
  armor: number;
  attackSpeed: number;
  range: number;
  maxMana: number;
  ability: AbilityDef;
  flavor: string;
}

export interface SynergyDef {
  key: string;
  name: string;
  group: 'race' | 'class';
  ref: Race | UnitClass;
  thresholds: number[];
  effects: string[];
}

export interface SynergyStatus {
  key: string;
  name: string;
  group: 'race' | 'class';
  count: number;
  threshold: number;
  next: number | null;
  active: boolean;
  tier: number;
  effects: string[];
}

export interface LobbySettings {
  maxPlayers: number;
  startingGold: number;
  startingLevel: number;
  startingLives: number;
  prepSeconds: number;
  maxRounds: number;
  aiFill: boolean;
  privateLobby: boolean;
}

export const DEFAULT_SETTINGS: LobbySettings = {
  maxPlayers: 8,
  startingGold: 6,
  startingLevel: 2,
  startingLives: 30,
  prepSeconds: 32,
  maxRounds: 24,
  aiFill: true,
  privateLobby: false,
};

export interface UnitView {
  uid: string;
  defId: string;
  star: number;
  x: number;
  y: number;
}

export interface BenchUnitView {
  uid: string;
  defId: string;
  star: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  isBot: boolean;
  host: boolean;
  ready: boolean;
  connected: boolean;
  alive: boolean;
  lives: number;
  level: number;
  streak: number;
  placement: number | null;
  board: UnitView[];
  synergies: SynergyStatus[];
}

export interface SelfView {
  id: string;
  name: string;
  isBot: boolean;
  gold: number;
  level: number;
  xp: number;
  xpNeeded: number;
  lives: number;
  alive: boolean;
  streak: number;
  board: UnitView[];
  bench: BenchUnitView[];
  shop: (string | null)[];
  locked: boolean;
  synergies: SynergyStatus[];
  placement: number | null;
  lastResult: 'win' | 'loss' | 'draw' | null;
  lastDamage: number;
}

export interface RoomView {
  code: string;
  name: string;
  hostId: string;
  settings: LobbySettings;
  phase: GamePhase;
  round: number;
  maxRounds: number;
  timeLeft: number;
  selfId: string;
  players: PublicPlayer[];
  self: SelfView | null;
  opponentName?: string;
}

export interface LobbySummary {
  code: string;
  name: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  aiFill: boolean;
  phase: GamePhase;
}

export interface BattleUnitView {
  uid: string;
  defId: string;
  star: number;
  team: 0 | 1;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  shield: number;
  alive: boolean;
}

export interface BattleEffectView {
  id: string;
  kind: 'hit' | 'cast' | 'heal' | 'shield' | 'death' | 'miss';
  x: number;
  y: number;
  team: 0 | 1;
  value?: number;
  sx?: number;
  sy?: number;
}

export interface BattleSnapshot {
  round: number;
  time: number;
  units: BattleUnitView[];
  effects: BattleEffectView[];
  opponentName: string;
  result?: 'win' | 'loss' | 'draw';
}

export type ClientMessage =
  | { type: 'auth'; name: string; token?: string }
  | { type: 'set_name'; name: string }
  | { type: 'list_lobbies' }
  | { type: 'create_lobby'; name: string; settings: Partial<LobbySettings> }
  | { type: 'join_lobby'; code: string }
  | { type: 'quick_play' }
  | { type: 'leave_lobby' }
  | { type: 'ready'; ready: boolean }
  | { type: 'start_game' }
  | { type: 'buy_unit'; index: number }
  | { type: 'reroll' }
  | { type: 'buy_xp' }
  | { type: 'toggle_lock' }
  | { type: 'move_unit'; uid: string; to: { type: 'board'; x: number; y: number } | { type: 'bench' } }
  | { type: 'sell_unit'; uid: string }
  | { type: 'surrender' };

export type ServerMessage =
  | { type: 'auth'; playerId: string; token: string; playerName: string }
  | { type: 'lobby_list'; lobbies: LobbySummary[] }
  | { type: 'room'; room: RoomView }
  | { type: 'battle'; battle: BattleSnapshot }
  | { type: 'toast'; message: string }
  | { type: 'error'; message: string }
  | { type: 'left' }
  | { type: 'game_over'; placement: number; totalPlayers: number; victory: boolean };

export const BOARD_WIDTH = 8;
export const BOARD_HEIGHT = 8;
export const PLAYER_ROWS = [4, 5, 6, 7];
export const BENCH_SIZE = 9;
export const SHOP_SIZE = 5;
export const MAX_LEVEL = 9;
export const XP_THRESHOLDS = [0, 2, 4, 6, 10, 16, 22, 30, 40];
export const XP_FOR_LEVEL: Record<number, number> = {
  1: 2,
  2: 4,
  3: 6,
  4: 10,
  5: 16,
  6: 22,
  7: 30,
  8: 40,
  9: 0,
};
export const SHOP_ODDS: Record<number, number[]> = {
  1: [100, 0, 0, 0, 0],
  2: [72, 28, 0, 0, 0],
  3: [60, 30, 10, 0, 0],
  4: [50, 35, 15, 0, 0],
  5: [40, 35, 20, 5, 0],
  6: [30, 35, 25, 10, 0],
  7: [20, 30, 30, 15, 5],
  8: [15, 20, 30, 25, 10],
  9: [10, 15, 25, 30, 20],
};
export const POOL_COPIES: Record<number, number> = { 1: 18, 2: 14, 3: 10, 4: 7, 5: 4 };
export const STAR_MULTIPLIER = [0, 1, 1.8, 3.2];
export const SELL_VALUE = [0, 1, 3, 9, 27, 81];
export const RACE_NAMES: Record<Race, string> = {
  human: 'Люди',
  undead: 'Нежить',
  mech: 'Мехи',
  beast: 'Звери',
  demon: 'Демоны',
  elf: 'Эльфы',
};
export const CLASS_NAMES: Record<UnitClass, string> = {
  warrior: 'Воины',
  mage: 'Маги',
  hunter: 'Охотники',
  assassin: 'Убийцы',
};
