/**
 * Win-streak sparks for the leaderboard.
 *
 * A single canvas is overlaid on the players panel. Every row that has a
 * positive win streak emits sparks from its left border; the sparks drift to
 * the right and fade out. Two size tiers are used (small / medium).
 *
 * Emission rate, brightness, spark size and the short "streak grew" burst all
 * scale with the streak level: a 1-win streak is a barely visible shimmer, an
 * 8-win streak is a dense golden current.
 *
 * Sparks are strictly contained by their own row: each spark keeps a snapshot
 * of the row box it was born in, is drawn inside a clip region of that box and
 * fades out before it can reach the right edge.
 *
 * Rows are re-rendered with innerHTML by main.ts, so mount() re-attaches the
 * same canvas instead of recreating it.
 */

const MAX_SPARKS = 160;
const TARGET_REFRESH_MS = 140;
const SPRITE_SIZE = 48;
/** Horizontal distance over which a spark fades before the row's right edge. */
const EDGE_FADE = 18;

type Rgb = readonly [number, number, number];

const PALETTE: Rgb[] = [
  [255, 236, 190],
  [255, 208, 122],
  [255, 172, 74],
  [255, 244, 222],
];

interface SparkTier {
  rate: number;        // Частота появления частиц (плотность)
  speedMin: number;    // Минимальная скорость
  speedMax: number;    // Максимальная скорость
  sizeMin: number;     // Минимальный размер
  sizeMax: number;     // Максимальный размер
  goldChance: number;  // Шанс появления золотого/оранжевого цвета (0.0 - 1.0)
  burstCount: number;  // Количество частиц при мгновенном увеличении серии
  bright: number;      // Базовая яркость (непрозрачность)
}

const STREAK_TIERS: Record<number, SparkTier> = {
  1: { rate: 1.5,  speedMin: 5, speedMax: 15,  sizeMin: 0.3, sizeMax: 1.2,  goldChance: 0.0, burstCount: 3,  bright: 0.4 },
  2: { rate: 3.0,  speedMin: 10, speedMax: 20,  sizeMin: 0.4, sizeMax: 1.7,  goldChance: 0.2, burstCount: 5,  bright: 0.5 },
  3: { rate: 5.0,  speedMin: 15, speedMax: 25,  sizeMin: 0.4, sizeMax: 2.1,  goldChance: 0.3, burstCount: 8,  bright: 0.65 },
  4: { rate: 7.0,  speedMin: 20, speedMax: 30,  sizeMin: 0.5, sizeMax: 2.5,  goldChance: 0.4, burstCount: 10, bright: 0.71 },
  5: { rate: 9.0,  speedMin: 20, speedMax: 35,  sizeMin: 0.5, sizeMax: 2.8,  goldChance: 0.5, burstCount: 12, bright: 0.81 },
  6: { rate: 11.0, speedMin: 25, speedMax: 40,  sizeMin: 0.6, sizeMax: 3.5,  goldChance: 0.6, burstCount: 15, bright: 0.91 },
  7: { rate: 13.0, speedMin: 30, speedMax: 45,  sizeMin: 0.6, sizeMax: 4.0,  goldChance: 0.7, burstCount: 18, bright: 0.95 },
  8: { rate: 16.0, speedMin: 35, speedMax: 50, sizeMin: 0.7, sizeMax: 4.5,  goldChance: 0.8, burstCount: 25, bright: 1.0 },
};

/** The row rect a spark belongs to; nothing is ever drawn outside of it. */
interface SparkBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface SparkTarget extends SparkBox {
  rate: number;
  streak: number;
  bright: number;
  playerId: string;
  tier: SparkTier;
}

interface Spark {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  size: number;
  bright: number;
  box: SparkBox;
  playerId: string;
  sprite: HTMLCanvasElement;
  rgb: Rgb;
}

export class LeaderSparks {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D | null;
  private panel: HTMLElement | null = null;
  private sparks: Spark[] = [];
  private targets: SparkTarget[] = [];
  private streaks = new Map<string, number>();
  private sprites: HTMLCanvasElement[];
  private raf = 0;
  private lastFrame = 0;
  private refreshIn = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private reduced: boolean;

  constructor() {
    this.canvas.className = 'leader-sparks';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    this.sprites = PALETTE.map((rgb) => buildSprite(rgb));

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = motion.matches;
    motion.addEventListener('change', (event) => {
      this.reduced = event.matches;
      if (this.reduced) {
        this.sparks = [];
        this.clear();
      }
    });
  }

  /** Keeps one canvas inside the panel and starts the render loop once. */
  mount(panel: HTMLElement): void {
    this.panel = panel;
    if (this.canvas.parentElement !== panel) {
      panel.appendChild(this.canvas);
      this.lastFrame = 0;
    }
    this.resize();
    if (!this.raf) this.raf = window.requestAnimationFrame(this.tick);
  }

  private tick = (time: number): void => {
    this.raf = window.requestAnimationFrame(this.tick);
    const panel = this.panel;
    if (!panel || !panel.isConnected || panel.offsetParent === null || document.hidden) {
      this.lastFrame = time;
      this.clear();
      return;
    }

    const dt = this.lastFrame ? Math.min(0.05, (time - this.lastFrame) / 1000) : 0;
    this.lastFrame = time;

    this.refreshIn -= dt * 1000;
    if (this.refreshIn <= 0) {
      this.refreshIn = TARGET_REFRESH_MS;
      this.resize();
      this.refreshTargets();
    }

    if (this.reduced) {
      if (this.sparks.length > 0) {
        this.sparks = [];
        this.clear();
      }
      return;
    }

    if (dt > 0) {
      this.emit(dt);
      this.step(dt);
    }
    this.draw();
  };

  private resize(): void {
    const panel = this.panel;
    if (!panel) return;
    const width = panel.clientWidth;
    const height = panel.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (width === this.width && height === this.height && dpr === this.dpr) return;

    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private refreshTargets(): void {
    const panel = this.panel;
    if (!panel) {
      this.targets = [];
      return;
    }

    const base = panel.getBoundingClientRect();
    const list = panel.querySelector<HTMLElement>('.leader-list');
    const listRect = list ? list.getBoundingClientRect() : base;
    const clipTop = Math.max(base.top, listRect.top) - base.top;
    const clipBottom = Math.min(base.bottom, listRect.bottom) - base.top;

    const targets: SparkTarget[] = [];
    const seen = new Set<string>();
    const rows = panel.querySelectorAll<HTMLElement>('.leader-row[data-streak]');
    
    rows.forEach((row) => {
      const streak = Number(row.dataset.streak ?? '0');
      if (!Number.isFinite(streak) || streak <= 0) return;
      if (row.classList.contains('dead')) return;

      const rect = row.getBoundingClientRect();
      const top = rect.top - base.top;
      const bottom = rect.bottom - base.top;
      if (bottom < clipTop || top > clipBottom) return;

      const playerId = row.dataset.playerId ?? '';
      seen.add(playerId);

      // Берем настройки для текущего уровня (максимум 8)
      const tier = STREAK_TIERS[Math.min(streak, 8)] ?? STREAK_TIERS[1];

      const target: SparkTarget = {
        left: rect.left - base.left,
        right: rect.right - base.left,
        top: Math.max(top, clipTop) + 2,
        bottom: Math.min(bottom, clipBottom) - 2,
        rate: tier.rate,
        streak,
        bright: tier.bright,
        playerId,
        tier, // Передаем весь объект настроек
      };

      const previous = this.streaks.get(playerId);
      if (previous !== undefined && streak > previous) {
        // Взрыв частиц при повышении серии
        for (let i = 0; i < tier.burstCount; i++) {
          this.spawn(target, true);
        }
      }
      this.streaks.set(playerId, streak);
      targets.push(target);
    });

    for (const id of this.streaks.keys()) {
      if (!seen.has(id)) this.streaks.delete(id);
    }

    this.targets = targets;

    const boxes = new Map<string, SparkBox>();
    for (const target of targets) {
      boxes.set(target.playerId, {
        left: target.left,
        right: target.right,
        top: target.top,
        bottom: target.bottom,
      });
    }
    this.sparks = this.sparks.filter((spark) => {
      const box = boxes.get(spark.playerId);
      if (!box) return false;
      const dx = box.left - spark.box.left;
      const dy = box.top - spark.box.top;
      spark.box = box;
      spark.x += dx;
      spark.y += dy;
      spark.px += dx;
      spark.py += dy;
      return true;
    });
  }

  private emit(dt: number): void {
    for (const target of this.targets) {
      if (Math.random() < target.rate * dt) this.spawn(target, false);
    }
  }

  private spawn(target: SparkTarget, burst: boolean): void {
    if (this.sparks.length >= MAX_SPARKS) return;

    const tier = target.tier;
    const height = Math.max(1, target.bottom - target.top);
    const width = Math.max(1, target.right - target.left);

    // Умный выбор цвета на основе goldChance
    let paletteIndex: number;
    if (Math.random() < tier.goldChance) {
      // Золотые/оранжевые оттенки (индексы 1 и 2 в PALETTE)
      paletteIndex = Math.random() < 0.7 ? 1 : 2;
    } else {
      // Белые/светлые оттенки (индексы 0 и 3 в PALETTE)
      paletteIndex = Math.random() < 0.5 ? 0 : 3;
    }

    // Магия нелинейности: Math.pow дает много мелких частиц и мало крупных
    const randomFactor = Math.pow(Math.random(), 2.5);
    const size = tier.sizeMin + randomFactor * (tier.sizeMax - tier.sizeMin);
    const x = target.left + 1;
    const inset = Math.min(height * 0.35, size * 4 + 4);
    const y = target.top + inset + Math.random() * Math.max(1, height - inset * 2);

    // Скорость и дальность полета
    const speed = tier.speedMin + Math.random() * (tier.speedMax - tier.speedMin);
    const travelMultiplier = burst ? 1.15 : 1.0; // Взрывные частицы летят чуть дальше
    const maxRange = (width - 26) * (0.4 + (target.streak / 8) * 0.6);
    const travel = Math.max(14, maxRange * (0.3 + 0.7 * Math.random())) * travelMultiplier;
    const ttl = Math.min(2.5, Math.max(0.4, travel / speed));

    this.sparks.push({
      x,
      y,
      px: x,
      py: y,
      vx: Math.min(speed, travel / ttl),
      // На высоких уровнях добавляем хаотичности по вертикали для эффекта "взрыва"
      vy: (Math.random() - 0.6) * (2 + target.streak * 0.3),
      age: 0,
      ttl,
      size,
      bright: target.bright,
      box: { left: target.left, right: target.right, top: target.top, bottom: target.bottom },
      playerId: target.playerId,
      sprite: this.sprites[paletteIndex],
      rgb: PALETTE[paletteIndex],
    });
  }

  private step(dt: number): void {
    const alive: Spark[] = [];
    for (const spark of this.sparks) {
      spark.px = spark.x;
      spark.py = spark.y;
      spark.age += dt;
      if (spark.age >= spark.ttl || spark.x > spark.box.right - 2) continue;

      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 1 - 0.2 * dt;
      alive.push(spark);
    }
    this.sparks = alive;
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = 'lighter';

    // One clip per row, so a spark can never paint outside its own plate.
    const groups = new Map<SparkBox, Spark[]>();
    for (const spark of this.sparks) {
      const list = groups.get(spark.box);
      if (list) list.push(spark);
      else groups.set(spark.box, [spark]);
    }

    for (const [box, list] of groups) {
      const width = box.right - box.left;
      const height = box.bottom - box.top;
      if (width <= 0 || height <= 0) continue;

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.left, box.top, width, height);
      ctx.clip();

      for (const spark of list) {
        const progress = spark.age / spark.ttl;
        const fadeIn = Math.min(1, progress / 0.18);
        const fadeOut = 1 - Math.max(0, (progress - 0.45) / 0.55);
        const edge = Math.max(0, Math.min(1, (box.right - spark.x) / EDGE_FADE));
        const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut * edge)) * spark.bright;
        if (alpha <= 0.01) continue;

        const [r, g, b] = spark.rgb;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`;
        ctx.lineWidth = spark.size;
        ctx.beginPath();
        ctx.moveTo(spark.px, spark.py);
        ctx.lineTo(spark.x, spark.y);
        ctx.stroke();

        const radius = spark.size * 2.4;
        ctx.globalAlpha = alpha;
        ctx.drawImage(spark.sprite, spark.x - radius, spark.y - radius, radius * 2, radius * 2);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  private clear(): void {
    if (!this.ctx || this.width === 0 || this.height === 0) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}

function streak8(streak: number): number {
  return Math.max(1, Math.min(8, streak));
}

function buildSprite(rgb: Rgb): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const [r, g, b] = rgb;
  const center = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.16, `rgba(${r}, ${g}, ${b}, 0.95)`);
  gradient.addColorStop(0.42, `rgba(${r}, ${g}, ${b}, 0.32)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}
