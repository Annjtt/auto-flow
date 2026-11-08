import { normalizeMapList, type MapDoc } from '../shared/maps';

let customMaps: MapDoc[] = [];

export function getCustomMaps(): MapDoc[] {
  return customMaps;
}

export function getCustomMap(id: string): MapDoc | null {
  return customMaps.find((doc) => doc.id === id) ?? null;
}

/** Replaces the runtime custom map registry (used by tests and by the boot fetch). */
export function setCustomMaps(raw: unknown): MapDoc[] {
  customMaps = normalizeMapList(raw);
  return customMaps;
}

export async function loadMapsFromServer(): Promise<MapDoc[]> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch('/api/maps', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return customMaps;
    const payload = (await response.json()) as { maps?: unknown };
    return setCustomMaps(payload.maps);
  } catch {
    return customMaps;
  } finally {
    window.clearTimeout(timeout);
  }
}
