import {
  cloneMapObject,
  normalizeMapList,
  normalizeMapObject,
  type MapDoc,
  type MapObject,
} from '../../../src/shared/maps';

export const MAP_LAB_VERSION = 1 as const;
export const MAP_LAB_STORAGE_KEY = 'autoflow.map-lab.v1';

/** A reusable snippet (single object or an assembled group) for quick pasting. */
export interface MapPreset {
  id: string;
  name: string;
  createdAt: string;
  objects: MapObject[];
}

export interface MapLabState {
  version: typeof MAP_LAB_VERSION;
  savedAt: string;
  maps: MapDoc[];
  presets: MapPreset[];
  selectedId: string | null;
}

export function createDefaultState(): MapLabState {
  return {
    version: MAP_LAB_VERSION,
    savedAt: new Date().toISOString(),
    maps: [],
    presets: [],
    selectedId: null,
  };
}

export function createPresetId(): string {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizePresetList(raw: unknown): MapPreset[] {
  const list = Array.isArray(raw) ? raw : [];
  const used = new Set<string>();
  const presets: MapPreset[] = [];
  for (const [index, entry] of list.slice(0, 240).entries()) {
    const source = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const objectsSource = Array.isArray(source.objects) ? source.objects : [];
    const objects = objectsSource.slice(0, 400).map((object, objectIndex) => normalizeMapObject(object, objectIndex));
    if (objects.length === 0) continue;
    let id =
      typeof source.id === 'string' && source.id.length > 0 ? source.id.slice(0, 64) : `preset-${index + 1}`;
    if (used.has(id)) id = createPresetId();
    used.add(id);
    presets.push({
      id,
      name:
        typeof source.name === 'string' && source.name.trim().length > 0
          ? source.name.trim().slice(0, 48)
          : `Пресет ${index + 1}`,
      createdAt: typeof source.createdAt === 'string' ? source.createdAt : new Date().toISOString(),
      objects,
    });
  }
  return presets;
}

export function clonePresetObjects(objects: MapObject[]): MapObject[] {
  return objects.map(cloneMapObject);
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
  const presets = normalizePresetList(source.presets);
  const selectedId =
    typeof source.selectedId === 'string' && maps.some((doc) => doc.id === source.selectedId)
      ? source.selectedId
      : (maps[0]?.id ?? null);
  return {
    version: MAP_LAB_VERSION,
    savedAt: typeof source.savedAt === 'string' ? source.savedAt : new Date().toISOString(),
    maps,
    presets,
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
