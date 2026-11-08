import {
  BUILTIN_MAP_META,
  BUILTIN_MAP_THEMES,
  MAP_SHAPES,
  builtinTheme,
  createEmptyMapDoc,
  createMapObject,
  duplicateMapDoc,
  isBuiltinMapId,
  mapMeta,
  normalizeMapDoc,
  normalizeMapList,
  slugifyMapId,
  themeForDoc,
  type BuiltinMapId,
  type MapDoc,
  type MapObject,
  type MapShape,
  type MapTheme,
  type Vec3,
} from '../../../src/shared/maps';
import {
  escapeHtml,
  formatNumber,
  loadSavedState,
  normalizeImportedState,
  round,
  saveState,
  type MapLabState,
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
let tab: 'map' | 'object' = 'map';
let gizmoMode: GizmoMode = 'move';
let placementShape: MapShape | null = null;
let snapEnabled = true;
let snapStep = 0.25;
let searchQuery = '';
let builtinPreview: MapDoc | null = null;
let saveTimer: number | null = null;
let toastTimer: number | null = null;
let pendingSnapshot: string | null = null;
const undoStack: string[] = [];
const redoStack: string[] = [];

const canvas = byId<HTMLCanvasElement>('mapCanvas');
const customMapList = byId('customMapList');
const builtinMapList = byId('builtinMapList');
const mapCount = byId('mapCount');
const objectList = byId('objectList');
const objectEmpty = byId('objectEmpty');
const objectCount = byId('objectCount');
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

let preview: MapPreview | null = null;
try {
  preview = new MapPreview(canvas, {
    onSelect: (id) => selectObject(id),
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
        objects: [],
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
  doc.objects = restored.objects;
  doc.theme.label = doc.name;
  if (selectedObjectId && !doc.objects.some((object) => object.id === selectedObjectId)) selectedObjectId = null;
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

function selectMap(id: string): void {
  if (id === selectedMapId) return;
  selectedMapId = id;
  selectedObjectId = null;
  placementShape = null;
  tab = isBuiltinMapId(id) ? 'map' : 'map';
  resetHistory();
  preview?.setPlacement(null);
  refreshPreview();
  renderAll();
  flushSave();
}

function selectObject(id: string | null): void {
  if (id && !activeDoc()?.objects.some((object) => object.id === id)) id = null;
  if (selectedObjectId === id && (id ? tab === 'object' : true)) return;
  selectedObjectId = id;
  if (id) tab = 'object';
  renderObjects();
  renderInspector();
  renderStage();
  renderTabs();
  preview?.setSelection(id);
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
  tab = 'object';
  afterChange({ inspector: true });
  showToast(`Добавлен объект «${object.name}».`);
}

function deleteObject(id: string | null = selectedObjectId): void {
  const doc = activeDoc();
  if (!doc || !id || isReadOnly(doc)) return;
  const object = doc.objects.find((entry) => entry.id === id);
  if (!object) return;
  recordUndo();
  doc.objects = doc.objects.filter((entry) => entry.id !== id);
  if (selectedObjectId === id) selectedObjectId = null;
  afterChange({ inspector: true });
  showToast(`Объект «${object.name}» удалён.`);
}

function duplicateObject(id: string | null = selectedObjectId): void {
  const doc = activeDoc();
  if (!doc || !id || isReadOnly(doc)) return;
  const source = doc.objects.find((entry) => entry.id === id);
  if (!source) return;
  recordUndo();
  const object: MapObject = {
    ...source,
    id: `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: `${source.name} (копия)`,
    position: [source.position[0] + 1, source.position[1], source.position[2]],
    rotation: [...source.rotation],
    scale: [...source.scale],
  };
  doc.objects.push(object);
  selectedObjectId = object.id;
  tab = 'object';
  afterChange({ inspector: true });
  showToast('Объект продублирован.');
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

function createMap(base?: BuiltinMapId): void {
  const sourceDoc = activeDoc();
  const baseId: BuiltinMapId = base ?? (sourceDoc && isBuiltinMapId(sourceDoc.base) ? sourceDoc.base : sourceDoc?.base ?? 'jaddy');
  const doc = createEmptyMapDoc(baseId);
  const index = state.maps.length + 1;
  doc.name = index > 1 ? `Новая карта ${index}` : 'Новая карта';
  doc.subtitle = `На основе «${mapMeta(baseId).name}»`;
  state.maps.push(doc);
  selectedMapId = doc.id;
  selectedObjectId = null;
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
    resetHistory();
  }
  refreshPreview();
  renderAll();
  flushSave();
  showToast('Карта удалена.');
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

function renderObjects(): void {
  const doc = activeDoc();
  const objects = doc?.objects ?? [];
  objectCount.textContent = String(objects.length);
  objectEmpty.hidden = objects.length > 0;
  objectList.hidden = objects.length === 0;

  objectList.innerHTML = objects
    .map((object) => {
      const selected = object.id === selectedObjectId;
      return `
        <div class="object-row ${selected ? 'selected' : ''} ${object.visible ? '' : 'hidden'}"
          data-object-id="${escapeHtml(object.id)}" role="button" tabindex="0"
          style="--obj-color:${object.color};--obj-glow:${object.emissive === '#000000' ? object.color : object.emissive}">
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
            )}, ${formatNumber(object.position[2], 2)}</span>
          </span>
          <span class="map-row-actions">
            <button type="button" class="icon-mini" data-object-action="duplicate" data-object-id="${escapeHtml(
              object.id,
            )}" title="Дублировать объект">⧉</button>
            <button type="button" class="icon-mini danger" data-object-action="delete" data-object-id="${escapeHtml(
              object.id,
            )}" title="Удалить объект">×</button>
          </span>
        </div>`;
    })
    .join('');
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
  stageSub.textContent = `${doc.subtitle || meta.subtitle} · окружение «${meta.name}»`;
  hudName.textContent = doc.name;
  hudMeta.innerHTML = `
    <span class="meta-chip" style="--chip:${doc.theme.accent}">◈ ${escapeHtml(meta.name)}</span>
    <span class="meta-chip" style="--chip:${doc.theme.tiles.playerLight}">${doc.objects.length} объектов</span>
    <span class="meta-chip" style="--chip:${doc.theme.accent}">${readOnly ? 'только просмотр' : 'редактируется'}</span>`;
  hudBadge.textContent = readOnly ? 'Шаблон · просмотр' : 'Редактируется';
  hudBadge.className = `hud-badge ${readOnly ? 'builtin' : ''}`;
  renderSelectionHud();
  deleteObjectBtn.disabled = !selectedObjectId || readOnly;
  focusObjectBtn.disabled = !selectedObjectId;
  renderStageHint();
}

function renderSelectionHud(): void {
  const object = selectedObject();
  if (!object) {
    selectionHud.textContent = 'Ничего не выбрано';
    return;
  }
  selectionHud.textContent = `${object.name} · ${shapeLabel(object.shape)} · X ${formatNumber(object.position[0], 2)} / Y ${formatNumber(
    object.position[1],
    2,
  )} / Z ${formatNumber(object.position[2], 2)}`;
}

function renderStageHint(): void {
  if (placementShape) {
    stageHint.innerHTML = `<span class="stage-ability-label">Размещение</span><p>Кликните по доске, чтобы поставить «${escapeHtml(
      shapeLabel(placementShape),
    )}». Объект останется в палитре для быстрой расстановки; Esc — выход.</p>`;
    return;
  }
  if (selectedObject()) {
    stageHint.innerHTML =
      '<span class="stage-ability-label">Гизмо</span><p>W — двигать, E — вращать, R — масштаб, F — фокус, Ctrl+D — дублировать, Del — удалить. Привязка помогает ставить объекты ровно.</p>';
    return;
  }
  stageHint.innerHTML =
    '<span class="stage-ability-label">Совет</span><p>Выберите примитив в палитре, затем кликните по доске. Объекты выделяются кликом в сцене или в списке слева.</p>';
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
  metricStrip.innerHTML = [
    metricCard('Объекты', String(objects.length), 'примитивов на карте'),
    metricCard('Видимые', String(visible), 'участвуют в игре'),
    metricCard('Замки', String(locked), 'защищено от гизмо'),
    metricCard('Окружение', doc ? mapMeta(doc.base).name : '—', 'процедурная основа'),
    metricCard('Акцент', doc?.theme.accent ?? '—', 'цвет интерфейса'),
    metricCard('Карт', String(state.maps.length), 'в библиотеке'),
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

function renderMapInspector(doc: MapDoc): void {
  const readOnly = isReadOnly(doc);
  const theme = doc.theme;
  const baseOptions = BUILTIN_MAP_META.map((meta) => ({ value: meta.id, label: meta.name }));
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

function renderObjectInspector(doc: MapDoc): void {
  const object = selectedObject();
  const readOnly = isReadOnly(doc);
  if (!object) {
    inspectorBody.innerHTML = `
      <div class="inspector-title-row">
        <div><span class="eyebrow">Объект</span><h2>Ничего не выбрано</h2></div>
        <span class="count-pill">0</span>
      </div>
      <div class="tab-empty"><b>Выберите примитив</b>Кликните по объекту в сцене или в списке слева. Чтобы добавить новый, выберите форму в палитре под сценой.</div>`;
    return;
  }
  const disabled = readOnly || object.locked;
  const color = object.emissive === '#000000' ? object.color : object.emissive;
  inspectorBody.innerHTML = `
    <div class="inspector-title-row">
      <div><span class="eyebrow">Примитив</span><h2>${escapeHtml(object.name)}</h2></div>
      <span class="count-pill">${shapeLabel(object.shape)}</span>
    </div>

    <div class="object-hero" style="--obj-color:${object.color};--obj-glow:${color}">
      <span class="object-shape">${shapeGlyph(object.shape)}</span>
      <span class="object-hero-copy">
        <b>${escapeHtml(object.name)}</b>
        <small>${shapeLabel(object.shape)} · ${object.visible ? 'видим' : 'скрыт'}${object.locked ? ' · замок' : ''}</small>
      </span>
      <span class="hero-actions">
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

    ${
      readOnly
        ? '<div class="readonly-note" style="margin-top:10px"><b>Шаблон только для просмотра.</b>Создайте свою карту, чтобы редактировать объекты.</div>'
        : ''
    }
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
  } else {
    preview.setObjects([]);
    preview.setSelection(null);
  }
}

function renderAll(): void {
  renderMapLists();
  renderObjects();
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

  setByPath(target, path, value);

  if (path === 'name') {
    doc.theme.label = doc.name;
  }
  if (path === 'base') {
    const base = doc.base as BuiltinMapId;
    const previousLabel = doc.name;
    doc.theme = { ...cloneTheme(builtinTheme(base)), label: previousLabel };
  }
  if (tab === 'object' && selectedObject() && path === 'locked') {
    preview?.setSelection(selectedObjectId);
  }
  afterChange({ inspector: path === 'base' });
  return true;
}

function syncPairedColor(input: HTMLInputElement | HTMLSelectElement): void {
  if (input.dataset.type !== 'color') return;
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
  if (applyInspectorValue(target)) syncPairedColor(target);
});

inspectorBody.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (target.dataset.type === 'color' && !/^#[0-9a-f]{6}$/i.test(target.value)) {
    renderInspector();
    return;
  }
  if (applyInspectorValue(target)) syncPairedColor(target);
  endEdit();
});

inspectorBody.addEventListener('focusout', () => endEdit());

inspectorBody.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!action) return;
  const doc = activeDoc();
  switch (action.dataset.action) {
    case 'copy-template':
      if (doc && isBuiltinMapId(doc.id)) copyBuiltinMap(doc.id);
      break;
    case 'duplicate-object':
      duplicateObject();
      break;
    case 'delete-object':
      deleteObject();
      break;
    case 'focus-object':
      if (selectedObjectId) preview?.focusObject(selectedObjectId);
      break;
    case 'ground-object': {
      const object = selectedObject();
      if (object) {
        recordUndo();
        const onBoard = Math.abs(object.position[0]) <= 4 && Math.abs(object.position[2]) <= 4;
        const surface = onBoard ? 0 : -1.15;
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
  const eye = (event.target as HTMLElement).closest<HTMLElement>('[data-object-eye]');
  if (eye?.dataset.objectEye) {
    toggleObjectFlag(eye.dataset.objectEye, 'visible');
    return;
  }
  const lock = (event.target as HTMLElement).closest<HTMLElement>('[data-object-lock]');
  if (lock?.dataset.objectLock) {
    toggleObjectFlag(lock.dataset.objectLock, 'locked');
    return;
  }
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-object-action]');
  if (action?.dataset.objectId) {
    if (action.dataset.objectAction === 'duplicate') duplicateObject(action.dataset.objectId);
    else if (action.dataset.objectAction === 'delete') deleteObject(action.dataset.objectId);
    return;
  }
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-object-id]');
  if (row?.dataset.objectId) selectObject(row.dataset.objectId);
});

objectList.addEventListener('dblclick', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-object-id]');
  if (row?.dataset.objectId) preview?.focusObject(row.dataset.objectId);
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
focusObjectBtn.addEventListener('click', () => {
  if (selectedObjectId) preview?.focusObject(selectedObjectId);
});
byId('focusBoardBtn').addEventListener('click', () => preview?.focusBoard());
deleteObjectBtn.addEventListener('click', () => deleteObject());
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
    if (selectedObjectId) duplicateObject();
    return;
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
      if (selectedObjectId) preview?.focusObject(selectedObjectId);
      else preview?.focusBoard();
      break;
    case 'delete':
    case 'backspace':
      if (selectedObjectId) {
        event.preventDefault();
        deleteObject();
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
  const payload = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), maps: state.maps }, null, 2);
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
    state.maps = imported.maps;
    selectedMapId = imported.selectedId ?? imported.maps[0]?.id ?? null;
    selectedObjectId = null;
    resetHistory();
    refreshPreview();
    renderAll();
    flushSave();
    showToast(`Импортировано карт: ${imported.maps.length}.`);
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
  if (state.maps.length > 0) return;
  try {
    const response = await fetch('/api/maps', { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as { maps?: unknown };
    const maps = normalizeMapList(payload.maps);
    if (maps.length === 0) return;
    state.maps = maps;
    selectedMapId = maps[0].id;
    saveState(state);
  } catch {
    // Offline editing still works with localStorage drafts.
  }
}

async function boot(): Promise<void> {
  await seedMapsFromServer();
  if (state.maps.length === 0) {
    const doc = createEmptyMapDoc('jaddy');
    doc.name = 'Моя карта';
    doc.subtitle = 'На основе «Jaddy Forest»';
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
