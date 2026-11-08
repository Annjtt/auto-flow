import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/Builders/discBuilder';
import '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { UnitDef } from '../../../src/shared/types';
import { createUnitModel, type UnitModel } from '../../../src/client/unitModels';
import { computeAnimationFrame } from '../../../src/shared/unitAppearance';
import type { LabAnimation, LabModel } from './labTypes';

interface PartInfo {
  key: string;
  label: string;
  mesh: AbstractMesh;
  basePosition: Vector3;
  baseRotation: Vector3;
  baseScaling: Vector3;
}

export interface PlaybackState {
  attacking: boolean;
  casting: boolean;
  attackProgress: number;
  castProgress: number;
}

const PART_LABELS: Record<string, string> = {
  torso: 'Корпус',
  body: 'Тело',
  chest: 'Грудь',
  head: 'Голова',
  headPivot: 'Голова',
  skull: 'Череп',
  helmet: 'Шлем',
  hood: 'Капюшон',
  crown: 'Корона',
  crest: 'Гребень',
  pauldron: 'Наплечники',
  plate: 'Пластина',
  belt: 'Пояс',
  sash: 'Кушак',
  cape: 'Плащ',
  cloak: 'Плащ',
  scarf: 'Шарф',
  weapon: 'Оружие',
  offhand: 'Вторая рука',
  hilt: 'Рукоять',
  guard: 'Гарда',
  blade: 'Клинок',
  dagger: 'Кинжал',
  staff: 'Посох',
  orb: 'Сфера',
  ring: 'Кольцо',
  aura: 'Аура',
  bow: 'Лук',
  string: 'Тетива',
  arrow: 'Стрела',
  quiver: 'Колчан',
  spear: 'Копьё',
  barrel: 'Ствол',
  muzzle: 'Дуло',
  cannon: 'Пушка',
  shield: 'Щит',
  shieldBoss: 'Умбраб щита',
  halo: 'Ореол',
  wing: 'Крыло',
  membrane: 'Перепонка',
  bone: 'Кость',
  rib: 'Ребро',
  spine: 'Позвоночник',
  tail: 'Хвост',
  tailA: 'Хвост A',
  tailB: 'Хвост B',
  leg: 'Нога',
  boot: 'Обувь',
  arm: 'Рука',
  claw: 'Коготь',
  hoof: 'Копыто',
  eye: 'Глаз',
  eyeL: 'Глаз L',
  eyeR: 'Глаз R',
  jaw: 'Челюсть',
  snout: 'Морда',
  ear: 'Ухо',
  horn: 'Рог',
  fang: 'Клык',
  tusk: 'Клык',
  fire: 'Огонь',
  flame: 'Пламя',
  rune: 'Руна',
  star: 'Звезда',
  leaf: 'Листва',
  root: 'Корень',
  bark: 'Кора',
  branch: 'Ветвь',
  tread: 'Гусеница',
  wheel: 'Колесо',
  boiler: 'Котёл',
  chimney: 'Труба',
  antenna: 'Антенна',
  antennaTip: 'Кончик антенны',
  coil: 'Катушка',
  frame: 'Каркас',
  panel: 'Панель',
  starRay: 'Луч звезды',
  starCore: 'Ядро звезды',
  twig: 'Веточка',
  missile: 'Ракета',
  missileTip: 'Нос ракеты',
  pod: 'Ракетная шахта',
  foot: 'Ступня',
  chestPlate: 'Нагрудник',
  core: 'Ядро',
  spark: 'Искра',
  visor: 'Визор',
  pipe: 'Труба',
  grip: 'Рукоять',
  ringA: 'Кольцо A',
  ringB: 'Кольцо B',
  emblem: 'Эмблема',
  detail: 'Деталь',
};

function partLabel(key: string): string {
  const base = key.replace(/-\d+$/, '');
  const translated = PART_LABELS[base];
  const suffix = key.match(/-(\d+)$/);
  return `${translated ?? base}${suffix ? ` ${Number(suffix[1]) + 1}` : ''}`;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function modelSignature(model: LabModel): string {
  const custom = Object.entries(model.parts)
    .filter(([, part]) => Boolean(part.shape))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, part]) =>
        `${key}:${part.shape}:${part.color ?? ''}:${part.width ?? 0}:${part.height ?? 0}:${part.depth ?? 0}:${
          part.glow ? 1 : 0
        }`,
    )
    .join('|');
  return `${model.palette.body}|${model.palette.accent}|${model.palette.glow}|${custom}`;
}

export class UnitPreview {
  readonly engine: Engine;
  readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly pivot: TransformNode;
  private readonly rim: PointLight;
  private readonly glowLayer: GlowLayer;
  private readonly materials = new Map<string, StandardMaterial>();
  private model: UnitModel | null = null;
  private def: UnitDef | null = null;
  private modelConfig: LabModel | null = null;
  private animation: LabAnimation | null = null;
  private star = 1;
  private parts: PartInfo[] = [];
  private gradeScaleBase = 1;
  private modelSignatureValue = '';
  private clock = 0;
  private attackTimer = 0;
  private castTimer = 0;
  private autoFight = false;
  private autoTimer = 1.2;
  private autoCast = false;
  private paused = false;
  private turntable = true;
  private turntableAngle = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, alpha: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.022, 0.024, 0.04, 1);
    this.scene.ambientColor = new Color3(0.13, 0.14, 0.2);

    this.camera = new ArcRotateCamera(
      'lab-camera',
      Math.PI / 2 - 0.32,
      1.14,
      3.35,
      new Vector3(0, 0.82, 0),
      this.scene,
    );
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 1.65;
    this.camera.upperRadiusLimit = 6.4;
    this.camera.lowerBetaLimit = 0.22;
    this.camera.upperBetaLimit = 1.5;
    this.camera.wheelPrecision = 70;
    this.camera.panningSensibility = 0;
    this.camera.inertia = 0.72;
    this.camera.minZ = 0.05;

    const hemi = new HemisphericLight('lab-hemi', new Vector3(0.2, 1, 0.15), this.scene);
    hemi.intensity = 0.34;
    hemi.diffuse = new Color3(0.58, 0.66, 0.9);
    hemi.groundColor = new Color3(0.06, 0.055, 0.1);

    const dir = new DirectionalLight('lab-dir', new Vector3(-0.55, -1, -0.45), this.scene);
    dir.position = new Vector3(5, 8, 5);
    dir.intensity = 0.7;
    dir.diffuse = new Color3(1, 0.88, 0.72);

    this.rim = new PointLight('lab-rim', new Vector3(-2.4, 2.2, -2.8), this.scene);
    this.rim.intensity = 0.38;
    this.rim.diffuse = new Color3(0.5, 0.7, 1);
    this.rim.specular = new Color3(0.06, 0.06, 0.08);

    this.glowLayer = new GlowLayer('lab-glow', this.scene);
    this.glowLayer.intensity = 0.36;

    this.pivot = new TransformNode('lab-pivot', this.scene);

    const ground = MeshBuilder.CreateDisc('lab-ground', { radius: 2.4, tessellation: 64 }, this.scene);
    ground.rotation.x = Math.PI / 2;
    ground.position.y = -0.012;
    const groundMat = new StandardMaterial('lab-ground-mat', this.scene);
    groundMat.diffuseColor = new Color3(0.045, 0.05, 0.08);
    groundMat.emissiveColor = new Color3(0.012, 0.014, 0.026);
    groundMat.specularColor = Color3.Black();
    ground.material = groundMat;

    const pedestal = MeshBuilder.CreateCylinder(
      'lab-pedestal',
      { diameterTop: 1.72, diameterBottom: 1.92, height: 0.09, tessellation: 64 },
      this.scene,
    );
    pedestal.position.y = 0.008;
    const pedestalMat = new StandardMaterial('lab-pedestal-mat', this.scene);
    pedestalMat.diffuseColor = new Color3(0.07, 0.072, 0.1);
    pedestalMat.emissiveColor = new Color3(0.018, 0.018, 0.03);
    pedestalMat.specularColor = new Color3(0.2, 0.2, 0.24);
    pedestal.material = pedestalMat;

    const ringMat = new StandardMaterial('lab-ring-mat', this.scene);
    ringMat.diffuseColor = Color3.Black();
    ringMat.emissiveColor = new Color3(0.55, 0.38, 0.14);
    ringMat.specularColor = Color3.Black();
    const ring = MeshBuilder.CreateTorus('lab-ring', { diameter: 1.82, thickness: 0.018, tessellation: 64 }, this.scene);
    ring.position.y = 0.056;
    ring.material = ringMat;

    const innerRingMat = new StandardMaterial('lab-inner-ring-mat', this.scene);
    innerRingMat.diffuseColor = Color3.Black();
    innerRingMat.emissiveColor = new Color3(0.14, 0.2, 0.38);
    innerRingMat.specularColor = Color3.Black();
    const innerRing = MeshBuilder.CreateTorus(
      'lab-inner-ring',
      { diameter: 1.48, thickness: 0.008, tessellation: 64 },
      this.scene,
    );
    innerRing.position.y = 0.052;
    innerRing.material = innerRingMat;

    const softShadow = MeshBuilder.CreateDisc('lab-shadow', { radius: 0.62, tessellation: 48 }, this.scene);
    softShadow.rotation.x = Math.PI / 2;
    softShadow.position.y = 0.06;
    const shadowMat = new StandardMaterial('lab-shadow-mat', this.scene);
    shadowMat.diffuseColor = Color3.Black();
    shadowMat.emissiveColor = Color3.Black();
    shadowMat.specularColor = Color3.Black();
    shadowMat.alpha = 0.34;
    softShadow.material = shadowMat;

    for (const [index, radius] of [1.06, 2.05].entries()) {
      const faint = MeshBuilder.CreateTorus(
        `lab-orbit-${index}`,
        { diameter: radius * 2, thickness: 0.006, tessellation: 80 },
        this.scene,
      );
      faint.position.y = 0.048;
      const faintMat = new StandardMaterial(`lab-orbit-mat-${index}`, this.scene);
      faintMat.diffuseColor = Color3.Black();
      faintMat.emissiveColor = new Color3(0.09, 0.11, 0.18);
      faintMat.specularColor = Color3.Black();
      faint.material = faintMat;
    }

    this.engine.runRenderLoop(this.renderFrame);
    this.resizeObserver = new ResizeObserver(() => this.engine.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.engine.stopRenderLoop(this.renderFrame);
    this.scene.dispose();
    this.engine.dispose();
  }

  setUnit(def: UnitDef, model: LabModel, animation: LabAnimation, star: number): void {
    this.def = def;
    this.modelConfig = model;
    this.animation = animation;
    this.star = star;
    this.attackTimer = 0;
    this.castTimer = 0;
    this.modelSignatureValue = modelSignature(model);
    this.rebuild();
  }

  setModel(model: LabModel): void {
    if (!this.modelConfig || !this.model) {
      this.modelConfig = model;
      this.modelSignatureValue = modelSignature(model);
      this.rebuild();
      return;
    }
    this.modelConfig = model;
    const nextSignature = modelSignature(model);
    if (nextSignature !== this.modelSignatureValue) {
      this.modelSignatureValue = nextSignature;
      this.rebuild();
      return;
    }
    this.model.gradeScale = this.gradeScaleBase * model.scale;
    this.applyParts();
    this.updateAccent();
  }

  setAnimation(animation: LabAnimation): void {
    this.animation = animation;
    if (this.model) this.model.attackStyle = animation.attackStyle;
  }

  setStar(star: number): void {
    if (this.star === star) return;
    this.star = star;
    this.rebuild();
  }

  getParts(): { key: string; label: string }[] {
    return this.parts.map((part) => ({ key: part.key, label: part.label }));
  }

  getPlayback(): PlaybackState {
    if (!this.animation) {
      return { attacking: false, casting: false, attackProgress: 0, castProgress: 0 };
    }
    const frame = computeAnimationFrame(this.animation, this.attackTimer, this.castTimer);
    return {
      attacking: frame.attacking,
      casting: frame.casting,
      attackProgress: frame.attackProgress,
      castProgress: frame.castProgress,
    };
  }

  triggerAttack(): void {
    if (!this.animation) return;
    if (this.animation.swapAttackCast) {
      this.castTimer = this.animation.castDuration;
    } else {
      this.attackTimer = this.animation.attackDuration;
    }
  }

  triggerCast(): void {
    if (!this.animation) return;
    if (this.animation.swapAttackCast) {
      this.attackTimer = this.animation.attackDuration;
    } else {
      this.castTimer = this.animation.castDuration;
    }
  }

  triggerIdle(): void {
    this.attackTimer = 0;
    this.castTimer = 0;
  }

  setAutoFight(enabled: boolean): void {
    this.autoFight = enabled;
    this.autoTimer = 0.2;
    if (!enabled) this.triggerIdle();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setTurntable(enabled: boolean): void {
    this.turntable = enabled;
  }

  resize(): void {
    this.engine.resize();
  }

  private rebuild(): void {
    if (!this.def || !this.modelConfig || !this.animation) return;
    if (this.model) {
      this.model.body.dispose(false, false);
      this.model = null;
    }
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.parts = [];

    const model = createUnitModel(
      {
        scene: this.scene,
        material: (key, diffuse, emissive) => this.material(key, diffuse, emissive),
      },
      this.def,
      'lab',
      this.star,
      {
        palette: this.modelConfig.palette,
        scale: this.modelConfig.scale,
        parts: this.modelConfig.parts,
        skipPartOverrides: true,
      },
    );
    model.body.parent = this.pivot;
    model.body.rotation.y = 0;
    model.attackStyle = this.animation.attackStyle;
    this.model = model;
    this.gradeScaleBase = this.star >= 2 ? model.gradeScale / Math.max(0.001, this.modelConfig.scale) : 1;
    if (this.star < 2) this.gradeScaleBase = 1;

    const prefix = `lab-${this.def.id}-`;
    for (const mesh of model.body.getChildMeshes()) {
      const key = mesh.name.startsWith(prefix) ? mesh.name.slice(prefix.length) : mesh.name;
      this.parts.push({
        key,
        label: partLabel(key),
        mesh,
        basePosition: mesh.position.clone(),
        baseRotation: mesh.rotation.clone(),
        baseScaling: mesh.scaling.clone(),
      });
    }
    this.applyParts();
    this.updateAccent();
    this.resize();
  }

  private applyParts(): void {
    if (!this.modelConfig) return;
    for (const part of this.parts) {
      const override = this.modelConfig.parts[part.key];
      if (!override) {
        part.mesh.setEnabled(true);
        part.mesh.position.copyFrom(part.basePosition);
        part.mesh.rotation.copyFrom(part.baseRotation);
        part.mesh.scaling.copyFrom(part.baseScaling);
        continue;
      }
      part.mesh.setEnabled(override.visible);
      part.mesh.position.set(
        part.basePosition.x + override.px,
        part.basePosition.y + override.py,
        part.basePosition.z + override.pz,
      );
      part.mesh.rotation.set(
        part.baseRotation.x + toRadians(override.rx),
        part.baseRotation.y + toRadians(override.ry),
        part.baseRotation.z + toRadians(override.rz),
      );
      part.mesh.scaling.set(
        part.baseScaling.x * override.sx,
        part.baseScaling.y * override.sy,
        part.baseScaling.z * override.sz,
      );
    }
  }

  private updateAccent(): void {
    if (!this.modelConfig) return;
    const glow = Color3.FromHexString(this.modelConfig.palette.glow);
    this.rim.diffuse = glow.scale(0.62).add(new Color3(0.16, 0.2, 0.34));
    this.glowLayer.intensity = 0.32 + Math.min(0.5, glow.r * 0.18 + glow.g * 0.18 + glow.b * 0.18);
  }

  private material(key: string, diffuse: string, emissive = '#000000'): StandardMaterial {
    const existing = this.materials.get(key);
    if (existing) return existing;
    const material = new StandardMaterial(key, this.scene);
    material.diffuseColor = Color3.FromHexString(diffuse);
    material.emissiveColor = Color3.FromHexString(emissive);
    material.specularColor = new Color3(0.05, 0.05, 0.07);
    this.materials.set(key, material);
    return material;
  }

  private readonly renderFrame = (): void => {
    if (!this.animation || !this.modelConfig || !this.model || !this.def) {
      this.scene.render();
      return;
    }
    const dt = Math.min(0.06, this.engine.getDeltaTime() / 1000);
    const speed = this.paused ? 0 : this.animation.speed;
    const animDt = dt * speed;
    this.clock += animDt;
    this.turntableAngle += this.turntable && !this.paused ? dt * 0.45 : 0;
    this.pivot.rotation.y = toRadians(this.modelConfig.yaw) + this.turntableAngle;

    if (this.autoFight && !this.paused) {
      this.autoTimer -= animDt;
      if (this.autoTimer <= 0) {
        this.autoCast = !this.autoCast;
        if (this.autoCast) this.triggerCast();
        else this.triggerAttack();
        this.autoTimer = this.autoCast ? 1.9 : 1.35;
      }
    }

    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - animDt);
    if (this.castTimer > 0) this.castTimer = Math.max(0, this.castTimer - animDt);

    const animation = this.animation;
    const model = this.model;
    const t = this.clock + 3.7;
    const frame = computeAnimationFrame(animation, this.attackTimer, this.castTimer);
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

    model.body.position.set(0, this.modelConfig.hover + bob, forward);
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
      orb.mesh.rotation.x += animDt * 1.6;
      orb.mesh.rotation.y += animDt * 2.2;
    }
    if (model.gradeHalo) model.gradeHalo.rotation.y += animDt * 0.9;

    this.scene.render();
  };
}
