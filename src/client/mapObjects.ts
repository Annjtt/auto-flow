import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import '@babylonjs/core/Meshes/Builders/discBuilder';
import '@babylonjs/core/Meshes/Builders/sphereBuilder';
import '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { MapObject, MapAnimWave, MapShape } from '../shared/maps';

const DEG_TO_RAD = Math.PI / 180;

export interface MapObjectVisual {
  mesh: Mesh;
  material: StandardMaterial;
  /** Per-visual scratch colours used by the animator (avoids shared state). */
  animColor?: Color3;
  animEmissive?: Color3;
}

/** Oscillation in the -1..1 range for one loop, where t is 0..1. */
function animationWave(wave: MapAnimWave, t: number): number {
  switch (wave) {
    case 'triangle':
      return t < 0.5 ? -1 + t * 4 : 3 - t * 4;
    case 'pulse': {
      const sine = Math.sin(t * Math.PI * 2);
      return sine * Math.abs(sine);
    }
    case 'sine':
    default:
      return Math.sin(t * Math.PI * 2);
  }
}

function mixColor(target: Color3, from: Color3, to: Color3, amount: number): void {
  target.set(
    from.r + (to.r - from.r) * amount,
    from.g + (to.g - from.g) * amount,
    from.b + (to.b - from.b) * amount,
  );
}

/**
 * Applies a looped animation on top of an object's base transform and material.
 * The document is never modified: only the mesh/material are animated, so the
 * editor keeps the untouched base values.
 */
export function applyMapObjectAnimation(visual: MapObjectVisual, object: MapObject, time: number): void {
  const animation = object.animation;
  if (!animation || !animation.enabled || animation.tracks.length === 0) return;
  const duration = Math.max(0.1, animation.duration);
  const baseX = object.position[0];
  const baseY = object.position[1];
  const baseZ = object.position[2];
  let x = baseX;
  let y = baseY;
  let z = baseZ;
  let rx = object.rotation[0];
  let ry = object.rotation[1];
  let rz = object.rotation[2];
  let sx = object.scale[0];
  let sy = object.scale[1];
  let sz = object.scale[2];
  let alpha = object.alpha;
  let diffuse: Color3 | null = null;
  let emissive: Color3 | null = null;

  for (const track of animation.tracks) {
    const loop = ((time / duration + animation.phase + track.phase) % 1 + 1) % 1;
    const wave = animationWave(track.wave, loop);
    const delta = track.amplitude * wave;
    switch (track.property) {
      case 'position':
        if (track.axis === 'x') x += delta;
        else if (track.axis === 'z') z += delta;
        else y += delta;
        break;
      case 'rotation':
        if (track.axis === 'x') rx += delta;
        else if (track.axis === 'z') rz += delta;
        else ry += delta;
        break;
      case 'scale': {
        const factor = Math.max(0.01, 1 + delta);
        if (track.axis === 'x') sx *= factor;
        else if (track.axis === 'z') sz *= factor;
        else sy *= factor;
        break;
      }
      case 'alpha':
        alpha += delta;
        break;
      case 'color':
        if (!visual.animColor) visual.animColor = new Color3(1, 1, 1);
        mixColor(
          visual.animColor,
          Color3.FromHexString(object.color),
          Color3.FromHexString(track.color),
          (wave + 1) / 2,
        );
        diffuse = visual.animColor;
        break;
      case 'emissive':
        if (!visual.animEmissive) visual.animEmissive = new Color3(0, 0, 0);
        mixColor(
          visual.animEmissive,
          Color3.FromHexString(object.emissive),
          Color3.FromHexString(track.color),
          (wave + 1) / 2,
        );
        emissive = visual.animEmissive;
        break;
      default:
        break;
    }
  }

  visual.mesh.position.set(x, y, z);
  visual.mesh.rotation.set(rx * DEG_TO_RAD, ry * DEG_TO_RAD, rz * DEG_TO_RAD);
  visual.mesh.scaling.set(Math.max(0.01, sx), Math.max(0.01, sy), Math.max(0.01, sz));
  const clampedAlpha = Math.min(1, Math.max(0, alpha));
  visual.mesh.visibility = clampedAlpha;
  visual.material.alpha = clampedAlpha;
  if (diffuse) visual.material.diffuseColor = diffuse;
  if (emissive) visual.material.emissiveColor = emissive;
  if (object.visible) visual.mesh.setEnabled(true);
}

/**
 * True when an object's animation can visibly change it. Used by editors to
 * avoid writing animated transforms back into the document.
 */
export function hasObjectAnimation(object: MapObject | null | undefined): boolean {
  return Boolean(object?.animation?.enabled && object.animation.tracks.length > 0);
}

function baseMesh(scene: Scene, shape: MapShape, name: string): Mesh {
  switch (shape) {
    case 'sphere':
      return MeshBuilder.CreateSphere(name, { diameter: 1, segments: 18 }, scene);
    case 'cylinder':
      return MeshBuilder.CreateCylinder(name, { height: 1, diameter: 1, tessellation: 24 }, scene);
    case 'cone':
      return MeshBuilder.CreateCylinder(name, { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 24 }, scene);
    case 'torus':
      return MeshBuilder.CreateTorus(name, { diameter: 1, thickness: 0.24, tessellation: 32 }, scene);
    case 'plane':
      return MeshBuilder.CreateGround(name, { width: 1, height: 1, subdivisions: 1 }, scene);
    case 'pyramid':
      return MeshBuilder.CreateCylinder(name, { height: 1, diameterTop: 0, diameterBottom: 1.38, tessellation: 4 }, scene);
    case 'box':
    default:
      return MeshBuilder.CreateBox(name, { width: 1, height: 1, depth: 1 }, scene);
  }
}

/** Applies an object's transform and material without rebuilding the mesh. */
export function applyMapObjectTransform(mesh: Mesh, object: MapObject): void {
  mesh.position.set(object.position[0], object.position[1], object.position[2]);
  mesh.rotation.set(object.rotation[0] * DEG_TO_RAD, object.rotation[1] * DEG_TO_RAD, object.rotation[2] * DEG_TO_RAD);
  mesh.scaling.set(object.scale[0], object.scale[1], object.scale[2]);
  mesh.setEnabled(object.visible);
  mesh.visibility = object.alpha;
}

export function applyMapObjectMaterial(material: StandardMaterial, object: MapObject): void {
  material.diffuseColor = Color3.FromHexString(object.color);
  material.emissiveColor = Color3.FromHexString(object.emissive);
  material.alpha = object.alpha;
  material.backFaceCulling = false;
}

export interface CreateMapObjectOptions {
  pickable?: boolean;
  namePrefix?: string;
}

/**
 * Shared primitive factory used by the game scene and the Map Lab preview, so a
 * published map looks exactly the same in both places.
 */
export function createMapObjectMesh(
  scene: Scene,
  object: MapObject,
  options: CreateMapObjectOptions = {},
): MapObjectVisual {
  const prefix = options.namePrefix ?? 'mapObject';
  const mesh = baseMesh(scene, object.shape, `${prefix}-${object.id}`);
  const material = new StandardMaterial(`${prefix}-mat-${object.id}`, scene);
  material.specularColor = new Color3(0.12, 0.12, 0.16);
  applyMapObjectMaterial(material, object);
  mesh.material = material;
  mesh.metadata = { kind: 'map-object', objectId: object.id };
  mesh.isPickable = options.pickable === true;
  applyMapObjectTransform(mesh, object);
  return { mesh, material };
}
