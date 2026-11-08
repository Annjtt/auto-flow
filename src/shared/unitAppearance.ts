import type { UnitDef } from './types';

export type AttackStyle = 'melee' | 'ranged' | 'magic' | 'beast';

export interface UnitPalette {
  body: string;
  accent: string;
  glow: string;
}

/**
 * Animation parameters shared by the Unit Lab and the in-game renderer.
 * `speed` is a preview-only multiplier and is intentionally not applied to
 * authoritative combat timing.
 */
export interface UnitAnimationTuning {
  attackStyle: AttackStyle;
  /** Play the cast animation for basic attacks and the attack animation for abilities. */
  swapAttackCast: boolean;
  speed: number;
  attackDuration: number;
  castDuration: number;
  idleBobSpeed: number;
  idleBobAmount: number;
  idleSwaySpeed: number;
  idleSwayAmount: number;
  lunge: number;
  bodyPitch: number;
  meleeRoll: number;
  beastPitch: number;
  castScale: number;
  swingScale: number;
  weaponPower: number;
  castWeapon: number;
  offhandPower: number;
  headPower: number;
  wingFlap: number;
  wingCastFlap: number;
  wingSpeed: number;
  glowPulse: number;
  glowPulseSpeed: number;
  glowCast: number;
}

export const UNIT_PALETTES: Record<string, UnitPalette> = {
  squire: { body: '#c9b48a', accent: '#8b98a6', glow: '#ffd27a' },
  lightfoot: { body: '#b9975b', accent: '#5f7d65', glow: '#8fffc0' },
  arcanist: { body: '#8e7ac4', accent: '#d9b45a', glow: '#a98cff' },
  paladin: { body: '#e3c98e', accent: '#f2dd9a', glow: '#ffe28a' },
  ghoul: { body: '#7aa88a', accent: '#9b6b5a', glow: '#8fffa8' },
  crypt_archer: { body: '#b8c8b0', accent: '#6d7a63', glow: '#b6ffb0' },
  necromancer: { body: '#5b4a74', accent: '#89d0a8', glow: '#8affc0' },
  bone_dragon: { body: '#b8c3b0', accent: '#7fcfa8', glow: '#b9ffe0' },
  scrapbot: { body: '#8f9aa0', accent: '#c58b4a', glow: '#ffd18a' },
  steamgunner: { body: '#a58a62', accent: '#7fa8b8', glow: '#ffb45e' },
  sparkmage: { body: '#7d8fb5', accent: '#7ce6ff', glow: '#7cf0ff' },
  siege_colossus: { body: '#7e878d', accent: '#c25f3f', glow: '#ff8a5a' },
  direwolf: { body: '#8c7a66', accent: '#c7b299', glow: '#ffb070' },
  boar_rider: { body: '#9b745e', accent: '#6e523f', glow: '#d6a05a' },
  owl_sage: { body: '#c8b58d', accent: '#7fb08a', glow: '#b9ffe0' },
  elder_bear: { body: '#7a5b3f', accent: '#5f8a5a', glow: '#ffc07a' },
  imp: { body: '#b04a5d', accent: '#ff6b4a', glow: '#ff7a4a' },
  hellhound: { body: '#7a3b3b', accent: '#ff5a2a', glow: '#ff6a2a' },
  doomguard: { body: '#6e3a52', accent: '#d98a4a', glow: '#ff7a5a' },
  pit_fiend: { body: '#8a3c33', accent: '#e0a040', glow: '#ff5a3a' },
  scout: { body: '#7ea36b', accent: '#b8c78a', glow: '#c4ff9a' },
  blade_dancer: { body: '#7a9f84', accent: '#d8b46a', glow: '#b8ffe0' },
  starweaver: { body: '#8a8ac4', accent: '#e8d68a', glow: '#c9b8ff' },
  ancient_warden: { body: '#5f7350', accent: '#9a8a5a', glow: '#b9ff9a' },
};

/** Authored attack style per unit id, used before a model instance exists. */
export const ATTACK_STYLE_BY_ID: Record<string, AttackStyle> = {
  squire: 'melee',
  lightfoot: 'melee',
  arcanist: 'magic',
  paladin: 'melee',
  ghoul: 'melee',
  crypt_archer: 'ranged',
  necromancer: 'magic',
  bone_dragon: 'beast',
  scrapbot: 'melee',
  steamgunner: 'ranged',
  sparkmage: 'magic',
  siege_colossus: 'ranged',
  direwolf: 'beast',
  boar_rider: 'melee',
  owl_sage: 'magic',
  elder_bear: 'beast',
  imp: 'magic',
  hellhound: 'beast',
  doomguard: 'melee',
  pit_fiend: 'ranged',
  scout: 'ranged',
  blade_dancer: 'melee',
  starweaver: 'magic',
  ancient_warden: 'melee',
};

/** Authored hover offset per unit id. */
export const HOVER_BY_ID: Record<string, number> = {
  bone_dragon: 0.04,
  sparkmage: 0.12,
  owl_sage: 0.04,
  imp: 0.06,
  starweaver: 0.03,
};

export const DEFAULT_UNIT_ANIMATION: UnitAnimationTuning = {
  attackStyle: 'melee',
  swapAttackCast: false,
  speed: 1,
  attackDuration: 0.34,
  castDuration: 0.82,
  idleBobSpeed: 2.4,
  idleBobAmount: 0.018,
  idleSwaySpeed: 1.7,
  idleSwayAmount: 0.018,
  lunge: 0.12,
  bodyPitch: 0.1,
  meleeRoll: 0.07,
  beastPitch: 0.08,
  castScale: 0.05,
  swingScale: 0.018,
  weaponPower: 1,
  castWeapon: 0.95,
  offhandPower: 1,
  headPower: 1,
  wingFlap: 0.14,
  wingCastFlap: 0.42,
  wingSpeed: 5,
  glowPulse: 0.12,
  glowPulseSpeed: 5.5,
  glowCast: 0.85,
};

function fallbackPalette(def: UnitDef): UnitPalette {
  const byRace: Record<string, UnitPalette> = {
    human: { body: '#d7ad5b', accent: '#c9a46a', glow: '#ffe28a' },
    undead: { body: '#77c79a', accent: '#6d8f78', glow: '#b9ffe0' },
    mech: { body: '#9fb9c9', accent: '#c58b4a', glow: '#7cf0ff' },
    beast: { body: '#c4864f', accent: '#9a7a52', glow: '#ffc07a' },
    demon: { body: '#c75568', accent: '#d98a4a', glow: '#ff6a3a' },
    elf: { body: '#9bc77f', accent: '#b8c78a', glow: '#b9ffb0' },
  };
  return byRace[def.race] ?? { body: '#b9a267', accent: '#8fa6c7', glow: '#ffe28a' };
}

export function authoredPalette(def: UnitDef): UnitPalette {
  return UNIT_PALETTES[def.id] ?? fallbackPalette(def);
}

export function defaultAnimationFor(defId: string, attackStyle?: AttackStyle): UnitAnimationTuning {
  return {
    ...DEFAULT_UNIT_ANIMATION,
    attackStyle: attackStyle ?? ATTACK_STYLE_BY_ID[defId] ?? DEFAULT_UNIT_ANIMATION.attackStyle,
  };
}

export interface AnimationFrameState {
  /** Logical attack action, taking the swap into account. */
  attacking: boolean;
  /** Logical cast action, taking the swap into account. */
  casting: boolean;
  /** Progress of the logical attack action. */
  attackProgress: number;
  /** Progress of the logical cast action. */
  castProgress: number;
  /** Amplitude of the attack-motion channel. */
  swing: number;
  /** Amplitude of the cast-motion channel. */
  cast: number;
}

/**
 * Resolves the two animation timers into the values used by the renderer.
 *
 * The timers always belong to their authored clip (`attackTimer` = attack
 * motion, `castTimer` = cast motion). With `swapAttackCast` enabled the
 * triggers exchange which timer each logical action starts, so a basic attack
 * plays the cast clip and an ability plays the attack clip.
 */
export function computeAnimationFrame(
  animation: UnitAnimationTuning,
  attackTimer: number,
  castTimer: number,
): AnimationFrameState {
  const attackAnimating = attackTimer > 0;
  const castAnimating = castTimer > 0;
  const attackAnimProgress = attackAnimating
    ? 1 - attackTimer / Math.max(0.001, animation.attackDuration)
    : 0;
  const castAnimProgress = castAnimating
    ? 1 - castTimer / Math.max(0.001, animation.castDuration)
    : 0;
  const swap = animation.swapAttackCast;
  return {
    attacking: swap ? castAnimating : attackAnimating,
    casting: swap ? attackAnimating : castAnimating,
    attackProgress: swap ? castAnimProgress : attackAnimProgress,
    castProgress: swap ? attackAnimProgress : castAnimProgress,
    swing: attackAnimating ? Math.sin(attackAnimProgress * Math.PI) : 0,
    cast: castAnimating ? Math.sin(castAnimProgress * Math.PI) : 0,
  };
}
