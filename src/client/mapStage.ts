import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { BuiltinMapId, MapTheme } from '../shared/maps';

/** Height of the island surface below the floating war table. */
export const GROUND_Y = -1.15;

export interface StageFlame {
  mesh: Mesh;
  light: PointLight | null;
  phase: number;
}

export interface StageMote {
  mesh: Mesh;
  baseX: number;
  baseZ: number;
  phase: number;
  speed: number;
}

export interface MapStageOptions {
  /** Built-in biome used for the procedural island and its decorations. */
  base: BuiltinMapId;
  /** Board tiles receive cell metadata and remain pickable. */
  interactive?: boolean;
  /** Optional node that receives every built mesh/light, for easy rebuilding. */
  root?: TransformNode | null;
}

/**
 * Builds the whole map stage: war table, 8x8 board, island, shore, biome
 * decorations, braziers, motes and sky props. Shared by the game scene and the
 * Map Lab preview so the editor always shows the real environment.
 */
export class MapStage {
  readonly materials: Map<string, StandardMaterial>;
  tiles: Mesh[] = [];
  flames: StageFlame[] = [];
  motes: StageMote[] = [];
  shoreFoamMat: StandardMaterial | null = null;

  private readonly scene: Scene;
  private readonly base: BuiltinMapId;
  private readonly interactive: boolean;
  private readonly root: TransformNode | null;

  constructor(scene: Scene, materials: Map<string, StandardMaterial>, options: MapStageOptions) {
    this.scene = scene;
    this.materials = materials;
    this.base = options.base;
    this.interactive = options.interactive !== false;
    this.root = options.root ?? null;
  }

  build(): void {
    const meshesBefore = new Set(this.scene.meshes);
    const lightsBefore = new Set(this.scene.lights);
    const nodesBefore = new Set(this.scene.transformNodes);
    this.buildArena();
    this.buildEnvironment();
    if (!this.root) return;
    const root = this.root;
    // Attach only root-level nodes: children that already have a parent (for
    // example chess-piece parts under their own transform) keep their hierarchy.
    for (const node of this.scene.transformNodes) {
      if (!nodesBefore.has(node) && !node.parent) node.parent = root;
    }
    for (const mesh of this.scene.meshes) {
      if (!meshesBefore.has(mesh) && !mesh.parent) mesh.parent = root;
    }
    for (const light of this.scene.lights) {
      if (!lightsBefore.has(light) && !light.parent) light.parent = root;
    }
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

    const foamMat = this.material('shoreFoam', '#a6d8e8', '#d8f2fb');
    foamMat.disableLighting = true;
    foamMat.diffuseColor = Color3.Black();
    foamMat.alpha = 0.2;
    foamMat.backFaceCulling = false;
    this.shoreFoamMat = foamMat;
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

    this.buildMapDecor();
  }


  private buildMapDecor(): void {
    const rock = this.material('islandRock', '#37342c');
    const rockDark = this.material('islandRockDark', '#1e1d1a');
    const bone = this.material('ruinBone', '#645b4c');
    const moss = this.material('islandMoss', '#2f3d2d');
    const brass = this.material('warBrass', '#8b6a2f');
    const glow = this.material('warEmber', '#7a2a10');

    let seed = 419;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    if (this.base === 'kara') {
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2 + 0.16;
        const radius = 12.2 + rand() * 3.4;
        const height = 5.5 + rand() * 5.5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const tower = MeshBuilder.CreateCylinder(
          `karaTower-${i}`,
          { diameterTop: 0.9 + rand() * 0.5, diameterBottom: 2 + rand() * 1.2, height, tessellation: 6 },
          this.scene,
        );
        tower.position.set(x, GROUND_Y + height / 2 - 0.4, z);
        tower.rotation.y = rand() * Math.PI;
        tower.material = i % 3 === 0 ? rockDark : rock;
        tower.isPickable = false;

        const cap = MeshBuilder.CreateCylinder(
          `karaTowerCap-${i}`,
          { diameterTop: 0, diameterBottom: 1.5 + rand() * 0.5, height: 2.2, tessellation: 5 },
          this.scene,
        );
        cap.position.set(x, GROUND_Y + height + 0.7, z);
        cap.rotation.y = rand() * Math.PI;
        cap.material = rockDark;
        cap.isPickable = false;

        const crystal = MeshBuilder.CreateSphere(
          `karaCrystal-${i}`,
          { diameter: 0.5 + rand() * 0.24, segments: 6 },
          this.scene,
        );
        crystal.position.set(x, GROUND_Y + height + 1.5, z);
        crystal.scaling.y = 1.8;
        crystal.material = glow;
        crystal.isPickable = false;
      }
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + 0.7;
        const x = Math.cos(angle) * 8.6;
        const z = Math.sin(angle) * 8.6;
        const pillar = MeshBuilder.CreateBox(
          `karaPillar-${i}`,
          { width: 0.62, height: 3.1 + rand() * 0.7, depth: 0.62 },
          this.scene,
        );
        pillar.position.set(x, GROUND_Y + 1.55, z);
        pillar.rotation.y = angle;
        pillar.material = rockDark;
        pillar.isPickable = false;
        const rune = MeshBuilder.CreateTorus(
          `karaRune-${i}`,
          { diameter: 0.7, thickness: 0.035, tessellation: 32 },
          this.scene,
        );
        rune.position.set(x, GROUND_Y + 2.7, z);
        rune.rotation.x = Math.PI / 2;
        rune.material = brass;
        rune.isPickable = false;
      }
    } else if (this.base === 'starry') {
      for (let i = 0; i < 9; i++) {
        const angle = (i / 9) * Math.PI * 2 + 0.24;
        const radius = 9.4 + rand() * 3.6;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = 1.6 + rand() * 1.8;
        const trunk = MeshBuilder.CreateCylinder(
          `starryTrunk-${i}`,
          { diameterTop: 0.2, diameterBottom: 0.4, height, tessellation: 6 },
          this.scene,
        );
        trunk.position.set(x, GROUND_Y + height / 2, z);
        trunk.material = brass;
        trunk.isPickable = false;
        for (let layer = 0; layer < 3; layer++) {
          const canopy = MeshBuilder.CreateSphere(
            `starryCanopy-${i}-${layer}`,
            { diameter: 1.5 - layer * 0.34, segments: 8 },
            this.scene,
          );
          canopy.position.set(
            x + (rand() - 0.5) * 0.4,
            GROUND_Y + height + 0.2 + layer * 0.55,
            z + (rand() - 0.5) * 0.4,
          );
          canopy.scaling.y = 0.72;
          canopy.material = brass;
          canopy.isPickable = false;
        }
        const orb = MeshBuilder.CreateSphere(
          `starryOrb-${i}`,
          { diameter: 0.28 + rand() * 0.2, segments: 6 },
          this.scene,
        );
        orb.position.set(x, GROUND_Y + height + 2.2 + rand() * 0.8, z);
        orb.material = glow;
        orb.isPickable = false;
      }
      for (let i = 0; i < 3; i++) {
        const ring = MeshBuilder.CreateTorus(
          `starryRing-${i}`,
          { diameter: 12 + i * 2.4, thickness: 0.035, tessellation: 64 },
          this.scene,
        );
        ring.position.y = GROUND_Y + 0.05 + i * 0.02;
        ring.material = brass;
        ring.visibility = 0.35 - i * 0.07;
        ring.isPickable = false;
      }
    } else if (this.base === 'ruins') {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + 0.43;
        const radius = 9.8 + rand() * 3.2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const segments = 2 + Math.floor(rand() * 3);
        let y = GROUND_Y;
        for (let segment = 0; segment < segments; segment++) {
          const height = 0.7 + rand() * 0.9;
          const piece = MeshBuilder.CreateCylinder(
            `ruinPillar-${i}-${segment}`,
            { diameterTop: 0.55 - segment * 0.05, diameterBottom: 0.72, height, tessellation: 7 },
            this.scene,
          );
          piece.position.set(x + (rand() - 0.5) * 0.12, y + height / 2, z + (rand() - 0.5) * 0.12);
          piece.rotation.z = (rand() - 0.5) * 0.16;
          piece.material = segment === segments - 1 ? bone : rock;
          piece.isPickable = false;
          y += height;
        }
        if (rand() > 0.45) {
          const slab = MeshBuilder.CreateBox(
            `ruinSlab-${i}`,
            { width: 1.6 + rand() * 1.2, height: 0.18, depth: 0.7 + rand() * 0.5 },
            this.scene,
          );
          slab.position.set(x + 0.7, GROUND_Y + 0.24, z + 0.5);
          slab.rotation.y = rand() * Math.PI;
          slab.rotation.z = 0.12;
          slab.material = bone;
          slab.isPickable = false;
        }
      }
      for (let i = 0; i < 6; i++) {
        const angle = rand() * Math.PI * 2;
        const radius = 7.2 + rand() * 2.2;
        const rubble = MeshBuilder.CreateBox(
          `ruinRubble-${i}`,
          { width: 0.5 + rand() * 0.7, height: 0.3 + rand() * 0.4, depth: 0.5 + rand() * 0.6 },
          this.scene,
        );
        rubble.position.set(Math.cos(angle) * radius, GROUND_Y + 0.2, Math.sin(angle) * radius);
        rubble.rotation.y = rand() * Math.PI;
        rubble.material = rand() > 0.5 ? bone : rockDark;
        rubble.isPickable = false;
      }
    } else {
      for (let i = 0; i < 13; i++) {
        const angle = (i / 13) * Math.PI * 2 + rand() * 0.25;
        const radius = 9.2 + rand() * 4.4;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = 2 + rand() * 2.6;
        const trunk = MeshBuilder.CreateCylinder(
          `jaddyTrunk-${i}`,
          { diameterTop: 0.24, diameterBottom: 0.52, height, tessellation: 6 },
          this.scene,
        );
        trunk.position.set(x, GROUND_Y + height / 2, z);
        trunk.rotation.z = (rand() - 0.5) * 0.14;
        trunk.material = rockDark;
        trunk.isPickable = false;
        for (let layer = 0; layer < 3; layer++) {
          const canopy = MeshBuilder.CreateSphere(
            `jaddyCanopy-${i}-${layer}`,
            { diameter: 2.1 - layer * 0.4, segments: 8 },
            this.scene,
          );
          canopy.position.set(
            x + (rand() - 0.5) * 0.8,
            GROUND_Y + height + layer * 0.5,
            z + (rand() - 0.5) * 0.8,
          );
          canopy.scaling.y = 0.8;
          canopy.material = moss;
          canopy.isPickable = false;
        }
      }
      for (let i = 0; i < 10; i++) {
        const angle = rand() * Math.PI * 2;
        const radius = 7.4 + rand() * 1.9;
        const bush = MeshBuilder.CreateSphere(
          `jaddyBush-${i}`,
          { diameter: 0.8 + rand() * 0.9, segments: 7 },
          this.scene,
        );
        bush.position.set(Math.cos(angle) * radius, GROUND_Y + 0.25, Math.sin(angle) * radius);
        bush.scaling.y = 0.55;
        bush.material = moss;
        bush.isPickable = false;
      }
    }
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


  /** Repaints every stage material from a map theme (built-in or custom). */
  applyTheme(theme: MapTheme): void {
    for (const [key, [diffuse, emissive]] of Object.entries(theme.mats)) {
      const mat = this.materials.get(key);
      if (!mat) continue;
      mat.diffuseColor = Color3.FromHexString(diffuse);
      mat.emissiveColor = Color3.FromHexString(emissive);
    }
    const tileKeys: [keyof MapTheme['tiles'], string][] = [
      ['playerLight', 'tilePlayerLight'],
      ['playerDark', 'tilePlayerDark'],
      ['enemyLight', 'tileEnemyLight'],
      ['enemyDark', 'tileEnemyDark'],
    ];
    for (const [themeKey, materialKey] of tileKeys) {
      const mat = this.materials.get(materialKey);
      if (mat) mat.diffuseColor = Color3.FromHexString(theme.tiles[themeKey]);
    }
    if (this.shoreFoamMat) {
      this.shoreFoamMat.diffuseColor = Color3.Black();
      this.shoreFoamMat.emissiveColor = Color3.FromHexString(theme.mats.shoreFoam[1]);
    }
  }

  /** Animates brazier flames and floating motes. */
  animate(time: number): void {
    for (const flame of this.flames) {
      const flicker =
        0.9 + Math.sin(time * 9 + flame.phase) * 0.09 + Math.sin(time * 23 + flame.phase * 1.7) * 0.04;
      flame.mesh.scaling.y = flicker;
      flame.mesh.scaling.x = 0.9 + (flicker - 0.9) * 0.4;
      flame.mesh.scaling.z = flame.mesh.scaling.x;
      flame.mesh.rotation.y = time * 0.7 + flame.phase;
      if (flame.light) flame.light.intensity = 0.62 + (flicker - 0.9) * 1.6;
    }
    for (const mote of this.motes) {
      const t = (time * mote.speed + mote.phase) % 1;
      const fade = Math.sin(Math.PI * t);
      mote.mesh.position.set(
        mote.baseX + Math.sin(time * 0.45 + mote.phase * 9) * 0.5,
        -0.5 + t * 4.6,
        mote.baseZ + Math.cos(time * 0.38 + mote.phase * 7) * 0.5,
      );
      mote.mesh.scaling.setAll(0.5 + fade * 0.9);
      mote.mesh.visibility = 0.12 + fade * 0.62;
    }
  }
}
