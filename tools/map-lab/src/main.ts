import {
  BUILTIN_MAP_META,
  BUILTIN_MAP_THEMES,
  MAP_ANIMATION_LIMITS,
  MAP_ANIM_PROPERTIES,
  MAP_ANIM_WAVES,
  MAP_BASE_OPTIONS,
  MAP_SHAPES,
  baseSubtitle,
  baseTheme,
  cloneMapObject,
  createAnimationTrack,
  createEmptyMapDoc,
  createMapEnvSurface,
  createMapObject,
  createMapObjectGroup,
  createObjectAnimation,
  duplicateMapDoc,
  emptyMapEnv,
  groupOfObject,
  isBuiltinMapId,
  mapMeta,
  normalizeMapDoc,
  normalizeMapList,
  slugifyMapId,
  themeForDoc,
  type BuiltinMapId,
  type MapAnimProperty,
  type MapAnimationTrack,
  type MapBase,
  type MapDoc,
  type MapObject,
  type MapObjectAnimation,
  type MapObjectGroup,
  type MapShape,
  type MapTheme,
  type Vec3,
} from '../../../src/shared/maps';
import {
  createPresetId,
  escapeHtml,
  formatNumber,
  loadSavedState,
  normalizeImportedState,
  round,
  saveState,
  type MapLabState,
  type MapPreset,
} from './mapLabData';
import { MapPreview, type GizmoMode } from './mapPreview';

const MAP_SHAPE_LABELS = Object.fromEntries(MAP_SHAPES.map((entry) => [entry.value, entry.label])) as Record<MapShape, string>;
const MAP_SHAPE_GLYPHS = Object.fromEntries(MAP_SHAPES.map((entry) => [entry.value, entry.glyph])) as Record<MapShape, string>;

const MAT_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Камень и арена', keys: ['warStone', 'warStoneDark', 'warBasalt', 'warIron'] },
  { title: 'Остров и земля', keys: ['islandGround', 'islandCourt', 'islandRock', 'islandRockDark', 'islandMoss', 'shoreSand'] },
  { title: 'Руины и металл', keys: ['ruinBone', 'ruinRust', 'warMetal', 'boardRivet'] },
  { title: 'Акценты и огонь', keys: ['warBrass', 'warRust', 'warEmber', 'brazierFlame', 'moteEmber', 'moteAsh'] },
  { title: 'Море и небо', keys: ['seaWater', 'shoreFoam', 'moonHalo', 'starMat', 'bloodMoon'] },
];

const MAT_LABELS: Record<string, string> = {
  warStone: 'Камень арены',
  warStoneDark: 'Тёмный камень',
  warBasalt: 'Базальт',
  warIron: 'Железо',
  warRust: 'Ржавчина',
  warBrass: 'Латунь',
  warEmber: 'Магический акцент',
  boardRivet: 'Заклёпки доски',
  islandGround: 'Земля острова',
  islandCourt: 'Двор',
  islandRock: 'Скалы',
  islandRockDark: 'Тёмные скалы',
  islandMoss: 'Мох',
  shoreSand: 'Берег',
  ruinBone: 'Кость руин',
  ruinRust: 'Ржавые руины',
  warMetal: 'Металл',
  brazierFlame: 'Пламя чаши',
  starMat: 'Звёзды',
  bloodMoon: 'Луна',
  seaWater: 'Море',
  moonHalo: 'Ореол луны',
  moteEmber: 'Искры',
  moteAsh: 'Пепел',
  shoreFoam: 'Пена',
};

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function shapeLabel(shape: MapShape): string {
  return MAP_SHAPE_LABELS[shape] ?? shape;
}

function shapeGlyph(shape: MapShape): string {
  return MAP_SHAPE_GLYPHS[shape] ?? '▣';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cloneTheme(theme: MapTheme): MapTheme {
  return JSON.parse(JSON.stringify(theme)) as MapTheme;
}

let state: MapLabState = loadSavedState();
let selectedMapId: string | null = state.selectedId;
let selectedObjectId: string | null = null;
let selectedIds: string[] = [];
let selectedGroupId: string | null = null;
let tab: 'map' | 'object' = 'map';
let gizmoMode: GizmoMode = 'move';
let placementShape: MapShape | null = null;
let snapEnabled = true;
let snapStep = 0.25;
let searchQuery = '';
let objectSearchQuery = '';
let builtinPreview: MapDoc | null = null;
let saveTimer: number | null = null;
let toastTimer: number | null = null;
let pendingSnapshot: string | null = null;
const undoStack: string[] = [];
const redoStack: string[] = [];
const expandedGroups = new Set<string>();
const presetInsertCount = new Map<string, number>();

const canvas = byId<HTMLCanvasElement>('mapCanvas');
const customMapList = byId('customMapList');
const builtinMapList = byId('builtinMapList');
const mapCount = byId('mapCount');
const objectList = byId('objectList');
const objectEmpty = byId('objectEmpty');
const objectCount = byId('objectCount');
const objectSearch = byId<HTMLInputElement>('objectSearch');
const presetList = byId('presetList');
const presetEmpty = byId('presetEmpty');
const presetCount = byId('presetCount');
const mapSearch = byId<HTMLInputElement>('mapSearch');
const inspectorBody = byId('inspectorBody');
const saveStateLabel = byId('saveStateLabel');
const modifiedCount = byId('modifiedCount');
const toast = byId('toast');
const importFile = byId<HTMLInputElement>('importFile');
const stageTitle = byId('stageTitle');
const stageSub = byId('stageSub');
const stageEyebrow = byId('stageEyebrow');
const hudName = byId('hudName');
const hudMeta = byId('hudMeta');
const hudBadge = byId('hudBadge');
const selectionHud = byId('selectionHud');
const metricStrip = byId('metricStrip');
const stageHint = byId('stageHint');
const placementHint = byId('placementHint');
const shapePalette = byId('shapePalette');
const snapToggle = byId<HTMLInputElement>('snapToggle');
const snapStepSelect = byId<HTMLSelectElement>('snapStep');
const undoBtn = byId<HTMLButtonElement>('undoBtn');
const redoBtn = byId<HTMLButtonElement>('redoBtn');
const focusObjectBtn = byId<HTMLButtonElement>('focusObjectBtn');
const deleteObjectBtn = byId<HTMLButtonElement>('deleteObjectBtn');
const groupSelectionBtn = byId<HTMLButtonElement>('groupSelectionBtn');

let preview: MapPreview | null = null;
try {
  preview = new MapPreview(canvas, {
    onSelect: (id, additive) => selectObject(id, additive),
    onTransform: (id, transform) => {
      const object = activeDoc()?.objects.find((entry) => entry.id === id);
      if (!object) return;
      object.position = transform.position;
      object.rotation = transform.rotation;
      object.scale = transform.scale;
      scheduleSave();
      updateTransformInputs();
      renderSelectionHud();
    },
    onGroupTransform: (ids, delta) => {
      const doc = activeDoc();
      if (!doc) return;
      let changed = false;
      for (const id of ids) {
        const object = doc.objects.find((entry) => entry.id === id);
        if (!object) continue;
        object.position = [
          round(object.position[0] + delta[0], 3),
          round(object.position[1] + delta[1], 3),
          round(object.position[2] + delta[2], 3),
        ];
        changed = true;
      }
      if (!changed) return;
      scheduleSave();
      updateTransformInputs();
      renderSelectionHud();
    },
    onPlace: (position) => {
      if (!placementShape) return;
      addObject(placementShape, position);
    },
  });
} catch (error) {
  const wrap = canvas.parentElement;
  if (wrap) {
    wrap.innerHTML = `<div class="preview-error"><b>WebGL недоступен</b><span>${escapeHtml(
      error instanceof Error ? error.message : 'Не удалось запустить 3D-превью.',
    )}</span></div>`;
  }
}

// Debug handle that makes the Babylon scene inspectable from devtools.
(window as unknown as { __mapLabPreview?: MapPreview | null }).__mapLabPreview = preview;

function showToast(message: string, kind: 'ok' | 'warn' | 'error' = 'ok'): void {
  toast.textContent = message;
  toast.className = `toast show ${kind}`;
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.className = 'toast';
  }, 2600);
}

function markSaved(): void {
  state.selectedId = selectedMapId && state.maps.some((doc) => doc.id === selectedMapId) ? selectedMapId : null;
  saveState(state);
  const time = new Date(state.savedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  saveStateLabel.textContent = `Автосохранение · ${time}`;
  saveStateLabel.dataset.state = 'saved';
}

function scheduleSave(): void {
  saveStateLabel.textContent = 'Есть несохранённые изменения…';
  saveStateLabel.dataset.state = 'dirty';
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    markSaved();
  }, 400);
}

function flushSave(): void {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  markSaved();
}

function activeDoc(): MapDoc | null {
  if (!selectedMapId) return null;
  const custom = state.maps.find((doc) => doc.id === selectedMapId);
  if (custom) return custom;
  if (isBuiltinMapId(selectedMapId)) {
    if (!builtinPreview || builtinPreview.id !== selectedMapId) {
      const meta = mapMeta(selectedMapId);
      builtinPreview = {
        id: selectedMapId,
        name: meta.name,
        subtitle: meta.subtitle,
        base: selectedMapId,
        theme: { ...cloneTheme(BUILTIN_MAP_THEMES[selectedMapId]), label: meta.name },
        env: emptyMapEnv(),
        objects: [],
        groups: [],
      };
    }
    return builtinPreview;
  }
  return null;
}

function isReadOnly(doc: MapDoc | null = activeDoc()): boolean {
  return Boolean(doc && !state.maps.some((entry) => entry.id === doc.id));
}

function selectedObject(): MapObject | null {
  const doc = activeDoc();
  return doc?.objects.find((object) => object.id === selectedObjectId) ?? null;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

function activeSnapshot(): string {
  const doc = activeDoc();
  return doc ? JSON.stringify(doc) : '';
}

function addUndo(snapshot: string): void {
  if (!snapshot) return;
  undoStack.push(snapshot);
  if (undoStack.length > 70) undoStack.shift();
  redoStack.length = 0;
  updateHistoryButtons();
}

function recordUndo(): void {
  if (isReadOnly()) return;
  addUndo(activeSnapshot());
}

function beginEdit(): void {
  if (isReadOnly()) return;
  if (pendingSnapshot === null) pendingSnapshot = activeSnapshot();
}

function endEdit(): void {
  if (pendingSnapshot === null) return;
  if (pendingSnapshot !== activeSnapshot()) addUndo(pendingSnapshot);
  pendingSnapshot = null;
}

function updateHistoryButtons(): void {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

function restoreSnapshot(snapshot: string): void {
  const doc = activeDoc();
  if (!doc || isReadOnly()) return;
  const restored = normalizeMapDoc(JSON.parse(snapshot));
  doc.name = restored.name;
  doc.subtitle = restored.subtitle;
  doc.base = restored.base;
  doc.theme = restored.theme;
  doc.env = restored.env;
  doc.objects = restored.objects;
  doc.groups = restored.groups;
  doc.theme.label = doc.name;
  selectedIds = selectedIds.filter((id) => doc.objects.some((object) => object.id === id));
  if (selectedGroupId && !doc.groups.some((group) => group.id === selectedGroupId)) selectedGroupId = null;
  if (selectedObjectId && !doc.objects.some((object) => object.id === selectedObjectId)) {
    selectedObjectId = selectedIds[selectedIds.length - 1] ?? null;
  }
  afterChange({ inspector: true });
}

function undo(): void {
  if (undoStack.length === 0) return;
  const doc = activeDoc();
  if (!doc || isReadOnly()) return;
  const target = undoStack.pop();
  if (!target) return;
  redoStack.push(JSON.stringify(doc));
  restoreSnapshot(target);
  updateHistoryButtons();
}

function redo(): void {
  if (redoStack.length === 0) return;
  const doc = activeDoc();
  if (!doc || isReadOnly()) return;
  const target = redoStack.pop();
  if (!target) return;
  undoStack.push(JSON.stringify(doc));
  restoreSnapshot(target);
  updateHistoryButtons();
}

function resetHistory(): void {
  undoStack.length = 0;
  redoStack.length = 0;
  pendingSnapshot = null;
  updateHistoryButtons();
}

// ---------------------------------------------------------------------------
// Selection and editing
// ---------------------------------------------------------------------------

function resetObjectSearch(): void {
  objectSearchQuery = '';
  if (objectSearch.value) objectSearch.value = '';
}

function selectMap(id: string): void {
  if (id === selectedMapId) return;
  selectedMapId = id;
  selectedObjectId = null;
  selectedIds = [];
  selectedGroupId = null;
  placementShape = null;
  tab = 'map';
  resetObjectSearch();
  resetHistory();
  preview?.setPlacement(null);
  refreshPreview();
  renderAll();
  flushSave();
}

function selectedObjects(): MapObject[] {
  const doc = activeDoc();
  if (!doc || selectedIds.length === 0) return [];
  return doc.objects.filter((object) => selectedIds.includes(object.id));
}

/** Pushes the current selection into the 3D preview (single or group gizmo). */
function emitSelection(): void {
  preview?.setSelectionIds(selectedIds);
}

function applySelection(ids: string[], primary: string | null = null, groupId: string | null = null): void {
  const doc = activeDoc();
  const known = new Set(doc?.objects.map((object) => object.id) ?? []);
  const unique = [...new Set(ids)].filter((id) => known.has(id));
  selectedIds = unique;
  selectedObjectId = primary && unique.includes(primary) ? primary : (unique[unique.length - 1] ?? null);
  selectedGroupId = groupId && doc?.groups.some((group) => group.id === groupId) ? groupId : null;
  if (unique.length > 0) tab = 'object';
  renderObjects();
  renderInspector();
  renderStage();
  renderTabs();
  renderMetrics();
  emitSelection();
}

/** Selects exactly one object without expanding its group (used by the list). */
function selectObjectOnly(id: string | null, additive = false): void {
  const doc = activeDoc();
  if (!doc) return;
  if (!id) {
    applySelection([]);
    return;
  }
  const object = doc.objects.find((entry) => entry.id === id);
  if (!object) {
    applySelection([]);
    return;
  }
  if (additive) {
    const next = selectedIds.includes(id) ? selectedIds.filter((entry) => entry !== id) : [...selectedIds, id];
    applySelection(next, id);
    return;
  }
  if (selectedIds.length === 1 && selectedObjectId === id) return;
  applySelection([id], id);
}

function selectObject(id: string | null, additive = false): void {
  const doc = activeDoc();
  if (!doc) return;
  if (!id) {
    applySelection([]);
    return;
  }
  const object = doc.objects.find((entry) => entry.id === id);
  if (!object) {
    applySelection([]);
    return;
  }
  if (additive) {
    const next = selectedIds.includes(id) ? selectedIds.filter((entry) => entry !== id) : [...selectedIds, id];
    applySelection(next, id);
    return;
  }
  const group = groupOfObject(doc, id);
  if (group) {
    if (!expandedGroups.has(group.id)) expandedGroups.add(group.id);
    applySelection(group.objectIds, id, group.id);
    return;
  }
  if (selectedIds.length === 1 && selectedObjectId === id) return;
  applySelection([id], id);
}

function selectGroup(groupId: string): void {
  const doc = activeDoc();
  const group = doc?.groups.find((entry) => entry.id === groupId);
  if (!group) return;
  if (!expandedGroups.has(group.id)) expandedGroups.add(group.id);
  applySelection(group.objectIds, group.objectIds[0] ?? null, group.id);
}

function setTab(next: 'map' | 'object'): void {
  tab = next;
  renderInspector();
  renderTabs();
}

function setGizmoMode(mode: GizmoMode): void {
  gizmoMode = mode;
  preview?.setGizmoMode(mode);
  renderTabs();
  renderStageHint();
}

function togglePlacement(shape: MapShape | null): void {
  const doc = activeDoc();
  if (!doc) {
    showToast('Сначала создайте или выберите карту.', 'warn');
    return;
  }
  if (isReadOnly(doc)) {
    showToast('Это встроенный шаблон. Создайте на его основе свою карту.', 'warn');
    return;
  }
  placementShape = placementShape === shape ? null : shape;
  preview?.setPlacement(placementShape);
  placementHint.hidden = !placementShape;
  if (placementShape) {
    placementHint.textContent = `${shapeLabel(placementShape)}: кликните по доске · Esc — отмена`;
  }
  renderTabs();
  renderStageHint();
}

function addObject(shape: MapShape, position: Vec3): void {
  const doc = activeDoc();
  if (!doc) return;
  if (isReadOnly(doc)) {
    showToast('Встроенный шаблон нельзя редактировать. Создайте копию.', 'warn');
    return;
  }
  recordUndo();
  // The preview sends the object's center already resting on the picked
  // surface (board tile top or island ground).
  const object = createMapObject(shape, position);
  object.name = `${shapeLabel(shape)} ${doc.objects.filter((entry) => entry.shape === shape).length + 1}`;
  doc.objects.push(object);
  selectedObjectId = object.id;
  selectedIds = [object.id];
  selectedGroupId = null;
  tab = 'object';
  afterChange({ inspector: true });
  emitSelection();
  showToast(`Добавлен объект «${object.name}».`);
}

function syncGroups(doc: MapDoc): void {
  if (!Array.isArray(doc.groups)) doc.groups = [];
  const known = new Set(doc.objects.map((object) => object.id));
  const claimed = new Set<string>();
  for (const group of doc.groups) {
    group.objectIds = group.objectIds.filter((id) => known.has(id) && !claimed.has(id));
    for (const id of group.objectIds) claimed.add(id);
  }
  doc.groups = doc.groups.filter((group) => group.objectIds.length > 0);
}

function deleteObjects(ids: string[]): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return;
  const targets = [...new Set(ids)].filter((id) => doc.objects.some((object) => object.id === id));
  if (targets.length === 0) return;
  recordUndo();
  const removed = new Set(targets);
  doc.objects = doc.objects.filter((object) => !removed.has(object.id));
  syncGroups(doc);
  applySelection([]);
  afterChange({ inspector: true });
  showToast(targets.length === 1 ? 'Объект удалён.' : `Удалено объектов: ${targets.length}.`);
}

function deleteObject(id: string | null = selectedObjectId): void {
  if (!id) return;
  deleteObjects([id]);
}

function deleteSelectedObjects(): void {
  deleteObjects(selectedIds.length > 0 ? selectedIds : selectedObjectId ? [selectedObjectId] : []);
}

function cloneObjectWithOffset(source: MapObject, offset: Vec3): MapObject {
  return {
    ...cloneMapObject(source),
    id: `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    position: [
      round(source.position[0] + offset[0], 3),
      round(source.position[1] + offset[1], 3),
      round(source.position[2] + offset[2], 3),
    ],
  };
}

function duplicateObject(id: string | null = selectedObjectId): void {
  const doc = activeDoc();
  if (!doc || !id || isReadOnly(doc)) return;
  const source = doc.objects.find((entry) => entry.id === id);
  if (!source) return;
  recordUndo();
  const object = cloneObjectWithOffset(source, [1, 0, 0]);
  object.name = `${source.name} (копия)`;
  doc.objects.push(object);
  const group = groupOfObject(doc, source.id);
  if (group) group.objectIds.push(object.id);
  selectedIds = [object.id];
  selectedObjectId = object.id;
  selectedGroupId = null;
  tab = 'object';
  afterChange({ inspector: true });
  emitSelection();
  showToast('Объект продублирован.');
}

function duplicateSelectedObjects(): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return;
  const sources = selectedObjects().filter((object) => !object.locked);
  if (sources.length === 0) {
    showToast('Нет объектов для копирования.', 'warn');
    return;
  }
  recordUndo();
  const copies = sources.map((source) => {
    const copy = cloneObjectWithOffset(source, [1, 0, 1]);
    copy.name = `${source.name} (копия)`;
    return copy;
  });
  doc.objects.push(...copies);
  const group = selectedGroupId ? doc.groups.find((entry) => entry.id === selectedGroupId) : null;
  let nextGroup: MapObjectGroup | null = null;
  if (group && copies.length > 1) {
    nextGroup = {
      ...createMapObjectGroup(`${group.name} (копия)`, group.color),
      objectIds: copies.map((copy) => copy.id),
    };
    doc.groups.push(nextGroup);
  }
  selectedIds = copies.map((copy) => copy.id);
  selectedObjectId = copies[0].id;
  selectedGroupId = nextGroup?.id ?? null;
  afterChange({ inspector: true });
  emitSelection();
  showToast(copies.length === 1 ? 'Объект продублирован.' : `Скопировано объектов: ${copies.length}.`);
}

function toggleObjectFlag(id: string, flag: 'visible' | 'locked'): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return;
  const object = doc.objects.find((entry) => entry.id === id);
  if (!object) return;
  recordUndo();
  object[flag] = !object[flag];
  afterChange({ inspector: true });
}

function toggleManyObjectsFlag(ids: string[], flag: 'visible' | 'locked'): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc) || ids.length === 0) return;
  recordUndo();
  const targets = doc.objects.filter((object) => ids.includes(object.id));
  const next = !targets.every((object) => object[flag]);
  for (const object of targets) object[flag] = next;
  afterChange({ inspector: true });
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

function createGroupFromSelection(): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return;
  const ids = selectedObjects()
    .filter((object) => !object.locked)
    .map((object) => object.id);
  if (ids.length < 2) {
    showToast('Выберите минимум два объекта (Ctrl+клик), чтобы создать группу.', 'warn');
    return;
  }
  recordUndo();
  const picked = new Set(ids);
  for (const group of doc.groups) group.objectIds = group.objectIds.filter((id) => !picked.has(id));
  doc.groups = doc.groups.filter((group) => group.objectIds.length > 0);
  const group = createMapObjectGroup(`Группа ${doc.groups.length + 1}`, doc.theme.accent);
  group.objectIds = ids;
  doc.groups.push(group);
  expandedGroups.add(group.id);
  applySelection(ids, ids[0], group.id);
  afterChange({ inspector: true });
  showToast(`Создана группа «${group.name}» (${ids.length} объектов).`);
}

function selectWholeGroup(groupId: string): void {
  selectGroup(groupId);
  preview?.focusObjects(selectedIds);
}

function duplicateGroup(groupId: string): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return;
  const group = doc.groups.find((entry) => entry.id === groupId);
  if (!group) return;
  const sources = group.objectIds
    .map((id) => doc.objects.find((object) => object.id === id))
    .filter((object): object is MapObject => Boolean(object));
  if (sources.length === 0) return;
  recordUndo();
  const copies = sources.map((source) => {
    const copy = cloneObjectWithOffset(source, [1, 0, 1]);
    copy.name = `${source.name} (копия)`;
    return copy;
  });
  doc.objects.push(...copies);
  const copyGroup = {
    ...createMapObjectGroup(`${group.name} (копия)`, group.color),
    objectIds: copies.map((copy) => copy.id),
  };
  doc.groups.push(copyGroup);
  expandedGroups.add(copyGroup.id);
  applySelection(copyGroup.objectIds, copyGroup.objectIds[0] ?? null, copyGroup.id);
  afterChange({ inspector: true });
  showToast(`Группа «${group.name}» скопирована.`);
}

function dissolveGroup(groupId: string): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return;
  const group = doc.groups.find((entry) => entry.id === groupId);
  if (!group) return;
  recordUndo();
  doc.groups = doc.groups.filter((entry) => entry.id !== groupId);
  expandedGroups.delete(groupId);
  selectedGroupId = null;
  afterChange({ inspector: true });
  showToast('Группа расформирована, объекты остались на карте.');
}

function deleteGroupWithObjects(groupId: string): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return;
  const group = doc.groups.find((entry) => entry.id === groupId);
  if (!group) return;
  if (!window.confirm(`Удалить группу «${group.name}» вместе с ${group.objectIds.length} объектами?`)) return;
  deleteObjects(group.objectIds);
}

function nudgeObjects(ids: string[], delta: Vec3): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return;
  const targets = doc.objects.filter((object) => ids.includes(object.id) && !object.locked);
  if (targets.length === 0) return;
  recordUndo();
  for (const object of targets) {
    object.position = [
      round(object.position[0] + delta[0], 3),
      round(object.position[1] + delta[1], 3),
      round(object.position[2] + delta[2], 3),
    ];
  }
  afterChange({ inspector: true });
}

/** Rotates a group around its centroid; object rotations follow the same angle. */
function rotateGroup(groupId: string, angleDeg: number): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return;
  const group = doc.groups.find((entry) => entry.id === groupId);
  if (!group) return;
  const targets = group.objectIds
    .map((id) => doc.objects.find((object) => object.id === id))
    .filter((object): object is MapObject => object !== undefined && !object.locked);
  if (targets.length === 0) return;
  const centerX = targets.reduce((sum, object) => sum + object.position[0], 0) / targets.length;
  const centerZ = targets.reduce((sum, object) => sum + object.position[2], 0) / targets.length;
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  recordUndo();
  for (const object of targets) {
    const dx = object.position[0] - centerX;
    const dz = object.position[2] - centerZ;
    object.position = [
      round(centerX + dx * cos - dz * sin, 3),
      object.position[1],
      round(centerZ + dx * sin + dz * cos, 3),
    ];
    object.rotation = [object.rotation[0], round(object.rotation[1] + angleDeg, 2), object.rotation[2]];
  }
  afterChange({ inspector: true });
}

function snapSelectedToGrid(): void {
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return;
  const targets = selectedObjects().filter((object) => !object.locked);
  if (targets.length === 0) return;
  const step = snapStep > 0 ? snapStep : 0.25;
  recordUndo();
  for (const object of targets) {
    object.position = [
      round(Math.round(object.position[0] / step) * step, 3),
      object.position[1],
      round(Math.round(object.position[2] / step) * step, 3),
    ];
  }
  afterChange({ inspector: true });
}

function alignSelected(axis: 'x' | 'z' | 'y'): void {
  const targets = selectedObjects().filter((object) => !object.locked);
  if (targets.length < 2) return;
  recordUndo();
  if (axis === 'y') {
    for (const object of targets) object.position[1] = targets[0].position[1];
  } else {
    const values = targets.map((object) => (axis === 'x' ? object.position[0] : object.position[2]));
    const center = values.reduce((sum, value) => sum + value, 0) / values.length;
    for (const object of targets) {
      object.position[axis === 'x' ? 0 : 2] = round(center, 3);
    }
  }
  afterChange({ inspector: true });
}

function createMap(base: MapBase = 'none'): void {
  const doc = createEmptyMapDoc(base);
  const index = state.maps.length + 1;
  doc.name = index > 1 ? `Новая карта ${index}` : 'Новая карта';
  doc.subtitle = baseSubtitle(base);
  state.maps.push(doc);
  selectedMapId = doc.id;
  selectedObjectId = null;
  selectedIds = [];
  selectedGroupId = null;
  resetObjectSearch();
  resetHistory();
  refreshPreview();
  renderAll();
  flushSave();
  showToast(`Создана карта «${doc.name}».`);
}

function copyBuiltinMap(id: BuiltinMapId): void {
  const doc = createEmptyMapDoc(id);
  doc.name = `${mapMeta(id).name} — моя`;
  doc.subtitle = `Копия шаблона «${mapMeta(id).name}»`;
  state.maps.push(doc);
  selectedMapId = doc.id;
  selectedObjectId = null;
  selectedIds = [];
  selectedGroupId = null;
  resetObjectSearch();
  resetHistory();
  refreshPreview();
  renderAll();
  flushSave();
  showToast('Создана редактируемая копия шаблона.');
}

function duplicateMap(id: string): void {
  const source = state.maps.find((doc) => doc.id === id);
  if (!source) return;
  const doc = duplicateMapDoc(source);
  doc.name = `${source.name} (копия)`.slice(0, 48);
  state.maps.push(doc);
  selectedMapId = doc.id;
  selectedObjectId = null;
  selectedIds = [];
  selectedGroupId = null;
  resetObjectSearch();
  resetHistory();
  refreshPreview();
  renderAll();
  flushSave();
  showToast('Карта продублирована.');
}

function deleteMap(id: string): void {
  const doc = state.maps.find((entry) => entry.id === id);
  if (!doc) return;
  if (!window.confirm(`Удалить карту «${doc.name}»? Действие можно отменить только до перезагрузки страницы.`)) return;
  state.maps = state.maps.filter((entry) => entry.id !== id);
  if (selectedMapId === id) {
    selectedMapId = state.maps[0]?.id ?? 'jaddy';
    selectedObjectId = null;
    selectedIds = [];
    selectedGroupId = null;
    resetObjectSearch();
    resetHistory();
  }
  refreshPreview();
  renderAll();
  flushSave();
  showToast('Карта удалена.');
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

function freshObjectId(): string {
  return `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function presetSelectionName(): string {
  const doc = activeDoc();
  const objects = selectedObjects();
  if (selectedGroupId && doc) {
    const group = doc.groups.find((entry) => entry.id === selectedGroupId);
    if (group) return group.name;
  }
  if (objects.length === 1) return objects[0].name;
  return `Пресет ${state.presets.length + 1}`;
}

function saveObjectsAsPreset(objects: MapObject[], suggested: string): void {
  if (objects.length === 0) {
    showToast('Сначала выделите объекты, которые нужно сохранить в пресет.', 'warn');
    return;
  }
  const answer = window.prompt('Название пресета', suggested);
  if (answer === null) return;
  const name = answer.trim().slice(0, 48) || suggested;
  const preset: MapPreset = {
    id: createPresetId(),
    name,
    createdAt: new Date().toISOString(),
    objects: objects.map(cloneMapObject),
  };
  state.presets.unshift(preset);
  scheduleSave();
  renderPresets();
  showToast(`Пресет «${name}» сохранён (${preset.objects.length} объектов).`);
}

function saveSelectionAsPreset(): void {
  saveObjectsAsPreset(selectedObjects(), presetSelectionName());
}

function insertPreset(presetId: string): void {
  const doc = activeDoc();
  const preset = state.presets.find((entry) => entry.id === presetId);
  if (!doc || !preset) return;
  if (isReadOnly(doc)) {
    showToast('Встроенный шаблон нельзя редактировать. Создайте копию карты.', 'warn');
    return;
  }
  if (preset.objects.length === 0) return;
  recordUndo();
  const index = presetInsertCount.get(preset.id) ?? 0;
  presetInsertCount.set(preset.id, index + 1);
  const shift = index * 0.8;
  const centerX = preset.objects.reduce((sum, object) => sum + object.position[0], 0) / preset.objects.length;
  const centerZ = preset.objects.reduce((sum, object) => sum + object.position[2], 0) / preset.objects.length;
  const dx = shift - centerX;
  const dz = shift - centerZ;
  const copies = preset.objects.map((source) => {
    const copy = cloneMapObject(source);
    copy.id = freshObjectId();
    copy.position = [
      round(source.position[0] + dx, 3),
      source.position[1],
      round(source.position[2] + dz, 3),
    ];
    return copy;
  });
  doc.objects.push(...copies);
  let group: MapObjectGroup | null = null;
  if (copies.length > 1) {
    group = {
      ...createMapObjectGroup(preset.name, preset.objects[0]?.color ?? doc.theme.accent),
      objectIds: copies.map((copy) => copy.id),
    };
    doc.groups.push(group);
    expandedGroups.add(group.id);
  }
  applySelection(
    copies.map((copy) => copy.id),
    copies[0]?.id ?? null,
    group?.id ?? null,
  );
  afterChange({ inspector: true });
  showToast(`Пресет «${preset.name}» вставлен на карту.`);
}

function renamePreset(presetId: string): void {
  const preset = state.presets.find((entry) => entry.id === presetId);
  if (!preset) return;
  const answer = window.prompt('Новое название пресета', preset.name);
  if (answer === null) return;
  const name = answer.trim().slice(0, 48);
  if (!name) return;
  preset.name = name;
  scheduleSave();
  renderPresets();
}

function deletePreset(presetId: string): void {
  const preset = state.presets.find((entry) => entry.id === presetId);
  if (!preset) return;
  if (!window.confirm(`Удалить пресет «${preset.name}»?`)) return;
  state.presets = state.presets.filter((entry) => entry.id !== presetId);
  presetInsertCount.delete(presetId);
  scheduleSave();
  renderPresets();
  showToast('Пресет удалён.');
}

function renderPresets(): void {
  presetCount.textContent = String(state.presets.length);
  presetEmpty.hidden = state.presets.length > 0;
  presetList.hidden = state.presets.length === 0;
  presetList.innerHTML = state.presets
    .map((preset) => {
      const preview = preset.objects[0];
      const color = preview?.emissive && preview.emissive !== '#000000' ? preview.emissive : (preview?.color ?? '#8a8f9c');
      return `
        <div class="preset-row" data-preset-id="${escapeHtml(preset.id)}" role="button" tabindex="0"
          title="Вставить пресет на карту" style="--preset-color:${escapeHtml(color)}">
          <span class="preset-swatch">${preview ? shapeGlyph(preview.shape) : '▣'}</span>
          <span class="preset-copy">
            <b>${escapeHtml(preset.name)}</b>
            <small>${preset.objects.length} об. · с анимацией: ${
              preset.objects.filter((object) => object.animation?.enabled).length
            }</small>
          </span>
          <span class="map-row-actions">
            <button class="icon-mini" type="button" data-preset-action="insert" data-preset-id="${escapeHtml(
              preset.id,
            )}" title="Вставить">＋</button>
            <button class="icon-mini" type="button" data-preset-action="rename" data-preset-id="${escapeHtml(
              preset.id,
            )}" title="Переименовать">✎</button>
            <button class="icon-mini danger" type="button" data-preset-action="delete" data-preset-id="${escapeHtml(
              preset.id,
            )}" title="Удалить пресет">×</button>
          </span>
        </div>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Inspector helpers
// ---------------------------------------------------------------------------

function textField(path: string, label: string, value: string, disabled = false, maxLength = 60): string {
  return `
    <label class="text-field">
      <span>${escapeHtml(label)}</span>
      <input type="text" value="${escapeHtml(value)}" maxlength="${maxLength}" spellcheck="false"
        data-path="${escapeHtml(path)}" data-type="string" ${disabled ? 'disabled' : ''} />
    </label>`;
}

function numberField(
  path: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  disabled = false,
): string {
  const decimals = step >= 1 ? 0 : step.toString().split('.')[1]?.length ?? 2;
  return `
    <label class="text-field">
      <span>${escapeHtml(label)}</span>
      <input class="num" type="number" value="${round(value, decimals)}" min="${min}" max="${max}" step="${step}"
        data-path="${escapeHtml(path)}" data-type="number" ${disabled ? 'disabled' : ''} />
    </label>`;
}

function colorField(path: string, label: string, value: string, disabled = false): string {
  return `
    <div class="color-field">
      <label><span>${escapeHtml(label)}</span>
        <input type="color" value="${value}" data-path="${escapeHtml(path)}" data-type="color" ${disabled ? 'disabled' : ''} />
      </label>
      <input class="hex" type="text" value="${value}" maxlength="7" spellcheck="false"
        data-path="${escapeHtml(path)}" data-type="color" ${disabled ? 'disabled' : ''} />
    </div>`;
}

function selectField(
  path: string,
  label: string,
  value: string,
  options: { value: string; label: string }[],
  disabled = false,
): string {
  return `
    <label class="select-field">
      <span>${escapeHtml(label)}</span>
      <select data-path="${escapeHtml(path)}" data-type="string" ${disabled ? 'disabled' : ''}>
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(
                option.label,
              )}</option>`,
          )
          .join('')}
      </select>
    </label>`;
}

function checkField(path: string, title: string, hint: string, checked: boolean, disabled = false): string {
  return `
    <label class="check-field">
      <input type="checkbox" data-path="${escapeHtml(path)}" data-type="bool" ${checked ? 'checked' : ''} ${
        disabled ? 'disabled' : ''
      } />
      <span><b>${escapeHtml(title)}</b><small>${escapeHtml(hint)}</small></span>
    </label>`;
}

function vecGroup(
  prefix: string,
  label: string,
  values: Vec3,
  step: number,
  min: number,
  max: number,
  disabled = false,
): string {
  const axes = ['X', 'Y', 'Z'];
  const decimals = step >= 1 ? 0 : step.toString().split('.')[1]?.length ?? 2;
  return `
    <div class="vec-group">
      <span>${escapeHtml(label)}</span>
      <div class="vec-row">
        ${axes
          .map(
            (axis, index) => `
          <label class="vec-num">
            <span class="${axis.toLowerCase()}">${axis}</span>
            <input type="number" value="${round(values[index], decimals)}" step="${step}" min="${min}" max="${max}"
              data-path="${escapeHtml(prefix)}.${index}" data-type="number" ${disabled ? 'disabled' : ''} />
          </label>`,
          )
          .join('')}
      </div>
    </div>`;
}

function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < parts.length - 1; index++) {
    const key = parts[index];
    const next = cursor[key];
    if (next === null || typeof next !== 'object') {
      cursor[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

function mapSwatchStyle(theme: MapTheme): string {
  return `--map-light:${theme.tiles.playerLight};--map-dark:${theme.tiles.playerDark};--map-glow:${theme.accent}`;
}

function filterMaps(doc: MapDoc): boolean {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;
  return `${doc.name} ${doc.subtitle} ${doc.base}`.toLowerCase().includes(query);
}

function renderMapLists(): void {
  const list = state.maps.filter(filterMaps);
  mapCount.textContent = `${state.maps.length} моих`;
  modifiedCount.textContent = state.maps.length > 0 ? `${state.maps.length} карт` : 'Нет карт';
  modifiedCount.dataset.state = state.maps.length > 0 ? 'modified' : 'default';

  if (list.length === 0) {
    customMapList.innerHTML = `<div class="roster-empty">${state.maps.length === 0 ? 'Пока нет своих карт.' : 'Ничего не найдено.'}<br /><small>${
      state.maps.length === 0 ? 'Создайте карту кнопкой «＋ Карта».' : 'Измените запрос.'
    }</small></div>`;
  } else {
    customMapList.innerHTML = list
      .map((doc) => {
        const selected = doc.id === selectedMapId;
        return `
          <div class="map-row ${selected ? 'selected' : ''}" data-map-id="${escapeHtml(doc.id)}"
            style="${mapSwatchStyle(doc.theme)}" role="button" tabindex="0">
            <span class="map-swatch"></span>
            <span class="map-row-copy">
              <b>${escapeHtml(doc.name)}</b>
              <small>${doc.objects.length} объектов · ${escapeHtml(mapMeta(doc.base).name)}</small>
            </span>
            <span class="map-row-actions">
              <button class="icon-mini" type="button" data-map-action="duplicate" data-map-id="${escapeHtml(
                doc.id,
              )}" title="Дублировать карту">⧉</button>
              <button class="icon-mini danger" type="button" data-map-action="delete" data-map-id="${escapeHtml(
                doc.id,
              )}" title="Удалить карту">×</button>
            </span>
          </div>`;
      })
      .join('');
  }

  builtinMapList.innerHTML = BUILTIN_MAP_META.map((meta) => {
    const selected = meta.id === selectedMapId;
    const theme = BUILTIN_MAP_THEMES[meta.id];
    return `
      <div class="map-row ${selected ? 'selected' : ''}" data-builtin-id="${meta.id}" style="${mapSwatchStyle(
        theme,
      )}" role="button" tabindex="0">
        <span class="map-swatch"></span>
        <span class="map-row-copy">
          <b>${escapeHtml(meta.name)}</b>
          <small>${escapeHtml(meta.subtitle)} · шаблон</small>
        </span>
        <span class="map-row-actions">
          <button class="icon-mini" type="button" data-builtin-action="copy" data-builtin-id="${meta.id}"
            title="Создать свою карту на основе шаблона">＋</button>
        </span>
      </div>`;
  }).join('');
}

function objectMatchesQuery(object: MapObject): boolean {
  const query = objectSearchQuery.trim().toLowerCase();
  if (!query) return true;
  return `${object.name} ${object.shape} ${shapeLabel(object.shape)}`.toLowerCase().includes(query);
}

function objectRowHtml(object: MapObject, inGroup: boolean): string {
  const selected = selectedIds.includes(object.id);
  const glow = object.emissive === '#000000' ? object.color : object.emissive;
  return `
    <div class="object-row ${selected ? 'selected' : ''} ${object.visible ? '' : 'hidden'} ${
      inGroup ? 'in-group' : ''
    }"
      data-object-id="${escapeHtml(object.id)}" role="button" tabindex="0"
      style="--obj-color:${object.color};--obj-glow:${glow}">
      <button type="button" class="object-eye ${object.visible ? '' : 'off'}"
        data-object-eye="${escapeHtml(object.id)}" title="${object.visible ? 'Скрыть' : 'Показать'}">${
          object.visible ? '◉' : '◌'
        }</button>
      <button type="button" class="object-lock ${object.locked ? 'on' : ''}"
        data-object-lock="${escapeHtml(object.id)}" title="${object.locked ? 'Разблокировать' : 'Заблокировать'}">${
          object.locked ? '▣' : '▢'
        }</button>
      <span class="object-shape">${shapeGlyph(object.shape)}</span>
      <span class="object-copy">
        <span class="object-name">${escapeHtml(object.name)}</span>
        <span class="object-meta">${shapeLabel(object.shape)} · ${formatNumber(object.position[0], 2)}, ${formatNumber(
          object.position[1],
          2,
        )}, ${formatNumber(object.position[2], 2)}${object.animation?.enabled ? ' · ◎ анимация' : ''}</span>
      </span>
      <span class="map-row-actions">
        <button type="button" class="icon-mini" data-object-action="preset" data-object-id="${escapeHtml(
          object.id,
        )}" title="Сохранить в пресеты">☆</button>
        <button type="button" class="icon-mini" data-object-action="duplicate" data-object-id="${escapeHtml(
          object.id,
        )}" title="Дублировать объект">⧉</button>
        <button type="button" class="icon-mini danger" data-object-action="delete" data-object-id="${escapeHtml(
          object.id,
        )}" title="Удалить объект">×</button>
      </span>
    </div>`;
}

function groupRowHtml(group: MapObjectGroup, members: MapObject[]): string {
  const selected = selectedGroupId === group.id;
  const expanded = expandedGroups.has(group.id);
  const visible = members.some((object) => object.visible);
  const locked = members.length > 0 && members.every((object) => object.locked);
  const animated = members.filter((object) => object.animation?.enabled).length;
  return `
    <div class="group-row ${selected ? 'selected' : ''}" data-group-id="${escapeHtml(group.id)}"
      role="button" tabindex="0" style="--group-color:${group.color}">
      <button type="button" class="group-toggle" data-group-toggle="${escapeHtml(group.id)}"
        title="${expanded ? 'Свернуть' : 'Развернуть'}">${expanded ? '▾' : '▸'}</button>
      <span class="group-swatch"></span>
      <span class="object-copy">
        <span class="object-name">${escapeHtml(group.name)}</span>
        <span class="object-meta">${members.length} об.${animated ? ` · ◎ ${animated}` : ''} · группа</span>
      </span>
      <button type="button" class="object-eye ${visible ? '' : 'off'}"
        data-group-eye="${escapeHtml(group.id)}" title="${visible ? 'Скрыть группу' : 'Показать группу'}">${
          visible ? '◉' : '◌'
        }</button>
      <button type="button" class="object-lock ${locked ? 'on' : ''}"
        data-group-lock="${escapeHtml(group.id)}" title="${locked ? 'Разблокировать группу' : 'Заблокировать группу'}">${
          locked ? '▣' : '▢'
        }</button>
      <span class="map-row-actions">
        <button type="button" class="icon-mini" data-group-action="preset" data-group-id="${escapeHtml(
          group.id,
        )}" title="Сохранить группу в пресеты">☆</button>
        <button type="button" class="icon-mini" data-group-action="duplicate" data-group-id="${escapeHtml(
          group.id,
        )}" title="Скопировать группу">⧉</button>
        <button type="button" class="icon-mini" data-group-action="dissolve" data-group-id="${escapeHtml(
          group.id,
        )}" title="Расформировать группу">⤫</button>
      </span>
    </div>`;
}

function renderObjects(): void {
  const doc = activeDoc();
  const objects = doc?.objects ?? [];
  objectCount.textContent =
    selectedIds.length > 0 ? `${selectedIds.length} / ${objects.length}` : String(objects.length);
  objectEmpty.hidden = objects.length > 0;
  objectList.hidden = objects.length === 0;

  const query = objectSearchQuery.trim().toLowerCase();
  const objectById = new Map(objects.map((object) => [object.id, object]));
  const groupByObject = new Map<string, MapObjectGroup>();
  for (const group of doc?.groups ?? []) {
    for (const id of group.objectIds) groupByObject.set(id, group);
  }
  const matching = new Set(objects.filter(objectMatchesQuery).map((object) => object.id));
  const rows: string[] = [];
  const seenGroups = new Set<string>();

  for (const object of objects) {
    const group = groupByObject.get(object.id);
    if (group) {
      if (seenGroups.has(group.id)) continue;
      seenGroups.add(group.id);
      const members = group.objectIds
        .map((id) => objectById.get(id))
        .filter((entry): entry is MapObject => Boolean(entry));
      const matchingMembers = members.filter((entry) => matching.has(entry.id));
      const groupMatchesQuery = !query || group.name.toLowerCase().includes(query);
      if (matchingMembers.length === 0 && !groupMatchesQuery) continue;
      rows.push(groupRowHtml(group, members));
      const expanded = expandedGroups.has(group.id) || Boolean(query);
      if (expanded) {
        for (const member of query && !groupMatchesQuery ? matchingMembers : members) {
          rows.push(objectRowHtml(member, true));
        }
      }
      continue;
    }
    if (matching.has(object.id)) rows.push(objectRowHtml(object, false));
  }

  objectList.innerHTML =
    rows.length > 0
      ? rows.join('')
      : `<div class="roster-empty">Ничего не найдено.<br /><small>Измените запрос или снимите фильтр.</small></div>`;
}

function renderTabs(): void {
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  document.querySelectorAll<HTMLElement>('[data-gizmo]').forEach((button) => {
    button.classList.toggle('active', button.dataset.gizmo === gizmoMode);
  });
  shapePalette.querySelectorAll<HTMLElement>('[data-shape]').forEach((button) => {
    button.classList.toggle('active', button.dataset.shape === placementShape);
  });
  snapToggle.checked = snapEnabled;
  snapStepSelect.value = String(snapStep);
  placementHint.hidden = !placementShape;
}

function renderStage(): void {
  const doc = activeDoc();
  if (!doc) {
    stageTitle.textContent = 'Нет карты';
    stageSub.textContent = 'Создайте карту, чтобы начать редактирование';
    hudName.textContent = 'Map Lab';
    hudMeta.innerHTML = '';
    hudBadge.textContent = 'Пусто';
    hudBadge.className = 'hud-badge';
    return;
  }
  const meta = mapMeta(doc.base);
  const readOnly = isReadOnly(doc);
  stageEyebrow.textContent = readOnly ? 'Шаблон карты' : 'Редактор карты';
  stageTitle.textContent = doc.name;
  stageSub.textContent =
    doc.base === 'none'
      ? doc.subtitle || 'Чистая доска без декораций'
      : `${doc.subtitle || meta.subtitle} · окружение «${meta.name}»`;
  hudName.textContent = doc.name;
  hudMeta.innerHTML = `
    <span class="meta-chip" style="--chip:${doc.theme.accent}">◈ ${escapeHtml(meta.name)}</span>
    <span class="meta-chip" style="--chip:${doc.theme.tiles.playerLight}">${doc.objects.length} объектов</span>
    <span class="meta-chip" style="--chip:${doc.theme.accent}">${doc.groups.length} групп</span>
    <span class="meta-chip" style="--chip:${doc.theme.accent}">${readOnly ? 'только просмотр' : 'редактируется'}</span>`;
  hudBadge.textContent = readOnly ? 'Шаблон · просмотр' : 'Редактируется';
  hudBadge.className = `hud-badge ${readOnly ? 'builtin' : ''}`;
  renderSelectionHud();
  deleteObjectBtn.disabled = selectedIds.length === 0 || readOnly;
  focusObjectBtn.disabled = selectedIds.length === 0;
  groupSelectionBtn.disabled = selectedIds.length < 2 || readOnly;
  renderStageHint();
}

function renderSelectionHud(): void {
  const doc = activeDoc();
  const objects = selectedObjects();
  if (objects.length === 0) {
    selectionHud.textContent = 'Ничего не выбрано';
    return;
  }
  if (selectedGroupId && doc) {
    const group = doc.groups.find((entry) => entry.id === selectedGroupId);
    if (group) {
      const cx = objects.reduce((sum, object) => sum + object.position[0], 0) / objects.length;
      const cz = objects.reduce((sum, object) => sum + object.position[2], 0) / objects.length;
      selectionHud.textContent = `Группа «${group.name}» · ${objects.length} объектов · X ${formatNumber(
        cx,
        2,
      )} / Z ${formatNumber(cz, 2)} · гизмо перемещает группу`;
      return;
    }
  }
  if (objects.length > 1) {
    selectionHud.textContent = `Выбрано объектов: ${objects.length} · гизмо перемещает выделение · Ctrl+G — группа`;
    return;
  }
  const object = objects[0];
  selectionHud.textContent = `${object.name} · ${shapeLabel(object.shape)} · X ${formatNumber(
    object.position[0],
    2,
  )} / Y ${formatNumber(object.position[1], 2)} / Z ${formatNumber(object.position[2], 2)}${
    object.animation?.enabled ? ' · анимация' : ''
  }`;
}

function renderStageHint(): void {
  if (placementShape) {
    stageHint.innerHTML = `<span class="stage-ability-label">Размещение</span><p>Кликните по доске, чтобы поставить «${escapeHtml(
      shapeLabel(placementShape),
    )}». Объект останется в палитре для быстрой расстановки; Esc — выход.</p>`;
    return;
  }
  if (selectedIds.length > 1) {
    stageHint.innerHTML =
      '<span class="stage-ability-label">Группа</span><p>Гизмо двигает всё выделение сразу. Ctrl+G — объединить в группу, Ctrl+D — скопировать, Del — удалить. В инспекторе можно повернуть группу и сохранить её в пресет.</p>';
    return;
  }
  if (selectedObject()) {
    const object = selectedObject() as MapObject;
    stageHint.innerHTML = `<span class="stage-ability-label">Гизмо</span><p>W — двигать, E — вращать, R — масштаб, F — фокус, Ctrl+D — дублировать, Del — удалить.${
      object.animation?.enabled ? ' Анимация проигрывается в превью и в игре.' : ''
    }</p>`;
    return;
  }
  stageHint.innerHTML =
    '<span class="stage-ability-label">Совет</span><p>Выберите примитив в палитре, затем кликните по доске. Ctrl+клик добавляет объекты в выделение, чтобы собрать группу.</p>';
}

function metricCard(label: string, value: string, note = ''): string {
  return `<div class="metric-card"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b>${
    note ? `<small>${escapeHtml(note)}</small>` : ''
  }</div>`;
}

function renderMetrics(): void {
  const doc = activeDoc();
  const objects = doc?.objects ?? [];
  const visible = objects.filter((object) => object.visible).length;
  const locked = objects.filter((object) => object.locked).length;
  const animated = objects.filter((object) => object.animation?.enabled && object.animation.tracks.length > 0).length;
  metricStrip.innerHTML = [
    metricCard('Объекты', String(objects.length), 'примитивов на карте'),
    metricCard('Группы', String(doc?.groups.length ?? 0), 'перемещаются целиком'),
    metricCard('Анимации', String(animated), 'зациклено'),
    metricCard('Видимые', String(visible), 'участвуют в игре'),
    metricCard('Замки', String(locked), 'защищено от гизмо'),
    metricCard('Пресеты', String(state.presets.length), 'в библиотеке'),
    metricCard('Окружение', doc ? mapMeta(doc.base).name : '—', 'процедурная основа'),
  ].join('');
}

function renderInspector(): void {
  const doc = activeDoc();
  if (!doc) {
    inspectorBody.innerHTML = `<div class="tab-empty"><b>Нет выбранной карты</b>Создайте новую карту или выберите шаблон слева.</div>`;
    return;
  }
  if (tab === 'object') {
    renderObjectInspector(doc);
    return;
  }
  renderMapInspector(doc);
}

const MAP_PARTICLE_LABELS: { value: string; label: string }[] = [
  { value: 'embers', label: 'Угли' },
  { value: 'ash', label: 'Пепел' },
  { value: 'snow', label: 'Снег' },
  { value: 'sparks', label: 'Искры' },
];

function renderEnvSection(doc: MapDoc, readOnly: boolean): string {
  const env = doc.env;
  const islandRows =
    doc.base === 'none'
      ? `
      <details class="mat-section" open>
        <summary>Остров</summary>
        <div class="mat-body">
          ${checkField('env.island.enabled', 'Пустой остров', 'Основание под доской, без декораций', env.island.enabled, readOnly)}
          <div class="theme-grid" style="margin-top:8px">
            ${numberField('env.island.radius', 'Радиус', env.island.radius, 6, 60, 0.5, readOnly)}
            ${numberField('env.island.depth', 'Толщина', env.island.depth, 0.4, 14, 0.1, readOnly)}
            ${numberField('env.island.courtRadius', 'Радиус площадки', env.island.courtRadius, 0, 40, 0.2, readOnly)}
          </div>
          <div class="color-fields" style="margin-top:8px">
            ${colorField('env.island.topColor', 'Верх', env.island.topColor, readOnly)}
            ${colorField('env.island.sideColor', 'Склон', env.island.sideColor, readOnly)}
            ${colorField('env.island.rimColor', 'Кайма и площадка', env.island.rimColor, readOnly)}
          </div>
        </div>
      </details>
      <details class="mat-section">
        <summary>Море</summary>
        <div class="mat-body">
          ${checkField('env.sea.enabled', 'Море', 'Вода вокруг острова', env.sea.enabled, readOnly)}
          <div class="theme-grid" style="margin-top:8px">
            ${numberField('env.sea.level', 'Уровень воды', env.sea.level, -12, 2, 0.1, readOnly)}
            ${numberField('env.sea.size', 'Размер моря', env.sea.size, 20, 400, 5, readOnly)}
          </div>
          <div class="color-fields" style="margin-top:8px">
            ${colorField('env.sea.color', 'Вода', env.sea.color, readOnly)}
            ${colorField('env.sea.emissive', 'Свечение воды', env.sea.emissive, readOnly)}
          </div>
          <div class="field-grid two" style="margin-top:8px">
            ${checkField('env.sea.foam', 'Пена у берега', 'Кольца прибоя вокруг острова', env.sea.foam, readOnly)}
            ${colorField('env.sea.foamColor', 'Цвет пены', env.sea.foamColor, readOnly)}
          </div>
        </div>
      </details>`
      : `<p class="mini-hint">Остров и море доступны на базе «Без окружения». Для биомов используйте поверхности, небо, частицы и звёзды.</p>`;

  const surfaceRows =
    env.surfaces.length === 0
      ? '<p class="mini-hint">Пока нет дополнительных поверхностей.</p>'
      : env.surfaces
          .map(
            (surface, index) => `
        <div class="env-surface-card" style="margin-top:8px">
          <div class="env-surface-head">
            <b>${escapeHtml(surface.name)}</b>
            <button class="icon-mini danger" type="button" data-action="delete-surface" data-surface-id="${escapeHtml(
              surface.id,
            )}" title="Удалить поверхность" ${readOnly ? 'disabled' : ''}>×</button>
          </div>
          <div class="field-grid two">
            ${textField(`env.surfaces.${index}.name`, 'Имя', surface.name, readOnly, 48)}
            ${selectField(
              `env.surfaces.${index}.shape`,
              'Тип',
              surface.shape,
              [
                { value: 'disc', label: 'Площадка' },
                { value: 'box', label: 'Блок' },
              ],
              readOnly,
            )}
          </div>
          ${vecGroup(`env.surfaces.${index}.position`, 'Позиция', surface.position, 0.1, -40, 40, readOnly)}
          ${vecGroup(`env.surfaces.${index}.size`, 'Размер', surface.size, 0.1, 0.1, 80, readOnly)}
          <div class="color-fields">
            ${colorField(`env.surfaces.${index}.color`, 'Цвет', surface.color, readOnly)}
            ${colorField(`env.surfaces.${index}.emissive`, 'Свечение', surface.emissive, readOnly)}
          </div>
          <div class="theme-grid" style="margin-top:8px">
            ${numberField(`env.surfaces.${index}.alpha`, 'Прозрачность', surface.alpha, 0, 1, 0.01, readOnly)}
          </div>
        </div>`,
          )
          .join('');

  return `
    <div class="panel-section">
      <div class="section-head"><span>Окружение</span><small>конструктор</small></div>
      <div class="obj-actions env-preset-row" style="margin-top:0">
        <button class="btn small" type="button" data-action="env-preset" data-preset="island" ${
          readOnly || doc.base !== 'none' ? 'disabled' : ''
        }>Остров</button>
        <button class="btn small" type="button" data-action="env-preset" data-preset="sea" ${
          readOnly || doc.base !== 'none' ? 'disabled' : ''
        }>Море</button>
        <button class="btn small" type="button" data-action="env-preset" data-preset="sky" ${
          readOnly ? 'disabled' : ''
        }>Небо</button>
        <button class="btn small" type="button" data-action="env-preset" data-preset="stars" ${
          readOnly ? 'disabled' : ''
        }>Звёзды</button>
        <button class="btn small" type="button" data-action="env-preset" data-preset="particles" ${
          readOnly ? 'disabled' : ''
        }>Частицы</button>
        <button class="btn small" type="button" data-action="env-preset" data-preset="base" ${
          readOnly ? 'disabled' : ''
        }>Базовое окружение</button>
        <button class="btn small" type="button" data-action="env-preset" data-preset="clear" ${
          readOnly ? 'disabled' : ''
        }>Очистить</button>
      </div>

      ${islandRows}

      <details class="mat-section">
        <summary>Небо и туман</summary>
        <div class="mat-body">
          ${checkField(
            'env.sky.enabled',
            'Своё небо',
            'Перекрывает небо и туман из темы карты',
            env.sky.enabled,
            readOnly,
          )}
          <div class="color-fields" style="margin-top:8px">
            ${colorField('env.sky.color', 'Цвет неба', env.sky.color, readOnly)}
            ${colorField('env.sky.fogColor', 'Цвет тумана', env.sky.fogColor, readOnly)}
          </div>
          <div class="theme-grid" style="margin-top:8px">
            ${numberField('env.sky.fogDensity', 'Плотность тумана', env.sky.fogDensity, 0, 0.12, 0.001, readOnly)}
          </div>
        </div>
      </details>

      <details class="mat-section">
        <summary>Частицы</summary>
        <div class="mat-body">
          ${checkField('env.particles.enabled', 'Частицы', 'Угли, пепел, снег или искры', env.particles.enabled, readOnly)}
          <div class="field-grid two" style="margin-top:8px">${selectField(
            'env.particles.kind',
            'Тип',
            env.particles.kind,
            MAP_PARTICLE_LABELS,
            readOnly,
          )}</div>
          <div class="theme-grid" style="margin-top:8px">
            ${numberField('env.particles.count', 'Количество', env.particles.count, 4, 240, 1, readOnly)}
            ${numberField('env.particles.size', 'Размер', env.particles.size, 0.01, 1, 0.01, readOnly)}
            ${numberField('env.particles.speed', 'Скорость', env.particles.speed, 0.01, 1.2, 0.01, readOnly)}
            ${numberField('env.particles.height', 'Высота', env.particles.height, 0.5, 30, 0.5, readOnly)}
            ${numberField('env.particles.spread', 'Разброс', env.particles.spread, 0.5, 40, 0.5, readOnly)}
          </div>
          <div class="color-fields" style="margin-top:8px">
            ${colorField('env.particles.color', 'Цвет частиц', env.particles.color, readOnly)}
          </div>
        </div>
      </details>

      <details class="mat-section">
        <summary>Звёзды</summary>
        <div class="mat-body">
          ${checkField('env.stars.enabled', 'Звёзды', 'Отдельные светящиеся точки на фоне', env.stars.enabled, readOnly)}
          <div class="theme-grid" style="margin-top:8px">
            ${numberField('env.stars.count', 'Количество', env.stars.count, 4, 400, 1, readOnly)}
            ${numberField('env.stars.size', 'Размер', env.stars.size, 0.02, 1.5, 0.01, readOnly)}
            ${numberField('env.stars.distance', 'Дальность', env.stars.distance, 12, 140, 1, readOnly)}
          </div>
          <div class="color-fields" style="margin-top:8px">
            ${colorField('env.stars.color', 'Цвет звёзд', env.stars.color, readOnly)}
          </div>
          <div class="field-grid two" style="margin-top:8px">
            ${checkField('env.stars.twinkle', 'Мерцание', 'Плавно менять яркость', env.stars.twinkle, readOnly)}
          </div>
        </div>
      </details>

      <details class="mat-section">
        <summary>Поверхности (${env.surfaces.length})</summary>
        <div class="mat-body">
          <p class="mini-hint">Площадки и блоки для декора и необычных арен. По ним можно ставить объекты.</p>
          <div class="obj-actions" style="margin-top:8px">
            <button class="btn small" type="button" data-action="add-surface" data-shape="disc" ${
              readOnly ? 'disabled' : ''
            }>＋ Площадка</button>
            <button class="btn small" type="button" data-action="add-surface" data-shape="box" ${
              readOnly ? 'disabled' : ''
            }>＋ Блок</button>
          </div>
          ${surfaceRows}
        </div>
      </details>
    </div>`;
}

function applyEnvPreset(doc: MapDoc, preset: string): void {
  const defaults = emptyMapEnv();
  switch (preset) {
    case 'island':
      doc.env.island = { ...defaults.island, enabled: true };
      break;
    case 'sea':
      doc.env.sea = { ...defaults.sea, enabled: true };
      break;
    case 'sky':
      doc.env.sky = { enabled: true, color: '#141a2e', fogColor: '#0a0d18', fogDensity: 0.006 };
      break;
    case 'stars':
      doc.env.stars = { ...defaults.stars, enabled: true, count: 110, size: 0.28, distance: 70 };
      break;
    case 'particles':
      doc.env.particles = { ...defaults.particles, enabled: true, kind: 'embers', color: '#ffb45e', count: 44 };
      break;
    case 'base':
      doc.env.island = { ...defaults.island, enabled: true };
      doc.env.sea = { ...defaults.sea, enabled: true };
      doc.env.sky = { enabled: true, color: '#0d1626', fogColor: '#091019', fogDensity: 0.008 };
      break;
    case 'clear':
      doc.env = emptyMapEnv();
      break;
    default:
      break;
  }
}

function renderMapInspector(doc: MapDoc): void {
  const readOnly = isReadOnly(doc);
  const theme = doc.theme;
  const baseOptions = MAP_BASE_OPTIONS;
  const materials = MAT_GROUPS.map(
    (group) => `
      <details class="mat-section">
        <summary>${escapeHtml(group.title)}</summary>
        <div class="mat-body">
          <div class="color-fields">
            ${group.keys
              .map((key) => {
                const pair = theme.mats[key] ?? ['#777777', '#000000'];
                return colorField(`theme.mats.${key}.0`, MAT_LABELS[key] ?? key, pair[0], readOnly);
              })
              .join('')}
          </div>
        </div>
      </details>`,
  ).join('');

  inspectorBody.innerHTML = `
    <div class="inspector-title-row">
      <div>
        <span class="eyebrow">${readOnly ? 'Шаблон' : 'Карта'}</span>
        <h2>${escapeHtml(doc.name)}</h2>
      </div>
      <span class="count-pill">${doc.objects.length} об.</span>
    </div>

    ${
      readOnly
        ? `<div class="readonly-note"><b>Встроенный шаблон только для просмотра.</b>Создайте копию, чтобы менять окружение, тему и расставлять объекты.
            <div class="obj-actions"><button class="btn primary full" type="button" data-action="copy-template">Создать карту на этой основе</button></div>
          </div>`
        : ''
    }

    <div class="panel-section">
      <div class="section-head"><span>Основное</span><small>${readOnly ? 'read only' : 'автосохранение'}</small></div>
      <div class="field-grid two">
        ${textField('name', 'Название', doc.name, readOnly, 48)}
        ${textField('subtitle', 'Подпись', doc.subtitle, readOnly, 80)}
        <div class="span-2">${selectField('base', 'Процедурное окружение', doc.base, baseOptions, readOnly)}</div>
      </div>
      <p class="section-hint" style="margin-top:8px">Окружение задаёт скалы, деревья и декор вокруг арены. Тема и объекты остаются вашими.</p>
    </div>

    <div class="panel-section">
      <div class="section-head"><span>Свет и небо</span><small>${theme.accent}</small></div>
      <div class="color-fields">
        ${colorField('theme.accent', 'Акцент карты', theme.accent, readOnly)}
        ${colorField('theme.sky', 'Небо', theme.sky, readOnly)}
        ${colorField('theme.fog', 'Туман', theme.fog, readOnly)}
        ${colorField('theme.hemiDiffuse', 'Рассеянный свет', theme.hemiDiffuse, readOnly)}
        ${colorField('theme.hemiGround', 'Свет снизу', theme.hemiGround, readOnly)}
        ${colorField('theme.dirDiffuse', 'Направленный свет', theme.dirDiffuse, readOnly)}
      </div>
      <div class="theme-grid" style="margin-top:8px">
        ${numberField('theme.fogDensity', 'Плотность тумана', theme.fogDensity, 0, 0.12, 0.001, readOnly)}
        ${numberField('theme.glow', 'Свечение', theme.glow, 0, 2, 0.05, readOnly)}
        ${numberField('theme.hemiIntensity', 'Сила рассеянного', theme.hemiIntensity, 0, 4, 0.05, readOnly)}
        ${numberField('theme.dirIntensity', 'Сила направленного', theme.dirIntensity, 0, 4, 0.05, readOnly)}
      </div>
    </div>

    <div class="panel-section">
      <div class="section-head"><span>Плитки доски</span><small>8 × 8</small></div>
      <div class="color-fields">
        ${colorField('theme.tiles.playerLight', 'Светлая плитка игрока', theme.tiles.playerLight, readOnly)}
        ${colorField('theme.tiles.playerDark', 'Тёмная плитка игрока', theme.tiles.playerDark, readOnly)}
        ${colorField('theme.tiles.enemyLight', 'Светлая плитка врага', theme.tiles.enemyLight, readOnly)}
        ${colorField('theme.tiles.enemyDark', 'Тёмная плитка врага', theme.tiles.enemyDark, readOnly)}
      </div>
    </div>

    ${renderEnvSection(doc, readOnly)}

    <div class="panel-section">
      <div class="section-head"><span>Материалы окружения</span><small>${MAT_GROUPS.length} группы</small></div>
      <p class="mini-hint">Цвета применяются к процедурному острову, скалам, руинам и морю вокруг арены.</p>
      ${materials}
    </div>

    ${
      readOnly
        ? ''
        : `<div class="panel-section danger-zone">
            <button class="btn danger full" type="button" data-action="delete-map">Удалить карту</button>
          </div>`
    }
  `;
}

const ANIM_PROPERTY_RANGES: Record<MapAnimProperty, { min: number; max: number; step: number }> = {
  position: { min: -20, max: 20, step: 0.05 },
  rotation: { min: -720, max: 720, step: 5 },
  scale: { min: -1, max: 4, step: 0.02 },
  color: { min: -1, max: 1, step: 0.01 },
  emissive: { min: -1, max: 1, step: 0.01 },
  alpha: { min: -1, max: 1, step: 0.01 },
};

function animationTrackCard(track: MapAnimationTrack, index: number, readOnly: boolean): string {
  const property = MAP_ANIM_PROPERTIES.find((entry) => entry.value === track.property) ?? MAP_ANIM_PROPERTIES[0];
  const range = ANIM_PROPERTY_RANGES[track.property] ?? ANIM_PROPERTY_RANGES.position;
  const usesColor = track.property === 'color' || track.property === 'emissive';
  return `
    <div class="anim-track">
      <div class="anim-track-head">
        <b>${escapeHtml(property.label)}${property.vector ? ` · ${track.axis.toUpperCase()}` : ''}</b>
        <button class="icon-mini danger" type="button" data-action="delete-track" data-track-id="${escapeHtml(
          track.id,
        )}" title="Удалить трек" ${readOnly ? 'disabled' : ''}>×</button>
      </div>
      <div class="field-grid two">
        ${selectField(
          `animation.tracks.${index}.property`,
          'Свойство',
          track.property,
          MAP_ANIM_PROPERTIES.map((entry) => ({ value: entry.value, label: entry.label })),
          readOnly,
        )}
        ${selectField(
          `animation.tracks.${index}.wave`,
          'Кривая',
          track.wave,
          MAP_ANIM_WAVES.map((entry) => ({ value: entry.value, label: entry.label })),
          readOnly,
        )}
      </div>
      <div class="field-grid two" style="margin-top:6px">
        ${
          property.vector
            ? selectField(
                `animation.tracks.${index}.axis`,
                'Ось',
                track.axis,
                [
                  { value: 'x', label: 'X' },
                  { value: 'y', label: 'Y' },
                  { value: 'z', label: 'Z' },
                ],
                readOnly,
              )
            : colorField(`animation.tracks.${index}.color`, 'Целевой цвет', track.color, readOnly)
        }
        ${numberField(
          `animation.tracks.${index}.amplitude`,
          usesColor ? 'Смешивание' : 'Амплитуда',
          track.amplitude,
          range.min,
          range.max,
          range.step,
          readOnly,
        )}
      </div>
      <div class="theme-grid" style="margin-top:6px">
        ${numberField(`animation.tracks.${index}.phase`, 'Фаза 0–1', track.phase, 0, 1, 0.01, readOnly)}
        ${
          usesColor
            ? '<span class="mini-hint" style="margin:0;align-self:end">смешивает базовый цвет с целевым</span>'
            : `<span class="mini-hint" style="margin:0;align-self:end">${
                track.property === 'scale' ? 'доля размера, например 0.2 = ±20%' : 'размах колебания'
              }</span>`
        }
      </div>
    </div>`;
}

function animationSection(object: MapObject, readOnly: boolean): string {
  const animation = object.animation ?? { enabled: false, duration: 3, phase: 0, tracks: [] };
  const tracks = animation.tracks
    .map((track, index) => animationTrackCard(track, index, readOnly))
    .join('');
  const quick: { id: string; label: string }[] = [
    { id: 'float', label: 'Парение' },
    { id: 'pulse', label: 'Пульс' },
    { id: 'glow', label: 'Сияние' },
    { id: 'fade', label: 'Мерцание' },
    { id: 'spin', label: 'Оборот' },
  ];
  return `
    <div class="panel-section">
      <div class="section-head"><span>Анимация</span><small>${
        animation.enabled ? `${animation.tracks.length} трек(ов)` : 'выключена'
      }</small></div>
      ${checkField(
        'animation.enabled',
        'Зацикленная анимация',
        'Бесконечно повторяется в редакторе и в игре',
        animation.enabled,
        readOnly,
      )}
      <div class="anim-quick">
        ${quick
          .map(
            (entry) =>
              `<button class="btn small" type="button" data-action="anim-preset" data-preset="${entry.id}" ${
                readOnly ? 'disabled' : ''
              }>${entry.label}</button>`,
          )
          .join('')}
      </div>
      <div class="theme-grid" style="margin-top:8px">
        ${numberField(
          'animation.duration',
          'Длительность, с',
          animation.duration,
          MAP_ANIMATION_LIMITS.durationMin,
          MAP_ANIMATION_LIMITS.durationMax,
          0.1,
          readOnly,
        )}
        ${numberField('animation.phase', 'Фаза 0–1', animation.phase, 0, 1, 0.01, readOnly)}
      </div>
      <div class="anim-track-list">
        ${tracks || '<p class="mini-hint" style="margin:0">Добавьте трек или выберите быстрый пресет выше.</p>'}
      </div>
      <div class="obj-actions">
        ${MAP_ANIM_PROPERTIES.map(
          (entry) =>
            `<button class="btn small" type="button" data-action="add-track" data-property="${entry.value}" ${
              readOnly ? 'disabled' : ''
            }>＋ ${entry.label}</button>`,
        ).join('')}
      </div>
    </div>`;
}

function ensureObjectAnimation(object: MapObject): MapObjectAnimation {
  if (!object.animation) object.animation = createObjectAnimation(false);
  return object.animation;
}

function addAnimationTrack(property: MapAnimProperty): void {
  const doc = activeDoc();
  const object = selectedObject();
  if (!doc || !object || isReadOnly(doc) || object.locked) return;
  const animation = ensureObjectAnimation(object);
  if (animation.tracks.length >= MAP_ANIMATION_LIMITS.maxTracks) {
    showToast(`Максимум ${MAP_ANIMATION_LIMITS.maxTracks} треков на объект.`, 'warn');
    return;
  }
  recordUndo();
  animation.tracks.push(createAnimationTrack(property));
  animation.enabled = true;
  afterChange({ inspector: true });
}

function removeAnimationTrack(trackId: string): void {
  const doc = activeDoc();
  const object = selectedObject();
  if (!doc || !object || isReadOnly(doc) || object.locked) return;
  const animation = object.animation;
  if (!animation) return;
  const next = animation.tracks.filter((track) => track.id !== trackId);
  if (next.length === animation.tracks.length) return;
  recordUndo();
  animation.tracks = next;
  if (next.length === 0) animation.enabled = false;
  afterChange({ inspector: true });
}

/** Applies one of the quick looped-animation presets to the selected object. */
function applyObjectAnimationPreset(presetId: string): void {
  const doc = activeDoc();
  const object = selectedObject();
  if (!doc || !object || isReadOnly(doc) || object.locked) return;
  recordUndo();
  const animation = ensureObjectAnimation(object);
  const tracks: MapAnimationTrack[] = [];
  const add = (property: MapAnimProperty, init: Partial<MapAnimationTrack> = {}): void => {
    tracks.push({ ...createAnimationTrack(property), ...init });
  };

  switch (presetId) {
    case 'float':
      animation.duration = 3.4;
      add('position', { axis: 'y', amplitude: 0.32, wave: 'sine' });
      break;
    case 'pulse':
      animation.duration = 1.8;
      add('scale', { axis: 'x', amplitude: 0.16, wave: 'sine' });
      add('scale', { axis: 'y', amplitude: 0.16, wave: 'sine' });
      add('scale', { axis: 'z', amplitude: 0.16, wave: 'sine' });
      break;
    case 'glow': {
      animation.duration = 2.6;
      const glow = object.emissive === '#000000' ? object.color : object.emissive;
      add('emissive', { amplitude: 1, wave: 'sine', color: glow });
      break;
    }
    case 'fade':
      animation.duration = 2.2;
      add('alpha', { amplitude: 0.35, wave: 'triangle', phase: 0.25 });
      break;
    case 'spin':
      animation.duration = 6;
      add('rotation', { axis: 'y', amplitude: 180, wave: 'triangle' });
      break;
    default:
      return;
  }

  animation.tracks = tracks.slice(0, MAP_ANIMATION_LIMITS.maxTracks);
  animation.enabled = true;
  animation.phase = 0;
  object.animation = animation;
  afterChange({ inspector: true });
  showToast('Анимация применена. Настройте длительность и треки ниже.');
}

function focusSelection(): void {
  if (selectedIds.length === 0) {
    preview?.focusBoard();
    return;
  }
  if (selectedIds.length === 1) preview?.focusObject(selectedIds[0]);
  else preview?.focusObjects(selectedIds);
}

function renderObjectInspector(doc: MapDoc): void {
  if (selectedIds.length > 1) {
    const group =
      (selectedGroupId ? doc.groups.find((entry) => entry.id === selectedGroupId) : null) ?? null;
    if (group && group.objectIds.length === selectedIds.length) {
      renderGroupInspector(doc, group);
    } else {
      renderMultiObjectInspector(doc);
    }
    return;
  }

  const object = selectedObject();
  const readOnly = isReadOnly(doc);
  if (!object) {
    inspectorBody.innerHTML = `
      <div class="inspector-title-row">
        <div><span class="eyebrow">Объект</span><h2>Ничего не выбрано</h2></div>
        <span class="count-pill">0</span>
      </div>
      <div class="tab-empty"><b>Выберите примитив</b>Кликните по объекту в сцене или в списке слева. Чтобы добавить новый, выберите форму в палитре под сценой.<br /><br />Ctrl+клик собирает несколько объектов, после чего их можно объединить в группу.</div>`;
    return;
  }
  const disabled = readOnly || object.locked;
  const color = object.emissive === '#000000' ? object.color : object.emissive;
  const group = groupOfObject(doc, object.id);
  const groupOptions = [
    { value: '', label: 'Без группы' },
    ...doc.groups.map((entry) => ({ value: entry.id, label: entry.name })),
  ];
  inspectorBody.innerHTML = `
    <div class="inspector-title-row">
      <div><span class="eyebrow">Примитив</span><h2>${escapeHtml(object.name)}</h2></div>
      <span class="count-pill">${shapeLabel(object.shape)}${object.animation?.enabled ? ' · ◎' : ''}</span>
    </div>

    <div class="object-hero" style="--obj-color:${object.color};--obj-glow:${color}">
      <span class="object-shape">${shapeGlyph(object.shape)}</span>
      <span class="object-hero-copy">
        <b>${escapeHtml(object.name)}</b>
        <small>${shapeLabel(object.shape)} · ${object.visible ? 'видим' : 'скрыт'}${object.locked ? ' · замок' : ''}${
          group ? ` · ${escapeHtml(group.name)}` : ''
        }</small>
      </span>
      <span class="hero-actions">
        <button class="icon-mini" type="button" data-action="preset-selection" title="Сохранить в пресеты">☆</button>
        <button class="icon-mini" type="button" data-action="duplicate-object" title="Дублировать">⧉</button>
        <button class="icon-mini danger" type="button" data-action="delete-object" title="Удалить">×</button>
      </span>
    </div>

    <div class="panel-section">
      <div class="section-head"><span>Форма</span><small>${object.id.slice(-8)}</small></div>
      <div class="field-grid two">
        ${textField('name', 'Имя объекта', object.name, readOnly, 48)}
        ${selectField(
          'shape',
          'Примитив',
          object.shape,
          MAP_SHAPES.map((entry) => ({ value: entry.value, label: entry.label })),
          readOnly,
        )}
      </div>
      <div class="field-grid two" style="margin-top:8px">
        ${checkField('visible', 'Видимый', 'Показывать объект в игре и редакторе', object.visible, readOnly)}
        ${checkField('locked', 'Замок', 'Запретить перемещение гизмо', object.locked, readOnly)}
      </div>
      <div style="margin-top:8px">
        <label class="select-field">
          <span>Группа</span>
          <select data-role="object-group" ${readOnly ? 'disabled' : ''}>
            ${groupOptions
              .map(
                (option) =>
                  `<option value="${escapeHtml(option.value)}" ${
                    (group?.id ?? '') === option.value ? 'selected' : ''
                  }>${escapeHtml(option.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
      </div>
      <div class="obj-actions">
        <button class="btn small" type="button" data-action="preset-selection" ${
          readOnly ? 'disabled' : ''
        }>Сохранить в пресеты</button>
      </div>
    </div>

    <div class="panel-section">
      <div class="section-head"><span>Трансформация</span><small>${object.locked ? 'заблокировано' : 'W / E / R'}</small></div>
      ${vecGroup('position', 'Позиция', object.position, 0.05, -40, 40, disabled)}
      ${vecGroup('rotation', 'Поворот, °', object.rotation, 5, -3600, 3600, disabled)}
      ${vecGroup('scale', 'Масштаб', object.scale, 0.05, 0.02, 40, disabled)}
      <div class="obj-actions">
        <button class="btn small" type="button" data-action="ground-object" ${disabled ? 'disabled' : ''}>На доску</button>
        <button class="btn small" type="button" data-action="reset-rotation" ${disabled ? 'disabled' : ''}>Сброс поворота</button>
        <button class="btn small" type="button" data-action="center-object" ${disabled ? 'disabled' : ''}>В центр</button>
        <button class="btn small" type="button" data-action="focus-object">Фокус</button>
      </div>
    </div>

    <div class="panel-section">
      <div class="section-head"><span>Материал</span><small>цвет и свечение</small></div>
      <div class="color-fields">
        ${colorField('color', 'Цвет', object.color, readOnly)}
        ${colorField('emissive', 'Свечение', object.emissive, readOnly)}
      </div>
      <div class="theme-grid" style="margin-top:8px">
        ${numberField('alpha', 'Прозрачность', object.alpha, 0, 1, 0.01, readOnly)}
      </div>
    </div>

    ${animationSection(object, readOnly)}

    ${
      readOnly
        ? '<div class="readonly-note" style="margin-top:10px"><b>Шаблон только для просмотра.</b>Создайте свою карту, чтобы редактировать объекты.</div>'
        : ''
    }
  `;
}

function renderGroupInspector(doc: MapDoc, group: MapObjectGroup): void {
  const readOnly = isReadOnly(doc);
  const members = group.objectIds
    .map((id) => doc.objects.find((object) => object.id === id))
    .filter((object): object is MapObject => Boolean(object));
  const animated = members.filter((object) => object.animation?.enabled).length;
  const nudgeButtons: { delta: Vec3; label: string; title: string }[] = [
    { delta: [0, 0, -snapStep], label: '↑', title: 'Сдвинуть от камеры' },
    { delta: [-snapStep, 0, 0], label: '←', title: 'Сдвинуть влево' },
    { delta: [snapStep, 0, 0], label: '→', title: 'Сдвинуть вправо' },
    { delta: [0, 0, snapStep], label: '↓', title: 'Сдвинуть к камере' },
  ];
  inspectorBody.innerHTML = `
    <div class="inspector-title-row">
      <div><span class="eyebrow">Группа</span><h2>${escapeHtml(group.name)}</h2></div>
      <span class="count-pill">${members.length} об.</span>
    </div>

    <div class="object-hero group-hero" style="--obj-color:${group.color};--obj-glow:${group.color}">
      <span class="object-shape">▦</span>
      <span class="object-hero-copy">
        <b>${escapeHtml(group.name)}</b>
        <small>${members.length} объектов · ${animated} с анимацией</small>
      </span>
      <span class="hero-actions">
        <button class="icon-mini" type="button" data-action="preset-selection" title="Сохранить группу в пресеты">☆</button>
        <button class="icon-mini" type="button" data-action="duplicate-group" title="Скопировать группу">⧉</button>
        <button class="icon-mini danger" type="button" data-action="delete-object" title="Удалить выбранное">×</button>
      </span>
    </div>

    <div class="panel-section">
      <div class="section-head"><span>Группа</span><small>перемещается целиком</small></div>
      <label class="text-field">
        <span>Название группы</span>
        <input type="text" value="${escapeHtml(group.name)}" maxlength="48" spellcheck="false"
          data-role="group-name" ${readOnly ? 'disabled' : ''} />
      </label>
      <div class="color-field" style="margin-top:8px">
        <label><span>Цвет метки</span>
          <input type="color" value="${group.color}" data-role="group-color" ${readOnly ? 'disabled' : ''} />
        </label>
        <input class="hex" type="text" value="${group.color}" maxlength="7" data-role="group-color" ${
          readOnly ? 'disabled' : ''
        } />
      </div>
      <p class="mini-hint" style="margin-top:8px">Гизмо под сценой двигает всю группу. Кнопки ниже помогают сдвинуть её точно по сетке.</p>
      <div class="nudge-grid">
        ${nudgeButtons
          .map(
            (entry) =>
              `<button class="btn small" type="button" data-action="nudge-selection" data-delta="${entry.delta.join(
                ',',
              )}" title="${entry.title}" ${readOnly ? 'disabled' : ''}>${entry.label}</button>`,
          )
          .join('')}
        <button class="btn small" type="button" data-action="nudge-selection" data-delta="0,-${snapStep},0" ${
          readOnly ? 'disabled' : ''
        } title="Опустить">Y−</button>
        <button class="btn small" type="button" data-action="nudge-selection" data-delta="0,${snapStep},0" ${
          readOnly ? 'disabled' : ''
        } title="Поднять">Y+</button>
      </div>
      <div class="obj-actions">
        <button class="btn small" type="button" data-action="rotate-group" data-angle="-90" ${
          readOnly ? 'disabled' : ''
        }>⟲ 90°</button>
        <button class="btn small" type="button" data-action="rotate-group" data-angle="90" ${
          readOnly ? 'disabled' : ''
        }>⟳ 90°</button>
        <button class="btn small" type="button" data-action="snap-selection" ${readOnly ? 'disabled' : ''}>К сетке</button>
        <button class="btn small" type="button" data-action="focus-selection">Фокус</button>
      </div>
      <div class="obj-actions">
        <button class="btn small" type="button" data-action="preset-selection" ${readOnly ? 'disabled' : ''}>В пресеты</button>
        <button class="btn small" type="button" data-action="duplicate-group" ${readOnly ? 'disabled' : ''}>Копия группы</button>
        <button class="btn small" type="button" data-action="dissolve-group" ${readOnly ? 'disabled' : ''}>Расформировать</button>
      </div>
      <div class="obj-actions">
        <button class="btn danger small full" type="button" data-action="delete-group" ${
          readOnly ? 'disabled' : ''
        }>Удалить группу и объекты</button>
      </div>
    </div>

    <div class="panel-section">
      <div class="section-head"><span>Объекты группы</span><small>${members.length}</small></div>
      <div class="object-list embedded">
        ${members.map((object) => objectRowHtml(object, true)).join('')}
      </div>
    </div>

    ${
      readOnly
        ? '<div class="readonly-note" style="margin-top:10px"><b>Шаблон только для просмотра.</b>Создайте свою карту, чтобы менять группы.</div>'
        : ''
    }
  `;
}

function renderMultiObjectInspector(doc: MapDoc): void {
  const readOnly = isReadOnly(doc);
  const objects = selectedObjects();
  inspectorBody.innerHTML = `
    <div class="inspector-title-row">
      <div><span class="eyebrow">Выделение</span><h2>${objects.length} объектов</h2></div>
      <span class="count-pill">мультивыбор</span>
    </div>

    <div class="multi-summary">
      <b>Гизмо двигает всё выделение сразу.</b>
      <small>Ctrl+клик в сцене или списке добавляет и убирает объекты. Ctrl+G объединяет их в группу.</small>
    </div>

    <div class="panel-section">
      <div class="section-head"><span>Действия</span><small>выделение</small></div>
      <div class="obj-actions">
        <button class="btn primary small" type="button" data-action="create-group" ${
          readOnly ? 'disabled' : ''
        }>Сгруппировать</button>
        <button class="btn small" type="button" data-action="duplicate-selection" ${
          readOnly ? 'disabled' : ''
        }>Копировать</button>
        <button class="btn small danger" type="button" data-action="delete-object" ${
          readOnly ? 'disabled' : ''
        }>Удалить</button>
      </div>
      <div class="obj-actions">
        <button class="btn small" type="button" data-action="preset-selection" ${
          readOnly ? 'disabled' : ''
        }>Сохранить в пресеты</button>
        <button class="btn small" type="button" data-action="focus-selection">Фокус</button>
      </div>
      <div class="obj-actions">
        <button class="btn small" type="button" data-action="align-selection" data-axis="x" ${
          readOnly ? 'disabled' : ''
        }>Ровно по X</button>
        <button class="btn small" type="button" data-action="align-selection" data-axis="z" ${
          readOnly ? 'disabled' : ''
        }>Ровно по Z</button>
        <button class="btn small" type="button" data-action="align-selection" data-axis="y" ${
          readOnly ? 'disabled' : ''
        }>Один уровень</button>
        <button class="btn small" type="button" data-action="snap-selection" ${readOnly ? 'disabled' : ''}>К сетке</button>
      </div>
    </div>

    <div class="panel-section">
      <div class="section-head"><span>Состав</span><small>${objects.length}</small></div>
      <div class="object-list embedded">
        ${objects.map((object) => objectRowHtml(object, false)).join('')}
      </div>
    </div>
  `;
}

function refreshPreview(): void {
  if (!preview) return;
  const doc = activeDoc();
  if (doc) {
    preview.setDoc(doc);
    preview.setGizmoMode(gizmoMode);
    preview.setSnapping(snapEnabled, snapStep);
    preview.setPlacement(placementShape);
    preview.setSelectionIds(selectedIds);
  } else {
    preview.setObjects([]);
    preview.setSelection(null);
  }
}

function renderAll(): void {
  renderMapLists();
  renderObjects();
  renderPresets();
  renderTabs();
  renderStage();
  renderMetrics();
  renderInspector();
  updateHistoryButtons();
  refreshPreview();
}

function afterChange(options: { inspector?: boolean } = {}): void {
  const doc = activeDoc();
  if (doc && !isReadOnly(doc)) doc.updatedAt = new Date().toISOString();
  scheduleSave();
  renderMapLists();
  renderObjects();
  renderPresets();
  renderStage();
  renderMetrics();
  refreshPreview();
  if (options.inspector) renderInspector();
}

function updateTransformInputs(): void {
  const object = selectedObject();
  if (!object) return;
  const groups: { prefix: string; values: Vec3; decimals: number }[] = [
    { prefix: 'position', values: object.position, decimals: 2 },
    { prefix: 'rotation', values: object.rotation, decimals: 2 },
    { prefix: 'scale', values: object.scale, decimals: 3 },
  ];
  for (const group of groups) {
    group.values.forEach((value, index) => {
      const input = inspectorBody.querySelector<HTMLInputElement>(
        `input[data-path="${group.prefix}.${index}"]`,
      );
      if (input && document.activeElement !== input) input.value = String(round(value, group.decimals));
    });
  }
}

// ---------------------------------------------------------------------------
// Inspector input handling
// ---------------------------------------------------------------------------

function applyInspectorValue(input: HTMLInputElement | HTMLSelectElement): boolean {
  const path = input.dataset.path;
  if (!path) return false;
  const doc = activeDoc();
  if (!doc) return false;
  if (isReadOnly(doc)) {
    showToast('Шаблон только для просмотра. Создайте копию, чтобы менять настройки.', 'warn');
    renderInspector();
    return false;
  }
  const target: Record<string, unknown> =
    tab === 'object' && selectedObject() ? (selectedObject() as unknown as Record<string, unknown>) : (doc as unknown as Record<string, unknown>);
  const type = input.dataset.type;
  let value: unknown;
  if (type === 'bool' && input instanceof HTMLInputElement) {
    value = input.checked;
  } else if (type === 'number') {
    if (input.value.trim() === '') return false;
    let number = Number(input.value);
    if (!Number.isFinite(number)) return false;
    const min = input instanceof HTMLInputElement && input.min !== '' ? Number(input.min) : -Infinity;
    const max = input instanceof HTMLInputElement && input.max !== '' ? Number(input.max) : Infinity;
    number = clamp(number, min, max);
    value = number;
  } else if (type === 'color') {
    if (!/^#[0-9a-f]{6}$/i.test(input.value)) return false;
    value = input.value.toLowerCase();
  } else {
    value = input.value;
  }

  const previousBase = path === 'base' ? doc.base : null;
  setByPath(target, path, value);

  if (path === 'name') {
    doc.theme.label = doc.name;
  }
  if (path === 'base' && previousBase) {
    const base = doc.base as MapBase;
    const previousLabel = doc.name;
    doc.theme = { ...cloneTheme(baseTheme(base)), label: previousLabel };
    // Keep the auto-generated subtitle in sync when it was not customised.
    const generated =
      doc.subtitle === baseSubtitle(previousBase) ||
      doc.subtitle.startsWith('На основе') ||
      doc.subtitle.startsWith('Копия шаблона');
    if (generated) doc.subtitle = baseSubtitle(base);
  }
  if (tab === 'object' && selectedObject() && path === 'locked') {
    emitSelection();
  }
  const rerenderInspector =
    path === 'base' ||
    path === 'animation.enabled' ||
    path.endsWith('.property') ||
    (input.dataset.type === 'bool' && path.startsWith('env.'));
  afterChange({ inspector: rerenderInspector });
  return true;
}

/** Group name/colour and object group membership use their own handlers. */
function applyRoleValue(input: HTMLInputElement | HTMLSelectElement): boolean {
  const role = input.dataset.role;
  if (!role) return false;
  const doc = activeDoc();
  if (!doc || isReadOnly(doc)) return false;

  if (role === 'object-group' && input instanceof HTMLSelectElement) {
    const current = selectedObjectId ? groupOfObject(doc, selectedObjectId) : null;
    if ((current?.id ?? '') === input.value) return true;
    assignObjectToGroup(selectedObjectId, input.value || null);
    return true;
  }

  const group = selectedGroupId ? doc.groups.find((entry) => entry.id === selectedGroupId) : null;
  if (!group) return false;

  if (role === 'group-name' && input instanceof HTMLInputElement) {
    const name = input.value.trim().slice(0, 48);
    if (!name) return false;
    group.name = name;
    afterChange();
    return true;
  }

  if (role === 'group-color') {
    if (!/^#[0-9a-f]{6}$/i.test(input.value)) return false;
    group.color = input.value.toLowerCase();
    afterChange();
    return true;
  }

  return false;
}

function assignObjectToGroup(objectId: string | null, groupId: string | null): void {
  const doc = activeDoc();
  if (!doc || !objectId || isReadOnly(doc)) return;
  const object = doc.objects.find((entry) => entry.id === objectId);
  if (!object) return;
  recordUndo();
  for (const group of doc.groups) {
    group.objectIds = group.objectIds.filter((id) => id !== objectId);
  }
  const target = groupId ? doc.groups.find((entry) => entry.id === groupId) : null;
  if (target) target.objectIds.push(objectId);
  syncGroups(doc);
  applySelection([objectId], objectId, target?.id ?? null);
  afterChange({ inspector: true });
  showToast(target ? `Объект добавлен в группу «${target.name}».` : 'Объект убран из группы.');
}

function syncPairedColor(input: HTMLInputElement | HTMLSelectElement): void {
  const isColor = input.dataset.type === 'color' || input.dataset.role === 'group-color';
  if (!isColor) return;
  const field = input.closest('.color-field');
  if (!field) return;
  field.querySelectorAll<HTMLInputElement>('input').forEach((other) => {
    if (other !== input && other.value !== input.value) other.value = input.value;
  });
}

inspectorBody.addEventListener('focusin', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) beginEdit();
});

inspectorBody.addEventListener('pointerdown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) beginEdit();
});

inspectorBody.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (applyRoleValue(target)) {
    syncPairedColor(target);
    return;
  }
  if (applyInspectorValue(target)) syncPairedColor(target);
});

inspectorBody.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (target.dataset.role) {
    if (applyRoleValue(target)) syncPairedColor(target);
    endEdit();
    return;
  }
  if (target.dataset.type === 'color' && !/^#[0-9a-f]{6}$/i.test(target.value)) {
    renderInspector();
    return;
  }
  if (applyInspectorValue(target)) syncPairedColor(target);
  endEdit();
});

inspectorBody.addEventListener('focusout', () => endEdit());

inspectorBody.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target as HTMLElement;
  if (target.closest('input, select, textarea, button')) return;
  const row = target.closest<HTMLElement>('[data-object-id]');
  if (!row?.dataset.objectId) return;
  event.preventDefault();
  selectObjectOnly(row.dataset.objectId);
});

inspectorBody.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const doc = activeDoc();

  const eye = target.closest<HTMLElement>('[data-object-eye]');
  if (eye?.dataset.objectEye) {
    toggleObjectFlag(eye.dataset.objectEye, 'visible');
    return;
  }
  const lock = target.closest<HTMLElement>('[data-object-lock]');
  if (lock?.dataset.objectLock) {
    toggleObjectFlag(lock.dataset.objectLock, 'locked');
    return;
  }
  const objectAction = target.closest<HTMLElement>('[data-object-action]');
  if (objectAction?.dataset.objectId) {
    const id = objectAction.dataset.objectId;
    if (objectAction.dataset.objectAction === 'duplicate') duplicateObject(id);
    else if (objectAction.dataset.objectAction === 'delete') deleteObjects([id]);
    else if (objectAction.dataset.objectAction === 'preset') {
      const object = doc?.objects.find((entry) => entry.id === id);
      if (object) saveObjectsAsPreset([object], object.name);
    }
    return;
  }
  const objectRow = target.closest<HTMLElement>('[data-object-id]');
  if (objectRow?.dataset.objectId) {
    selectObjectOnly(objectRow.dataset.objectId);
    return;
  }

  const action = target.closest<HTMLElement>('[data-action]');
  if (!action) return;
  switch (action.dataset.action) {
    case 'copy-template':
      if (doc && isBuiltinMapId(doc.id)) copyBuiltinMap(doc.id);
      break;
    case 'duplicate-object':
      if (selectedIds.length > 1) duplicateSelectedObjects();
      else duplicateObject();
      break;
    case 'delete-object':
      deleteSelectedObjects();
      break;
    case 'preset-selection':
      saveSelectionAsPreset();
      break;
    case 'create-group':
      createGroupFromSelection();
      break;
    case 'duplicate-selection':
      duplicateSelectedObjects();
      break;
    case 'duplicate-group':
      if (selectedGroupId) duplicateGroup(selectedGroupId);
      break;
    case 'dissolve-group':
      if (selectedGroupId) dissolveGroup(selectedGroupId);
      break;
    case 'delete-group':
      if (selectedGroupId) deleteGroupWithObjects(selectedGroupId);
      break;
    case 'focus-selection':
      focusSelection();
      break;
    case 'snap-selection':
      snapSelectedToGrid();
      break;
    case 'align-selection': {
      const axis = action.dataset.axis;
      if (axis === 'x' || axis === 'y' || axis === 'z') alignSelected(axis);
      break;
    }
    case 'nudge-selection': {
      const delta = (action.dataset.delta ?? '').split(',').map(Number);
      if (delta.length === 3 && delta.every((entry) => Number.isFinite(entry))) {
        nudgeObjects(selectedIds, [delta[0], delta[1], delta[2]]);
      }
      break;
    }
    case 'rotate-group': {
      const angle = Number(action.dataset.angle ?? 0);
      if (selectedGroupId && Number.isFinite(angle)) rotateGroup(selectedGroupId, angle);
      break;
    }
    case 'add-track': {
      const property = action.dataset.property as MapAnimProperty | undefined;
      if (property && MAP_ANIM_PROPERTIES.some((entry) => entry.value === property)) addAnimationTrack(property);
      break;
    }
    case 'delete-track':
      if (action.dataset.trackId) removeAnimationTrack(action.dataset.trackId);
      break;
    case 'anim-preset':
      if (action.dataset.preset) applyObjectAnimationPreset(action.dataset.preset);
      break;
    case 'focus-object':
      if (selectedObjectId) preview?.focusObject(selectedObjectId);
      break;
    case 'ground-object': {
      const object = selectedObject();
      if (object) {
        recordUndo();
        const onBoard = Math.abs(object.position[0]) <= 4 && Math.abs(object.position[2]) <= 4;
        const onIsland = !onBoard && activeDoc()?.base === 'none' && activeDoc()?.env.island.enabled;
        const surface = onBoard ? 0 : onIsland ? -1.15 : activeDoc()?.base === 'none' ? -0.3 : -1.15;
        object.position[1] = round(surface + (object.shape === 'plane' ? 0.01 : object.scale[1] / 2), 3);
        afterChange({ inspector: true });
      }
      break;
    }
    case 'reset-rotation': {
      const object = selectedObject();
      if (object) {
        recordUndo();
        object.rotation = [0, 0, 0];
        afterChange({ inspector: true });
      }
      break;
    }
    case 'center-object': {
      const object = selectedObject();
      if (object) {
        recordUndo();
        object.position[0] = 0;
        object.position[2] = 0;
        afterChange({ inspector: true });
      }
      break;
    }
    case 'delete-map':
      if (doc) deleteMap(doc.id);
      break;
    case 'env-preset': {
      const preset = action.dataset.preset;
      if (doc && preset) {
        recordUndo();
        applyEnvPreset(doc, preset);
        afterChange({ inspector: true });
      }
      break;
    }
    case 'add-surface': {
      if (doc) {
        recordUndo();
        const surface = createMapEnvSurface(action.dataset.shape === 'box' ? 'box' : 'disc');
        surface.position[1] = doc.base === 'none' && !doc.env.island.enabled ? -0.3 : -1.15;
        doc.env.surfaces.push(surface);
        afterChange({ inspector: true });
      }
      break;
    }
    case 'delete-surface': {
      if (doc) {
        const id = action.dataset.surfaceId;
        const index = doc.env.surfaces.findIndex((surface) => surface.id === id);
        if (index >= 0) {
          recordUndo();
          doc.env.surfaces.splice(index, 1);
          afterChange({ inspector: true });
        }
      }
      break;
    }
    default:
      break;
  }
});

// ---------------------------------------------------------------------------
// Left panel events
// ---------------------------------------------------------------------------

customMapList.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-map-action]');
  if (action) {
    const id = action.dataset.mapId;
    if (!id) return;
    if (action.dataset.mapAction === 'duplicate') duplicateMap(id);
    else if (action.dataset.mapAction === 'delete') deleteMap(id);
    return;
  }
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-map-id]');
  if (row?.dataset.mapId) selectMap(row.dataset.mapId);
});

builtinMapList.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-builtin-action]');
  if (action?.dataset.builtinId) {
    copyBuiltinMap(action.dataset.builtinId as BuiltinMapId);
    return;
  }
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-builtin-id]');
  if (row?.dataset.builtinId) selectMap(row.dataset.builtinId);
});

for (const list of [customMapList, builtinMapList]) {
  list.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-map-id], [data-builtin-id]');
    if (!row) return;
    event.preventDefault();
    const id = row.dataset.mapId ?? row.dataset.builtinId;
    if (id) selectMap(id);
  });
}

objectList.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const doc = activeDoc();

  const groupToggle = target.closest<HTMLElement>('[data-group-toggle]');
  if (groupToggle?.dataset.groupToggle) {
    const id = groupToggle.dataset.groupToggle;
    if (expandedGroups.has(id)) expandedGroups.delete(id);
    else expandedGroups.add(id);
    renderObjects();
    return;
  }

  const groupEye = target.closest<HTMLElement>('[data-group-eye]');
  if (groupEye?.dataset.groupEye) {
    const group = doc?.groups.find((entry) => entry.id === groupEye.dataset.groupEye);
    if (group) toggleManyObjectsFlag(group.objectIds, 'visible');
    return;
  }

  const groupLock = target.closest<HTMLElement>('[data-group-lock]');
  if (groupLock?.dataset.groupLock) {
    const group = doc?.groups.find((entry) => entry.id === groupLock.dataset.groupLock);
    if (group) toggleManyObjectsFlag(group.objectIds, 'locked');
    return;
  }

  const groupAction = target.closest<HTMLElement>('[data-group-action]');
  if (groupAction?.dataset.groupId) {
    const id = groupAction.dataset.groupId;
    switch (groupAction.dataset.groupAction) {
      case 'duplicate':
        duplicateGroup(id);
        break;
      case 'dissolve':
        dissolveGroup(id);
        break;
      case 'preset':
        {
          const group = doc?.groups.find((entry) => entry.id === id);
          if (group) {
            const members = group.objectIds
              .map((objectId) => doc?.objects.find((object) => object.id === objectId))
              .filter((object): object is MapObject => Boolean(object));
            saveObjectsAsPreset(members, group.name);
          }
        }
        break;
      default:
        break;
    }
    return;
  }

  const eye = target.closest<HTMLElement>('[data-object-eye]');
  if (eye?.dataset.objectEye) {
    toggleObjectFlag(eye.dataset.objectEye, 'visible');
    return;
  }
  const lock = target.closest<HTMLElement>('[data-object-lock]');
  if (lock?.dataset.objectLock) {
    toggleObjectFlag(lock.dataset.objectLock, 'locked');
    return;
  }
  const action = target.closest<HTMLElement>('[data-object-action]');
  if (action?.dataset.objectId) {
    const id = action.dataset.objectId;
    if (action.dataset.objectAction === 'duplicate') duplicateObject(id);
    else if (action.dataset.objectAction === 'delete') deleteObjects([id]);
    else if (action.dataset.objectAction === 'preset') {
      const object = doc?.objects.find((entry) => entry.id === id);
      if (object) saveObjectsAsPreset([object], object.name);
    }
    return;
  }

  const groupRow = target.closest<HTMLElement>('[data-group-id]');
  if (groupRow?.dataset.groupId) {
    selectGroup(groupRow.dataset.groupId);
    return;
  }

  const row = target.closest<HTMLElement>('[data-object-id]');
  if (row?.dataset.objectId) {
    selectObjectOnly(row.dataset.objectId, event.ctrlKey || event.metaKey || event.shiftKey);
  }
});

objectList.addEventListener('dblclick', (event) => {
  const target = event.target as HTMLElement;
  if (target.closest('[data-group-id]')) {
    const groupRow = target.closest<HTMLElement>('[data-group-id]');
    if (groupRow?.dataset.groupId) selectWholeGroup(groupRow.dataset.groupId);
    return;
  }
  const row = target.closest<HTMLElement>('[data-object-id]');
  if (row?.dataset.objectId) preview?.focusObject(row.dataset.objectId);
});

objectList.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target as HTMLElement;
  if (target.closest('button')) return;
  const groupRow = target.closest<HTMLElement>('[data-group-id]');
  if (groupRow?.dataset.groupId) {
    event.preventDefault();
    selectGroup(groupRow.dataset.groupId);
    return;
  }
  const row = target.closest<HTMLElement>('[data-object-id]');
  if (row?.dataset.objectId) {
    event.preventDefault();
    selectObjectOnly(row.dataset.objectId, event.ctrlKey || event.metaKey || event.shiftKey);
  }
});

presetList.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-preset-action]');
  if (action?.dataset.presetId) {
    const id = action.dataset.presetId;
    if (action.dataset.presetAction === 'insert') insertPreset(id);
    else if (action.dataset.presetAction === 'rename') renamePreset(id);
    else if (action.dataset.presetAction === 'delete') deletePreset(id);
    return;
  }
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-preset-id]');
  if (row?.dataset.presetId) insertPreset(row.dataset.presetId);
});

presetList.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-preset-id]');
  if (!row?.dataset.presetId) return;
  event.preventDefault();
  insertPreset(row.dataset.presetId);
});

byId('savePresetBtn').addEventListener('click', () => saveSelectionAsPreset());

objectSearch.addEventListener('input', () => {
  objectSearchQuery = objectSearch.value;
  renderObjects();
});

// ---------------------------------------------------------------------------
// Top / stage controls
// ---------------------------------------------------------------------------

document.querySelectorAll<HTMLElement>('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => setTab(button.dataset.tab === 'object' ? 'object' : 'map'));
});

document.querySelectorAll<HTMLElement>('[data-gizmo]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.gizmo;
    if (mode === 'move' || mode === 'rotate' || mode === 'scale') setGizmoMode(mode);
  });
});

shapePalette.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-shape]');
  if (!button?.dataset.shape) return;
  togglePlacement(button.dataset.shape as MapShape);
});

snapToggle.addEventListener('change', () => {
  snapEnabled = snapToggle.checked;
  preview?.setSnapping(snapEnabled, snapStep);
});

snapStepSelect.addEventListener('change', () => {
  snapStep = Number(snapStepSelect.value) || 0.25;
  preview?.setSnapping(snapEnabled, snapStep);
});

mapSearch.addEventListener('input', () => {
  searchQuery = mapSearch.value;
  renderMapLists();
});

byId('newMapBtn').addEventListener('click', () => createMap());
byId('clearSelectionBtn').addEventListener('click', () => selectObject(null));
focusObjectBtn.addEventListener('click', () => focusSelection());
byId('focusBoardBtn').addEventListener('click', () => preview?.focusBoard());
deleteObjectBtn.addEventListener('click', () => deleteSelectedObjects());
groupSelectionBtn.addEventListener('click', () => createGroupFromSelection());
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

function isFormTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

window.addEventListener('keydown', (event) => {
  if (isFormTarget(event.target)) {
    if (event.key === 'Escape') (event.target as HTMLElement).blur();
    return;
  }
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redo();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    duplicateSelectedObjects();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'g') {
    event.preventDefault();
    createGroupFromSelection();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    const doc = activeDoc();
    if (doc) applySelection(doc.objects.map((object) => object.id));
    return;
  }
  if (!modifier && !event.altKey) {
    const step = snapStep > 0 ? snapStep : 0.25;
    const nudge: Record<string, Vec3> = {
      arrowleft: [-step, 0, 0],
      arrowright: [step, 0, 0],
      arrowup: event.shiftKey ? [0, step, 0] : [0, 0, -step],
      arrowdown: event.shiftKey ? [0, -step, 0] : [0, 0, step],
    };
    const delta = nudge[event.key.toLowerCase()];
    if (delta && selectedIds.length > 0) {
      event.preventDefault();
      nudgeObjects(selectedIds, delta);
      return;
    }
  }
  switch (event.key.toLowerCase()) {
    case 'w':
      setGizmoMode('move');
      break;
    case 'e':
      setGizmoMode('rotate');
      break;
    case 'r':
      setGizmoMode('scale');
      break;
    case 'f':
      focusSelection();
      break;
    case 'delete':
    case 'backspace':
      if (selectedIds.length > 0) {
        event.preventDefault();
        deleteSelectedObjects();
      }
      break;
    case 'escape':
      if (placementShape) togglePlacement(placementShape);
      else selectObject(null);
      break;
    default:
      if (/^[1-7]$/.test(event.key)) {
        const shape = MAP_SHAPES[Number(event.key) - 1]?.value;
        if (shape) togglePlacement(shape);
      }
      break;
  }
});

// ---------------------------------------------------------------------------
// Publish / export / import
// ---------------------------------------------------------------------------

byId('applyBtn').addEventListener('click', async () => {
  flushSave();
  const button = byId<HTMLButtonElement>('applyBtn');
  const originalLabel = button.textContent ?? 'Применить в игру';
  button.disabled = true;
  button.textContent = 'Применяем…';
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = new URLSearchParams(location.search).get('mapsToken');
    if (token) headers['x-maps-token'] = token;
    const response = await fetch('/api/maps', {
      method: 'POST',
      headers,
      body: JSON.stringify({ maps: state.maps }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      maps?: number;
      persisted?: boolean;
      warning?: string;
    };
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
    const count = payload.maps ?? state.maps.length;
    showToast(
      count > 0
        ? `Карты применены: ${count}. Обновите страницу игры, чтобы увидеть их в списке.`
        : 'Карты применены: пользовательских карт нет.',
    );
    if (payload.persisted === false) {
      showToast(
        `Сервер применил карты, но не сохранил файл${payload.warning ? `: ${payload.warning}` : ''}. После перезапуска карты исчезнут.`,
        'warn',
      );
    }
  } catch (error) {
    showToast(
      `Не удалось применить карты: ${error instanceof Error ? error.message : 'сервер недоступен'}. Запустите npm run dev.`,
      'error',
    );
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
});

interface SaveFileHandle {
  name: string;
  createWritable(): Promise<{
    write(data: string | Blob): Promise<void>;
    close(): Promise<void>;
  }>;
}

type SaveFilePicker = (options?: {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<SaveFileHandle>;

function downloadJsonFile(payload: string, filename: string): void {
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function saveJsonFile(payload: string, filename: string): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (!picker) {
    downloadJsonFile(payload, filename);
    showToast('Браузер не умеет выбирать папку — файл скачан в папку загрузок.', 'warn');
    return;
  }
  try {
    const handle = await picker.call(window, {
      suggestedName: filename,
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(payload);
    await writable.close();
    showToast(`Сохранено: ${handle.name}`);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    downloadJsonFile(payload, filename);
    showToast(
      `Не удалось открыть выбор папки — файл скачан в папку загрузок.${
        error instanceof Error ? ` (${error.message})` : ''
      }`,
      'warn',
    );
  }
}

byId('exportBtn').addEventListener('click', async () => {
  flushSave();
  const payload = JSON.stringify(
    { version: 1, savedAt: new Date().toISOString(), maps: state.maps, presets: state.presets },
    null,
    2,
  );
  const date = new Date().toISOString().slice(0, 10);
  await saveJsonFile(payload, `auto-flow-maps-${date}.json`);
});

byId('importBtn').addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) {
    importFile.value = '';
    return;
  }
  try {
    // Read first: clearing the input before the async read aborts it in some Chromium builds.
    const text = await file.text();
    const raw = JSON.parse(text.replace(/^\uFEFF/, ''));
    const imported = normalizeImportedState(raw);
    if (imported.maps.length === 0) {
      showToast('В файле не найдено ни одной карты.', 'error');
      return;
    }
    if (state.maps.length > 0 && !window.confirm(`Импорт заменит текущие карты (${state.maps.length}). Продолжить?`)) {
      return;
    }
    const hasPresets = Boolean(raw && typeof raw === 'object' && Array.isArray((raw as { presets?: unknown }).presets));
    state.maps = imported.maps;
    if (hasPresets) state.presets = imported.presets;
    selectedMapId = imported.selectedId ?? imported.maps[0]?.id ?? null;
    selectedObjectId = null;
    selectedIds = [];
    selectedGroupId = null;
    presetInsertCount.clear();
    resetObjectSearch();
    resetHistory();
    refreshPreview();
    renderAll();
    flushSave();
    showToast(
      hasPresets
        ? `Импортировано карт: ${imported.maps.length}, пресетов: ${imported.presets.length}.`
        : `Импортировано карт: ${imported.maps.length}.`,
    );
  } catch (error) {
    console.error('Не удалось импортировать карты', error);
    showToast(
      `Не удалось прочитать JSON: ${error instanceof Error ? error.message : 'неизвестная ошибка'}. Проверьте формат файла.`,
      'error',
    );
  } finally {
    importFile.value = '';
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function seedMapsFromServer(): Promise<void> {
  try {
    const response = await fetch('/api/maps', { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as { maps?: unknown };
    if (!Array.isArray(payload.maps)) return;
    // The server is the source of truth: always replace local browser copies
    // with the maps that are actually active in the game.
    state.maps = normalizeMapList(payload.maps);
    saveState(state);
  } catch {
    // Offline editing still works with the local draft.
    showToast('Не удалось получить карты с сервера — используется локальная копия.', 'warn');
  }
}

async function boot(): Promise<void> {
  await seedMapsFromServer();
  if (state.maps.length === 0) {
    const doc = createEmptyMapDoc('none');
    doc.name = 'Моя карта';
    doc.subtitle = baseSubtitle('none');
    state.maps.push(doc);
    selectedMapId = doc.id;
    saveState(state);
  }
  if (!selectedMapId || (!state.maps.some((doc) => doc.id === selectedMapId) && !isBuiltinMapId(selectedMapId))) {
    selectedMapId = state.maps[0]?.id ?? 'jaddy';
  }
  preview?.setSnapping(snapEnabled, snapStep);
  renderAll();
  // The canvas stylesheet resolves after module evaluation, so grow the engine
  // buffer once the grid has its final size.
  window.requestAnimationFrame(() => preview?.resize());
}

window.addEventListener('beforeunload', () => flushSave());

void boot();
