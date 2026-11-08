import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyTuningToContent,
  emptyTuning,
  normalizeTuning,
  tunedUnitCount,
  type TuningState,
} from '../shared/tuning';

const here = dirname(fileURLToPath(import.meta.url));
const defaultFile = resolve(here, '../../data/tuning.json');

function tuningFile(): string {
  return process.env.TUNING_FILE ? resolve(process.env.TUNING_FILE) : defaultFile;
}

let active: TuningState = emptyTuning();
let loadedFromDisk = false;

function writeState(state: TuningState): { persisted: boolean; file: string; error?: string } {
  const file = tuningFile();
  try {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    renameSync(tmp, file);
    return { persisted: true, file };
  } catch (error) {
    return { persisted: false, file, error: error instanceof Error ? error.message : String(error) };
  }
}

export function initTuningStore(): { loaded: boolean; units: number; file: string } {
  loadedFromDisk = false;
  const file = tuningFile();
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
      active = normalizeTuning(parsed);
      loadedFromDisk = true;
    } else {
      active = emptyTuning();
    }
  } catch (error) {
    console.warn(`[tuning] Не удалось прочитать ${file}:`, error);
    active = emptyTuning();
  }
  applyTuningToContent(active);
  return { loaded: loadedFromDisk, units: tunedUnitCount(active), file };
}

export function getActiveTuning(): TuningState {
  return active;
}

export function publishTuning(
  raw: unknown,
): { tuning: TuningState; persisted: boolean; file: string; error?: string } {
  active = normalizeTuning(raw);
  active.savedAt = new Date().toISOString();
  applyTuningToContent(active);
  const result = writeState(active);
  return { tuning: active, ...result };
}

export function resetTuning(): { tuning: TuningState; persisted: boolean; file: string; error?: string } {
  active = emptyTuning();
  applyTuningToContent(active);
  const file = tuningFile();
  try {
    if (existsSync(file)) unlinkSync(file);
    return { tuning: active, persisted: true, file };
  } catch (error) {
    return { tuning: active, persisted: false, file, error: error instanceof Error ? error.message : String(error) };
  }
}

export function tuningStoreInfo(): { loaded: boolean; units: number; file: string } {
  return { loaded: loadedFromDisk, units: tunedUnitCount(active), file: tuningFile() };
}
