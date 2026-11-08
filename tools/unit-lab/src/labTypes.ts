import type { AttackStyle, UnitPalette } from '../../../src/client/unitModels';
import type { TuningShape } from '../../../src/shared/tuning';
import type { AbilityKind, Race, UnitClass } from '../../../src/shared/types';

export type LabMode = 'balance' | 'model' | 'animation';

export interface PartOverride {
  visible: boolean;
  /** Position offset added to the part's authored transform. */
  px: number;
  py: number;
  pz: number;
  /** Rotation offset in degrees. */
  rx: number;
  ry: number;
  rz: number;
  /** Uniform multiplier applied on top of the part's authored scale. */
  sx: number;
  sy: number;
  sz: number;
  /** Present only on primitives added in the Unit Lab. */
  shape?: TuningShape;
  width?: number;
  height?: number;
  depth?: number;
  color?: string;
  glow?: boolean;
}

export interface LabAbility {
  name: string;
  kind: AbilityKind;
  power: number;
  radius: number;
  duration: number;
  secondary: number;
}

export interface LabStats {
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
  ability: LabAbility;
}

export interface LabModel {
  palette: UnitPalette;
  scale: number;
  hover: number;
  /** Degrees. */
  yaw: number;
  parts: Record<string, PartOverride>;
}

export interface LabAnimation {
  attackStyle: AttackStyle;
  /** Play the cast animation for basic attacks and the attack animation for abilities. */
  swapAttackCast: boolean;
  /** Playback speed multiplier used by the lab preview. */
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

export interface UnitLabEntry {
  /** Authored unit id, kept for special-case mechanics (e.g. starweaver). */
  id: string;
  stats: LabStats;
  model: LabModel;
  animation: LabAnimation;
}

export interface LabState {
  version: 1;
  savedAt: string;
  units: Record<string, UnitLabEntry>;
}

export interface StatFieldMeta {
  path: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}
