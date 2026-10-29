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
  star: number;
  model: UnitModel;
  camera: ArcRotateCamera;
}

export interface PreviewOptions {
  /** Maximum number of simultaneous previews. */
  capacity?: number;
  /** Dataset attribute (without the `data-` prefix) that marks slot elements. */
  attribute?: string;
}

export class ShopPreview {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly capacity: number;
  private readonly attribute: string;
  private readonly materials = new Map<string, StandardMaterial>();
  private readonly resizeObserver: ResizeObserver;
  private slots: (PreviewSlot | null)[] = [];
  private slotElements: (HTMLElement | null)[] = [];
  private time = 0;
  private seq = 0;

  constructor(canvas: HTMLCanvasElement, options: PreviewOptions = {}) {
    this.canvas = canvas;
    this.capacity = Math.max(1, options.capacity ?? 5);
    this.attribute = options.attribute ?? 'preview-index';
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

  setUnits(defIds: (string | null)[], stars: number[] = []): void {
    const next = defIds.slice(0, this.capacity);

    for (let index = 0; index < next.length; index++) {
      const defId = next[index] ?? null;
      const star = Math.max(1, Math.round(stars[index] ?? 1));
      const current = this.slots[index] ?? null;
      if (current?.defId === defId && current.star === star) continue;
      if (current) this.disposeSlot(current);
      this.slots[index] = defId ? this.createSlot(defId, index, star) : null;
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

  private createSlot(defId: string, index: number, star: number): PreviewSlot {
    const def = getUnitDef(defId);
    const model = createUnitModel(
      {
        scene: this.scene,
        material: (key, diffuse, emissive) => this.material(key, diffuse, emissive),
      },
      def,
      `shop-preview-${defId}-${star}-${this.seq++}`,
      star,
    );

    const mask = 1 << index;
    for (const mesh of model.body.getChildMeshes()) {
      mesh.layerMask = mask;
      mesh.isPickable = false;
    }

    const bounds = this.measure(model);
    const camera = new ArcRotateCamera(
      `shop-preview-camera-${index}`,
      Math.PI / 2 + 0.42,
      1.16,
      Math.max(1.3, bounds.height * 1.48),
      new Vector3(bounds.center.x, bounds.center.y, bounds.center.z),
      this.scene,
    );
    camera.layerMask = mask;
    camera.fov = 0.72;
    camera.minZ = 0.05;
    camera.maxZ = 30;

    return { defId, star, model, camera };
  }

  private measure(model: UnitModel): { center: Vector3; height: number } {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (const mesh of model.body.getChildMeshes()) {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      minX = Math.min(minX, box.minimumWorld.x);
      minY = Math.min(minY, box.minimumWorld.y);
      minZ = Math.min(minZ, box.minimumWorld.z);
      maxX = Math.max(maxX, box.maximumWorld.x);
      maxY = Math.max(maxY, box.maximumWorld.y);
      maxZ = Math.max(maxZ, box.maximumWorld.z);
    }
    if (!Number.isFinite(minY)) {
      return { center: new Vector3(0, model.height * 0.5, 0), height: model.height };
    }
    return {
      center: new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
      height: Math.max(0.4, maxY - minY),
    };
  }

  private disposeSlot(slot: PreviewSlot): void {
    slot.camera.dispose();
    slot.model.body.dispose();
  }

  private collectSlotElements(): void {
    const root = this.canvas.parentElement;
    this.slotElements = new Array(this.slots.length).fill(null);
    if (!root) return;
    for (const element of root.querySelectorAll<HTMLElement>(`[data-${this.attribute}]`)) {
      const index = Number(element.getAttribute(`data-${this.attribute}`));
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
      if (!slot) continue;
      const element = this.slotElements[index];
      const rect = element?.isConnected ? element.getBoundingClientRect() : null;
      // Hide the model while its card is being dragged or re-rendered.
      if (!element || !rect || rect.width < 1 || rect.height < 1 || element.closest('.dragging')) {
        slot.model.body.setEnabled(false);
        continue;
      }
      slot.model.body.setEnabled(true);
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
