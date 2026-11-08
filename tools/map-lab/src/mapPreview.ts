import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { PointerEventTypes, type PointerInfo } from '@babylonjs/core/Events/pointerEvents';
import { GizmoManager } from '@babylonjs/core/Gizmos/gizmoManager';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import '@babylonjs/core/Meshes/Builders/discBuilder';
import '@babylonjs/core/Meshes/Builders/sphereBuilder';
import '@babylonjs/core/Meshes/Builders/torusBuilder';
import '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Rendering/edgesRenderer';
import { Scene } from '@babylonjs/core/scene';
import {
  MAP_SHAPES,
  createMapObject,
  themeForDoc,
  type BuiltinMapId,
  type MapDoc,
  type MapObject,
  type MapShape,
  type MapTheme,
  type Vec3,
} from '../../../src/shared/maps';
import { applyMapObjectMaterial, applyMapObjectTransform, createMapObjectMesh } from '../../../src/client/mapObjects';
import { GROUND_Y, MapStage } from '../../../src/client/mapStage';

export type GizmoMode = 'move' | 'rotate' | 'scale';

export interface MapPreviewCallbacks {
  onSelect: (id: string | null) => void;
  onTransform: (id: string, transform: { position: Vec3; rotation: Vec3; scale: Vec3 }) => void;
  onPlace: (position: Vec3) => void;
}

interface ObjectVisual {
  mesh: Mesh;
  material: StandardMaterial;
  shape: MapShape;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function round(value: number, digits = 3): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export class MapPreview {
  readonly engine: Engine;
  readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: MapPreviewCallbacks;
  private readonly camera: ArcRotateCamera;
  private readonly hemi: HemisphericLight;
  private readonly dir: DirectionalLight;
  private readonly glowLayer: GlowLayer;
  private readonly selectionLayer: HighlightLayer;
  private readonly gizmos: GizmoManager;
  private stage: MapStage | null = null;
  private stageRoot: TransformNode | null = null;
  private stageBase: BuiltinMapId | null = null;
  private readonly stageMaterials = new Map<string, StandardMaterial>();
  private visuals = new Map<string, ObjectVisual>();
  private objects: MapObject[] = [];
  private selectedId: string | null = null;
  private hoverId: string | null = null;
  private ghost: ObjectVisual | null = null;
  private placementShape: MapShape | null = null;
  private snapEnabled = true;
  private snapStep = 0.25;
  private mode: GizmoMode = 'move';
  private resizeObserver: ResizeObserver | null = null;
  private lastTransform = '';
  private lastGhostSignature = '';
  private theme: MapTheme | null = null;
  private time = 0;
  private placementHalf = 0.5;

  constructor(canvas: HTMLCanvasElement, callbacks: MapPreviewCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.03, 0.045, 0.07, 1);
    this.scene.ambientColor = new Color3(0.22, 0.26, 0.36);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = new Color3(0.03, 0.06, 0.06);
    this.scene.fogDensity = 0.012;

    this.camera = new ArcRotateCamera('map-camera', Math.PI / 2, 0.9, 30, new Vector3(0, -0.35, 0.6), this.scene);
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 6;
    this.camera.upperRadiusLimit = 72;
    this.camera.lowerBetaLimit = 0.16;
    this.camera.upperBetaLimit = 1.46;
    this.camera.wheelPrecision = 40;
    this.camera.panningSensibility = 700;
    this.camera.inertia = 0.76;

    this.hemi = new HemisphericLight('map-hemi', new Vector3(0.2, 1, 0.1), this.scene);
    this.dir = new DirectionalLight('map-dir', new Vector3(-0.5, -1, -0.35), this.scene);
    this.dir.position = new Vector3(9, 15, 8);
    this.glowLayer = new GlowLayer('map-glow', this.scene);
    this.glowLayer.intensity = 0.4;

    this.buildStage('jaddy');
    this.buildPicker();

    this.selectionLayer = new HighlightLayer('map-selection', this.scene);
    this.selectionLayer.innerGlow = false;
    this.selectionLayer.outerGlow = true;
    this.selectionLayer.blurHorizontalSize = 0.6;
    this.selectionLayer.blurVerticalSize = 0.6;

    this.gizmos = new GizmoManager(this.scene);
    this.gizmos.usePointerToAttachGizmos = false;
    this.gizmos.positionGizmoEnabled = true;
    this.gizmos.rotationGizmoEnabled = false;
    this.gizmos.scaleGizmoEnabled = false;
    this.gizmos.boundingBoxGizmoEnabled = false;

    this.scene.onPointerObservable.add((info) => this.handlePointer(info));
    this.engine.runRenderLoop(() => {
      this.time += this.engine.getDeltaTime() / 1000;
      this.stage?.animate(this.time);
      this.syncMeshTransform();
      this.scene.render();
    });
    this.resizeObserver = new ResizeObserver(() => this.engine.resize());
    this.resizeObserver.observe(canvas);
    if (canvas.parentElement) this.resizeObserver.observe(canvas.parentElement);
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }

  setTheme(theme: MapTheme): void {
    this.theme = theme;
    const sky = Color3.FromHexString(theme.sky);
    this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
    this.scene.fogColor = Color3.FromHexString(theme.fog);
    this.scene.fogDensity = theme.fogDensity;
    this.hemi.diffuse = Color3.FromHexString(theme.hemiDiffuse);
    this.hemi.groundColor = Color3.FromHexString(theme.hemiGround);
    this.hemi.intensity = theme.hemiIntensity;
    this.dir.diffuse = Color3.FromHexString(theme.dirDiffuse);
    this.dir.intensity = theme.dirIntensity;
    this.glowLayer.intensity = theme.glow;
    // The real stage materials (island, rocks, table, board, decor) live in the
    // shared builder, exactly like in the game scene.
    this.stage?.applyTheme(theme);
    this.ghost?.material.diffuseColor.copyFrom(Color3.FromHexString(theme.accent));
    this.ghost?.material.emissiveColor.copyFrom(Color3.FromHexString(theme.accent));
  }

  setDoc(doc: MapDoc): void {
    if (this.stageBase !== doc.base) this.buildStage(doc.base);
    this.setTheme(themeForDoc(doc));
    this.objects = doc.objects;
    this.syncObjects();
    this.setSelection(doc.objects.some((object) => object.id === this.selectedId) ? this.selectedId : null);
  }

  setObjects(objects: MapObject[]): void {
    this.objects = objects;
    this.syncObjects();
  }

  setSelection(id: string | null): void {
    this.selectedId = id;
    this.gizmos.attachToMesh(id ? (this.visuals.get(id)?.mesh ?? null) : null);
    this.updateHighlight();
    if (id) {
      const visual = this.visuals.get(id);
      const object = this.objects.find((entry) => entry.id === id);
      this.gizmos.positionGizmoEnabled = this.mode === 'move' && Boolean(object) && !object?.locked;
      this.gizmos.rotationGizmoEnabled = this.mode === 'rotate' && Boolean(object) && !object?.locked;
      this.gizmos.scaleGizmoEnabled = this.mode === 'scale' && Boolean(object) && !object?.locked;
      if (visual) this.lastTransform = this.transformSignature(visual.mesh);
    }
    if (!id) {
      this.gizmos.positionGizmoEnabled = false;
      this.gizmos.rotationGizmoEnabled = false;
      this.gizmos.scaleGizmoEnabled = false;
    }
  }

  setGizmoMode(mode: GizmoMode): void {
    this.mode = mode;
    this.setSelection(this.selectedId);
  }

  setSnapping(enabled: boolean, step = this.snapStep): void {
    this.snapEnabled = enabled;
    this.snapStep = step;
    this.applySnapping();
  }

  setPlacement(shape: MapShape | null): void {
    this.placementShape = shape;
    if (!shape) {
      this.ghost?.mesh.setEnabled(false);
      return;
    }
    const accent = this.theme?.accent ?? '#d9b56c';
    const object = createMapObject(shape, [0, 0, 0]);
    this.placementHalf = shape === 'plane' ? 0.01 : object.scale[1] / 2;
    object.position = [0, GROUND_Y + this.placementHalf, 0];
    object.color = accent;
    object.emissive = accent;
    if (this.ghost) {
      this.ghost.mesh.dispose(false, false);
      this.ghost.material.dispose();
    }
    const ghost = createMapObjectMesh(this.scene, object, { pickable: false, namePrefix: 'map-ghost' });
    this.ghost = { ...ghost, shape };
    ghost.mesh.visibility = 0.5;
    ghost.material.alpha = 0.42;
    ghost.material.disableLighting = true;
    ghost.mesh.setEnabled(false);
    this.lastGhostSignature = '';
  }

  focusObject(id: string): void {
    const object = this.objects.find((entry) => entry.id === id);
    if (!object) return;
    this.camera.setTarget(new Vector3(object.position[0], object.position[1], object.position[2]));
    this.camera.radius = Math.min(this.camera.radius, 12);
  }

  focusBoard(): void {
    this.camera.setTarget(new Vector3(0, -0.35, 0.6));
    this.camera.radius = 30;
    this.camera.alpha = Math.PI / 2;
    this.camera.beta = 0.9;
  }

  resize(): void {
    this.engine.resize();
  }

  getSelectedMesh(): AbstractMesh | null {
    return this.selectedId ? (this.visuals.get(this.selectedId)?.mesh ?? null) : null;
  }

  private buildStage(base: BuiltinMapId): void {
    this.stageRoot?.dispose(false, false);
    this.stageRoot = null;
    for (const material of this.stageMaterials.values()) material.dispose();
    this.stageMaterials.clear();

    const root = new TransformNode('map-stage-root', this.scene);
    this.stageRoot = root;
    this.stageBase = base;
    this.stage = new MapStage(this.scene, this.stageMaterials, { base, interactive: true, root });
    this.stage.build();
    if (this.theme) this.stage.applyTheme(this.theme);
  }

  private buildPicker(): void {
    // Invisible ground at island level so decorations can be placed off-board;
    // the real board tiles sit above it and win the pick on the arena.
    const picker = MeshBuilder.CreateGround('map-picker', { width: 30, height: 30, subdivisions: 1 }, this.scene);
    picker.position.y = GROUND_Y + 0.02;
    picker.visibility = 0;
    picker.isPickable = true;
    picker.metadata = { kind: 'editor-ground' };
  }

  private syncObjects(): void {
    const alive = new Set(this.objects.map((object) => object.id));
    for (const [id, visual] of this.visuals) {
      if (alive.has(id)) continue;
      this.selectionLayer.removeMesh(visual.mesh);
      visual.mesh.dispose(false, false);
      visual.material.dispose();
      this.visuals.delete(id);
    }
    for (const object of this.objects) {
      let visual = this.visuals.get(object.id);
      if (visual && visual.shape !== object.shape) {
        this.selectionLayer.removeMesh(visual.mesh);
        visual.mesh.dispose(false, false);
        visual.material.dispose();
        this.visuals.delete(object.id);
        visual = undefined;
      }
      if (!visual) {
        const created = createMapObjectMesh(this.scene, object, { pickable: true, namePrefix: 'map-edit' });
        visual = { ...created, shape: object.shape };
        this.visuals.set(object.id, visual);
      }
      applyMapObjectTransform(visual.mesh, object);
      applyMapObjectMaterial(visual.material, object);
      visual.mesh.metadata = { kind: 'map-object', objectId: object.id };
      visual.mesh.isPickable = object.visible;
    }
    if (this.selectedId && !alive.has(this.selectedId)) this.setSelection(null);
    else this.updateHighlight();
  }

  private updateHighlight(): void {
    this.selectionLayer.removeAllMeshes();
    if (this.hoverId && this.hoverId !== this.selectedId) {
      const hover = this.visuals.get(this.hoverId);
      if (hover) this.selectionLayer.addMesh(hover.mesh, Color3.FromHexString('#6db8ff'));
    }
    if (this.selectedId) {
      const selected = this.visuals.get(this.selectedId);
      if (selected) this.selectionLayer.addMesh(selected.mesh, Color3.FromHexString('#f2d89a'));
    }
  }

  private applySnapping(): void {
    const position = this.gizmos.gizmos.positionGizmo;
    if (position) position.snapDistance = this.snapEnabled ? this.snapStep : 0;
    const rotation = this.gizmos.gizmos.rotationGizmo;
    if (rotation) rotation.snapDistance = this.snapEnabled ? Math.PI / 12 : 0;
    const scale = this.gizmos.gizmos.scaleGizmo;
    if (scale) scale.snapDistance = this.snapEnabled ? 0.1 : 0;
  }

  private snapValue(value: number): number {
    if (!this.snapEnabled) return round(value, 2);
    return round(Math.round(value / this.snapStep) * this.snapStep, 4);
  }

  private handlePointer(info: PointerInfo): void {
    if (info.type === PointerEventTypes.POINTERMOVE) {
      if (!this.placementShape || !this.ghost) return;
      const pick = info.pickInfo;
      if (!pick?.pickedPoint) return;
      const position: Vec3 = [
        this.snapValue(pick.pickedPoint.x),
        round(pick.pickedPoint.y + this.placementHalf, 3),
        this.snapValue(pick.pickedPoint.z),
      ];
      const signature = position.join(',');
      if (signature === this.lastGhostSignature) return;
      this.lastGhostSignature = signature;
      this.ghost.mesh.position.set(position[0], position[1], position[2]);
      this.ghost.mesh.setEnabled(true);
      return;
    }
    if (info.type !== PointerEventTypes.POINTERPICK) return;

    const mesh = info.pickInfo?.pickedMesh ?? null;
    if (this.placementShape && this.ghost) {
      const point = info.pickInfo?.pickedPoint;
      if (mesh && mesh.metadata?.kind === 'map-object') return;
      if (!point) return;
      this.callbacks.onPlace([
        this.snapValue(point.x),
        round(point.y + this.placementHalf, 3),
        this.snapValue(point.z),
      ]);
      return;
    }

    if (mesh?.metadata?.kind === 'map-object') {
      const id = String(mesh.metadata.objectId);
      if (id !== this.selectedId) this.callbacks.onSelect(id);
      return;
    }
    // Board tiles and the invisible island picker deselect the current object.
    if (mesh?.metadata?.kind === 'editor-ground' || mesh?.metadata?.kind === 'cell') this.callbacks.onSelect(null);
  }

  private transformSignature(mesh: Mesh): string {
    return [
      round(mesh.position.x),
      round(mesh.position.y),
      round(mesh.position.z),
      round(toDegrees(mesh.rotation.x), 2),
      round(toDegrees(mesh.rotation.y), 2),
      round(toDegrees(mesh.rotation.z), 2),
      round(mesh.scaling.x),
      round(mesh.scaling.y),
      round(mesh.scaling.z),
    ].join('|');
  }

  private syncMeshTransform(): void {
    if (!this.selectedId) return;
    const visual = this.visuals.get(this.selectedId);
    if (!visual) return;
    const signature = this.transformSignature(visual.mesh);
    if (signature === this.lastTransform) return;
    this.lastTransform = signature;
    this.callbacks.onTransform(this.selectedId, {
      position: [round(visual.mesh.position.x, 3), round(visual.mesh.position.y, 3), round(visual.mesh.position.z, 3)],
      rotation: [
        round(toDegrees(visual.mesh.rotation.x), 2),
        round(toDegrees(visual.mesh.rotation.y), 2),
        round(toDegrees(visual.mesh.rotation.z), 2),
      ],
      scale: [round(visual.mesh.scaling.x, 3), round(visual.mesh.scaling.y, 3), round(visual.mesh.scaling.z, 3)],
    });
  }
}
