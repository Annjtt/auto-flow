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
import type { MapObject, MapShape } from '../shared/maps';

const DEG_TO_RAD = Math.PI / 180;

export interface MapObjectVisual {
  mesh: Mesh;
  material: StandardMaterial;
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
