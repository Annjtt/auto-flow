import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import '@babylonjs/core/Meshes/Builders/sphereBuilder';
import '@babylonjs/core/Meshes/Builders/torusBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { UnitDef } from '../shared/types';

export type AttackStyle = 'melee' | 'ranged' | 'magic' | 'beast';

export interface UnitPalette {
  body: string;
  accent: string;
  glow: string;
}

export interface WingPart {
  node: TransformNode;
  baseZ: number;
  sign: number;
}

export interface GradeOrb {
  mesh: Mesh;
  angle: number;
  radius: number;
  y: number;
  speed: number;
}

export interface UnitModel {
  body: TransformNode;
  head: TransformNode | null;
  headBase: Vector3;
  weapon: TransformNode | null;
  weaponBase: Vector3;
  offhand: TransformNode | null;
  offhandBase: Vector3;
  wings: WingPart[];
  glow: Mesh | null;
  glowBase: number;
  attackStyle: AttackStyle;
  hover: number;
  height: number;
  gradeOrbs: GradeOrb[];
  gradeHalo: Mesh | null;
  gradeScale: number;
}

export interface ModelContext {
  scene: Scene;
  material: (key: string, diffuse: string, emissive?: string) => StandardMaterial;
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

export function createUnitModel(ctx: ModelContext, def: UnitDef, uid: string, star = 1): UnitModel {
  const palette = UNIT_PALETTES[def.id] ?? fallbackPalette(def);
  const body = new TransformNode(`model-${uid}`, ctx.scene);
  const parts = buildUnit(ctx, def, palette, body, uid);

  parts.headBase = parts.head ? parts.head.rotation.clone() : Vector3.Zero();
  parts.weaponBase = parts.weapon ? parts.weapon.rotation.clone() : Vector3.Zero();
  parts.offhandBase = parts.offhand ? parts.offhand.rotation.clone() : Vector3.Zero();
  if (parts.glow) parts.glowBase = parts.glow.scaling.x || 1;
  const grade = applyGrade(ctx, def, palette, body, parts.height, uid, star);

  return {
    body,
    head: parts.head,
    headBase: parts.headBase,
    weapon: parts.weapon,
    weaponBase: parts.weaponBase,
    offhand: parts.offhand,
    offhandBase: parts.offhandBase,
    wings: parts.wings,
    glow: parts.glow,
    glowBase: parts.glowBase,
    attackStyle: parts.attackStyle,
    hover: parts.hover,
    height: parts.height,
    gradeOrbs: grade.orbs,
    gradeHalo: grade.halo,
    gradeScale: grade.scale,
  };
}

function applyGrade(
  ctx: ModelContext,
  def: UnitDef,
  palette: UnitPalette,
  body: TransformNode,
  height: number,
  uid: string,
  star: number,
): { orbs: GradeOrb[]; halo: Mesh | null; scale: number } {
  if (star < 2) return { orbs: [], halo: null, scale: 1 };

  const tier = Math.min(3, Math.max(2, star));
  const trimMat = ctx.material(
    `${def.id}-gradeTrim-${tier}`,
    tier >= 3 ? '#f5d98a' : '#cdbc8e',
    tier >= 3 ? '#7a4a10' : '#4a3a18',
  );
  const gemMat = ctx.material(`${def.id}-gradeGem-${tier}`, palette.glow, palette.glow);
  const scale = tier >= 3 ? 1.06 : 1.03;
  const orbs: GradeOrb[] = [];
  let seq = 0;
  const name = (kind: string) => `${uid}-${def.id}-grade${tier}-${kind}-${seq++}`;

  for (const sign of [-1, 1]) {
    const crest = MeshBuilder.CreateCylinder(
      name('crest'),
      { diameterTop: 0.015, diameterBottom: 0.11, height: 0.18, tessellation: 4 },
      ctx.scene,
    );
    crest.parent = body;
    crest.material = trimMat;
    crest.position.set(sign * 0.24, height * 0.43, 0.01);
    crest.rotation.z = sign * -0.36;
    crest.isPickable = false;
  }

  const gem = MeshBuilder.CreateSphere(name('gem'), { diameter: 0.085, segments: 8 }, ctx.scene);
  gem.parent = body;
  gem.material = gemMat;
  gem.position.set(0, height * 0.42, 0.19);
  gem.isPickable = false;

  let halo: Mesh | null = null;
  if (tier >= 3) {
    halo = MeshBuilder.CreateTorus(
      name('halo'),
      { diameter: 0.24, thickness: 0.018, tessellation: 24 },
      ctx.scene,
    );
    halo.parent = body;
    halo.material = gemMat;
    halo.position.set(0, height * 0.86, 0);
    halo.isPickable = false;

    for (const sign of [-1, 1]) {
      const fin = MeshBuilder.CreateCylinder(
        name('fin'),
        { diameterTop: 0, diameterBottom: 0.14, height: 0.34, tessellation: 3 },
        ctx.scene,
      );
      fin.parent = body;
      fin.material = gemMat;
      fin.position.set(sign * 0.2, height * 0.56, -0.18);
      fin.rotation.set(-0.35, 0, sign * 0.5);
      fin.isPickable = false;
    }
  }

  const count = tier >= 3 ? 4 : 2;
  for (let index = 0; index < count; index++) {
    const orb = MeshBuilder.CreateSphere(name('orb'), { diameter: tier >= 3 ? 0.06 : 0.05, segments: 4 }, ctx.scene);
    orb.parent = body;
    orb.material = gemMat;
    orb.isPickable = false;
    orbs.push({
      mesh: orb,
      angle: (index / count) * Math.PI * 2,
      radius: tier >= 3 ? 0.38 : 0.33,
      y: height * (tier >= 3 ? 0.62 : 0.56),
      speed: tier >= 3 ? 2.4 : 1.8,
    });
  }

  return { orbs, halo, scale };
}

interface BuiltParts {
  head: TransformNode | null;
  headBase: Vector3;
  weapon: TransformNode | null;
  weaponBase: Vector3;
  offhand: TransformNode | null;
  offhandBase: Vector3;
  wings: WingPart[];
  glow: Mesh | null;
  glowBase: number;
  attackStyle: AttackStyle;
  hover: number;
  height: number;
}

function buildUnit(ctx: ModelContext, def: UnitDef, palette: UnitPalette, body: TransformNode, uid: string): BuiltParts {
  const scene = ctx.scene;
  const mat = (suffix: string, diffuse: string, emissive = '#0a0806') =>
    ctx.material(`${def.id}-${suffix}`, diffuse, emissive);
  const bodyMat = mat('body', palette.body);
  const accentMat = mat('accent', palette.accent, '#141008');
  const glowMat = mat('glow', palette.glow, palette.glow);
  const darkMat = mat('dark', '#2a2622');
  const metalMat = mat('metal', '#8a8f92', '#1a1c1e');
  const woodMat = mat('wood', '#5a4530', '#120c07');
  const wingMat = mat('wing', palette.accent, '#0e0a06');

  let seq = 0;
  const name = (kind: string) => `${uid}-${def.id}-${kind}-${seq++}`;

  const node = (parent: TransformNode, kind: string, x = 0, y = 0, z = 0): TransformNode => {
    const created = new TransformNode(name(kind), scene);
    created.parent = parent;
    created.position.set(x, y, z);
    return created;
  };
  const box = (
    parent: TransformNode,
    kind: string,
    material: StandardMaterial,
    width: number,
    height: number,
    depth: number,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
  ): Mesh => {
    const mesh = MeshBuilder.CreateBox(name(kind), { width, height, depth }, scene);
    mesh.parent = parent;
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
  };
  const cyl = (
    parent: TransformNode,
    kind: string,
    material: StandardMaterial,
    diameterTop: number,
    diameterBottom: number,
    height: number,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    tessellation = 8,
  ): Mesh => {
    const mesh = MeshBuilder.CreateCylinder(
      name(kind),
      { diameterTop, diameterBottom, height, tessellation },
      scene,
    );
    mesh.parent = parent;
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
  };
  const sphere = (
    parent: TransformNode,
    kind: string,
    material: StandardMaterial,
    diameter: number,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ): Mesh => {
    const mesh = MeshBuilder.CreateSphere(name(kind), { diameter, segments: 8 }, scene);
    mesh.parent = parent;
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.scaling.set(sx, sy, sz);
    return mesh;
  };
  const torus = (
    parent: TransformNode,
    kind: string,
    material: StandardMaterial,
    diameter: number,
    thickness: number,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
  ): Mesh => {
    const mesh = MeshBuilder.CreateTorus(name(kind), { diameter, thickness, tessellation: 28 }, scene);
    mesh.parent = parent;
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
  };
  const legs = (parent: TransformNode, spread: number, front: number, back: number, matLeg: StandardMaterial, size = 0.1) => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        box(
          parent,
          'leg',
          matLeg,
          size,
          0.26,
          size,
          sx * spread,
          0.16,
          sz > 0 ? front : back,
        );
      }
    }
  };
  const boot = (parent: TransformNode, x: number, matBoot: StandardMaterial) => {
    box(parent, 'boot', matBoot, 0.14, 0.14, 0.2, x, 0.12, 0.03);
  };
  const claw = (parent: TransformNode, kind: string, x: number, y: number, z: number, matClaw: StandardMaterial, sign = 1) => {
    for (let i = -1; i <= 1; i++) {
      cyl(
        parent,
        kind,
        matClaw,
        0,
        0.035,
        0.18,
        x + i * 0.05,
        y,
        z,
        Math.PI / 2 + sign * 0.25,
        0,
        i * 0.28,
        4,
      );
    }
  };

  const built: BuiltParts = {
    head: null,
    headBase: Vector3.Zero(),
    weapon: null,
    weaponBase: Vector3.Zero(),
    offhand: null,
    offhandBase: Vector3.Zero(),
    wings: [],
    glow: null,
    glowBase: 1,
    attackStyle: 'melee',
    hover: 0,
    height: 1.42,
  };

  switch (def.id) {
    case 'squire': {
      cyl(body, 'torso', bodyMat, 0.34, 0.48, 0.5, 0, 0.4, 0);
      box(body, 'belt', accentMat, 0.42, 0.08, 0.32, 0, 0.21, 0);
      sphere(body, 'head', bodyMat, 0.3, 0, 0.76, 0);
      sphere(body, 'helmet', accentMat, 0.34, 0, 0.79, 0, 1, 0.68, 1);
      box(body, 'crest', glowMat, 0.06, 0.2, 0.14, 0, 1, -0.02);
      box(body, 'pauldron', accentMat, 0.5, 0.1, 0.3, 0, 0.61, 0);
      box(body, 'shield', accentMat, 0.1, 0.44, 0.36, -0.31, 0.45, 0.02);
      sphere(body, 'shieldBoss', glowMat, 0.1, -0.37, 0.46, 0.04);
      const weapon = node(body, 'weapon', 0.28, 0.56, 0.05);
      cyl(weapon, 'hilt', woodMat, 0.04, 0.04, 0.16, 0, 0, 0);
      box(weapon, 'guard', accentMat, 0.2, 0.04, 0.06, 0, 0.08, 0);
      box(weapon, 'blade', metalMat, 0.06, 0.38, 0.05, 0, 0.28, 0);
      boot(body, -0.14, darkMat);
      boot(body, 0.14, darkMat);
      built.weapon = weapon;
      built.attackStyle = 'melee';
      built.height = 1.45;
      break;
    }
    case 'lightfoot': {
      cyl(body, 'torso', bodyMat, 0.27, 0.36, 0.48, 0, 0.4, 0);
      box(body, 'belt', accentMat, 0.32, 0.06, 0.24, 0, 0.2, 0);
      sphere(body, 'head', bodyMat, 0.28, 0, 0.74, 0, 1, 1.05, 1);
      cyl(body, 'hood', accentMat, 0.06, 0.38, 0.3, 0, 0.91, -0.03, 0, 0, 0, 7);
      box(body, 'cape', accentMat, 0.32, 0.52, 0.05, 0, 0.42, -0.2, 0.16, 0, 0);
      const weapon = node(body, 'weapon', 0.27, 0.52, 0.06);
      box(weapon, 'dagger', metalMat, 0.035, 0.32, 0.06, 0, 0.18, 0);
      box(weapon, 'guard', accentMat, 0.14, 0.035, 0.04, 0, 0, 0);
      const offhand = node(body, 'offhand', -0.27, 0.52, 0.06);
      box(offhand, 'dagger', metalMat, 0.035, 0.3, 0.06, 0, 0.16, 0);
      box(offhand, 'guard', accentMat, 0.14, 0.035, 0.04, 0, 0, 0);
      boot(body, -0.13, darkMat);
      boot(body, 0.13, darkMat);
      built.weapon = weapon;
      built.offhand = offhand;
      built.attackStyle = 'melee';
      built.height = 1.42;
      break;
    }
    case 'arcanist': {
      cyl(body, 'robe', bodyMat, 0.24, 0.54, 0.62, 0, 0.37, 0);
      torus(body, 'rune', glowMat, 0.58, 0.025, 0, 0.18, 0);
      sphere(body, 'head', bodyMat, 0.28, 0, 0.8, 0);
      cyl(body, 'hood', accentMat, 0.04, 0.4, 0.34, 0, 0.97, -0.03, 0, 0, 0, 7);
      box(body, 'sash', accentMat, 0.38, 0.06, 0.28, 0, 0.34, 0);
      const weapon = node(body, 'weapon', 0.32, 0.5, 0.07);
      cyl(weapon, 'staff', woodMat, 0.035, 0.045, 0.92, 0, 0.38, 0);
      sphere(weapon, 'orb', glowMat, 0.16, 0, 0.88, 0);
      torus(weapon, 'orbRing', glowMat, 0.26, 0.015, 0, 0.88, 0, Math.PI / 2, 0, 0);
      built.weapon = weapon;
      built.glow = sphere(weapon, 'aura', glowMat, 0.28, 0, 0.88, 0);
      built.glow.scaling.setAll(0.8);
      built.glow.visibility = 0.28;
      built.attackStyle = 'magic';
      built.height = 1.5;
      break;
    }
    case 'paladin': {
      cyl(body, 'torso', bodyMat, 0.42, 0.54, 0.58, 0, 0.44, 0);
      box(body, 'plate', accentMat, 0.48, 0.24, 0.38, 0, 0.48, 0.05);
      sphere(body, 'head', bodyMat, 0.32, 0, 0.84, 0);
      sphere(body, 'helmet', accentMat, 0.37, 0, 0.87, 0, 1, 0.72, 1);
      box(body, 'crest', glowMat, 0.07, 0.26, 0.16, 0, 1.11, -0.02);
      box(body, 'pauldron', accentMat, 0.62, 0.12, 0.36, 0, 0.68, 0);
      box(body, 'shield', accentMat, 0.11, 0.52, 0.42, -0.37, 0.48, 0.03);
      box(body, 'shieldCrossV', glowMat, 0.04, 0.34, 0.06, -0.43, 0.48, 0.03);
      box(body, 'shieldCrossH', glowMat, 0.04, 0.06, 0.28, -0.43, 0.58, 0.03);
      const weapon = node(body, 'weapon', 0.32, 0.62, 0.06);
      cyl(weapon, 'shaft', woodMat, 0.04, 0.05, 0.52, 0, 0.22, 0);
      box(weapon, 'hammer', metalMat, 0.18, 0.18, 0.32, 0, 0.5, 0);
      box(weapon, 'hammerCore', glowMat, 0.1, 0.1, 0.34, 0, 0.5, 0);
      torus(body, 'halo', glowMat, 0.46, 0.026, 0, 1.09, 0, Math.PI / 2, 0, 0);
      box(body, 'cape', accentMat, 0.48, 0.64, 0.05, 0, 0.44, -0.24, 0.13, 0, 0);
      boot(body, -0.16, metalMat);
      boot(body, 0.16, metalMat);
      built.weapon = weapon;
      built.attackStyle = 'melee';
      built.height = 1.58;
      break;
    }
    case 'ghoul': {
      cyl(body, 'torso', bodyMat, 0.28, 0.42, 0.44, 0, 0.36, 0.03, 0.22, 0, 0);
      box(body, 'ribs', darkMat, 0.34, 0.12, 0.24, 0, 0.44, 0.08, 0.25, 0, 0);
      sphere(body, 'head', bodyMat, 0.29, 0, 0.67, 0.09, 1, 0.92, 1);
      sphere(body, 'jaw', darkMat, 0.2, 0, 0.58, 0.2, 1, 0.6, 1);
      sphere(body, 'eyeL', glowMat, 0.05, -0.08, 0.72, 0.23);
      sphere(body, 'eyeR', glowMat, 0.05, 0.08, 0.72, 0.23);
      const weapon = node(body, 'weapon', 0.3, 0.5, 0.08);
      cyl(weapon, 'arm', bodyMat, 0.09, 0.11, 0.42, 0, -0.16, 0, 0, 0, -0.35);
      claw(weapon, 'claw', 0, -0.44, 0.08, accentMat);
      const offhand = node(body, 'offhand', -0.3, 0.5, 0.08);
      cyl(offhand, 'arm', bodyMat, 0.09, 0.11, 0.42, 0, -0.16, 0, 0, 0, 0.35);
      claw(offhand, 'claw', 0, -0.44, 0.08, accentMat, -1);
      legs(body, 0.14, 0.12, -0.08, bodyMat, 0.1);
      built.weapon = weapon;
      built.offhand = offhand;
      built.attackStyle = 'melee';
      built.height = 1.35;
      break;
    }
    case 'crypt_archer': {
      cyl(body, 'spine', bodyMat, 0.14, 0.2, 0.48, 0, 0.44, 0);
      for (let i = 0; i < 3; i++) {
        torus(body, 'rib', accentMat, 0.34 - i * 0.03, 0.02, 0, 0.55 - i * 0.11, 0);
      }
      sphere(body, 'skull', bodyMat, 0.28, 0, 0.79, 0, 1, 0.95, 1);
      box(body, 'jaw', bodyMat, 0.18, 0.08, 0.16, 0, 0.68, 0.08);
      sphere(body, 'eyeL', glowMat, 0.05, -0.07, 0.81, 0.13);
      sphere(body, 'eyeR', glowMat, 0.05, 0.07, 0.81, 0.13);
      const weapon = node(body, 'weapon', 0.28, 0.52, 0.08);
      torus(weapon, 'bow', accentMat, 0.4, 0.026, 0, 0.04, 0, Math.PI / 2, 0, 0);
      box(weapon, 'string', glowMat, 0.012, 0.4, 0.012, 0, 0.04, 0);
      box(weapon, 'arrow', woodMat, 0.02, 0.02, 0.36, 0, 0.04, 0.14);
      cyl(body, 'quiver', accentMat, 0.12, 0.1, 0.38, -0.18, 0.53, -0.15, 0.22, 0, -0.25);
      for (let i = 0; i < 3; i++) {
        box(body, 'quiverArrow', woodMat, 0.015, 0.22, 0.015, -0.22 + i * 0.04, 0.76, -0.19, 0.22, 0, 0);
      }
      legs(body, 0.13, 0.1, -0.08, bodyMat, 0.09);
      built.weapon = weapon;
      built.attackStyle = 'ranged';
      built.height = 1.45;
      break;
    }
    case 'necromancer': {
      cyl(body, 'robe', bodyMat, 0.22, 0.56, 0.66, 0, 0.38, 0);
      torus(body, 'rune', glowMat, 0.62, 0.025, 0, 0.16, 0);
      sphere(body, 'skull', bodyMat, 0.28, 0, 0.82, 0, 1, 0.95, 1);
      sphere(body, 'eyeL', glowMat, 0.055, -0.07, 0.84, 0.13);
      sphere(body, 'eyeR', glowMat, 0.055, 0.07, 0.84, 0.13);
      box(body, 'jaw', darkMat, 0.17, 0.07, 0.14, 0, 0.72, 0.09);
      cyl(body, 'hood', accentMat, 0.03, 0.36, 0.28, 0, 0.98, -0.04, 0, 0, 0, 7);
      const weapon = node(body, 'weapon', 0.32, 0.5, 0.06);
      cyl(weapon, 'staff', woodMat, 0.035, 0.05, 0.94, 0, 0.38, 0);
      sphere(weapon, 'skullTop', bodyMat, 0.16, 0, 0.88, 0);
      sphere(weapon, 'eye', glowMat, 0.06, 0.05, 0.9, 0.07);
      cyl(weapon, 'hornL', accentMat, 0, 0.04, 0.16, -0.08, 0.98, 0, 0, 0, -0.5, 4);
      cyl(weapon, 'hornR', accentMat, 0, 0.04, 0.16, 0.08, 0.98, 0, 0, 0, 0.5, 4);
      built.weapon = weapon;
      built.glow = sphere(weapon, 'aura', glowMat, 0.32, 0, 0.88, 0);
      built.glow.visibility = 0.24;
      built.attackStyle = 'magic';
      built.height = 1.55;
      break;
    }
    case 'bone_dragon': {
      const head = node(body, 'headPivot', 0, 0.94, 0.52);
      box(body, 'torso', bodyMat, 0.46, 0.36, 0.82, 0, 0.55, -0.02);
      for (let i = 0; i < 4; i++) {
        box(body, 'spine', accentMat, 0.1, 0.12, 0.1, 0, 0.78, -0.32 + i * 0.19);
      }
      cyl(body, 'neck', bodyMat, 0.16, 0.22, 0.4, 0, 0.8, 0.38, 0.55, 0, 0, 6);
      box(head, 'skull', bodyMat, 0.3, 0.24, 0.34, 0, 0, 0.08);
      box(head, 'snout', bodyMat, 0.22, 0.16, 0.3, 0, -0.03, 0.34);
      box(head, 'jaw', darkMat, 0.2, 0.06, 0.28, 0, -0.12, 0.33);
      cyl(head, 'hornL', accentMat, 0, 0.05, 0.26, -0.13, 0.14, -0.02, 0.5, 0, -0.45, 4);
      cyl(head, 'hornR', accentMat, 0, 0.05, 0.26, 0.13, 0.14, -0.02, 0.5, 0, 0.45, 4);
      sphere(head, 'eyeL', glowMat, 0.06, -0.09, 0.03, 0.22);
      sphere(head, 'eyeR', glowMat, 0.06, 0.09, 0.03, 0.22);
      sphere(head, 'frost', glowMat, 0.12, 0, -0.03, 0.48);
      for (const sign of [-1, 1]) {
        const wing = node(body, 'wing', sign * 0.12, 0.67, -0.08);
        box(wing, 'bone', accentMat, 0.34, 0.05, 0.08, sign * 0.24, 0.05, -0.12, 0, 0, sign * 0.15);
        box(wing, 'membrane', wingMat, 0.4, 0.025, 0.32, sign * 0.26, 0.02, -0.2, 0, 0, sign * 0.1);
        box(wing, 'ribA', bodyMat, 0.34, 0.025, 0.04, sign * 0.24, 0.04, -0.05, 0, -sign * 0.3, 0);
        box(wing, 'ribB', bodyMat, 0.3, 0.025, 0.04, sign * 0.22, 0.02, -0.34, 0, sign * 0.35, 0);
        built.wings.push({ node: wing, baseZ: 0, sign });
      }
      for (const sx of [-1, 1]) {
        box(body, 'leg', bodyMat, 0.13, 0.3, 0.14, sx * 0.2, 0.23, 0.18, 0.2, 0, 0);
        box(body, 'leg', bodyMat, 0.12, 0.28, 0.13, sx * 0.18, 0.22, -0.28, -0.2, 0, 0);
      }
      const tail = node(body, 'tail', 0, 0.48, -0.42);
      for (let i = 0; i < 3; i++) {
        box(tail, 'tailBone', bodyMat, 0.1 - i * 0.02, 0.08, 0.24, 0, -i * 0.05, -0.16 - i * 0.2, -0.12, 0, 0);
      }
      built.head = head;
      built.glow = sphere(head, 'aura', glowMat, 0.24, 0, -0.03, 0.5) as Mesh;
      built.glow.visibility = 0.18;
      built.attackStyle = 'beast';
      built.hover = 0.04;
      built.height = 1.85;
      break;
    }
    case 'scrapbot': {
      box(body, 'torso', bodyMat, 0.46, 0.38, 0.38, 0, 0.43, 0);
      box(body, 'chest', accentMat, 0.3, 0.2, 0.06, 0, 0.45, 0.2);
      box(body, 'head', metalMat, 0.32, 0.24, 0.28, 0, 0.76, 0);
      box(body, 'eye', glowMat, 0.24, 0.06, 0.03, 0, 0.78, 0.15);
      cyl(body, 'antenna', metalMat, 0.015, 0.025, 0.24, 0, 0.98, -0.02);
      sphere(body, 'antennaTip', glowMat, 0.07, 0, 1.1, -0.02);
      for (const sx of [-1, 1]) {
        box(body, 'tread', darkMat, 0.17, 0.17, 0.46, sx * 0.27, 0.16, 0);
        for (let i = -1; i <= 1; i++) {
          cyl(body, 'wheel', metalMat, 0.1, 0.1, 0.04, sx * 0.36, 0.16, i * 0.14, 0, 0, Math.PI / 2, 8);
        }
      }
      const weapon = node(body, 'weapon', 0.3, 0.53, 0.05);
      box(weapon, 'arm', metalMat, 0.12, 0.3, 0.12, 0, -0.12, 0);
      box(weapon, 'clawA', accentMat, 0.08, 0.2, 0.05, -0.05, -0.3, 0.07, 0.4, 0, 0);
      box(weapon, 'clawB', accentMat, 0.08, 0.2, 0.05, 0.05, -0.3, 0.07, 0.4, 0, 0);
      const offhand = node(body, 'offhand', -0.3, 0.53, 0.05);
      box(offhand, 'arm', metalMat, 0.12, 0.3, 0.12, 0, -0.12, 0);
      box(offhand, 'clawA', accentMat, 0.08, 0.2, 0.05, -0.05, -0.3, 0.07, 0.4, 0, 0);
      box(offhand, 'clawB', accentMat, 0.08, 0.2, 0.05, 0.05, -0.3, 0.07, 0.4, 0, 0);
      built.weapon = weapon;
      built.offhand = offhand;
      built.attackStyle = 'melee';
      built.height = 1.4;
      break;
    }
    case 'steamgunner': {
      box(body, 'torso', bodyMat, 0.42, 0.36, 0.36, 0, 0.42, 0);
      box(body, 'plate', accentMat, 0.34, 0.24, 0.08, 0, 0.45, 0.19);
      cyl(body, 'head', metalMat, 0.26, 0.28, 0.24, 0, 0.74, 0);
      box(body, 'visor', glowMat, 0.2, 0.06, 0.03, 0, 0.76, 0.14);
      cyl(body, 'boiler', accentMat, 0.3, 0.3, 0.42, -0.08, 0.5, -0.22);
      cyl(body, 'chimney', metalMat, 0.09, 0.12, 0.3, -0.08, 0.84, -0.22);
      cyl(body, 'pipe', metalMat, 0.04, 0.04, 0.4, 0.08, 0.58, -0.12, 0.4, 0, 0.7);
      const weapon = node(body, 'weapon', 0.3, 0.52, 0.08);
      cyl(weapon, 'barrel', metalMat, 0.13, 0.16, 0.52, 0, 0, 0.2, Math.PI / 2, 0, 0, 10);
      torus(weapon, 'muzzle', glowMat, 0.28, 0.03, 0, 0, 0.46, 0, 0, 0);
      box(weapon, 'grip', accentMat, 0.1, 0.16, 0.1, 0, -0.1, 0);
      for (const sx of [-1, 1]) {
        box(body, 'leg', metalMat, 0.14, 0.24, 0.16, sx * 0.15, 0.15, 0);
      }
      built.weapon = weapon;
      built.attackStyle = 'ranged';
      built.height = 1.42;
      break;
    }
    case 'sparkmage': {
      sphere(body, 'core', bodyMat, 0.42, 0, 0.56, 0, 1, 1.15, 1);
      torus(body, 'frame', metalMat, 0.5, 0.03, 0, 0.56, 0, Math.PI / 2, 0, 0);
      torus(body, 'frame2', metalMat, 0.5, 0.03, 0, 0.56, 0, 0, 0, Math.PI / 2);
      sphere(body, 'head', bodyMat, 0.26, 0, 0.9, 0);
      sphere(body, 'eye', glowMat, 0.08, 0, 0.91, 0.12);
      for (const sign of [-1, 1]) {
        cyl(body, 'coil', metalMat, 0.05, 0.07, 0.28, sign * 0.3, 0.58, 0, 0, 0, sign * 0.4);
        sphere(body, 'spark', glowMat, 0.12, sign * 0.4, 0.68, 0);
        const wing = node(body, 'wing', sign * 0.2, 0.58, -0.12);
        box(wing, 'panel', accentMat, 0.26, 0.04, 0.22, sign * 0.16, 0.03, -0.1, 0, 0, sign * 0.18);
        built.wings.push({ node: wing, baseZ: 0, sign });
      }
      const weapon = node(body, 'weapon', 0.26, 0.55, 0.22);
      sphere(weapon, 'orb', glowMat, 0.18, 0, 0, 0);
      torus(weapon, 'ring', glowMat, 0.3, 0.018, 0, 0, 0, Math.PI / 2, 0, 0);
      built.weapon = weapon;
      built.glow = sphere(weapon, 'aura', glowMat, 0.3, 0, 0, 0);
      built.glow.visibility = 0.28;
      built.attackStyle = 'magic';
      built.hover = 0.12;
      built.height = 1.45;
      break;
    }
    case 'siege_colossus': {
      box(body, 'torso', bodyMat, 0.66, 0.54, 0.52, 0, 0.52, 0);
      box(body, 'plate', accentMat, 0.54, 0.3, 0.08, 0, 0.54, 0.28);
      box(body, 'head', metalMat, 0.34, 0.24, 0.3, 0, 0.89, 0.04);
      box(body, 'visor', glowMat, 0.26, 0.07, 0.03, 0, 0.9, 0.2);
      for (const sx of [-1, 1]) {
        cyl(body, 'pod', accentMat, 0.24, 0.26, 0.4, sx * 0.45, 0.68, 0.02, Math.PI / 2, 0, 0, 10);
        for (let i = -1; i <= 1; i++) {
          cyl(body, 'missile', darkMat, 0.06, 0.06, 0.12, sx * 0.45 + i * 0.1, 0.68, 0.25, Math.PI / 2, 0, 0, 6);
          sphere(body, 'missileTip', glowMat, 0.05, sx * 0.45 + i * 0.1, 0.68, 0.32);
        }
        box(body, 'leg', metalMat, 0.22, 0.34, 0.24, sx * 0.22, 0.2, 0);
        box(body, 'foot', darkMat, 0.28, 0.12, 0.36, sx * 0.22, 0.06, 0.05);
      }
      const weapon = node(body, 'weapon', 0, 0.62, 0.32);
      cyl(weapon, 'cannon', metalMat, 0.14, 0.18, 0.56, 0, 0, 0.1, Math.PI / 2, 0, 0, 10);
      torus(weapon, 'muzzle', glowMat, 0.32, 0.035, 0, 0, 0.38, 0, 0, 0);
      built.weapon = weapon;
      built.attackStyle = 'ranged';
      built.height = 1.72;
      break;
    }
    case 'direwolf': {
      box(body, 'torso', bodyMat, 0.38, 0.32, 0.64, 0, 0.45, -0.02);
      sphere(body, 'chest', bodyMat, 0.4, 0, 0.48, 0.26, 1, 0.9, 1);
      const head = node(body, 'headPivot', 0, 0.58, 0.42);
      box(head, 'skull', bodyMat, 0.3, 0.26, 0.3, 0, 0, 0.02);
      box(head, 'snout', bodyMat, 0.2, 0.15, 0.26, 0, -0.05, 0.24);
      box(head, 'nose', darkMat, 0.08, 0.07, 0.06, 0, -0.03, 0.38);
      for (const sx of [-1, 1]) {
        cyl(head, 'ear', accentMat, 0, 0.06, 0.16, sx * 0.11, 0.18, -0.04, 0, 0, sx * -0.2, 4);
        sphere(head, 'eye', glowMat, 0.055, sx * 0.08, 0.03, 0.14);
        claw(head, 'fang', sx * 0.06, -0.12, 0.32, metalMat, sx);
      }
      legs(body, 0.14, 0.22, -0.24, bodyMat, 0.1);
      const tail = node(body, 'tail', 0, 0.5, -0.38);
      box(tail, 'tailA', bodyMat, 0.1, 0.1, 0.28, 0, 0.02, -0.14, 0.3, 0, 0);
      box(tail, 'tailB', bodyMat, 0.08, 0.08, 0.24, 0, 0.1, -0.34, 0.6, 0, 0);
      built.head = head;
      built.attackStyle = 'beast';
      built.height = 1.3;
      break;
    }
    case 'boar_rider': {
      box(body, 'boarBody', bodyMat, 0.44, 0.36, 0.62, 0, 0.4, 0);
      sphere(body, 'boarChest', bodyMat, 0.44, 0, 0.43, 0.24, 1.1, 0.9, 1);
      const head = node(body, 'headPivot', 0, 0.46, 0.36);
      box(head, 'boarHead', bodyMat, 0.32, 0.28, 0.3, 0, 0, 0.02);
      box(head, 'snout', accentMat, 0.22, 0.16, 0.18, 0, -0.04, 0.23);
      for (const sx of [-1, 1]) {
        cyl(head, 'tusk', metalMat, 0, 0.05, 0.2, sx * 0.1, -0.09, 0.3, 0.9, 0, sx * 0.35, 4);
        cyl(head, 'ear', bodyMat, 0, 0.08, 0.14, sx * 0.13, 0.16, -0.02, 0, 0, sx * -0.35, 4);
        sphere(head, 'eye', glowMat, 0.05, sx * 0.08, 0.05, 0.15);
      }
      legs(body, 0.16, 0.22, -0.22, darkMat, 0.11);
      cyl(body, 'riderBody', bodyMat, 0.2, 0.26, 0.32, 0, 0.7, -0.06);
      sphere(body, 'riderHead', bodyMat, 0.22, 0, 0.92, -0.06);
      sphere(body, 'riderHelm', accentMat, 0.24, 0, 0.94, -0.06, 1, 0.7, 1);
      const weapon = node(body, 'weapon', 0.25, 0.78, 0.04);
      cyl(weapon, 'spear', woodMat, 0.025, 0.03, 0.78, 0, 0.26, 0);
      cyl(weapon, 'spearTip', metalMat, 0, 0.07, 0.22, 0, 0.72, 0, 0, 0, 0, 4);
      built.head = head;
      built.weapon = weapon;
      built.attackStyle = 'melee';
      built.height = 1.4;
      break;
    }
    case 'owl_sage': {
      sphere(body, 'body', bodyMat, 0.44, 0, 0.45, 0, 1.05, 1.12, 1);
      sphere(body, 'belly', accentMat, 0.34, 0, 0.4, 0.13, 1, 1.05, 0.7);
      sphere(body, 'head', bodyMat, 0.34, 0, 0.78, 0.02);
      for (const sx of [-1, 1]) {
        sphere(body, 'eyeRing', accentMat, 0.16, sx * 0.09, 0.81, 0.17, 1, 1, 0.6);
        sphere(body, 'eye', glowMat, 0.09, sx * 0.09, 0.81, 0.22);
        cyl(body, 'tuft', accentMat, 0, 0.05, 0.16, sx * 0.13, 0.99, 0, 0, 0, sx * 0.4, 4);
        const wing = node(body, 'wing', sx * 0.25, 0.55, -0.04);
        box(wing, 'wingPanel', wingMat, 0.14, 0.34, 0.3, sx * 0.06, -0.06, -0.03, 0, 0, sx * 0.2);
        built.wings.push({ node: wing, baseZ: 0, sign: sx });
      }
      cyl(body, 'beak', accentMat, 0, 0.1, 0.16, 0, 0.73, 0.2, 1.05, 0, 0, 4);
      const weapon = node(body, 'weapon', 0.3, 0.5, 0.08);
      cyl(weapon, 'staff', woodMat, 0.03, 0.04, 0.88, 0, 0.36, 0);
      sphere(weapon, 'orb', glowMat, 0.14, 0, 0.84, 0);
      torus(weapon, 'ring', glowMat, 0.24, 0.015, 0, 0.84, 0, Math.PI / 2, 0, 0);
      built.weapon = weapon;
      built.glow = sphere(weapon, 'aura', glowMat, 0.26, 0, 0.84, 0);
      built.glow.visibility = 0.24;
      built.attackStyle = 'magic';
      built.hover = 0.04;
      built.height = 1.45;
      break;
    }
    case 'elder_bear': {
      sphere(body, 'body', bodyMat, 0.56, 0, 0.55, -0.02, 1, 1.16, 1.05);
      sphere(body, 'chest', bodyMat, 0.44, 0, 0.52, 0.22, 1, 0.95, 1);
      const head = node(body, 'headPivot', 0, 0.9, 0.16);
      sphere(head, 'skull', bodyMat, 0.4, 0, 0, 0.04);
      box(head, 'muzzle', accentMat, 0.22, 0.18, 0.24, 0, -0.06, 0.24);
      sphere(head, 'nose', darkMat, 0.09, 0, -0.01, 0.38);
      for (const sx of [-1, 1]) {
        sphere(head, 'ear', bodyMat, 0.14, sx * 0.14, 0.19, -0.02);
        sphere(head, 'eye', glowMat, 0.055, sx * 0.1, 0.05, 0.18);
        cyl(body, 'arm', bodyMat, 0.14, 0.18, 0.44, sx * 0.36, 0.47, 0.1, 0, 0, sx * 0.4);
        claw(body, 'claw', sx * 0.44, 0.22, 0.2, accentMat, sx);
        box(body, 'leg', bodyMat, 0.16, 0.26, 0.18, sx * 0.2, 0.17, -0.02);
      }
      built.head = head;
      built.attackStyle = 'beast';
      built.height = 1.62;
      break;
    }
    case 'imp': {
      sphere(body, 'body', bodyMat, 0.34, 0, 0.4, 0, 1, 1.1, 1);
      sphere(body, 'head', bodyMat, 0.28, 0, 0.68, 0.02);
      for (const sx of [-1, 1]) {
        cyl(body, 'horn', accentMat, 0, 0.05, 0.18, sx * 0.1, 0.83, 0, 0, 0, sx * -0.4, 4);
        sphere(body, 'eye', glowMat, 0.05, sx * 0.07, 0.7, 0.14);
        const wing = node(body, 'wing', sx * 0.17, 0.5, -0.08);
        box(wing, 'membrane', wingMat, 0.3, 0.035, 0.22, sx * 0.18, 0.02, -0.08, 0, 0, sx * 0.3);
        box(wing, 'bone', accentMat, 0.28, 0.03, 0.04, sx * 0.16, 0.04, -0.06, 0, 0, sx * 0.16);
        built.wings.push({ node: wing, baseZ: 0, sign: sx });
        box(body, 'leg', bodyMat, 0.08, 0.18, 0.1, sx * 0.1, 0.14, 0);
      }
      const weapon = node(body, 'weapon', 0.25, 0.47, 0.12);
      sphere(weapon, 'fire', glowMat, 0.16, 0, 0, 0);
      torus(weapon, 'fireRing', glowMat, 0.24, 0.015, 0, 0, 0, Math.PI / 2, 0, 0);
      const tail = node(body, 'tail', 0, 0.35, -0.18);
      box(tail, 'tailA', bodyMat, 0.05, 0.05, 0.28, 0, 0.04, -0.12, 0.4, 0, 0);
      cyl(tail, 'spade', accentMat, 0, 0.09, 0.12, 0, 0.16, -0.3, 0.4, 0, 0, 4);
      built.weapon = weapon;
      built.glow = sphere(weapon, 'aura', glowMat, 0.24, 0, 0, 0);
      built.glow.visibility = 0.25;
      built.attackStyle = 'magic';
      built.hover = 0.06;
      built.height = 1.3;
      break;
    }
    case 'hellhound': {
      box(body, 'torso', bodyMat, 0.4, 0.34, 0.64, 0, 0.44, -0.02);
      sphere(body, 'chest', bodyMat, 0.42, 0, 0.47, 0.26, 1, 0.9, 1);
      for (let i = 0; i < 4; i++) {
        cyl(body, 'spike', accentMat, 0, 0.05, 0.2, 0, 0.65 - i * 0.01, 0.16 - i * 0.16, 0.25, 0, 0, 4);
      }
      const head = node(body, 'headPivot', 0, 0.56, 0.42);
      box(head, 'skull', bodyMat, 0.3, 0.26, 0.3, 0, 0, 0.02);
      box(head, 'snout', bodyMat, 0.2, 0.16, 0.24, 0, -0.04, 0.23);
      box(head, 'jaw', darkMat, 0.18, 0.06, 0.24, 0, -0.12, 0.22);
      sphere(head, 'ember', glowMat, 0.12, 0, -0.02, 0.36);
      for (const sx of [-1, 1]) {
        cyl(head, 'horn', accentMat, 0, 0.05, 0.2, sx * 0.12, 0.16, -0.04, 0.5, 0, sx * 0.4, 4);
        sphere(head, 'eye', glowMat, 0.06, sx * 0.08, 0.04, 0.14);
      }
      legs(body, 0.15, 0.22, -0.24, bodyMat, 0.1);
      const tail = node(body, 'tail', 0, 0.5, -0.38);
      box(tail, 'tailA', bodyMat, 0.1, 0.1, 0.28, 0, 0.02, -0.14, 0.3, 0, 0);
      cyl(tail, 'tailFlame', glowMat, 0, 0.16, 0.26, 0, 0.13, -0.34, 0.9, 0, 0, 5);
      built.head = head;
      built.glow = sphere(head, 'aura', glowMat, 0.26, 0, -0.02, 0.38);
      built.glow.visibility = 0.2;
      built.attackStyle = 'beast';
      built.height = 1.34;
      break;
    }
    case 'doomguard': {
      cyl(body, 'torso', bodyMat, 0.36, 0.5, 0.62, 0, 0.5, 0);
      box(body, 'plate', accentMat, 0.46, 0.24, 0.34, 0, 0.56, 0.06);
      sphere(body, 'head', bodyMat, 0.3, 0, 0.88, 0.02);
      box(body, 'jaw', darkMat, 0.2, 0.09, 0.18, 0, 0.8, 0.15);
      for (const sx of [-1, 1]) {
        cyl(body, 'horn', accentMat, 0, 0.07, 0.32, sx * 0.13, 1.02, -0.02, 0.1, 0, sx * 0.55, 4);
        sphere(body, 'eye', glowMat, 0.06, sx * 0.09, 0.9, 0.15);
        box(body, 'hoof', darkMat, 0.16, 0.12, 0.24, sx * 0.17, 0.09, 0.04);
        box(body, 'leg', bodyMat, 0.14, 0.34, 0.16, sx * 0.17, 0.26, 0);
        const wing = node(body, 'wing', sx * 0.18, 0.7, -0.12);
        box(wing, 'membrane', wingMat, 0.34, 0.035, 0.28, sx * 0.18, 0.02, -0.12, 0, 0, sx * 0.2);
        box(wing, 'bone', accentMat, 0.3, 0.03, 0.05, sx * 0.15, 0.04, -0.1, 0, 0, sx * 0.12);
        built.wings.push({ node: wing, baseZ: 0, sign: sx });
      }
      const weapon = node(body, 'weapon', 0.34, 0.68, 0.08);
      cyl(weapon, 'grip', woodMat, 0.04, 0.05, 0.24, 0, 0, 0);
      box(weapon, 'blade', metalMat, 0.07, 0.62, 0.13, 0, 0.4, 0);
      box(weapon, 'bladeTip', metalMat, 0.06, 0.18, 0.1, 0, 0.78, 0, 0, 0, 0);
      box(weapon, 'guard', accentMat, 0.24, 0.06, 0.08, 0, 0.1, 0);
      built.weapon = weapon;
      built.attackStyle = 'melee';
      built.height = 1.66;
      break;
    }
    case 'pit_fiend': {
      cyl(body, 'torso', bodyMat, 0.42, 0.58, 0.66, 0, 0.52, 0);
      box(body, 'chest', accentMat, 0.5, 0.26, 0.4, 0, 0.56, 0.06);
      sphere(body, 'head', bodyMat, 0.34, 0, 0.92, 0.04);
      box(body, 'jaw', darkMat, 0.24, 0.1, 0.2, 0, 0.83, 0.18);
      for (const sx of [-1, 1]) {
        cyl(body, 'horn', accentMat, 0, 0.09, 0.4, sx * 0.16, 1.08, -0.02, 0.15, 0, sx * 0.5, 4);
        sphere(body, 'eye', glowMat, 0.07, sx * 0.1, 0.94, 0.18);
        box(body, 'hoof', darkMat, 0.18, 0.12, 0.28, sx * 0.19, 0.09, 0.05);
        box(body, 'leg', bodyMat, 0.16, 0.36, 0.18, sx * 0.19, 0.27, 0);
        const wing = node(body, 'wing', sx * 0.2, 0.74, -0.14);
        box(wing, 'membrane', wingMat, 0.42, 0.035, 0.34, sx * 0.22, 0.02, -0.15, 0, 0, sx * 0.18);
        box(wing, 'bone', accentMat, 0.38, 0.03, 0.05, sx * 0.2, 0.04, -0.13, 0, 0, sx * 0.12);
        built.wings.push({ node: wing, baseZ: 0, sign: sx });
        cyl(body, 'arm', bodyMat, 0.12, 0.15, 0.42, sx * 0.4, 0.55, 0.08, 0, 0, sx * 0.45);
        claw(body, 'claw', sx * 0.48, 0.3, 0.18, accentMat, sx);
      }
      const weapon = node(body, 'weapon', 0.38, 0.56, 0.18);
      sphere(weapon, 'fire', glowMat, 0.22, 0, 0, 0);
      torus(weapon, 'fireRing', glowMat, 0.34, 0.02, 0, 0, 0, Math.PI / 2, 0, 0);
      built.weapon = weapon;
      built.glow = sphere(weapon, 'aura', glowMat, 0.34, 0, 0, 0);
      built.glow.visibility = 0.24;
      built.attackStyle = 'ranged';
      built.height = 1.66;
      break;
    }
    case 'scout': {
      cyl(body, 'torso', bodyMat, 0.26, 0.36, 0.46, 0, 0.4, 0);
      box(body, 'belt', accentMat, 0.32, 0.06, 0.24, 0, 0.2, 0);
      sphere(body, 'head', bodyMat, 0.28, 0, 0.74, 0);
      cyl(body, 'hood', accentMat, 0.05, 0.36, 0.3, 0, 0.91, -0.03, 0, 0, 0, 7);
      box(body, 'cloak', accentMat, 0.34, 0.56, 0.05, 0, 0.42, -0.2, 0.15, 0, 0);
      box(body, 'ponytail', accentMat, 0.06, 0.28, 0.06, 0, 0.6, -0.2, -0.4, 0, 0);
      const weapon = node(body, 'weapon', 0.29, 0.52, 0.08);
      torus(weapon, 'longbow', accentMat, 0.46, 0.024, 0, 0.04, 0, Math.PI / 2, 0, 0);
      box(weapon, 'string', glowMat, 0.012, 0.46, 0.012, 0, 0.04, 0);
      box(weapon, 'arrow', woodMat, 0.02, 0.02, 0.42, 0, 0.04, 0.16);
      cyl(body, 'quiver', accentMat, 0.12, 0.1, 0.38, -0.18, 0.53, -0.15, 0.22, 0, -0.25);
      for (let i = 0; i < 3; i++) {
        box(body, 'quiverArrow', woodMat, 0.015, 0.22, 0.015, -0.22 + i * 0.04, 0.76, -0.19, 0.22, 0, 0);
      }
      boot(body, -0.13, darkMat);
      boot(body, 0.13, darkMat);
      built.weapon = weapon;
      built.attackStyle = 'ranged';
      built.height = 1.44;
      break;
    }
    case 'blade_dancer': {
      cyl(body, 'torso', bodyMat, 0.28, 0.38, 0.48, 0, 0.42, 0);
      box(body, 'sash', accentMat, 0.36, 0.07, 0.28, 0, 0.3, 0);
      sphere(body, 'head', bodyMat, 0.28, 0, 0.76, 0);
      box(body, 'ponytail', accentMat, 0.08, 0.34, 0.08, 0, 0.62, -0.22, -0.5, 0, 0.2);
      box(body, 'scarf', accentMat, 0.3, 0.06, 0.06, 0, 0.66, -0.18, 0, 0, 0.2);
      const weapon = node(body, 'weapon', 0.3, 0.58, 0.06);
      box(weapon, 'blade', metalMat, 0.045, 0.46, 0.05, 0, 0.24, 0, 0, 0, 0.18);
      box(weapon, 'guard', accentMat, 0.16, 0.04, 0.06, 0, 0.02, 0);
      const offhand = node(body, 'offhand', -0.3, 0.58, 0.06);
      box(offhand, 'blade', metalMat, 0.045, 0.46, 0.05, 0, 0.24, 0, 0, 0, -0.18);
      box(offhand, 'guard', accentMat, 0.16, 0.04, 0.06, 0, 0.02, 0);
      boot(body, -0.13, darkMat);
      boot(body, 0.13, darkMat);
      built.weapon = weapon;
      built.offhand = offhand;
      built.attackStyle = 'melee';
      built.height = 1.44;
      break;
    }
    case 'starweaver': {
      cyl(body, 'robe', bodyMat, 0.22, 0.52, 0.6, 0, 0.36, 0);
      torus(body, 'rune', glowMat, 0.56, 0.022, 0, 0.16, 0);
      sphere(body, 'head', bodyMat, 0.28, 0, 0.8, 0);
      cyl(body, 'hood', accentMat, 0.04, 0.38, 0.3, 0, 0.96, -0.03, 0, 0, 0, 7);
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        sphere(body, 'star', glowMat, 0.13, Math.cos(angle) * 0.38, 0.58 + Math.sin(angle * 2) * 0.1, Math.sin(angle) * 0.3);
      }
      const weapon = node(body, 'weapon', 0.32, 0.5, 0.06);
      cyl(weapon, 'staff', woodMat, 0.03, 0.045, 0.92, 0, 0.38, 0);
      for (let i = 0; i < 3; i++) {
        box(weapon, 'starRay', glowMat, 0.025, 0.28, 0.025, 0, 0.92, 0, 0, (i * Math.PI) / 3, 0);
      }
      sphere(weapon, 'starCore', glowMat, 0.14, 0, 0.92, 0);
      built.weapon = weapon;
      built.glow = sphere(weapon, 'aura', glowMat, 0.32, 0, 0.92, 0);
      built.glow.visibility = 0.24;
      built.attackStyle = 'magic';
      built.hover = 0.03;
      built.height = 1.55;
      break;
    }
    case 'ancient_warden': {
      cyl(body, 'trunk', bodyMat, 0.34, 0.52, 0.7, 0, 0.45, 0);
      for (let i = 0; i < 5; i++) {
        box(body, 'bark', accentMat, 0.06, 0.16, 0.3, -0.22 + i * 0.11, 0.3 + i * 0.09, 0.2, 0, 0, 0.1);
      }
      sphere(body, 'head', bodyMat, 0.4, 0, 0.9, 0.02, 1, 0.9, 0.95);
      for (const sx of [-1, 1]) {
        sphere(body, 'eye', glowMat, 0.07, sx * 0.1, 0.93, 0.2);
        cyl(body, 'branch', woodMat, 0.05, 0.09, 0.52, sx * 0.36, 0.66, 0.02, 0, 0, sx * 0.6, 6);
        claw(body, 'twig', sx * 0.5, 0.54, 0.16, accentMat, sx);
        box(body, 'root', darkMat, 0.16, 0.22, 0.22, sx * 0.2, 0.11, 0.04);
      }
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        sphere(body, 'leaf', glowMat, 0.16, Math.cos(angle) * 0.24, 1.13 + Math.sin(angle * 2) * 0.06, Math.sin(angle) * 0.24);
      }
      box(body, 'shield', accentMat, 0.12, 0.52, 0.44, -0.35, 0.52, 0.03);
      torus(body, 'shieldRune', glowMat, 0.28, 0.022, -0.42, 0.52, 0.03, 0, Math.PI / 2, 0);
      built.attackStyle = 'melee';
      built.height = 1.72;
      break;
    }
    default: {
      cyl(body, 'torso', bodyMat, 0.3, 0.42, 0.5, 0, 0.4, 0);
      sphere(body, 'head', bodyMat, 0.3, 0, 0.76, 0);
      break;
    }
  }

  body.getChildMeshes().forEach((mesh) => {
    mesh.isPickable = true;
  });

  return built;
}
