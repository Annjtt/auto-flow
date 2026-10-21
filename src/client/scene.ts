import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
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
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Rendering/edgesRenderer';
import { getUnitDef } from '../shared/content';
import type { BattleSnapshot, UnitView } from '../shared/types';

const RACE_COLORS: Record<string, string> = {
  human: '#d7ad5b',
  undead: '#77c79a',
  mech: '#9fb9c9',
  beast: '#c4864f',
  demon: '#c75568',
  elf: '#9bc77f',
};

const CLASS_COLORS: Record<string, string> = {
  warrior: '#c9a46a',
  mage: '#7f9fe0',
  hunter: '#91c184',
  assassin: '#b47bd4',
};

const GROUND_Y = -1.15;

interface UnitVisual {
  root: TransformNode;
  hpFill: Mesh;
  manaFill: Mesh;
  selection: Mesh;
  defId: string;
  star: number;
  target: Vector3;
  selected: boolean;
  team: number;
}

interface FxVisual {
  mesh: Mesh;
  material: StandardMaterial;
  born: number;
  ttl: number;
  mode: 'burst' | 'tracer';
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
  private seenEffects = new Set<string>();
  private battleRound = 0;
  private preparing = true;
  private dragging = false;
  private draggedUid: string | null = null;
  private time = 0;
  private materials = new Map<string, StandardMaterial>();
  private flames: { mesh: Mesh; light: PointLight | null; phase: number }[] = [];
  private motes: { mesh: Mesh; baseX: number; baseZ: number; phase: number; speed: number }[] = [];

  constructor(canvas: HTMLCanvasElement, callbacks: ArenaCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
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

    const dir = new DirectionalLight('dir', new Vector3(-0.5, -1, -0.35), this.scene);
    dir.position = new Vector3(8, 14, 8);
    dir.intensity = 1.25;
    dir.diffuse = new Color3(1, 0.9, 0.75);

    const glow = new GlowLayer('glow', this.scene);
    glow.intensity = 0.38;

    this.buildEnvironment();
    this.buildArena();
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

  private buildArena(): void {
    const stone = this.material('warStone', '#3a352e', '#0b0907');
    const stoneDark = this.material('warStoneDark', '#24211d', '#070605');
    const basalt = this.material('warBasalt', '#191817', '#050505');
    const iron = this.material('warIron', '#2d2d30', '#0a0a0c');
    const rust = this.material('warRust', '#5a3424', '#1b0803');
    const brass = this.material('warBrass', '#8b6a2f', '#3a2608');
    const ember = this.material('warEmber', '#7a2a10', '#ff5a14');

    const bed = MeshBuilder.CreateBox('boardBed', { width: 8.94, height: 0.55, depth: 8.94 }, this.scene);
    bed.position.y = -0.385;
    bed.material = basalt;
    bed.isPickable = false;

    const table = MeshBuilder.CreateBox('warTable', { width: 10.9, height: 0.86, depth: 10.9 }, this.scene);
    table.position.y = -0.75;
    table.material = stone;
    table.isPickable = false;

    const plinth = MeshBuilder.CreateBox('warTablePlinth', { width: 7.6, height: 0.7, depth: 7.6 }, this.scene);
    plinth.position.y = -1.42;
    plinth.material = stoneDark;
    plinth.isPickable = false;

    const skirt = MeshBuilder.CreateBox('warTableSkirt', { width: 10.98, height: 0.24, depth: 10.98 }, this.scene);
    skirt.position.y = -0.42;
    skirt.material = iron;
    skirt.isPickable = false;

    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) {
      const brace = MeshBuilder.CreateBox(`tableBrace-${sx}-${sz}`, { width: 1.7, height: 0.18, depth: 0.46 }, this.scene);
      brace.position = new Vector3(sx * 4.5, -0.3, sz * 4.5);
      brace.rotation.y = sx * sz > 0 ? Math.PI / 4 : -Math.PI / 4;
      brace.material = rust;
      brace.isPickable = false;

      const foot = MeshBuilder.CreateBox(`tableFoot-${sx}-${sz}`, { width: 1.15, height: 0.55, depth: 1.15 }, this.scene);
      foot.position = new Vector3(sx * 4.72, -1.32, sz * 4.72);
      foot.material = stoneDark;
      foot.isPickable = false;

      const footCap = MeshBuilder.CreateBox(`tableFootCap-${sx}-${sz}`, { width: 1.28, height: 0.12, depth: 1.28 }, this.scene);
      footCap.position = new Vector3(sx * 4.72, -1.06, sz * 4.72);
      footCap.material = rust;
      footCap.isPickable = false;
    }

    const seam = MeshBuilder.CreateBox('boardSeam', { width: 8.28, height: 0.04, depth: 8.28 }, this.scene);
    seam.position.y = -0.122;
    seam.material = ember;
    seam.isPickable = false;

    const frameN = MeshBuilder.CreateBox('boardFrameN', { width: 9.1, height: 0.2, depth: 0.38 }, this.scene);
    frameN.position = new Vector3(0, -0.03, -4.18);
    frameN.material = iron;
    frameN.isPickable = false;
    const frameS = frameN.clone('boardFrameS');
    frameS.position.z = 4.18;
    const frameW = MeshBuilder.CreateBox('boardFrameW', { width: 0.38, height: 0.2, depth: 9.1 }, this.scene);
    frameW.position = new Vector3(-4.18, -0.03, 0);
    frameW.material = iron;
    frameW.isPickable = false;
    const frameE = frameW.clone('boardFrameE');
    frameE.position.x = 4.18;

    const inlayN = MeshBuilder.CreateBox('boardInlayN', { width: 9.1, height: 0.035, depth: 0.1 }, this.scene);
    inlayN.position = new Vector3(0, 0.077, -4.18);
    inlayN.material = brass;
    inlayN.isPickable = false;
    const inlayS = inlayN.clone('boardInlayS');
    inlayS.position.z = 4.18;
    const inlayW = MeshBuilder.CreateBox('boardInlayW', { width: 0.1, height: 0.035, depth: 9.1 }, this.scene);
    inlayW.position = new Vector3(-4.18, 0.077, 0);
    inlayW.material = brass;
    inlayW.isPickable = false;
    const inlayE = inlayW.clone('boardInlayE');
    inlayE.position.x = 4.18;

    const rivetMat = this.material('boardRivet', '#8c7448', '#2a1c08');
    for (const side of [-1, 1]) {
      for (let i = -3; i <= 3; i++) {
        const rivetA = MeshBuilder.CreateSphere(`rivetA-${side}-${i}`, { diameter: 0.09, segments: 5 }, this.scene);
        rivetA.position = new Vector3(i * 1.16, 0.083, side * 4.18);
        rivetA.material = rivetMat;
        rivetA.isPickable = false;
        const rivetB = MeshBuilder.CreateSphere(`rivetB-${side}-${i}`, { diameter: 0.09, segments: 5 }, this.scene);
        rivetB.position = new Vector3(side * 4.18, 0.083, i * 1.16);
        rivetB.material = rivetMat;
        rivetB.isPickable = false;
      }
    }

    const tilePlayerLight = this.material('tilePlayerLight', '#405564', '#0b1a24');
    const tilePlayerDark = this.material('tilePlayerDark', '#23323c', '#050c11');
    const tileEnemyLight = this.material('tileEnemyLight', '#5d3b31', '#1c0906');
    const tileEnemyDark = this.material('tileEnemyDark', '#36211c', '#0f0403');

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const playerSide = y >= 4;
        const alt = (x + y) % 2 === 0;
        const mat = playerSide
          ? alt
            ? tilePlayerLight
            : tilePlayerDark
          : alt
            ? tileEnemyLight
            : tileEnemyDark;
        const tile = MeshBuilder.CreateBox(`tile-${x}-${y}`, { width: 0.96, height: 0.11, depth: 0.96 }, this.scene);
        tile.position = new Vector3(x - 3.5, -0.055, y - 3.5);
        tile.rotation.y = (((x * 7 + y * 13) % 5) - 2) * 0.0015;
        tile.material = mat;
        tile.metadata = { kind: 'cell', x, y };
        tile.enableEdgesRendering(0.998);
        tile.edgesWidth = 0.35;
        tile.edgesColor = playerSide
          ? new Color4(0.42, 0.72, 0.94, 0.16)
          : new Color4(0.94, 0.46, 0.3, 0.14);
        this.tiles.push(tile);
      }
    }

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

    const centerRing = MeshBuilder.CreateTorus('centerRune', { diameter: 2.3, thickness: 0.035, tessellation: 64 }, this.scene);
    centerRing.position = new Vector3(0, 0.004, 0);
    centerRing.material = brass;
    centerRing.isPickable = false;
    const centerRingOuter = MeshBuilder.CreateTorus('centerRuneOuter', { diameter: 2.85, thickness: 0.02, tessellation: 64 }, this.scene);
    centerRingOuter.position = new Vector3(0, 0.003, 0);
    centerRingOuter.material = rust;
    centerRingOuter.isPickable = false;

    for (const [x, z] of [[0, 0], [7, 0], [0, 7], [7, 7]]) {
      const rune = MeshBuilder.CreateTorus(`rune-${x}-${z}`, { diameter: 0.52, thickness: 0.035, tessellation: 32 }, this.scene);
      rune.position = new Vector3(x - 3.5, 0.003, z - 3.5);
      rune.material = ember;
      rune.isPickable = false;
    }
  }

  private buildEnvironment(): void {
    const ash = this.material('islandGround', '#2b2a22', '#080806');
    const ashDark = this.material('islandCourt', '#1c1d18', '#050504');
    const rock = this.material('islandRock', '#37342c', '#0b0a08');
    const rockDark = this.material('islandRockDark', '#1e1d1a', '#050504');
    const moss = this.material('islandMoss', '#2f3d2d', '#090f08');
    const sand = this.material('shoreSand', '#5f5543', '#0b0906');
    const bone = this.material('ruinBone', '#645b4c', '#17130d');
    const rust = this.material('ruinRust', '#543024', '#180704');
    const metal = this.material('warMetal', '#2b2a2e', '#0a090c');
    const ember = this.material('brazierFlame', '#ffb45e', '#ff7b1c');
    const starMat = this.material('starMat', '#9fc4ee', '#bcd8ff');
    const moonMat = this.material('bloodMoon', '#3b1b17', '#8a2b1d');

    const sea = this.material('seaWater', '#0a2630', '#031014');
    sea.specularColor = new Color3(0.16, 0.28, 0.32);
    const ocean = MeshBuilder.CreateGround('ocean', { width: 140, height: 140, subdivisions: 1 }, this.scene);
    ocean.position.y = -2.55;
    ocean.material = sea;
    ocean.isPickable = false;

    const islandBase = MeshBuilder.CreateCylinder(
      'islandBase',
      { height: 3.2, diameterTop: 27.2, diameterBottom: 20.5, tessellation: 20 },
      this.scene,
    );
    islandBase.position.y = -2.9;
    islandBase.material = rockDark;
    islandBase.isPickable = false;

    const islandTop = MeshBuilder.CreateCylinder(
      'islandTop',
      { height: 0.34, diameterTop: 27, diameterBottom: 27.4, tessellation: 20 },
      this.scene,
    );
    islandTop.position.y = GROUND_Y - 0.17;
    islandTop.material = ash;
    islandTop.isPickable = false;

    const court = MeshBuilder.CreateCylinder(
      'islandCourt',
      { height: 0.16, diameterTop: 12.4, diameterBottom: 13.2, tessellation: 18 },
      this.scene,
    );
    court.position.y = GROUND_Y + 0.04;
    court.material = ashDark;
    court.isPickable = false;

    const beach = MeshBuilder.CreateTorus(
      'shoreBeach',
      { diameter: 24.8, thickness: 2.3, tessellation: 64 },
      this.scene,
    );
    beach.position.y = GROUND_Y - 0.04;
    beach.scaling.y = 0.12;
    beach.material = sand;
    beach.isPickable = false;

    const foamMat = new StandardMaterial('shoreFoamMat', this.scene);
    foamMat.disableLighting = true;
    foamMat.diffuseColor = Color3.Black();
    foamMat.emissiveColor = new Color3(0.42, 0.76, 0.78);
    foamMat.alpha = 0.2;
    foamMat.backFaceCulling = false;
    for (const [diameter, thickness, fade] of [
      [27.5, 0.08, 1],
      [31, 0.06, 0.7],
      [35.5, 0.045, 0.42],
    ]) {
      const ring = MeshBuilder.CreateTorus(`shoreFoam-${diameter}`, { diameter, thickness, tessellation: 64 }, this.scene);
      ring.position.y = -2.53;
      ring.material = foamMat;
      ring.visibility = fade;
      ring.isPickable = false;
    }

    let seed = 7331;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    for (let i = 0; i < 4; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 29 + rand() * 13;
      const width = 1.2 + rand() * 1.8;
      const height = 2 + rand() * 3.5;
      const stack = MeshBuilder.CreateCylinder(
        `seaStack-${i}`,
        { diameterTop: width * 0.7, diameterBottom: width * 1.6, height, tessellation: 7 },
        this.scene,
      );
      stack.position.set(Math.cos(angle) * radius, -2.55 + height / 2 - 0.35, Math.sin(angle) * radius);
      stack.rotation.y = rand() * Math.PI;
      stack.scaling.z = 0.8 + rand() * 0.5;
      stack.material = i % 3 === 0 ? rockDark : rock;
      stack.isPickable = false;
    }

    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + rand() * 0.2;
      const radius = 10.2 + rand() * 2;
      const size = 0.7 + rand() * 1.4;
      const height = 0.6 + rand() * 1.3;
      const boulder = MeshBuilder.CreateCylinder(
        `islandBoulder-${i}`,
        { diameterTop: size * 0.7, diameterBottom: size, height, tessellation: 6 },
        this.scene,
      );
      boulder.position.set(Math.cos(angle) * radius, GROUND_Y + height / 2 - 0.12, Math.sin(angle) * radius);
      boulder.rotation.y = rand() * Math.PI;
      boulder.rotation.z = (rand() - 0.5) * 0.14;
      boulder.scaling.z = 0.8 + rand() * 0.45;
      boulder.material = i % 4 === 0 ? rock : i % 3 === 0 ? rockDark : moss;
      boulder.isPickable = false;
    }

    for (let i = 0; i < 12; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 13 + rand() * 2.3;
      const size = 0.5 + rand() * 1.1;
      const rockChunk = MeshBuilder.CreateCylinder(
        `shoreRock-${i}`,
        { diameterTop: size * 0.6, diameterBottom: size, height: size * 0.9, tessellation: 6 },
        this.scene,
      );
      rockChunk.position.set(Math.cos(angle) * radius, -2.2 + rand() * 0.5, Math.sin(angle) * radius);
      rockChunk.rotation.y = rand() * Math.PI;
      rockChunk.material = i % 3 === 0 ? rock : rockDark;
      rockChunk.isPickable = false;
    }

    for (let i = 0; i < 14; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 7.2 + rand() * 4.2;
      const size = 0.55 + rand() * 1.3;
      const patch = MeshBuilder.CreateCylinder(
        `moss-${i}`,
        { diameter: size, height: 0.018, tessellation: 10 },
        this.scene,
      );
      patch.position.set(Math.cos(angle) * radius, GROUND_Y + 0.012, Math.sin(angle) * radius);
      patch.scaling.z = 0.6 + rand() * 0.8;
      patch.material = moss;
      patch.isPickable = false;
    }

    for (const [x, z, lit] of [
      [-7.1, -7.1, true],
      [7.1, -7.1, true],
      [-7.1, 7.1, false],
      [7.1, 7.1, false],
    ] as [number, number, boolean][]) {
      this.addBrazier(x, z, metal, ember, lit);
    }

    for (const [x, z, scale, kind, tilt] of [
      [-9.7, -4.5, 2, 'pawn', 0.08],
      [9.7, -3.9, 2.05, 'pawn', -0.1],
      [-9, 4.4, 1.65, 'bishop', 0.04],
      [9, 4.7, 1.7, 'bishop', -0.05],
      [1.4, -9.7, 1.7, 'pawn', 0.88],
    ] as [number, number, number, 'pawn' | 'bishop', number][]) {
      this.addRuinChessPiece(x, z, scale, kind, tilt, bone, rust);
    }

    const moteEmber = this.material('moteEmber', '#a04a20', '#ff6a24');
    const moteAsh = this.material('moteAsh', '#5a5a58', '#9a9a96');
    for (const mat of [moteEmber, moteAsh]) {
      mat.disableLighting = true;
      mat.specularColor = Color3.Black();
      mat.alpha = 0.9;
    }
    for (let i = 0; i < 34; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 3.4 + rand() * 5.2;
      const mote = MeshBuilder.CreateSphere(`mote-${i}`, { diameter: 0.055 + rand() * 0.05, segments: 4 }, this.scene);
      mote.material = i % 3 === 0 ? moteEmber : moteAsh;
      mote.isPickable = false;
      this.motes.push({
        mesh: mote,
        baseX: Math.cos(angle) * radius,
        baseZ: Math.sin(angle) * radius,
        phase: i / 34,
        speed: 0.035 + rand() * 0.05,
      });
    }

    for (let i = 0; i < 44; i++) {
      const star = MeshBuilder.CreateSphere(`star-${i}`, { diameter: 0.1 + rand() * 0.15, segments: 4 }, this.scene);
      star.position.set(-36 + rand() * 72, -4 + rand() * 5.5, -20 - rand() * 24);
      star.material = starMat;
      star.isPickable = false;
    }

    const moon = MeshBuilder.CreateSphere('moon', { diameter: 2.9, segments: 20 }, this.scene);
    moon.position.set(-5, -5, -30);
    moon.material = moonMat;
    moon.isPickable = false;

    const moonHalo = MeshBuilder.CreateTorus('moonHalo', { diameter: 4.4, thickness: 0.06, tessellation: 64 }, this.scene);
    moonHalo.position.copyFrom(moon.position);
    moonHalo.rotation.x = Math.PI / 2;
    moonHalo.material = this.material('moonHalo', '#3a1210', '#8a2b1d');
    moonHalo.visibility = 0.4;
    moonHalo.isPickable = false;
  }

  private addBrazier(x: number, z: number, metal: StandardMaterial, ember: StandardMaterial, lit: boolean): void {
    const baseY = GROUND_Y;
    const pole = MeshBuilder.CreateCylinder(`brazierPole-${x}-${z}`, { diameter: 0.16, height: 1.1, tessellation: 8 }, this.scene);
    pole.position.set(x, baseY + 0.55, z);
    pole.material = metal;
    pole.isPickable = false;
    const bowl = MeshBuilder.CreateCylinder(
      `brazierBowl-${x}-${z}`,
      { diameterTop: 0.58, diameterBottom: 0.34, height: 0.3, tessellation: 10 },
      this.scene,
    );
    bowl.position.set(x, baseY + 1.22, z);
    bowl.material = metal;
    bowl.isPickable = false;
    const flame = MeshBuilder.CreateCylinder(
      `brazierFlame-${x}-${z}`,
      { diameterTop: 0, diameterBottom: 0.42, height: 0.75, tessellation: 8 },
      this.scene,
    );
    flame.position.set(x, baseY + 1.62, z);
    flame.material = ember;
    flame.isPickable = false;
    let light: PointLight | null = null;
    if (lit) {
      light = new PointLight(`brazierLight-${x}-${z}`, new Vector3(x, baseY + 1.9, z), this.scene);
      light.diffuse = new Color3(1, 0.58, 0.24);
      light.specular = new Color3(1, 0.6, 0.3);
      light.intensity = 0.75;
      light.range = 13;
    }
    this.flames.push({ mesh: flame, light, phase: Math.random() * Math.PI * 2 });
  }

  private addRuinChessPiece(
    x: number,
    z: number,
    scale: number,
    kind: 'pawn' | 'bishop' | 'rook' | 'king' | 'knight',
    tilt: number,
    bodyMat: StandardMaterial,
    accentMat: StandardMaterial,
  ): void {
    const root = new TransformNode(`chessRuin-${x}-${z}`, this.scene);
    root.position.set(x, GROUND_Y, z);
    root.rotation.y = (x * 13 + z * 7) % 3;
    root.rotation.z = tilt;

    const base = MeshBuilder.CreateCylinder(
      `chessBase-${x}-${z}`,
      { diameterTop: 0.86 * scale, diameterBottom: 1.1 * scale, height: 0.2 * scale, tessellation: 8 },
      this.scene,
    );
    base.parent = root;
    base.position.y = 0.1 * scale;
    base.material = accentMat;
    base.isPickable = false;

    if (kind === 'pawn') {
      const body = MeshBuilder.CreateCylinder(
        `chessBody-${x}-${z}`,
        { diameterTop: 0.3 * scale, diameterBottom: 0.54 * scale, height: 1.05 * scale, tessellation: 8 },
        this.scene,
      );
      body.parent = root;
      body.position.y = 0.68 * scale;
      body.material = bodyMat;
      body.isPickable = false;
      const head = MeshBuilder.CreateSphere(`chessHead-${x}-${z}`, { diameter: 0.44 * scale, segments: 8 }, this.scene);
      head.parent = root;
      head.position.y = 1.38 * scale;
      head.material = bodyMat;
      head.isPickable = false;
    } else if (kind === 'bishop') {
      const body = MeshBuilder.CreateCylinder(
        `chessBody-${x}-${z}`,
        { diameterTop: 0.28 * scale, diameterBottom: 0.56 * scale, height: 1.25 * scale, tessellation: 8 },
        this.scene,
      );
      body.parent = root;
      body.position.y = 0.825 * scale;
      body.material = bodyMat;
      body.isPickable = false;
      const collar = MeshBuilder.CreateCylinder(
        `chessCollar-${x}-${z}`,
        { diameterTop: 0.4 * scale, diameterBottom: 0.48 * scale, height: 0.14 * scale, tessellation: 8 },
        this.scene,
      );
      collar.parent = root;
      collar.position.y = 1.52 * scale;
      collar.material = accentMat;
      collar.isPickable = false;
      const profile: [number, number][] = [
        [0, 0],
        [0.16, 0],
        [0.25, 0.07],
        [0.31, 0.2],
        [0.29, 0.33],
        [0.19, 0.47],
        [0.16, 0.62],
        [0.24, 0.78],
        [0.25, 0.92],
        [0.16, 1.06],
        [0.07, 1.14],
        [0, 1.17],
      ];
      const mitre = MeshBuilder.CreateLathe(
        `chessMitre-${x}-${z}`,
        {
          shape: profile.map(([px, py]) => new Vector3(px * scale, py * scale, 0)),
          tessellation: 10,
        },
        this.scene,
      );
      mitre.parent = root;
      mitre.position.y = 1.46 * scale;
      mitre.rotation.z = 0.04;
      mitre.material = bodyMat;
      mitre.isPickable = false;
      const slash = MeshBuilder.CreateBox(
        `chessSlash-${x}-${z}`,
        { width: 0.34 * scale, height: 0.05 * scale, depth: 0.06 * scale },
        this.scene,
      );
      slash.parent = root;
      slash.position.set(0.01 * scale, 2.02 * scale, 0.24 * scale);
      slash.rotation.z = 0.68;
      slash.material = accentMat;
      slash.isPickable = false;
      const orb = MeshBuilder.CreateSphere(
        `chessOrb-${x}-${z}`,
        { diameter: 0.14 * scale, segments: 6 },
        this.scene,
      );
      orb.parent = root;
      orb.position.set(-0.03 * scale, 2.62 * scale, 0);
      orb.material = accentMat;
      orb.isPickable = false;
    } else if (kind === 'rook') {
      const body = MeshBuilder.CreateBox(
        `chessBody-${x}-${z}`,
        { width: 0.82 * scale, height: 1.45 * scale, depth: 0.82 * scale },
        this.scene,
      );
      body.parent = root;
      body.position.y = 0.92 * scale;
      body.material = bodyMat;
      body.isPickable = false;
      const crown = MeshBuilder.CreateBox(
        `chessCrown-${x}-${z}`,
        { width: 0.96 * scale, height: 0.2 * scale, depth: 0.96 * scale },
        this.scene,
      );
      crown.parent = root;
      crown.position.y = 1.73 * scale;
      crown.material = accentMat;
      crown.isPickable = false;
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) {
        const crenel = MeshBuilder.CreateBox(
          `chessCrenel-${x}-${z}-${cx}-${cz}`,
          { width: 0.18 * scale, height: 0.3 * scale, depth: 0.2 * scale },
          this.scene,
        );
        crenel.parent = root;
        crenel.position.set(cx * 0.34 * scale, 1.95 * scale, cz * 0.36 * scale);
        crenel.material = bodyMat;
        crenel.isPickable = false;
      }
    } else if (kind === 'king') {
      const body = MeshBuilder.CreateCylinder(
        `chessBody-${x}-${z}`,
        { diameterTop: 0.54 * scale, diameterBottom: 0.74 * scale, height: 1.6 * scale, tessellation: 8 },
        this.scene,
      );
      body.parent = root;
      body.position.y = 0.96 * scale;
      body.material = bodyMat;
      body.isPickable = false;
      const head = MeshBuilder.CreateSphere(`chessHead-${x}-${z}`, { diameter: 0.42 * scale, segments: 8 }, this.scene);
      head.parent = root;
      head.position.y = 1.86 * scale;
      head.material = bodyMat;
      head.isPickable = false;
      const crossV = MeshBuilder.CreateBox(
        `chessCrossV-${x}-${z}`,
        { width: 0.1 * scale, height: 0.5 * scale, depth: 0.1 * scale },
        this.scene,
      );
      crossV.parent = root;
      crossV.position.y = 2.24 * scale;
      crossV.material = accentMat;
      crossV.isPickable = false;
      const crossH = MeshBuilder.CreateBox(
        `chessCrossH-${x}-${z}`,
        { width: 0.38 * scale, height: 0.1 * scale, depth: 0.1 * scale },
        this.scene,
      );
      crossH.parent = root;
      crossH.position.y = 2.3 * scale;
      crossH.material = accentMat;
      crossH.isPickable = false;
    } else {
      const body = MeshBuilder.CreateCylinder(
        `chessBody-${x}-${z}`,
        { diameterTop: 0.46 * scale, diameterBottom: 0.68 * scale, height: 0.7 * scale, tessellation: 8 },
        this.scene,
      );
      body.parent = root;
      body.position.y = 0.53 * scale;
      body.material = bodyMat;
      body.isPickable = false;
      const neck = MeshBuilder.CreateBox(
        `chessNeck-${x}-${z}`,
        { width: 0.34 * scale, height: 0.86 * scale, depth: 0.38 * scale },
        this.scene,
      );
      neck.parent = root;
      neck.position.set(0.04 * scale, 1.24 * scale, 0);
      neck.rotation.z = -0.22;
      neck.material = bodyMat;
      neck.isPickable = false;
      const head = MeshBuilder.CreateBox(
        `chessHead-${x}-${z}`,
        { width: 0.62 * scale, height: 0.3 * scale, depth: 0.34 * scale },
        this.scene,
      );
      head.parent = root;
      head.position.set(0.22 * scale, 1.66 * scale, 0);
      head.rotation.z = -0.42;
      head.material = accentMat;
      head.isPickable = false;
    }
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
    for (const [id, visual] of this.unitVisuals) {
      visual.root.setEnabled(uid === null || id !== uid);
    }
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
      visual.root.position = visual.target.clone();
      visual.root.setEnabled(unit.uid !== this.draggedUid);
      visual.hpFill.scaling.x = 1;
      visual.hpFill.position.x = 0;
      visual.manaFill.scaling.x = 0.001;
      visual.manaFill.position.x = -0.29;
      const selected = unit.uid === selectedUid;
      visual.selection.setEnabled(selected);
      visual.selected = selected;
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
      if (!visual || visual.defId !== unit.defId || visual.star !== unit.star) {
        if (visual) visual.root.dispose();
        visual = this.createUnitVisual(
          { uid: unit.uid, defId: unit.defId, star: unit.star, x: unit.x, y: unit.y },
          unit.team,
        );
        visual.root.position = new Vector3(unit.x - 3.5, 0, unit.y - 3.5);
        this.unitVisuals.set(unit.uid, visual);
      }
      visual.target = new Vector3(unit.x - 3.5, 0, unit.y - 3.5);
      visual.selection.setEnabled(false);
      visual.root.setEnabled(unit.alive);
      const hpRatio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
      visual.hpFill.scaling.x = Math.max(0.001, hpRatio);
      visual.hpFill.position.x = -(0.58 * (1 - hpRatio)) / 2;
      const manaRatio = unit.maxMana > 0 ? Math.max(0, Math.min(1, unit.mana / unit.maxMana)) : 0;
      visual.manaFill.scaling.x = Math.max(0.001, manaRatio);
      visual.manaFill.position.x = -(0.58 * (1 - manaRatio)) / 2;
    }
    for (const effect of snapshot.effects) {
      if (this.seenEffects.has(effect.id)) continue;
      this.seenEffects.add(effect.id);
      this.spawnEffect(effect.kind, effect.x, effect.y, effect.team, effect.id);
      this.spawnFloatText(effect.kind, effect.x, effect.y, effect.value);
      if (
        effect.sx !== undefined &&
        effect.sy !== undefined &&
        (effect.kind === 'hit' || effect.kind === 'miss')
      ) {
        this.spawnTracer(effect.x, effect.y, effect.sx, effect.sy, effect.team, effect.id);
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
    const root = new TransformNode(`unit-${unit.uid}`, this.scene);
    const raceColor = RACE_COLORS[def.race] ?? '#b9a267';
    const classColor = CLASS_COLORS[def.unitClass] ?? '#8fa6c7';
    const bodyMat = this.material(`body-${def.race}`, raceColor, '#1a1208');
    const accentMat = this.material(`accent-${def.unitClass}`, classColor, '#120a1d');
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

    const body = MeshBuilder.CreateCylinder(
      `body-${unit.uid}`,
      { diameterTop: 0.32, diameterBottom: 0.44, height: 0.5, tessellation: 8 },
      this.scene,
    );
    body.parent = root;
    body.position.y = 0.39;
    body.material = bodyMat;
    body.metadata = { kind: 'unit', uid: unit.uid };

    const head = MeshBuilder.CreateSphere(`head-${unit.uid}`, { diameter: 0.3, segments: 10 }, this.scene);
    head.parent = root;
    head.position.y = 0.76;
    head.material = bodyMat;
    head.metadata = { kind: 'unit', uid: unit.uid };

    if (def.unitClass === 'warrior') {
      const shield = MeshBuilder.CreateBox(`shield-${unit.uid}`, { width: 0.08, height: 0.38, depth: 0.32 }, this.scene);
      shield.parent = root;
      shield.position = new Vector3(-0.29, 0.42, 0.02);
      shield.material = accentMat;
      shield.metadata = { kind: 'unit', uid: unit.uid };
      const pauldron = MeshBuilder.CreateBox(`pauldron-${unit.uid}`, { width: 0.52, height: 0.09, depth: 0.28 }, this.scene);
      pauldron.parent = root;
      pauldron.position.y = 0.58;
      pauldron.material = accentMat;
      pauldron.metadata = { kind: 'unit', uid: unit.uid };
    } else if (def.unitClass === 'mage') {
      const hat = MeshBuilder.CreateCylinder(
        `hat-${unit.uid}`,
        { diameterTop: 0.02, diameterBottom: 0.4, height: 0.34, tessellation: 8 },
        this.scene,
      );
      hat.parent = root;
      hat.position.y = 0.97;
      hat.material = accentMat;
      hat.metadata = { kind: 'unit', uid: unit.uid };
      const orb = MeshBuilder.CreateSphere(`orb-${unit.uid}`, { diameter: 0.16, segments: 8 }, this.scene);
      orb.parent = root;
      orb.position = new Vector3(0.3, 0.52, 0.1);
      orb.material = this.material('orb', '#8fc4ff', '#3f8fff');
      orb.metadata = { kind: 'unit', uid: unit.uid };
    } else if (def.unitClass === 'hunter') {
      const bow = MeshBuilder.CreateTorus(`bow-${unit.uid}`, { diameter: 0.38, thickness: 0.035, tessellation: 20 }, this.scene);
      bow.parent = root;
      bow.rotation.x = Math.PI / 2;
      bow.position = new Vector3(0.31, 0.48, 0);
      bow.material = accentMat;
      bow.metadata = { kind: 'unit', uid: unit.uid };
    } else {
      const bladeA = MeshBuilder.CreateBox(`bladeA-${unit.uid}`, { width: 0.04, height: 0.42, depth: 0.08 }, this.scene);
      bladeA.parent = root;
      bladeA.position = new Vector3(-0.26, 0.52, 0.12);
      bladeA.rotation.z = -0.35;
      bladeA.material = accentMat;
      bladeA.metadata = { kind: 'unit', uid: unit.uid };
      const bladeB = bladeA.clone(`bladeB-${unit.uid}`);
      bladeB.position.x = 0.26;
      bladeB.rotation.z = 0.35;
      bladeB.metadata = { kind: 'unit', uid: unit.uid };
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

    for (let i = 0; i < unit.star; i++) {
      const pip = MeshBuilder.CreateSphere(`pip-${unit.uid}-${i}`, { diameter: 0.1, segments: 6 }, this.scene);
      pip.parent = root;
      pip.position = new Vector3((i - (unit.star - 1) / 2) * 0.14, 1.08, 0);
      pip.material = starMat;
      pip.isPickable = false;
    }

    const hpBg = MeshBuilder.CreatePlane(`hpBg-${unit.uid}`, { width: 0.66, height: 0.09 }, this.scene);
    hpBg.parent = root;
    hpBg.position = new Vector3(0, 1.2, 0);
    hpBg.billboardMode = Mesh.BILLBOARDMODE_ALL;
    hpBg.material = this.material('hpBg', '#220d12');
    hpBg.isPickable = false;
    const hpFill = MeshBuilder.CreatePlane(`hp-${unit.uid}`, { width: 0.58, height: 0.05 }, this.scene);
    hpFill.parent = root;
    hpFill.position = new Vector3(0, 1.2, 0.002);
    hpFill.billboardMode = Mesh.BILLBOARDMODE_ALL;
    hpFill.material = this.material(team === 0 ? 'hpA' : 'hpB', team === 0 ? '#5fc06f' : '#d45555', team === 0 ? '#1d5a29' : '#651b1b');
    hpFill.isPickable = false;

    const manaBg = MeshBuilder.CreatePlane(`manaBg-${unit.uid}`, { width: 0.66, height: 0.06 }, this.scene);
    manaBg.parent = root;
    manaBg.position = new Vector3(0, 1.13, 0);
    manaBg.billboardMode = Mesh.BILLBOARDMODE_ALL;
    manaBg.material = this.material('manaBg', '#071527');
    manaBg.isPickable = false;
    const manaFill = MeshBuilder.CreatePlane(`mana-${unit.uid}`, { width: 0.58, height: 0.03 }, this.scene);
    manaFill.parent = root;
    manaFill.position = new Vector3(0, 1.13, 0.002);
    manaFill.billboardMode = Mesh.BILLBOARDMODE_ALL;
    manaFill.material = this.material('mana', '#4d9fff', '#1d4f9c');
    manaFill.isPickable = false;

    return {
      root,
      hpFill,
      manaFill,
      selection,
      defId: unit.defId,
      star: unit.star,
      target: new Vector3(unit.x - 3.5, 0, unit.y - 3.5),
      selected: false,
      team,
    };
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

  private animateEnvironment(): void {
    for (const flame of this.flames) {
      const flicker =
        0.9 + Math.sin(this.time * 9 + flame.phase) * 0.09 + Math.sin(this.time * 23 + flame.phase * 1.7) * 0.04;
      flame.mesh.scaling.y = flicker;
      flame.mesh.scaling.x = 0.9 + (flicker - 0.9) * 0.4;
      flame.mesh.scaling.z = flame.mesh.scaling.x;
      flame.mesh.rotation.y = this.time * 0.7 + flame.phase;
      if (flame.light) {
        flame.light.intensity = 0.62 + (flicker - 0.9) * 1.6;
      }
    }
    for (const mote of this.motes) {
      const t = (this.time * mote.speed + mote.phase) % 1;
      const fade = Math.sin(Math.PI * t);
      mote.mesh.position.set(
        mote.baseX + Math.sin(this.time * 0.45 + mote.phase * 9) * 0.5,
        -0.5 + t * 4.6,
        mote.baseZ + Math.cos(this.time * 0.38 + mote.phase * 7) * 0.5,
      );
      mote.mesh.scaling.setAll(0.5 + fade * 0.9);
      mote.mesh.visibility = 0.12 + fade * 0.62;
    }
  }

  private animate(): void {
    this.animateEnvironment();
    for (const visual of this.unitVisuals.values()) {
      const dx = visual.target.x - visual.root.position.x;
      const dz = visual.target.z - visual.root.position.z;
      if (Math.abs(dx) > 0.002 || Math.abs(dz) > 0.002) {
        visual.root.position.x += dx * 0.22;
        visual.root.position.z += dz * 0.22;
      }
      if (visual.selected) {
        visual.selection.scaling.x = 1 + Math.sin(this.time * 4) * 0.08;
        visual.selection.scaling.z = 1 + Math.sin(this.time * 4) * 0.08;
        visual.root.position.y = Math.sin(this.time * 3) * 0.018;
      } else {
        visual.selection.scaling.x = 1;
        visual.selection.scaling.z = 1;
        visual.root.position.y *= 0.8;
      }
    }
    const now = performance.now();
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
