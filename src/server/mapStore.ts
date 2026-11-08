import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeMapList, type MapDoc } from '../shared/maps';

const here = dirname(fileURLToPath(import.meta.url));
const defaultFile = resolve(here, '../../data/maps.json');

function mapsFile(): string {
  return process.env.MAPS_FILE ? resolve(process.env.MAPS_FILE) : defaultFile;
}

let active: MapDoc[] = [];
let loadedFromDisk = false;

function writeMaps(maps: MapDoc[]): { persisted: boolean; file: string; error?: string } {
  const file = mapsFile();
  try {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), maps }, null, 2), 'utf8');
    renameSync(tmp, file);
    return { persisted: true, file };
  } catch (error) {
    return { persisted: false, file, error: error instanceof Error ? error.message : String(error) };
  }
}

export function initMapStore(): { loaded: boolean; maps: number; file: string } {
  loadedFromDisk = false;
  const file = mapsFile();
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
      const source = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as {
        maps?: unknown;
      };
      active = normalizeMapList(Array.isArray(parsed) ? parsed : source.maps);
      loadedFromDisk = true;
    } else {
      active = [];
    }
  } catch (error) {
    console.warn(`[maps] Не удалось прочитать ${file}:`, error);
    active = [];
  }
  return { loaded: loadedFromDisk, maps: active.length, file };
}

export function getActiveMaps(): MapDoc[] {
  return active;
}

export function getActiveMap(id: string): MapDoc | null {
  return active.find((doc) => doc.id === id) ?? null;
}

export function publishMaps(raw: unknown): {
  maps: MapDoc[];
  persisted: boolean;
  file: string;
  error?: string;
} {
  const source = (raw && typeof raw === 'object' ? raw : {}) as { maps?: unknown };
  const list = Array.isArray(raw) ? raw : source.maps;
  active = normalizeMapList(list).map((doc) => ({ ...doc, updatedAt: new Date().toISOString() }));
  const result = writeMaps(active);
  return { maps: active, ...result };
}

export function deleteMap(id: string): { maps: MapDoc[]; persisted: boolean; file: string; error?: string } {
  active = active.filter((doc) => doc.id !== id);
  const result = writeMaps(active);
  return { maps: active, ...result };
}

export function mapStoreInfo(): { loaded: boolean; maps: number; file: string } {
  return { loaded: loadedFromDisk, maps: active.length, file: mapsFile() };
}
