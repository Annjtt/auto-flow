import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { Scene } from '@babylonjs/core/scene';
import { getUnitDef } from '../shared/content';
import { createUnitModel, type UnitModel } from './unitModels';

interface PreviewSlot {
  defId: string;
  model: UnitModel;
  camera: ArcRotateCamera;
}

export class ShopPreview {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly materials = new Map<string, StandardMaterial>();
  private readonly resizeObserver: ResizeObserver;
  private slots: (PreviewSlot | null)[] = [];
  private slotElements: (HTMLElement | null)[] = [];
  private time = 0;
  private seq = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
      antialias: true,
    }, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0, 0, 0, 0);

    const hemi = new HemisphericLight('shopPreviewHemi', new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.92;
    hemi.groundColor = new Color3(0.22, 0.25, 0.34);

    const dir = new DirectionalLight('shopPreviewDir', new Vector3(-0.55, -1, 0.7), this.scene);
    dir.intensity = 0.68;
    dir.position = new Vector3(2, 4, -3);

    this.resizeObserver = new ResizeObserver(() => this.engine.resize());
    this.resizeObserver.observe(canvas);
    window.addEventListener('resize', () => this.engine.resize());

    this.engine.runRenderLoop(() => this.render());
  }

  setUnits(defIds: (string | null)[]): void {
    const next = defIds.slice(0, 5);

    for (let index = 0; index < next.length; index++) {
      const defId = next[index] ?? null;
      const current = this.slots[index] ?? null;
      if (current?.defId === defId) continue;
      if (current) this.disposeSlot(current);
      this.slots[index] = defId ? this.createSlot(defId, index) : null;
    }

    for (let index = next.length; index < this.slots.length; index++) {
      const current = this.slots[index];
      if (current) this.disposeSlot(current);
    }
    this.slots.length = next.length;
    this.collectSlotElements();
    this.syncCameras();
  }

  private material(key: string, diffuse: string, emissive = '#000000'): StandardMaterial {
    const existing = this.materials.get(key);
    if (existing) return existing;
    const material = new StandardMaterial(key, this.scene);
    material.diffuseColor = Color3.FromHexString(diffuse);
    material.emissiveColor = Color3.FromHexString(emissive);
    this.materials.set(key, material);
    return material;
  }

  private createSlot(defId: string, index: number): PreviewSlot {
    const def = getUnitDef(defId);
    const model = createUnitModel(
      {
        scene: this.scene,
        material: (key, diffuse, emissive) => this.material(key, diffuse, emissive),
      },
      def,
      `shop-preview-${defId}-${this.seq++}`,
      1,
    );

    const mask = 1 << index;
    for (const mesh of model.body.getChildMeshes()) {
      mesh.layerMask = mask;
      mesh.isPickable = false;
    }

    const camera = new ArcRotateCamera(
      `shop-preview-camera-${index}`,
      Math.PI / 2 + 0.42,
      1.16,
      Math.max(2.3, model.height * 1.8),
      new Vector3(0, model.height * 0.48, 0),
      this.scene,
    );
    camera.layerMask = mask;
    camera.fov = 0.72;
    camera.minZ = 0.1;
    camera.maxZ = 30;

    return { defId, model, camera };
  }

  private disposeSlot(slot: PreviewSlot): void {
    slot.camera.dispose();
    slot.model.body.dispose();
  }

  private collectSlotElements(): void {
    const root = this.canvas.parentElement;
    this.slotElements = new Array(this.slots.length).fill(null);
    if (!root) return;
    for (const element of root.querySelectorAll<HTMLElement>('[data-preview-index]')) {
      const index = Number(element.dataset.previewIndex);
      if (Number.isInteger(index) && index >= 0 && index < this.slots.length) {
        this.slotElements[index] = element;
      }
    }
  }

  private syncCameras(): void {
    const cameras: ArcRotateCamera[] = [];
    for (const slot of this.slots) {
      if (slot) cameras.push(slot.camera);
    }
    this.scene.activeCameras = cameras;
  }

  private layout(): boolean {
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return false;

    for (let index = 0; index < this.slots.length; index++) {
      const slot = this.slots[index];
      const element = this.slotElements[index];
      if (!slot || !element) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const x = (rect.left - bounds.left) / bounds.width;
      const y = 1 - (rect.bottom - bounds.top) / bounds.height;
      const width = rect.width / bounds.width;
      const height = rect.height / bounds.height;
      slot.camera.viewport = new Viewport(x, y, width, height);
    }
    return true;
  }

  private animate(): void {
    for (let index = 0; index < this.slots.length; index++) {
      const slot = this.slots[index];
      if (!slot) continue;
      const phase = this.time * 1.5 + index * 1.7;
      slot.model.body.rotation.y = Math.sin(this.time * 0.55 + index * 0.9) * 0.2;
      slot.model.body.position.y = slot.model.hover + Math.sin(phase) * 0.02;
    }
  }

  private render(): void {
    if (!this.canvas.isConnected || this.canvas.offsetParent === null) return;
    if (!this.scene.activeCameras?.length) {
      this.engine.clear(this.scene.clearColor, true, true, true);
      return;
    }
    if (!this.layout()) return;
    this.time += Math.min(0.05, this.engine.getDeltaTime() / 1000);
    this.animate();
    this.scene.render();
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.scene.dispose();
    this.engine.dispose();
  }
}
