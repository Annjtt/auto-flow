import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Plane } from '@babylonjs/core/Maths/math.plane';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import '@babylonjs/core/Meshes/Builders/discBuilder';
import '@babylonjs/core/Meshes/Builders/planeBuilder';
import '@babylonjs/core/Meshes/Builders/sphereBuilder';
import '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Rendering/edgesRenderer';
import { getUnitDef } from '../shared/content';
import {
  BUILTIN_MAP_THEMES,
  builtinTheme,
  envSky,
  isBuiltinMapId,
  themeForDoc,
  type BuiltinMapId,
  type MapDoc,
  type MapId,
  type MapTheme,
} from '../shared/maps';
import type { BattleEffectView, BattleSnapshot, UnitView } from '../shared/types';
import { GROUND_Y, MapStage } from './mapStage';
import { createMapObjectMesh } from './mapObjects';
import { createUnitModel, type UnitModel } from './unitModels';
import { computeAnimationFrame } from '../shared/unitAppearance';
import type { TuningAnimation } from '../shared/tuning';
import { getTunedAnimation, getTunedModelOptions, getTunedModelYaw } from './tuningRuntime';

const ABILITY_COLORS: Record<string, string> = {
  squire: '#9fc7ff',
  lightfoot: '#a8ffb0',
  arcanist: '#b18cff',
  paladin: '#ffe28a',
  ghoul: '#8fffa8',
  crypt_archer: '#b6ffb0',
  necromancer: '#b06cff',
  bone_dragon: '#bff5ff',
  scrapbot: '#ffd18a',
  steamgunner: '#ffb45e',
  sparkmage: '#7cf0ff',
  siege_colossus: '#ff8a5a',
  direwolf: '#ffb070',
  boar_rider: '#ffd08a',
  owl_sage: '#9dffc0',
  elder_bear: '#ffb45e',
  imp: '#ff7a4a',
  hellhound: '#ff6a2a',
  doomguard: '#ff8a5a',
  pit_fiend: '#ff5a3a',
  scout: '#c4ff9a',
  blade_dancer: '#b8ffe0',
  starweaver: '#d9c4ff',
  ancient_warden: '#b9ff9a',
};

const ABILITY_ICONS: Record<string, string> = {
  squire: 'shield',
  lightfoot: 'dagger',
  arcanist: 'star',
  paladin: 'swords',
  ghoul: 'claw',
  crypt_archer: 'arrow',
  necromancer: 'skull',
  bone_dragon: 'snow',
  scrapbot: 'gear',
  steamgunner: 'bullet',
  sparkmage: 'bolt',
  siege_colossus: 'rocket',
  direwolf: 'claw',
  boar_rider: 'tusk',
  owl_sage: 'feather',
  elder_bear: 'paw',
  imp: 'flame',
  hellhound: 'flame',
  doomguard: 'blades',
  pit_fiend: 'flame',
  scout: 'arrow',
  blade_dancer: 'blades',
  starweaver: 'star',
  ancient_warden: 'shield',
};

const PROJECTILE_STYLES: Record<string, string> = {
  lightfoot: 'dagger',
  crypt_archer: 'arrow',
  steamgunner: 'bullet',
  sparkmage: 'bolt',
  siege_colossus: 'rocket',
  imp: 'flame',
  pit_fiend: 'flame',
  scout: 'arrow',
  arcanist: 'orb',
  starweaver: 'star',
  necromancer: 'orb',
};

const METER_WIDTH = 0.62;
const METER_Y_GAP = 0.078;
const STAR_Y_GAP = 0.16;

// Meter planes are drawn from a single texture each: frame, track, trail and
// fill live in the texture instead of being stacked as coplanar meshes.
const BAR_FRAME_WIDTH = 0.7;
const BAR_TRACK_WIDTH = 0.66;
const BAR_FRAME_HEIGHT = 0.1;
const MANA_FRAME_HEIGHT = 0.06;
const HP_TRACK_HEIGHT = 0.068;
const HP_FILL_HEIGHT = 0.05;
const MANA_TRACK_HEIGHT = 0.04;
const MANA_FILL_HEIGHT = 0.03;
const METER_TEX_WIDTH = 256;
const HP_TEX_HEIGHT = 32;
const MANA_TEX_HEIGHT = 24;

export type { MapId };

export const MAP_THEME_ACCENTS: Record<string, string> = Object.fromEntries(
  Object.entries(BUILTIN_MAP_THEMES).map(([id, theme]) => [id, theme.accent]),
);

interface DragPathFx {
  material: StandardMaterial;
  dots: Mesh[];
  ring: Mesh;
  arrowRoot: TransformNode;
  arrow: Mesh;
  active: boolean;
}

interface UnitLeap {
  from: Vector3;
  to: Vector3;
  elapsed: number;
  duration: number;
  height: number;
}

interface UnitVisual {
  root: TransformNode;
  hpBar: Mesh;
  manaBar: Mesh;
  hpTexture: DynamicTexture;
  manaTexture: DynamicTexture;
  hpDrawn: { fill: number; trail: number };
  manaDrawn: number;
  selection: Mesh;
  defId: string;
  star: number;
  target: Vector3;
  facingTarget: number;
  leap: UnitLeap | null;
  leapKey: string | null;
  selected: boolean;
  team: number;
  model: UnitModel;
  animation: TuningAnimation;
  attackTimer: number;
  castTimer: number;
  idleSeed: number;
  hpTarget: number;
  hpDisplay: number;
  hpTrailRatio: number;
  manaTarget: number;
  manaDisplay: number;
  gradeStars: Mesh[];
}

interface FxVisual {
  mesh: Mesh;
  material: StandardMaterial;
  born: number;
  ttl: number;
  mode: 'burst' | 'tracer';
}

interface CastFx {
  node: TransformNode;
  material: StandardMaterial;
  born: number;
  ttl: number;
  kind: 'aura' | 'ring' | 'beam' | 'projectile' | 'icon';
  from?: Vector3;
  to?: Vector3;
  base?: Vector3;
  startScale?: number;
  endScale?: number;
  spin?: number;
  rise?: number;
  arc?: number;
  alpha?: number;
}

export type FloatTextKind = 'damage' | 'heal' | 'shield' | 'miss';

export interface ArenaCallbacks {
  onCellClick: (x: number, y: number) => void;
  onUnitClick: (uid: string) => void;
  onFloatText?: (text: string, screenX: number, screenY: number, kind: FloatTextKind) => void;
}

export class ArenaScene {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private canvas: HTMLCanvasElement;
  private callbacks: ArenaCallbacks;
  private tiles: Mesh[] = [];
  private hoverTile: Mesh | null = null;
  private hoverMarker: Mesh | null = null;
  private hoverMarkerMat: StandardMaterial | null = null;
  private dropMarker: Mesh | null = null;
  private dropMarkerMat: StandardMaterial | null = null;
  private unitVisuals = new Map<string, UnitVisual>();
  private effects: FxVisual[] = [];
  private castFx: CastFx[] = [];
  private fxSeq = 0;
  private seenEffects = new Set<string>();
  private battleRound = 0;
  private preparing = true;
  private dragging = false;
  private draggedUid: string | null = null;
  private time = 0;
  private materials = new Map<string, StandardMaterial>();
  private glowLayer: GlowLayer | null = null;
  private hemi: HemisphericLight | null = null;
  private dir: DirectionalLight | null = null;
  private stage: MapStage | null = null;
  private mapId: MapId;
  private mapDoc: MapDoc | null = null;
  private customMats: StandardMaterial[] = [];
  private dragPathFx: DragPathFx | null = null;
  private dropJumps = new Map<string, Vector3>();

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: ArenaCallbacks,
    mapId: MapId = 'jaddy',
    mapDoc: MapDoc | null = null,
  ) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.mapId = mapId;
    this.mapDoc = mapDoc;
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.03, 0.052, 0.096, 1);
    this.scene.ambientColor = new Color3(0.25, 0.3, 0.42);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = new Color3(0.03, 0.05, 0.09);
    this.scene.fogDensity = 0.014;

    this.camera = new ArcRotateCamera('camera', Math.PI / 2, 0.93, 18.8, new Vector3(0, 0.3, 1.9), this.scene);
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 11;
    this.camera.upperRadiusLimit = 24;
    this.camera.lowerBetaLimit = 0.62;
    this.camera.upperBetaLimit = 1.22;
    this.camera.wheelPrecision = 55;
    this.camera.panningSensibility = 0;
    this.camera.inertia = 0.75;

    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.85;
    hemi.diffuse = new Color3(0.6, 0.7, 0.95);
    hemi.groundColor = new Color3(0.15, 0.12, 0.22);
    this.hemi = hemi;

    const dir = new DirectionalLight('dir', new Vector3(-0.5, -1, -0.35), this.scene);
    dir.position = new Vector3(8, 14, 8);
    dir.intensity = 1.25;
    dir.diffuse = new Color3(1, 0.9, 0.75);
    this.dir = dir;

    const glow = new GlowLayer('glow', this.scene);
    glow.intensity = 0.38;
    this.glowLayer = glow;

    this.buildStage();
    this.buildCustomObjects();
    this.applyTheme();
    this.setupPointer();
    this.engine.runRenderLoop(() => {
      this.time += this.engine.getDeltaTime() / 1000;
      this.animate();
      this.scene.render();
    });
    window.addEventListener('resize', () => this.engine.resize());
  }

  private material(key: string, diffuse: string, emissive = '#000000'): StandardMaterial {
    const existing = this.materials.get(key);
    if (existing) return existing;
    const mat = new StandardMaterial(key, this.scene);
    mat.diffuseColor = Color3.FromHexString(diffuse);
    mat.emissiveColor = Color3.FromHexString(emissive);
    mat.specularColor = new Color3(0.15, 0.15, 0.18);
    this.materials.set(key, mat);
    return mat;
  }

  private buildStage(): void {
    this.stage = new MapStage(this.scene, this.materials, {
      base: this.mapDoc?.base ?? (isBuiltinMapId(this.mapId) ? this.mapId : 'jaddy'),
      env: this.mapDoc?.env,
      interactive: true,
    });
    this.stage.build();
    this.tiles = this.stage.tiles;
    this.buildHoverMarkers();
  }

  private buildHoverMarkers(): void {
    this.hoverMarkerMat = new StandardMaterial('hoverMarkerMat', this.scene);
    this.hoverMarkerMat.disableLighting = true;
    this.hoverMarkerMat.diffuseColor = Color3.Black();
    this.hoverMarkerMat.emissiveColor = new Color3(0.3, 0.7, 1);
    this.hoverMarkerMat.alpha = 0.22;
    this.hoverMarkerMat.backFaceCulling = false;
    this.hoverMarker = MeshBuilder.CreateBox('hoverMarker', { width: 0.94, height: 0.018, depth: 0.94 }, this.scene);
    this.hoverMarker.position.y = 0.105;
    this.hoverMarker.material = this.hoverMarkerMat;
    this.hoverMarker.isPickable = false;
    this.hoverMarker.setEnabled(false);

    this.dropMarkerMat = new StandardMaterial('dropMarkerMat', this.scene);
    this.dropMarkerMat.disableLighting = true;
    this.dropMarkerMat.diffuseColor = Color3.Black();
    this.dropMarkerMat.emissiveColor = new Color3(0.2, 0.72, 0.4);
    this.dropMarkerMat.alpha = 0.2;
    this.dropMarkerMat.backFaceCulling = false;
    this.dropMarker = MeshBuilder.CreateBox('dropMarker', { width: 0.96, height: 0.026, depth: 0.96 }, this.scene);
    this.dropMarker.position.y = 0.105;
    this.dropMarker.material = this.dropMarkerMat;
    this.dropMarker.enableEdgesRendering(0.999);
    this.dropMarker.edgesWidth = 2;
    this.dropMarker.edgesColor = new Color4(0.32, 0.95, 0.56, 0.95);
    this.dropMarker.isPickable = false;
    this.dropMarker.setEnabled(false);

  }

  private buildCustomObjects(): void {
    if (!this.mapDoc) return;
    for (const object of this.mapDoc.objects) {
      if (!object.visible) continue;
      const visual = createMapObjectMesh(this.scene, object, { pickable: false, namePrefix: 'mapObject' });
      this.customMats.push(visual.material);
    }
  }

  private applyTheme(): void {
    const theme = this.mapDoc ? themeForDoc(this.mapDoc) : builtinTheme(this.mapId);
    const backdrop = envSky(theme, this.mapDoc?.env);
    const sky = Color3.FromHexString(backdrop.sky);
    this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
    this.scene.fogColor = Color3.FromHexString(backdrop.fog);
    this.scene.fogDensity = backdrop.fogDensity;
    if (this.hemi) {
      this.hemi.diffuse = Color3.FromHexString(theme.hemiDiffuse);
      this.hemi.groundColor = Color3.FromHexString(theme.hemiGround);
      this.hemi.intensity = theme.hemiIntensity;
    }
    if (this.dir) {
      this.dir.diffuse = Color3.FromHexString(theme.dirDiffuse);
      this.dir.intensity = theme.dirIntensity;
    }
    if (this.glowLayer) this.glowLayer.intensity = theme.glow;
    this.stage?.applyTheme(theme);
  }

  setMap(mapId: MapId, mapDoc: MapDoc | null = null): void {
    if (mapId === this.mapId && mapDoc === this.mapDoc) return;
    this.mapId = mapId;
    this.mapDoc = mapDoc;
    this.rebuildWorld();
  }

  getMap(): MapId {
    return this.mapId;
  }

  getMapDocument(): MapDoc | null {
    return this.mapDoc;
  }

  private rebuildWorld(): void {
    this.setDragging(false);
    this.clearUnits();
    this.hideDragPath();
    this.draggedUid = null;
    this.dropJumps.clear();
    this.hoverTile = null;
    for (const light of [...this.scene.lights]) {
      if (light !== this.hemi && light !== this.dir) light.dispose();
    }
    for (const mesh of [...this.scene.meshes]) mesh.dispose(false, false);
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.tiles = [];
    this.hoverMarker = null;
    this.hoverMarkerMat = null;
    this.dropMarker = null;
    this.dropMarkerMat = null;
    this.dragPathFx?.material.dispose();
    this.dragPathFx = null;
    for (const material of this.customMats) material.dispose();
    this.customMats = [];
    this.stage = null;
    this.buildStage();
    this.buildCustomObjects();
    this.applyTheme();
  }

  private setupPointer(): void {
    this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERDOWN) {
        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        const mesh = pick?.pickedMesh;
        if (!mesh?.metadata) {
          const cell = this.cellFromGround();
          if (cell) this.callbacks.onCellClick(cell.x, cell.y);
          return;
        }
        if (mesh.metadata.kind === 'cell') {
          this.callbacks.onCellClick(mesh.metadata.x, mesh.metadata.y);
        } else if (mesh.metadata.kind === 'unit') {
          this.callbacks.onUnitClick(mesh.metadata.uid);
        }
        return;
      }
      if (info.type === PointerEventTypes.POINTERMOVE) {
        if (!this.preparing) {
          this.setHover(null);
          return;
        }
        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        const mesh = pick?.pickedMesh;
        let tile = mesh?.metadata?.kind === 'cell' ? (mesh as Mesh) : null;
        if (!tile) {
          const cell = this.cellFromGround();
          if (cell) tile = this.tiles[cell.y * 8 + cell.x] ?? null;
        }
        this.setHover(tile);
      }
    });
  }

  private cellFromGround(): { x: number; y: number } | null {
    const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, Matrix.Identity(), this.camera);
    const distance = ray.intersectsPlane(new Plane(0, 1, 0, 0));
    if (distance === null) return null;
    const point = ray.origin.add(ray.direction.scale(distance));
    const x = Math.round(point.x + 3.5);
    const y = Math.round(point.z + 3.5);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return { x, y };
  }

  private setHover(tile: Mesh | null): void {
    if (this.dragging) return;
    if (this.hoverTile === tile) return;
    this.hoverTile = tile;
    if (!tile || !this.hoverMarker) {
      this.hoverMarker?.setEnabled(false);
      return;
    }
    this.hoverMarker.position.x = tile.metadata.x - 3.5;
    this.hoverMarker.position.z = tile.metadata.y - 3.5;
    this.hoverMarker.setEnabled(true);
  }

  setPreparing(preparing: boolean): void {
    this.preparing = preparing;
    if (!preparing) this.setHover(null);
  }

  show(): void {
    requestAnimationFrame(() => this.engine.resize());
  }

  pickCellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const point = this.clientToScene(clientX, clientY);
    const picked = this.scene.pick(point.x, point.y)?.pickedMesh;
    if (picked?.metadata?.kind === 'cell') {
      return { x: picked.metadata.x, y: picked.metadata.y };
    }
    const ray = this.scene.createPickingRay(point.x, point.y, Matrix.Identity(), this.camera);
    const distance = ray.intersectsPlane(new Plane(0, 1, 0, 0));
    if (distance === null) return null;
    const hit = ray.origin.add(ray.direction.scale(distance));
    const x = Math.round(hit.x + 3.5);
    const y = Math.round(hit.z + 3.5);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return { x, y };
  }

  pickUnitAt(clientX: number, clientY: number): string | null {
    const point = this.clientToScene(clientX, clientY);
    const picked = this.scene.pick(point.x, point.y)?.pickedMesh;
    return picked?.metadata?.kind === 'unit' ? String(picked.metadata.uid) : null;
  }

  setDragging(active: boolean): void {
    if (this.dragging === active) return;
    this.dragging = active;
    if (active) {
      this.setHover(null);
      this.camera.detachControl();
    } else {
      this.setDropHighlight(null, false);
      this.camera.attachControl(this.canvas, true);
    }
  }

  setDraggedUnit(uid: string | null): void {
    this.draggedUid = uid;
  }

  screenToGround(clientX: number, clientY: number): { x: number; z: number } | null {
    const point = this.clientToScene(clientX, clientY);
    const ray = this.scene.createPickingRay(point.x, point.y, Matrix.Identity(), this.camera);
    const distance = ray.intersectsPlane(new Plane(0, 1, 0, 0));
    if (distance === null) return null;
    const hit = ray.origin.add(ray.direction.scale(distance));
    return { x: hit.x, z: hit.z };
  }

  private ensureDragPath(): DragPathFx {
    if (this.dragPathFx) return this.dragPathFx;
    const material = new StandardMaterial('dragThreadMat', this.scene);
    material.disableLighting = true;
    material.diffuseColor = Color3.Black();
    material.emissiveColor = Color3.FromHexString('#8dffd9');
    material.alpha = 0.92;
    material.backFaceCulling = false;

    const dots: Mesh[] = [];
    for (let i = 0; i < 22; i++) {
      const dot = MeshBuilder.CreateSphere(`dragThreadDot-${i}`, { diameter: 0.075, segments: 6 }, this.scene);
      dot.material = material;
      dot.isPickable = false;
      dot.renderingGroupId = 2;
      dot.setEnabled(false);
      dots.push(dot);
    }

    const ring = MeshBuilder.CreateTorus('dragThreadRing', { diameter: 0.72, thickness: 0.045, tessellation: 48 }, this.scene);
    ring.material = material;
    ring.isPickable = false;
    ring.renderingGroupId = 2;
    ring.setEnabled(false);

    const arrowRoot = new TransformNode('dragThreadArrow', this.scene);
    const arrow = MeshBuilder.CreateCylinder(
      'dragThreadArrowHead',
      { diameterTop: 0, diameterBottom: 0.3, height: 0.5, tessellation: 10 },
      this.scene,
    );
    arrow.parent = arrowRoot;
    arrow.rotation.x = Math.PI / 2;
    arrow.material = material;
    arrow.isPickable = false;
    arrow.renderingGroupId = 2;
    arrowRoot.setEnabled(false);

    this.dragPathFx = { material, dots, ring, arrowRoot, arrow, active: false };
    return this.dragPathFx;
  }

  setDragPath(from: { x: number; z: number } | null, to: { x: number; y: number } | null, valid: boolean): void {
    const fx = this.ensureDragPath();
    if (!from || !to) {
      fx.active = false;
      fx.dots.forEach((dot) => dot.setEnabled(false));
      fx.ring.setEnabled(false);
      fx.arrowRoot.setEnabled(false);
      return;
    }
    const start = new Vector3(from.x, 0.16, from.z);
    const end = new Vector3(to.x - 3.5, 0.18, to.y - 3.5);
    const flat = Vector3.Distance(start, end);
    if (flat < 0.15) {
      fx.active = false;
      fx.dots.forEach((dot) => dot.setEnabled(false));
      fx.ring.setEnabled(false);
      fx.arrowRoot.setEnabled(false);
      return;
    }
    const control = start.add(end).scale(0.5);
    control.y += 0.55 + flat * 0.18;
    const pointAt = (t: number): Vector3 => {
      const inv = 1 - t;
      return new Vector3(
        inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
        inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
        inv * inv * start.z + 2 * inv * t * control.z + t * t * end.z,
      );
    };
    const color = Color3.FromHexString(valid ? '#8dffd9' : '#ff7a6a');
    fx.material.emissiveColor = color;
    fx.active = true;

    for (let i = 0; i < fx.dots.length; i++) {
      const t = (i + 1) / (fx.dots.length + 1);
      const dot = fx.dots[i];
      dot.position.copyFrom(pointAt(t));
      const size = 0.7 + Math.sin(t * Math.PI) * 0.85;
      dot.scaling.setAll(size);
      dot.setEnabled(true);
    }
    fx.ring.position.copyFrom(start);
    fx.ring.setEnabled(true);

    const headT = 0.955;
    const headPos = pointAt(headT);
    const ahead = pointAt(1);
    fx.arrowRoot.position.copyFrom(headPos);
    const direction = ahead.subtract(headPos);
    if (direction.lengthSquared() > 0.0001) {
      fx.arrowRoot.lookAt(ahead);
    }
    fx.arrowRoot.setEnabled(true);
  }

  hideDragPath(): void {
    const fx = this.dragPathFx;
    if (!fx) return;
    fx.active = false;
    fx.dots.forEach((dot) => dot.setEnabled(false));
    fx.ring.setEnabled(false);
    fx.arrowRoot.setEnabled(false);
  }

  queueDropJump(uid: string, from: { x: number; z: number } | null): void {
    if (!from) return;
    this.dropJumps.set(uid, new Vector3(from.x, 0, from.z));
  }

  setDropHighlight(cell: { x: number; y: number } | null, valid: boolean): void {
    if (!this.dropMarker || !this.dropMarkerMat) return;
    if (!cell) {
      this.dropMarker.setEnabled(false);
      return;
    }
    const tile = this.tiles[cell.y * 8 + cell.x];
    if (!tile) {
      this.dropMarker.setEnabled(false);
      return;
    }
    const color = valid ? new Color3(0.2, 0.72, 0.4) : new Color3(0.88, 0.22, 0.18);
    this.dropMarker.position.x = cell.x - 3.5;
    this.dropMarker.position.z = cell.y - 3.5;
    this.dropMarkerMat.emissiveColor = color;
    this.dropMarkerMat.alpha = valid ? 0.2 : 0.24;
    this.dropMarker.edgesColor = new Color4(color.r, color.g, color.b, 0.9);
    this.dropMarker.setEnabled(true);
  }

  private clientToScene(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  clearUnits(): void {
    for (const visual of this.unitVisuals.values()) {
      visual.root.dispose();
    }
    this.unitVisuals.clear();
    for (const fx of this.effects) {
      fx.mesh.dispose();
      fx.material.dispose();
    }
    this.effects = [];
    for (const fx of this.castFx) {
      fx.node.dispose(false, false);
      fx.material.dispose();
    }
    this.castFx = [];
    this.seenEffects.clear();
    this.battleRound = 0;
  }

  updatePrep(units: UnitView[], selectedUid: string | null): void {
    this.preparing = true;
    const active = new Set(units.map((u) => u.uid));
    for (const [uid, visual] of this.unitVisuals) {
      if (!active.has(uid)) {
        visual.root.dispose();
        this.unitVisuals.delete(uid);
      }
    }
    for (const unit of units) {
      let visual = this.unitVisuals.get(unit.uid);
      if (!visual || visual.defId !== unit.defId || visual.star !== unit.star) {
        if (visual) visual.root.dispose();
        visual = this.createUnitVisual(unit, 0);
        this.unitVisuals.set(unit.uid, visual);
      }
      visual.target = new Vector3(unit.x - 3.5, 0, unit.y - 3.5);
      const jumpFrom = this.dropJumps.get(unit.uid);
      if (jumpFrom && Vector3.Distance(jumpFrom, visual.target) > 0.05) {
        visual.root.position.copyFrom(jumpFrom);
        visual.leap = {
          from: jumpFrom.clone(),
          to: visual.target.clone(),
          elapsed: 0,
          duration: 0.46,
          height: 0.85 + Math.min(1.1, Vector3.Distance(jumpFrom, visual.target) * 0.1),
        };
        visual.leapKey = null;
        this.dropJumps.delete(unit.uid);
      } else {
        visual.root.position = visual.target.clone();
        visual.leap = null;
        visual.leapKey = null;
      }
      visual.facingTarget = visual.team === 0 ? Math.PI : 0;
      visual.model.body.rotation.y = visual.facingTarget;
      visual.root.setEnabled(true);
      visual.hpTarget = 1;
      visual.hpDisplay = 1;
      visual.hpTrailRatio = 1;
      visual.manaTarget = 0;
      visual.manaDisplay = 0;
      this.applyMeters(visual);
      const selected = unit.uid === selectedUid;
      visual.selection.setEnabled(selected);
      visual.selected = selected;
      visual.attackTimer = 0;
      visual.castTimer = 0;
    }
  }

  updateBattle(snapshot: BattleSnapshot): void {
    this.preparing = false;
    if (snapshot.round !== this.battleRound) {
      this.battleRound = snapshot.round;
      this.seenEffects.clear();
    }
    const active = new Set(snapshot.units.map((u) => u.uid));
    for (const [uid, visual] of this.unitVisuals) {
      if (!active.has(uid)) {
        visual.root.dispose();
        this.unitVisuals.delete(uid);
      }
    }
    for (const unit of snapshot.units) {
      let visual = this.unitVisuals.get(unit.uid);
      let fresh = false;
      if (!visual || visual.defId !== unit.defId || visual.star !== unit.star) {
        if (visual) visual.root.dispose();
        visual = this.createUnitVisual(
          { uid: unit.uid, defId: unit.defId, star: unit.star, x: unit.x, y: unit.y },
          unit.team,
        );
        visual.root.position = new Vector3(unit.x - 3.5, 0, unit.y - 3.5);
        this.unitVisuals.set(unit.uid, visual);
        fresh = true;
      }
      visual.target = new Vector3(unit.x - 3.5, 0, unit.y - 3.5);
      visual.facingTarget = unit.facing;
      if (unit.jump) {
        const to = new Vector3(unit.x - 3.5, 0, unit.y - 3.5);
        const key = `${unit.jump.fromX},${unit.jump.fromY}->${unit.x},${unit.y}`;
        if (visual.leap) {
          visual.leap.to.copyFrom(to);
        } else if (visual.leapKey !== key) {
          const from = new Vector3(unit.jump.fromX - 3.5, 0, unit.jump.fromY - 3.5);
          const distance = Math.hypot(to.x - from.x, to.z - from.z);
          visual.leap = {
            from,
            to,
            elapsed: 0,
            duration: Math.max(0.18, unit.jump.remaining),
            height: 1.05 + Math.min(1.1, distance * 0.12),
          };
          visual.leapKey = key;
          visual.root.position.copyFrom(from);
        }
      }
      visual.selection.setEnabled(false);
      visual.root.setEnabled(unit.alive);
      visual.hpTarget = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
      visual.manaTarget = unit.maxMana > 0 ? Math.max(0, Math.min(1, unit.mana / unit.maxMana)) : 0;
      if (fresh) {
        visual.hpDisplay = visual.hpTarget;
        visual.hpTrailRatio = visual.hpTarget;
        visual.manaDisplay = visual.manaTarget;
        this.applyMeters(visual);
      }
    }
    for (const effect of snapshot.effects) {
      if (this.seenEffects.has(effect.id)) continue;
      this.seenEffects.add(effect.id);
      if (effect.kind === 'cast') {
        this.playAbilityCast(effect);
      } else {
        this.spawnEffect(effect.kind, effect.x, effect.y, effect.team, effect.id);
      }
      this.spawnFloatText(effect.kind, effect.x, effect.y, effect.value);
      if (
        effect.sx !== undefined &&
        effect.sy !== undefined &&
        (effect.kind === 'hit' || effect.kind === 'miss')
      ) {
        this.spawnTracer(effect.x, effect.y, effect.sx, effect.sy, effect.team, effect.id);
      }
      if ((effect.kind === 'hit' || effect.kind === 'miss') && effect.sourceUid) {
        this.triggerAttack(effect.sourceUid);
      }
    }
  }

  private spawnFloatText(kind: string, x: number, y: number, value?: number): void {
    const handler = this.callbacks.onFloatText;
    if (!handler) return;
    let text = '';
    let floatKind: FloatTextKind;
    if (kind === 'hit' && value && value > 0) {
      text = `-${value}`;
      floatKind = 'damage';
    } else if (kind === 'heal' && value && value > 0) {
      text = `+${value}`;
      floatKind = 'heal';
    } else if (kind === 'shield' && value && value > 0) {
      text = `+${value}`;
      floatKind = 'shield';
    } else if (kind === 'miss') {
      text = 'мимо';
      floatKind = 'miss';
    } else {
      return;
    }
    const viewport = this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight());
    const projected = Vector3.Project(
      new Vector3(x - 3.5, 1.42, y - 3.5),
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      viewport,
    );
    if (projected.z < 0 || projected.z > 1) return;
    const jitter = (Math.random() - 0.5) * 26;
    handler(text, projected.x + jitter, projected.y, floatKind);
  }

  private createUnitVisual(unit: UnitView, team: number): UnitVisual {
    const def = getUnitDef(unit.defId);
    const animation = getTunedAnimation(unit.defId);
    const root = new TransformNode(`unit-${unit.uid}`, this.scene);
    root.rotation.y = getTunedModelYaw(unit.defId);
    const teamMat = this.material(team === 0 ? 'teamA' : 'teamB', team === 0 ? '#3f77c7' : '#a83d4d', team === 0 ? '#173a6e' : '#5c1724');
    const starMat = this.material('star', '#f2cc6b', '#9b6f16');

    const base = MeshBuilder.CreateCylinder(
      `base-${unit.uid}`,
      { diameter: 0.66, height: 0.08, tessellation: 8 },
      this.scene,
    );
    base.parent = root;
    base.position.y = 0.06;
    base.material = teamMat;
    base.metadata = { kind: 'unit', uid: unit.uid };

    const model = createUnitModel(
      {
        scene: this.scene,
        material: (key, diffuse, emissive) => this.material(key, diffuse, emissive),
      },
      def,
      unit.uid,
      unit.star,
      getTunedModelOptions(unit.defId),
    );
    model.body.parent = root;
    model.body.rotation.y = team === 0 ? Math.PI : 0;
    model.attackStyle = animation.attackStyle;
    for (const mesh of model.body.getChildMeshes()) {
      mesh.metadata = { kind: 'unit', uid: unit.uid };
      mesh.isPickable = true;
    }

    const selection = MeshBuilder.CreateTorus(
      `sel-${unit.uid}`,
      { diameter: 0.98, thickness: 0.035, tessellation: 32 },
      this.scene,
    );
    selection.parent = root;
    selection.position.y = 0.015;
    selection.material = starMat;
    selection.isPickable = false;
    selection.setEnabled(false);

    const barY = Math.max(1.2, model.height * model.gradeScale) + 0.12;

    // Each meter is one billboard plane whose texture already contains the
    // frame, the empty track, the damage trail and the fill. Stacking those as
    // separate coplanar planes made the draw order depend on the camera side,
    // so the dark frame could cover the fill and the bar looked solid black.
    const hpTexture = new DynamicTexture(
      `hpTex-${unit.uid}`,
      { width: METER_TEX_WIDTH, height: HP_TEX_HEIGHT },
      this.scene,
      false,
    );
    hpTexture.hasAlpha = false;
    const hpBar = MeshBuilder.CreatePlane(`hp-${unit.uid}`, { width: BAR_FRAME_WIDTH, height: BAR_FRAME_HEIGHT }, this.scene);
    hpBar.parent = root;
    hpBar.position = new Vector3(0, barY, 0);
    hpBar.billboardMode = Mesh.BILLBOARDMODE_ALL;
    hpBar.material = this.barMaterial(`hpMat-${unit.uid}`, hpTexture);
    hpBar.isPickable = false;
    hpBar.renderingGroupId = 1;

    const manaTexture = new DynamicTexture(
      `manaTex-${unit.uid}`,
      { width: METER_TEX_WIDTH, height: MANA_TEX_HEIGHT },
      this.scene,
      false,
    );
    manaTexture.hasAlpha = false;
    const manaBar = MeshBuilder.CreatePlane(
      `mana-${unit.uid}`,
      { width: BAR_FRAME_WIDTH, height: MANA_FRAME_HEIGHT },
      this.scene,
    );
    manaBar.parent = root;
    manaBar.position = new Vector3(0, barY - METER_Y_GAP, 0);
    manaBar.billboardMode = Mesh.BILLBOARDMODE_ALL;
    manaBar.material = this.barMaterial(`manaMat-${unit.uid}`, manaTexture);
    manaBar.isPickable = false;
    manaBar.renderingGroupId = 1;

    root.onDisposeObservable.add(() => {
      hpTexture.dispose();
      manaTexture.dispose();
      hpBar.material?.dispose();
      manaBar.material?.dispose();
    });
    // Bars must keep their exact palette, so keep them out of the bloom pass.
    this.glowLayer?.addExcludedMesh(hpBar);
    this.glowLayer?.addExcludedMesh(manaBar);

    const gradeStars: Mesh[] = [];
    if (unit.star >= 2) {
      const gradeMat = this.gradeStarMaterial(unit.star);
      const outer = unit.star >= 3 ? 0.076 : 0.066;
      const spacing = unit.star >= 3 ? 0.17 : 0.16;
      for (let i = 0; i < unit.star; i++) {
        const starMesh = this.createStarMesh(`gstar-${unit.uid}-${i}`, outer, outer * 0.42, gradeMat);
        starMesh.parent = root;
        starMesh.position = new Vector3((i - (unit.star - 1) / 2) * spacing, barY + STAR_Y_GAP, 0);
        starMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
        starMesh.isPickable = false;
        starMesh.renderingGroupId = 1;
        gradeStars.push(starMesh);
      }
    }

    // Meters and stars live in rendering group 1, which clears the depth buffer
    // before drawing, so bars never vanish behind models or props.
    return {
      root,
      hpBar,
      manaBar,
      hpTexture,
      manaTexture,
      hpDrawn: { fill: -1, trail: -1 },
      manaDrawn: -1,
      selection,
      defId: unit.defId,
      star: unit.star,
      target: new Vector3(unit.x - 3.5, 0, unit.y - 3.5),
      facingTarget: team === 0 ? Math.PI : 0,
      leap: null,
      leapKey: null,
      selected: false,
      team,
      model,
      animation,
      attackTimer: 0,
      castTimer: 0,
      idleSeed: Math.random() * Math.PI * 2,
      hpTarget: 1,
      hpDisplay: 1,
      hpTrailRatio: 1,
      manaTarget: 0,
      manaDisplay: 0,
      gradeStars,
    };
  }

  private gradeStarMaterial(star: number): StandardMaterial {
    const material = this.material(
      star >= 3 ? 'gradeStar3' : 'gradeStar2',
      star >= 3 ? '#fff2bd' : '#f0d89a',
      star >= 3 ? '#ffad1f' : '#b9861f',
    );
    material.backFaceCulling = false;
    material.disableLighting = true;
    return material;
  }

  private createStarMesh(name: string, outer: number, inner: number, material: StandardMaterial): Mesh {
    const points = 10;
    const positions = [0, 0, 0];
    const indices: number[] = [];
    for (let i = 0; i < points; i++) {
      const angle = Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? outer : inner;
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    }
    for (let i = 0; i < points; i++) {
      indices.push(0, 1 + i, 1 + ((i + 1) % points));
    }
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new Mesh(name, this.scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.material = material;
    return mesh;
  }

  private barMaterial(name: string, texture: DynamicTexture): StandardMaterial {
    const mat = new StandardMaterial(name, this.scene);
    // The texture is the whole look of the bar. Emissive colour is added to the
    // sampled texture, so it has to stay black for the palette to show up.
    mat.disableLighting = true;
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.emissiveTexture = texture;
    mat.emissiveColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);
    mat.backFaceCulling = false;
    return mat;
  }

  private applyMeters(visual: UnitVisual): void {
    const fill = Math.max(0, Math.min(1, visual.hpDisplay));
    const trail = Math.max(fill, Math.min(1, visual.hpTrailRatio));
    const mana = Math.max(0, Math.min(1, visual.manaDisplay));
    // Repainting a 256px texture is cheap, but not free: only redraw when the
    // rounded fill actually changes so idle units cost nothing.
    if (Math.abs(visual.hpDrawn.fill - fill) > 0.004 || Math.abs(visual.hpDrawn.trail - trail) > 0.004) {
      visual.hpDrawn.fill = fill;
      visual.hpDrawn.trail = trail;
      this.paintHpBar(visual, fill, trail);
    }
    if (Math.abs(visual.manaDrawn - mana) > 0.004) {
      visual.manaDrawn = mana;
      this.paintManaBar(visual, mana);
    }
  }

  private paintHpBar(visual: UnitVisual, fill: number, trail: number): void {
    const ctx = visual.hpTexture.getContext();
    const w = METER_TEX_WIDTH;
    const h = HP_TEX_HEIGHT;
    const sx = w / BAR_FRAME_WIDTH;
    const sy = h / BAR_FRAME_HEIGHT;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#050a12';
    ctx.fillRect(0, 0, w, h);

    const trackX = ((BAR_FRAME_WIDTH - BAR_TRACK_WIDTH) / 2) * sx;
    const trackY = ((BAR_FRAME_HEIGHT - HP_TRACK_HEIGHT) / 2) * sy;
    ctx.fillStyle = visual.team === 0 ? '#1d4a2b' : '#4a1f24';
    ctx.fillRect(trackX, trackY, BAR_TRACK_WIDTH * sx, HP_TRACK_HEIGHT * sy);

    const fillX = ((BAR_FRAME_WIDTH - METER_WIDTH) / 2) * sx;
    const fillY = ((BAR_FRAME_HEIGHT - HP_FILL_HEIGHT) / 2) * sy;
    const fillW = METER_WIDTH * sx;
    const fillH = HP_FILL_HEIGHT * sy;
    const trailW = Math.max(1, Math.round(fillW * trail));
    ctx.fillStyle = '#e8a35c';
    ctx.fillRect(fillX, fillY, trailW, fillH);
    const hpW = Math.max(1, Math.round(fillW * fill));
    ctx.fillStyle = visual.team === 0 ? '#5fc06f' : '#d45555';
    ctx.fillRect(fillX, fillY, hpW, fillH);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(fillX, fillY, hpW, Math.max(1, Math.round(fillH * 0.32)));
    visual.hpTexture.update();
  }

  private paintManaBar(visual: UnitVisual, fill: number): void {
    const ctx = visual.manaTexture.getContext();
    const w = METER_TEX_WIDTH;
    const h = MANA_TEX_HEIGHT;
    const sx = w / BAR_FRAME_WIDTH;
    const sy = h / MANA_FRAME_HEIGHT;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#030711';
    ctx.fillRect(0, 0, w, h);
    const trackX = ((BAR_FRAME_WIDTH - BAR_TRACK_WIDTH) / 2) * sx;
    const trackY = ((MANA_FRAME_HEIGHT - MANA_TRACK_HEIGHT) / 2) * sy;
    ctx.fillStyle = '#0e2642';
    ctx.fillRect(trackX, trackY, BAR_TRACK_WIDTH * sx, MANA_TRACK_HEIGHT * sy);
    const fillX = ((BAR_FRAME_WIDTH - METER_WIDTH) / 2) * sx;
    const fillY = ((MANA_FRAME_HEIGHT - MANA_FILL_HEIGHT) / 2) * sy;
    const fillW = METER_WIDTH * sx;
    const fillH = MANA_FILL_HEIGHT * sy;
    if (fill > 0.001) {
      ctx.fillStyle = '#4d9fff';
      ctx.fillRect(fillX, fillY, Math.max(1, Math.round(fillW * fill)), fillH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(fillX, fillY, Math.max(1, Math.round(fillW * fill)), Math.max(1, Math.round(fillH * 0.34)));
    }
    visual.manaTexture.update();
  }

  private spawnEffect(kind: string, x: number, y: number, team: number, id: string): void {
    const key = `fx-${id}`;
    const existing = this.scene.getMeshByName(key);
    if (existing) return;
    const mat = new StandardMaterial(key, this.scene);
    let color = team === 0 ? '#79b6ff' : '#ff7a84';
    let size = 0.28;
    let ttl = 0.45;
    if (kind === 'heal') {
      color = '#71e39d';
      ttl = 0.65;
    } else if (kind === 'shield') {
      color = '#6ecbff';
      ttl = 0.6;
    } else if (kind === 'cast') {
      color = '#e6c06b';
      size = 0.42;
      ttl = 0.5;
    } else if (kind === 'death') {
      color = '#c28be6';
      size = 0.5;
      ttl = 0.8;
    } else if (kind === 'miss') {
      color = '#b8c2d6';
      size = 0.2;
      ttl = 0.3;
    } else if (kind === 'jump') {
      color = '#c9a2ff';
      size = 0.46;
      ttl = 0.55;
    }
    mat.emissiveColor = Color3.FromHexString(color);
    mat.diffuseColor = Color3.FromHexString(color);
    mat.alpha = 0.85;
    const mesh = MeshBuilder.CreateSphere(key, { diameter: size, segments: 8 }, this.scene);
    mesh.position = new Vector3(x - 3.5, kind === 'cast' ? 0.5 : 0.72, y - 3.5);
    mesh.material = mat;
    mesh.isPickable = false;
    this.effects.push({ mesh, material: mat, born: performance.now(), ttl: ttl * 1000, mode: 'burst' });
  }

  private spawnTracer(x: number, y: number, sx: number, sy: number, team: number, id: string): void {
    const key = `fx-line-${id}`;
    if (this.scene.getMeshByName(key)) return;
    const dx = x - sx;
    const dz = y - sy;
    const distance = Math.hypot(dx, dz);
    if (distance < 1.2) return;
    const mat = new StandardMaterial(key, this.scene);
    const color = team === 0 ? '#b3dcff' : '#ffb3b8';
    mat.emissiveColor = Color3.FromHexString(color);
    mat.diffuseColor = Color3.FromHexString(color);
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mat.alpha = 0.9;
    const mesh = MeshBuilder.CreateBox(key, { width: 0.085, height: 0.085, depth: distance }, this.scene);
    mesh.position = new Vector3((x + sx) / 2 - 3.5, 0.8, (y + sy) / 2 - 3.5);
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.material = mat;
    mesh.isPickable = false;
    this.effects.push({ mesh, material: mat, born: performance.now(), ttl: 260, mode: 'tracer' });
  }

  private triggerAttack(uid: string): void {
    const visual = this.unitVisuals.get(uid);
    if (!visual) return;
    const swap = visual.animation.swapAttackCast;
    if ((swap ? visual.attackTimer : visual.castTimer) > 0.08) return;
    if (swap) {
      visual.castTimer = Math.max(visual.castTimer, visual.animation.castDuration);
    } else {
      visual.attackTimer = Math.max(visual.attackTimer, visual.animation.attackDuration);
    }
  }

  private playAbilityCast(effect: BattleEffectView): void {
    if (!effect.sourceDef) return;
    const def = getUnitDef(effect.sourceDef);
    const color = ABILITY_COLORS[def.id] ?? '#e6c06b';
    const icon = ABILITY_ICONS[def.id] ?? 'star';
    const projectile = PROJECTILE_STYLES[def.id] ?? 'orb';
    const caster = new Vector3(effect.x - 3.5, 0, effect.y - 3.5);
    const targets = (effect.targets ?? []).map((target) => new Vector3(target.x - 3.5, 0, target.y - 3.5));
    const visual = effect.sourceUid ? this.unitVisuals.get(effect.sourceUid) : undefined;
    if (visual) {
      if (visual.animation.swapAttackCast) visual.attackTimer = visual.animation.attackDuration;
      else visual.castTimer = visual.animation.castDuration;
    }
    const iconHeight = visual ? Math.max(1.5, visual.model.height * visual.model.gradeScale + 0.18) : 1.55;

    this.spawnAura(caster, color, 0.9);
    this.spawnIcon(caster, icon, color, 0.9, iconHeight);

    const primary = targets[0];
    const ranged = def.range > 1.4;

    switch (effect.ability ?? def.ability.kind) {
      case 'heal':
      case 'shield':
      case 'buff': {
        for (const target of targets) {
          this.spawnAura(target, color, 0.85);
          this.spawnIcon(target, def.id === 'paladin' ? 'shield' : icon, color, 0.8, 1.48);
        }
        if (def.id === 'paladin') {
          for (const target of targets) this.spawnIcon(target, 'swords', color, 1.12, 1.68);
          this.spawnIcon(caster, 'swords', color, 1.12, iconHeight + 0.12);
          this.spawnRing(caster, color, 2.2, 0.9);
        }
        if (def.id === 'elder_bear') this.spawnRing(caster, color, 2.4, 0.8);
        if (def.id === 'ancient_warden') this.spawnRing(caster, color, 1.9, 0.75);
        if (def.id === 'starweaver' && targets.length > 0) {
          const enemy = targets[targets.length - 1];
          this.spawnBeam(caster, enemy, '#e8d68a', 0.1, 0.5);
          this.spawnIcon(enemy, 'star', color, 0.85, 1.48);
        }
        break;
      }
      case 'chain': {
        if (def.id === 'steamgunner') {
          for (const target of targets) {
            this.spawnProjectile(caster, target, color, 'bullet', 0.5);
            this.spawnRing(target, color, 0.9, 0.4);
            this.spawnIcon(target, icon, color, 0.75, 1.45);
          }
        } else {
          let previous = caster;
          for (let index = 0; index < targets.length; index++) {
            const target = targets[index];
            this.spawnBeam(previous, target, color, 0.07, 0.4);
            this.spawnRing(target, color, 0.9, 0.4);
            this.spawnIcon(target, icon, color, 0.75, 1.45);
            if (index < 6) previous = target;
          }
        }
        break;
      }
      case 'aoe': {
        const diameter = Math.max(0.9, (def.ability.radius ?? 1.5) * 2);
        for (const target of targets) {
          this.spawnRing(target, color, diameter, 0.65);
          this.spawnIcon(target, icon, color, 0.8, 1.45);
        }
        if (ranged && primary) this.spawnProjectile(caster, primary, color, projectile, 0.5);
        if (def.id === 'bone_dragon') {
          for (const target of targets) {
            this.spawnBeam(caster, target, '#bff5ff', 0.14, 0.5);
            this.spawnIcon(target, 'stun', '#dff8ff', 0.75, 1.7);
          }
        }
        if (def.id === 'siege_colossus') {
          for (const target of targets) this.spawnProjectile(caster, target, '#ff8a5a', 'rocket', 0.7);
        }
        if (def.id === 'blade_dancer') this.spawnRing(caster, color, 2.1, 0.7);
        if (def.id === 'doomguard') this.spawnRing(caster, color, 1.8, 0.6);
        break;
      }
      case 'drain': {
        for (const target of targets) {
          this.spawnBeam(target, caster, color, 0.09, 0.7);
          this.spawnRing(target, color, 1.1, 0.5);
          this.spawnIcon(target, icon, color, 0.8, 1.45);
        }
        break;
      }
      default: {
        for (const target of targets) {
          this.spawnRing(target, color, effect.ability === 'stun' ? 1.2 : 1.0, 0.5);
          this.spawnIcon(target, icon, color, 0.85, 1.45);
          if (effect.ability === 'stun') this.spawnIcon(target, 'stun', '#ffe36e', 0.75, 1.7);
        }
        if (ranged && primary) this.spawnProjectile(caster, primary, color, projectile, 0.45);
        if (def.id === 'boar_rider' && primary) {
          this.spawnBeam(caster, primary, color, 0.16, 0.28);
          this.spawnRing(primary, color, 1.3, 0.45);
        }
        if (def.id === 'squire') this.spawnIcon(caster, 'shield', color, 0.75, iconHeight);
        break;
      }
    }
  }

  private fxMaterial(color: string, alpha = 0.9): StandardMaterial {
    const mat = new StandardMaterial(`abilityFx-${this.fxSeq++}`, this.scene);
    mat.disableLighting = true;
    mat.diffuseColor = Color3.Black();
    mat.emissiveColor = Color3.FromHexString(color);
    mat.specularColor = Color3.Black();
    mat.alpha = alpha;
    mat.backFaceCulling = false;
    return mat;
  }

  private spawnAura(at: Vector3, color: string, ttl: number): void {
    const material = this.fxMaterial(color, 0.85);
    const node = new TransformNode(`fx-aura-${this.fxSeq++}`, this.scene);
    node.position.set(at.x, 0.05, at.z);
    const ring = MeshBuilder.CreateTorus(`fx-aura-ring-${this.fxSeq++}`, { diameter: 0.92, thickness: 0.04, tessellation: 32 }, this.scene);
    ring.parent = node;
    ring.material = material;
    ring.position.y = 0.02;
    ring.isPickable = false;
    const ring2 = MeshBuilder.CreateTorus(`fx-aura-ring2-${this.fxSeq++}`, { diameter: 0.74, thickness: 0.025, tessellation: 32 }, this.scene);
    ring2.parent = node;
    ring2.material = material;
    ring2.position.y = 0.42;
    ring2.rotation.x = Math.PI / 2;
    ring2.isPickable = false;
    this.castFx.push({
      node,
      material,
      born: performance.now(),
      ttl: ttl * 1000,
      kind: 'aura',
      startScale: 0.7,
      endScale: 1.15,
      spin: 1.5,
      alpha: 0.85,
    });
  }

  private spawnRing(at: Vector3, color: string, diameter: number, ttl: number): void {
    const material = this.fxMaterial(color, 0.9);
    const node = new TransformNode(`fx-ring-${this.fxSeq++}`, this.scene);
    node.position.set(at.x, 0.07, at.z);
    node.scaling.setAll(0.2);
    const ring = MeshBuilder.CreateTorus(`fx-ring-mesh-${this.fxSeq++}`, { diameter: 1, thickness: 0.05, tessellation: 36 }, this.scene);
    ring.parent = node;
    ring.material = material;
    ring.isPickable = false;
    this.castFx.push({
      node,
      material,
      born: performance.now(),
      ttl: ttl * 1000,
      kind: 'ring',
      startScale: 0.2,
      endScale: Math.max(0.4, diameter),
      alpha: 0.9,
    });
  }

  private spawnBeam(from: Vector3, to: Vector3, color: string, width: number, ttl: number): void {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.2) return;
    const material = this.fxMaterial(color, 0.9);
    const node = new TransformNode(`fx-beam-${this.fxSeq++}`, this.scene);
    node.position.set((from.x + to.x) / 2, 0.72, (from.z + to.z) / 2);
    node.rotation.y = Math.atan2(dx, dz);
    const mesh = MeshBuilder.CreateBox(`fx-beam-mesh-${this.fxSeq++}`, { width, height: width, depth: distance }, this.scene);
    mesh.parent = node;
    mesh.material = material;
    mesh.isPickable = false;
    this.castFx.push({
      node,
      material,
      born: performance.now(),
      ttl: ttl * 1000,
      kind: 'beam',
      alpha: 0.9,
    });
  }

  private spawnProjectile(from: Vector3, to: Vector3, color: string, style: string, ttl: number): void {
    const start = new Vector3(from.x, 0.68, from.z);
    const end = new Vector3(to.x, 0.66, to.z);
    const { node, material } = this.buildProjectileNode(style, color);
    node.position.copyFrom(start);
    node.rotation.y = Math.atan2(end.x - start.x, end.z - start.z);
    const arc = style === 'rocket' ? 0.55 : style === 'flame' ? 0.16 : style === 'orb' || style === 'star' ? 0.22 : 0.04;
    this.castFx.push({
      node,
      material,
      born: performance.now(),
      ttl: ttl * 1000,
      kind: 'projectile',
      from: start,
      to: end,
      arc,
      spin: style === 'orb' || style === 'bolt' || style === 'star' ? 7 : 0,
      alpha: 0.95,
    });
  }

  private buildProjectileNode(style: string, color: string): { node: TransformNode; material: StandardMaterial } {
    const material = this.fxMaterial(color, 0.95);
    const node = new TransformNode(`fx-projectile-${this.fxSeq++}`, this.scene);
    const part = (mesh: Mesh): Mesh => {
      mesh.parent = node;
      mesh.material = material;
      mesh.isPickable = false;
      return mesh;
    };
    if (style === 'arrow' || style === 'dagger') {
      if (style === 'arrow') {
        const shaft = MeshBuilder.CreateCylinder(`fx-proj-${this.fxSeq++}`, { diameter: 0.035, height: 0.34, tessellation: 6 }, this.scene);
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = 0.04;
        part(shaft);
        const tip = MeshBuilder.CreateCylinder(`fx-proj-${this.fxSeq++}`, { diameterTop: 0, diameterBottom: 0.09, height: 0.14, tessellation: 5 }, this.scene);
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 0.28;
        part(tip);
        for (const sx of [-1, 1]) {
          const feather = MeshBuilder.CreateBox(`fx-proj-${this.fxSeq++}`, { width: 0.06, height: 0.01, depth: 0.1 }, this.scene);
          feather.position.set(sx * 0.05, 0, -0.11);
          feather.rotation.y = sx * 0.3;
          part(feather);
        }
      } else {
        const blade = MeshBuilder.CreateBox(`fx-proj-${this.fxSeq++}`, { width: 0.035, height: 0.04, depth: 0.26 }, this.scene);
        blade.position.z = 0.1;
        part(blade);
        const tip = MeshBuilder.CreateCylinder(`fx-proj-${this.fxSeq++}`, { diameterTop: 0, diameterBottom: 0.07, height: 0.1, tessellation: 4 }, this.scene);
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 0.26;
        part(tip);
        const guard = MeshBuilder.CreateBox(`fx-proj-${this.fxSeq++}`, { width: 0.16, height: 0.035, depth: 0.035 }, this.scene);
        guard.position.z = -0.03;
        part(guard);
      }
    } else if (style === 'flame') {
      const outer = MeshBuilder.CreateCylinder(
        `fx-proj-${this.fxSeq++}`,
        { diameterTop: 0, diameterBottom: 0.2, height: 0.34, tessellation: 7 },
        this.scene,
      );
      outer.rotation.x = Math.PI / 2;
      outer.position.z = 0.1;
      part(outer);
      const core = MeshBuilder.CreateSphere(`fx-proj-${this.fxSeq++}`, { diameter: 0.14, segments: 6 }, this.scene);
      core.position.z = -0.02;
      part(core);
    } else if (style === 'bullet') {
      const bullet = MeshBuilder.CreateSphere(`fx-proj-${this.fxSeq++}`, { diameter: 0.13, segments: 7 }, this.scene);
      part(bullet);
      const trail = MeshBuilder.CreateCylinder(
        `fx-proj-${this.fxSeq++}`,
        { diameterTop: 0, diameterBottom: 0.1, height: 0.24, tessellation: 6 },
        this.scene,
      );
      trail.rotation.x = -Math.PI / 2;
      trail.position.z = -0.16;
      part(trail);
    } else if (style === 'rocket') {
      const shell = MeshBuilder.CreateCylinder(
        `fx-proj-${this.fxSeq++}`,
        { diameter: 0.13, height: 0.3, tessellation: 8 },
        this.scene,
      );
      shell.rotation.x = Math.PI / 2;
      shell.position.z = 0.06;
      part(shell);
      const tip = MeshBuilder.CreateCylinder(
        `fx-proj-${this.fxSeq++}`,
        { diameterTop: 0, diameterBottom: 0.13, height: 0.15, tessellation: 6 },
        this.scene,
      );
      tip.rotation.x = Math.PI / 2;
      tip.position.z = 0.27;
      part(tip);
      for (const sx of [-1, 1]) {
        const fin = MeshBuilder.CreateBox(`fx-proj-${this.fxSeq++}`, { width: 0.02, height: 0.12, depth: 0.1 }, this.scene);
        fin.position.set(sx * 0.06, 0, -0.08);
        part(fin);
      }
    } else if (style === 'snow' || style === 'star') {
      for (let i = 0; i < 3; i++) {
        const ray = MeshBuilder.CreateBox(`fx-proj-${this.fxSeq++}`, { width: 0.04, height: 0.28, depth: 0.04 }, this.scene);
        ray.rotation.z = (i * Math.PI) / 3;
        part(ray);
      }
      const core = MeshBuilder.CreateSphere(`fx-proj-${this.fxSeq++}`, { diameter: 0.13, segments: 6 }, this.scene);
      part(core);
    } else if (style === 'bolt') {
      for (let i = 0; i < 3; i++) {
        const seg = MeshBuilder.CreateBox(`fx-proj-${this.fxSeq++}`, { width: 0.07, height: 0.07, depth: 0.18 }, this.scene);
        seg.position.set(i % 2 === 0 ? 0.04 : -0.04, 0, -i * 0.13);
        seg.rotation.z = i % 2 === 0 ? 0.4 : -0.4;
        part(seg);
      }
    } else {
      const orb = MeshBuilder.CreateSphere(`fx-proj-${this.fxSeq++}`, { diameter: 0.18, segments: 8 }, this.scene);
      part(orb);
      const halo = MeshBuilder.CreateTorus(`fx-proj-${this.fxSeq++}`, { diameter: 0.28, thickness: 0.018, tessellation: 20 }, this.scene);
      halo.rotation.x = Math.PI / 2;
      part(halo);
    }
    return { node, material };
  }

  private spawnIcon(at: Vector3, shape: string, color: string, scale: number, height: number): void {
    const material = this.fxMaterial(color, 0.95);
    const node = new TransformNode(`fx-icon-${this.fxSeq++}`, this.scene);
    node.position.set(at.x, height, at.z);
    node.scaling.setAll(scale);
    const addBox = (w: number, h: number, d: number, x: number, y: number, z = 0, rz = 0, ry = 0): Mesh => {
      const mesh = MeshBuilder.CreateBox(`fx-icon-part-${this.fxSeq++}`, { width: w, height: h, depth: d }, this.scene);
      mesh.parent = node;
      mesh.material = material;
      mesh.position.set(x, y, z);
      mesh.rotation.set(0, ry, rz);
      mesh.isPickable = false;
      return mesh;
    };
    const addSphere = (d: number, x: number, y: number, z = 0, sy = 1): Mesh => {
      const mesh = MeshBuilder.CreateSphere(`fx-icon-part-${this.fxSeq++}`, { diameter: d, segments: 6 }, this.scene);
      mesh.parent = node;
      mesh.material = material;
      mesh.position.set(x, y, z);
      mesh.scaling.y = sy;
      mesh.isPickable = false;
      return mesh;
    };
    const addCyl = (top: number, bottom: number, heightValue: number, x: number, y: number, z = 0, rx = 0, rz = 0, tessellation = 6): Mesh => {
      const mesh = MeshBuilder.CreateCylinder(
        `fx-icon-part-${this.fxSeq++}`,
        { diameterTop: top, diameterBottom: bottom, height: heightValue, tessellation },
        this.scene,
      );
      mesh.parent = node;
      mesh.material = material;
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, 0, rz);
      mesh.isPickable = false;
      return mesh;
    };
    const addTorus = (diameter: number, thickness: number, x: number, y: number, z = 0, rx = 0, rz = 0): Mesh => {
      const mesh = MeshBuilder.CreateTorus(`fx-icon-part-${this.fxSeq++}`, { diameter, thickness, tessellation: 24 }, this.scene);
      mesh.parent = node;
      mesh.material = material;
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, 0, rz);
      mesh.isPickable = false;
      return mesh;
    };

    switch (shape) {
      case 'swords': {
        addBox(0.055, 0.5, 0.05, -0.08, 0.04, 0, -0.55);
        addBox(0.055, 0.5, 0.05, 0.08, 0.04, 0, 0.55);
        addBox(0.16, 0.04, 0.06, -0.16, -0.2, 0);
        addBox(0.16, 0.04, 0.06, 0.16, -0.2, 0);
        addSphere(0.06, -0.2, 0.28);
        addSphere(0.06, 0.2, 0.28);
        break;
      }
      case 'shield': {
        addBox(0.34, 0.38, 0.07, 0, 0);
        addSphere(0.1, 0, 0.02, 0.05);
        addBox(0.06, 0.26, 0.04, 0, 0, 0.06);
        addBox(0.22, 0.06, 0.04, 0, 0.02, 0.06);
        break;
      }
      case 'plus': {
        addBox(0.34, 0.09, 0.06, 0, 0);
        addBox(0.09, 0.34, 0.06, 0, 0);
        addSphere(0.14, 0, 0, 0.05);
        break;
      }
      case 'skull': {
        addSphere(0.26, 0, 0.04, 0, 0.9);
        addBox(0.16, 0.08, 0.12, 0, -0.14, 0.04);
        addCyl(0, 0.05, 0.18, -0.1, 0.18, 0, 0, -0.4, 4);
        addCyl(0, 0.05, 0.18, 0.1, 0.18, 0, 0, 0.4, 4);
        break;
      }
      case 'snow': {
        for (let i = 0; i < 3; i++) addBox(0.035, 0.36, 0.035, 0, 0, 0, (i * Math.PI) / 3);
        addSphere(0.1, 0, 0, 0.02);
        break;
      }
      case 'star': {
        for (let i = 0; i < 3; i++) addBox(0.045, 0.38, 0.045, 0, 0, 0, (i * Math.PI) / 3);
        addSphere(0.13, 0, 0, 0.02);
        break;
      }
      case 'bolt': {
        addBox(0.08, 0.22, 0.06, 0.06, 0.13, 0, 0.5);
        addBox(0.08, 0.22, 0.06, -0.04, -0.02, 0, -0.5);
        addBox(0.08, 0.22, 0.06, 0.05, -0.17, 0, 0.5);
        break;
      }
      case 'flame': {
        addCyl(0, 0.2, 0.4, 0, 0, 0);
        addSphere(0.16, 0, -0.08, 0.02);
        addCyl(0, 0.12, 0.22, -0.12, -0.04, 0, 0, -0.35);
        addCyl(0, 0.12, 0.22, 0.12, -0.04, 0, 0, 0.35);
        break;
      }
      case 'arrow': {
        addBox(0.035, 0.36, 0.035, 0, -0.02);
        addCyl(0, 0.09, 0.16, 0, 0.24);
        addBox(0.08, 0.08, 0.03, -0.06, -0.2, 0, 0.6);
        addBox(0.08, 0.08, 0.03, 0.06, -0.2, 0, -0.6);
        break;
      }
      case 'claw':
      case 'tusk': {
        addBox(0.05, 0.3, 0.045, -0.11, 0.02, 0, -0.22);
        addBox(0.05, 0.3, 0.045, 0, 0.02, 0);
        addBox(0.05, 0.3, 0.045, 0.11, 0.02, 0, 0.22);
        break;
      }
      case 'paw': {
        addSphere(0.22, 0, -0.06, 0, 0.8);
        addSphere(0.09, -0.1, 0.14, 0.02);
        addSphere(0.09, 0, 0.17, 0.02);
        addSphere(0.09, 0.1, 0.14, 0.02);
        break;
      }
      case 'gear': {
        addTorus(0.3, 0.07, 0, 0, 0, Math.PI / 2);
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          addBox(0.1, 0.1, 0.07, Math.cos(angle) * 0.18, Math.sin(angle) * 0.18, 0, angle);
        }
        break;
      }
      case 'feather': {
        addSphere(0.24, 0, 0.04, 0.01, 1.5);
        addBox(0.03, 0.38, 0.03, 0, -0.04, 0, 0.18);
        break;
      }
      case 'blades': {
        addBox(0.05, 0.44, 0.05, -0.09, 0.02, 0, -0.7);
        addBox(0.05, 0.44, 0.05, 0.09, 0.02, 0, 0.7);
        addBox(0.16, 0.04, 0.06, -0.18, -0.18, 0);
        addBox(0.16, 0.04, 0.06, 0.18, -0.18, 0);
        break;
      }
      case 'dagger': {
        addBox(0.045, 0.34, 0.05, 0, 0.04);
        addBox(0.16, 0.04, 0.06, 0, -0.14);
        addSphere(0.06, 0, -0.2, 0);
        break;
      }
      case 'stun': {
        addTorus(0.36, 0.04, 0, 0.02, 0, Math.PI / 2);
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2;
          addSphere(0.08, Math.cos(angle) * 0.2, Math.sin(angle) * 0.2 + 0.02, 0);
        }
        break;
      }
      case 'rocket': {
        addCyl(0.13, 0.13, 0.3, 0, 0);
        addCyl(0, 0.13, 0.16, 0, 0.22);
        addBox(0.02, 0.12, 0.1, -0.08, -0.12);
        addBox(0.02, 0.12, 0.1, 0.08, -0.12);
        break;
      }
      case 'bullet': {
        addSphere(0.13, 0, 0.04);
        addCyl(0, 0.1, 0.2, 0, -0.16);
        break;
      }
      default: {
        for (let i = 0; i < 3; i++) addBox(0.045, 0.38, 0.045, 0, 0, 0, (i * Math.PI) / 3);
        addSphere(0.13, 0, 0, 0.02);
        break;
      }
    }

    this.castFx.push({
      node,
      material,
      born: performance.now(),
      ttl: 950,
      kind: 'icon',
      base: node.position.clone(),
      startScale: scale,
      spin: 1.3,
      rise: 0.42,
      alpha: 0.95,
    });
  }

  private animateCastFx(now: number): void {
    for (let i = this.castFx.length - 1; i >= 0; i--) {
      const fx = this.castFx[i];
      const age = (now - fx.born) / fx.ttl;
      if (age >= 1) {
        fx.node.dispose(false, false);
        fx.material.dispose();
        this.castFx.splice(i, 1);
        continue;
      }
      const t = Math.max(0, Math.min(1, age));
      if (fx.kind === 'projectile' && fx.from && fx.to) {
        fx.node.position.set(
          fx.from.x + (fx.to.x - fx.from.x) * t,
          fx.from.y + (fx.to.y - fx.from.y) * t + Math.sin(Math.PI * t) * (fx.arc ?? 0),
          fx.from.z + (fx.to.z - fx.from.z) * t,
        );
        if (fx.spin) fx.node.rotation.z = t * fx.spin;
      } else if (fx.kind === 'icon' && fx.base) {
        fx.node.position.y = fx.base.y + (fx.rise ?? 0.35) * t;
        fx.node.rotation.y = t * (fx.spin ?? 1.3);
        const scale = (fx.startScale ?? 1) * (1 + Math.sin(t * Math.PI) * 0.14);
        fx.node.scaling.setAll(scale);
      } else if (fx.kind === 'ring') {
        const scale = (fx.startScale ?? 0.2) + ((fx.endScale ?? 2) - (fx.startScale ?? 0.2)) * t;
        fx.node.scaling.setAll(scale);
      } else if (fx.kind === 'aura') {
        const scale = (fx.startScale ?? 0.7) + ((fx.endScale ?? 1.15) - (fx.startScale ?? 0.7)) * t;
        fx.node.scaling.setAll(scale);
        fx.node.rotation.y = t * (fx.spin ?? 1.5);
      } else if (fx.kind === 'beam') {
        fx.node.scaling.x = 1 + Math.sin(t * Math.PI) * 0.35;
      }
      fx.material.alpha = (fx.alpha ?? 0.9) * (1 - t * t);
    }
  }

  private animateEnvironment(): void {
    this.stage?.animate(this.time);
  }

  private animateUnit(visual: UnitVisual, dt: number): void {
    const model = visual.model;
    if (visual.attackTimer > 0) visual.attackTimer = Math.max(0, visual.attackTimer - dt);
    if (visual.castTimer > 0) visual.castTimer = Math.max(0, visual.castTimer - dt);
    const animation = visual.animation;
    const t = this.time + visual.idleSeed;
    const frame = computeAnimationFrame(animation, visual.attackTimer, visual.castTimer);
    const swing = frame.swing;
    const cast = frame.cast;
    const wingCasting = cast > 0;
    const bob =
      Math.sin(t * animation.idleBobSpeed) * animation.idleBobAmount +
      Math.sin(t * animation.idleBobSpeed * 1.7) * animation.idleBobAmount * 0.33;
    let forward = 0;
    if (swing > 0) {
      if (model.attackStyle === 'ranged') forward = -swing * animation.lunge * 0.58;
      else if (model.attackStyle === 'magic') forward = swing * animation.lunge * 0.33;
      else forward = swing * animation.lunge;
    }
    if (cast > 0) forward += cast * 0.04;

    model.body.position.set(0, model.hover + bob, forward);
    model.body.rotation.x = -cast * animation.bodyPitch + (model.attackStyle === 'beast' ? swing * animation.beastPitch : 0);
    model.body.rotation.z =
      Math.sin(t * animation.idleSwaySpeed) * animation.idleSwayAmount +
      (model.attackStyle === 'melee' ? swing * animation.meleeRoll : 0);
    model.body.scaling.setAll(model.gradeScale * (1 + cast * animation.castScale + swing * animation.swingScale));

    if (model.weapon) {
      let wx = model.weaponBase.x;
      let wz = model.weaponBase.z;
      if (swing > 0) {
        if (model.attackStyle === 'melee') {
          wx += swing * 0.35 * animation.weaponPower;
          wz += swing * 1.7 * animation.weaponPower;
        } else if (model.attackStyle === 'ranged') {
          wx -= swing * 0.3 * animation.weaponPower;
        } else if (model.attackStyle === 'magic') {
          wx -= swing * 0.45 * animation.weaponPower;
          wz += swing * 0.35 * animation.weaponPower;
        } else {
          wx += swing * 0.2 * animation.weaponPower;
        }
      }
      if (cast > 0) {
        wx -= cast * animation.castWeapon;
        wz += cast * animation.castWeapon * 0.26;
      }
      model.weapon.rotation.x = wx;
      model.weapon.rotation.z = wz;
    }

    if (model.offhand) {
      let ox = model.offhandBase.x;
      let oz = model.offhandBase.z;
      if (swing > 0) {
        ox += swing * 0.3 * animation.offhandPower;
        oz -= swing * 1.5 * animation.offhandPower;
      }
      if (cast > 0) {
        ox -= cast * 0.7;
        oz -= cast * 0.2;
      }
      model.offhand.rotation.x = ox;
      model.offhand.rotation.z = oz;
    }

    if (model.head) {
      let hx = model.headBase.x;
      if (model.attackStyle === 'beast' && swing > 0) hx += swing * 0.45 * animation.headPower;
      if (cast > 0) hx += cast * 0.25 * animation.headPower;
      model.head.rotation.x = hx;
    }

    const flap =
      Math.sin(t * (wingCasting ? animation.wingSpeed * 3 : animation.wingSpeed)) *
      (wingCasting ? animation.wingCastFlap : animation.wingFlap);
    for (const wing of model.wings) {
      wing.node.rotation.z = wing.baseZ + wing.sign * (flap + 0.06);
      wing.node.rotation.y = wing.sign * (wingCasting ? cast * 0.3 : Math.sin(t * 3) * 0.04);
    }

    if (model.glow) {
      const pulse =
        1 +
        Math.sin(t * animation.glowPulseSpeed) * animation.glowPulse +
        cast * animation.glowCast +
        swing * 0.25;
      model.glow.scaling.setAll(model.glowBase * pulse);
      model.glow.visibility = Math.min(1, 0.16 + cast * 0.5 + Math.abs(Math.sin(t * 6)) * 0.06);
    }

    for (const orb of model.gradeOrbs) {
      const angle = t * orb.speed + orb.angle;
      orb.mesh.position.set(
        Math.cos(angle) * orb.radius,
        orb.y + Math.sin(t * 2.2 + orb.angle) * 0.025,
        Math.sin(angle) * orb.radius,
      );
      orb.mesh.rotation.x += dt * 1.6;
      orb.mesh.rotation.y += dt * 2.2;
    }
    if (model.gradeHalo) model.gradeHalo.rotation.y += dt * 0.9;
    for (let i = 0; i < visual.gradeStars.length; i++) {
      visual.gradeStars[i].scaling.setAll(1 + Math.sin(t * 3.2 + i * 1.7) * 0.055);
    }

    visual.hpDisplay += (visual.hpTarget - visual.hpDisplay) * Math.min(1, dt * 16);
    if (visual.hpTarget >= visual.hpTrailRatio) {
      visual.hpTrailRatio = visual.hpTarget;
    } else {
      visual.hpTrailRatio = Math.max(visual.hpTarget, visual.hpTrailRatio - dt * 0.55);
    }
    visual.manaDisplay += (visual.manaTarget - visual.manaDisplay) * Math.min(1, dt * 14);
    this.applyMeters(visual);
  }

  private animate(): void {
    this.animateEnvironment();
    const pathFx = this.dragPathFx;
    if (pathFx?.active) {
      const pulse = 1 + Math.sin(this.time * 9) * 0.16;
      pathFx.ring.scaling.setAll(pulse);
      pathFx.material.alpha = 0.82 + Math.sin(this.time * 11) * 0.12;
    }
    const dt = Math.min(0.06, this.engine.getDeltaTime() / 1000);
    for (const visual of this.unitVisuals.values()) {
      const leaping = visual.leap !== null;
      if (visual.leap) {
        const leap = visual.leap;
        leap.elapsed += dt;
        const progress = Math.min(1, leap.elapsed / leap.duration);
        const eased = progress * progress * (3 - 2 * progress);
        visual.root.position.x = leap.from.x + (leap.to.x - leap.from.x) * eased;
        visual.root.position.z = leap.from.z + (leap.to.z - leap.from.z) * eased;
        visual.root.position.y = Math.sin(Math.PI * progress) * leap.height;
        if (progress >= 1) {
          visual.root.position.copyFrom(leap.to);
          visual.leap = null;
        }
      } else {
        const dx = visual.target.x - visual.root.position.x;
        const dz = visual.target.z - visual.root.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.002) {
          const travel = Math.min(distance, 4.2 * dt);
          visual.root.position.x += (dx / distance) * travel;
          visual.root.position.z += (dz / distance) * travel;
        }
      }
      const turn = Math.atan2(
        Math.sin(visual.facingTarget - visual.model.body.rotation.y),
        Math.cos(visual.facingTarget - visual.model.body.rotation.y),
      );
      visual.model.body.rotation.y += turn * Math.min(1, dt * 12);
      if (visual.selected) {
        visual.selection.scaling.x = 1 + Math.sin(this.time * 4) * 0.08;
        visual.selection.scaling.z = 1 + Math.sin(this.time * 4) * 0.08;
        if (!leaping) visual.root.position.y = Math.sin(this.time * 3) * 0.018;
      } else {
        visual.selection.scaling.x = 1;
        visual.selection.scaling.z = 1;
        if (!leaping) visual.root.position.y *= 0.8;
      }
      this.animateUnit(visual, dt);
    }
    const now = performance.now();
    this.animateCastFx(now);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      const age = (now - fx.born) / fx.ttl;
      if (age >= 1) {
        fx.mesh.dispose();
        fx.material.dispose();
        this.effects.splice(i, 1);
        continue;
      }
      if (fx.mode === 'tracer') {
        fx.material.alpha = 0.9 * (1 - age);
        continue;
      }
      const scale = 1 + age * 2.2;
      fx.mesh.scaling.setAll(scale);
      fx.material.alpha = 0.85 * (1 - age);
      fx.mesh.position.y += 0.008;
    }
  }
}
