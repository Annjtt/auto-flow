import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { builtinTheme, envSky, isBuiltinMapId, themeForDoc, type MapDoc, type MapId } from '../shared/maps';
import { MapStage } from './mapStage';

/**
 * Lightweight Babylon backdrop for the menu. It renders the currently selected
 * map on a slowly orbiting camera, so the hub always reflects the active board.
 */
export class MenuBackdrop {
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly hemi: HemisphericLight;
  private readonly dir: DirectionalLight;
  private readonly glow: GlowLayer;
  private readonly materials = new Map<string, StandardMaterial>();
  private stage: MapStage | null = null;
  private mapId: MapId;
  private mapDoc: MapDoc | null = null;
  private active = false;
  private time = 0;
  private readonly onResize = (): void => this.engine.resize();

  constructor(canvas: HTMLCanvasElement, mapId: MapId, mapDoc: MapDoc | null = null) {
    this.canvas = canvas;
    this.mapId = mapId;
    this.mapDoc = mapDoc;

    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, alpha: false });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.03, 0.05, 0.08, 1);
    this.scene.ambientColor = new Color3(0.22, 0.26, 0.36);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = new Color3(0.03, 0.05, 0.09);
    this.scene.fogDensity = 0.012;

    this.camera = new ArcRotateCamera('menuCamera', Math.PI * 0.7, 0.96, 24, new Vector3(0, 0.2, 0), this.scene);
    this.camera.minZ = 0.1;
    this.camera.wheelPrecision = 0;

    this.hemi = new HemisphericLight('menuHemi', new Vector3(0.2, 1, 0.1), this.scene);
    this.dir = new DirectionalLight('menuDir', new Vector3(-0.5, -1, -0.35), this.scene);
    this.dir.position = new Vector3(8, 14, 8);
    this.glow = new GlowLayer('menuGlow', this.scene);
    this.glow.intensity = 0.5;

    this.buildStage();
    this.applyTheme();
    this.engine.runRenderLoop(() => {
      if (!this.active) return;
      const delta = this.engine.getDeltaTime() / 1000;
      this.time += delta;
      this.camera.alpha += delta * 0.055;
      this.camera.beta = 0.96 + Math.sin(this.time * 0.16) * 0.035;
      this.stage?.animate(this.time);
      this.scene.render();
    });
    window.addEventListener('resize', this.onResize);
  }

  show(): void {
    this.active = true;
    this.engine.resize();
    this.scene.render();
  }

  hide(): void {
    this.active = false;
  }

  setMap(mapId: MapId, mapDoc: MapDoc | null = null): void {
    if (mapId === this.mapId && mapDoc === this.mapDoc) return;
    this.mapId = mapId;
    this.mapDoc = mapDoc;
    this.rebuildWorld();
  }

  private buildStage(): void {
    this.stage = new MapStage(this.scene, this.materials, {
      base: this.mapDoc?.base ?? (isBuiltinMapId(this.mapId) ? this.mapId : 'jaddy'),
      env: this.mapDoc?.env,
      interactive: false,
    });
    this.stage.build();
  }

  private rebuildWorld(): void {
    this.stage = null;
    for (const mesh of [...this.scene.meshes]) mesh.dispose(false, false);
    for (const node of [...this.scene.transformNodes]) node.dispose();
    for (const light of [...this.scene.lights]) {
      if (light !== this.hemi && light !== this.dir) light.dispose();
    }
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.buildStage();
    this.applyTheme();
  }

  private applyTheme(): void {
    const theme = this.mapDoc ? themeForDoc(this.mapDoc) : builtinTheme(this.mapId);
    const backdrop = envSky(theme, this.mapDoc?.env);
    const sky = Color3.FromHexString(backdrop.sky);
    const fog = Color3.FromHexString(backdrop.fog);
    this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
    this.scene.fogColor = fog;
    this.scene.fogDensity = backdrop.fogDensity;
    this.hemi.diffuse = Color3.FromHexString(theme.hemiDiffuse);
    this.hemi.groundColor = Color3.FromHexString(theme.hemiGround);
    this.hemi.intensity = theme.hemiIntensity;
    this.dir.diffuse = Color3.FromHexString(theme.dirDiffuse);
    this.dir.intensity = theme.dirIntensity;
    this.glow.intensity = theme.glow * 0.85;
    this.stage?.applyTheme(theme);
  }
}
