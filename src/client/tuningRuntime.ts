import {
  applyTuningToContent,
  emptyTuning,
  getTuningAnimation,
  getTuningModel,
  normalizeTuning,
  type TuningAnimation,
  type TuningModel,
  type TuningState,
} from '../shared/tuning';
import type { CreateUnitModelOptions } from './unitModels';

let activeTuning: TuningState = emptyTuning();

/** Applies a server/lab tuning payload to the client's shared content copy. */
export function applyClientTuning(raw: unknown): TuningState {
  activeTuning = raw ? normalizeTuning(raw) : emptyTuning();
  applyTuningToContent(activeTuning);
  return activeTuning;
}

export function getActiveClientTuning(): TuningState {
  return activeTuning;
}

export function getTunedModel(defId: string): TuningModel {
  return getTuningModel(activeTuning, defId);
}

export function getTunedModelOptions(defId: string): CreateUnitModelOptions {
  const model = getTunedModel(defId);
  return {
    palette: model.palette,
    scale: model.scale,
    hover: model.hover,
    parts: model.parts,
  };
}

export function getTunedModelYaw(defId: string): number {
  return (getTunedModel(defId).yaw * Math.PI) / 180;
}

export function getTunedAnimation(defId: string): TuningAnimation {
  return getTuningAnimation(activeTuning, defId);
}

export async function loadTuningFromServer(): Promise<TuningState | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch('/api/tuning', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { tuning?: TuningState } | TuningState;
    const tuning = 'tuning' in payload && payload.tuning ? payload.tuning : payload;
    return applyClientTuning(tuning);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
