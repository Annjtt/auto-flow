import {
  normalizeMapList,
  type MapDoc,
} from '../../../src/shared/maps';

export const MAP_LAB_VERSION = 1 as const;
export const MAP_LAB_STORAGE_KEY = 'autoflow.map-lab.v1';

export interface MapLabState {
  version: typeof MAP_LAB_VERSION;
  savedAt: string;
  maps: MapDoc[];
  selectedId: string | null;
}

export function createDefaultState(): MapLabState {
  return {
    version: MAP_LAB_VERSION,
    savedAt: new Date().toISOString(),
    maps: [],
    selectedId: null,
  };
}

export function normalizeImportedState(raw: unknown): MapLabState {
  const source = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const envelope = Array.isArray(raw)
    ? raw
    : (source.maps ??
      source.documents ??
      source.mapLab ??
      (Array.isArray(source.map) ? source.map : source.objects ? [source] : source.map));
  const maps = normalizeMapList(envelope);
  const selectedId =
    typeof source.selectedId === 'string' && maps.some((doc) => doc.id === source.selectedId)
      ? source.selectedId
      : (maps[0]?.id ?? null);
  return {
    version: MAP_LAB_VERSION,
    savedAt: typeof source.savedAt === 'string' ? source.savedAt : new Date().toISOString(),
    maps,
    selectedId,
  };
}

export function loadSavedState(): MapLabState {
  try {
    const raw = localStorage.getItem(MAP_LAB_STORAGE_KEY);
    if (!raw) return createDefaultState();
    return normalizeImportedState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: MapLabState): void {
  try {
    state.savedAt = new Date().toISOString();
    localStorage.setItem(MAP_LAB_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode: the editor keeps working in memory.
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function round(value: number, digits = 3): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function formatNumber(value: number, digits = 2): string {
  return round(value, digits).toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

export function cloneDoc<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
