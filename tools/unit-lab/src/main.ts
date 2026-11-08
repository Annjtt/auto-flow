import { traitIcon } from '../../../src/client/icons';
import { UNIT_BY_ID, UNITS } from '../../../src/shared/content';
import {
  CLASS_NAMES,
  RACE_NAMES,
  type AbilityKind,
  type Race,
  type UnitClass,
  type UnitDef,
} from '../../../src/shared/types';
import {
  ABILITY_FIELDS,
  ABILITY_GLYPHS,
  ABILITY_KIND_NAMES,
  ANIMATION_SLIDERS,
  PART_SHAPE_OPTIONS,
  STAT_FIELDS,
  abilityDescriptionAtStar,
  createCustomPart,
  createDefaultAnimation,
  createDefaultEntry,
  createDefaultModel,
  createDefaultState,
  deriveStats,
  escapeHtml,
  formatNumber,
  isPartModified,
  loadSavedState,
  mechanicSections,
  modifiedUnitIds,
  nextCustomPartKey,
  normalizeImportedState,
  partOrDefault,
  round,
  saveState,
  unitDefFromEntry,
} from './labData';
import type { LabMode, UnitLabEntry } from './labTypes';
import { UnitPreview } from './labPreview';

const RACE_COLORS: Record<Race, string> = {
  human: '#f0c46a',
  undead: '#7ee6a4',
  mech: '#7cd8ff',
  beast: '#e0a260',
  demon: '#ff7a5a',
  elf: '#b8e58a',
};

const CLASS_COLORS: Record<UnitClass, string> = {
  warrior: '#9db7d8',
  mage: '#b18cff',
  hunter: '#8fe0a0',
  assassin: '#ff8a9a',
};

const ABILITY_KINDS: AbilityKind[] = ['nuke', 'aoe', 'heal', 'shield', 'stun', 'buff', 'chain', 'drain'];
const RACES: Race[] = ['human', 'undead', 'mech', 'beast', 'demon', 'elf'];
const CLASSES: UnitClass[] = ['warrior', 'mage', 'hunter', 'assassin'];
const ATTACK_STYLES = [
  { value: 'melee', label: 'Ближний бой' },
  { value: 'ranged', label: 'Стрельба' },
  { value: 'magic', label: 'Магия' },
  { value: 'beast', label: 'Зверь' },
];

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function selectedDef(): UnitDef {
  return UNIT_BY_ID[selectedId];
}

function selectedEntry(): UnitLabEntry {
  return state.units[selectedId];
}

function decimalPlaces(step: number): number {
  if (!Number.isFinite(step) || step >= 1) return 0;
  const text = step.toString();
  return text.includes('.') ? text.split('.')[1].length : 0;
}

function valueForPath(entry: UnitLabEntry, path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = entry;
  for (const part of parts) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function setValueForPath(entry: UnitLabEntry, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = entry as unknown as Record<string, unknown>;
  for (let index = 0; index < parts.length - 1; index++) {
    const key = parts[index];
    const next = cursor[key];
    if (next === null || typeof next !== 'object') cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

function partValue(entry: UnitLabEntry, key: string, field: string): number | boolean {
  const part = entry.model.parts[key];
  if (!part) {
    if (field === 'visible') return true;
    if (field === 'sx' || field === 'sy' || field === 'sz') return 1;
    return 0;
  }
  return part[field as 'visible' | 'px' | 'py' | 'pz' | 'rx' | 'ry' | 'rz' | 'sx' | 'sy' | 'sz'];
}

function ensurePart(entry: UnitLabEntry, key: string): void {
  partOrDefault(entry, key);
}

function prunePart(entry: UnitLabEntry, key: string): void {
  const part = entry.model.parts[key];
  if (part && !isPartModified(part)) delete entry.model.parts[key];
}

function inputNumber(path: string, label: string, value: number, min: number, max: number, step: number, unit = ''): string {
  const decimals = decimalPlaces(step);
  const display = round(value, decimals);
  return `
    <div class="control-row" data-control="${escapeHtml(path)}">
      <div class="control-head">
        <label for="ctl-${escapeHtml(path)}">${escapeHtml(label)}</label>
        <output data-readout-path="${escapeHtml(path)}" data-unit="${escapeHtml(unit)}">${formatNumber(display, decimals)}</output>
      </div>
      <div class="control-inputs">
        <input id="ctl-${escapeHtml(path)}" class="range" type="range" min="${min}" max="${max}" step="${step}"
          value="${value}" data-path="${escapeHtml(path)}" data-type="number" />
        <input class="num" type="number" min="${min}" max="${max}" step="${step}"
          value="${display}" data-path="${escapeHtml(path)}" data-type="number" />
      </div>
    </div>`;
}

function sliderOnly(path: string, label: string, value: number, min: number, max: number, step: number, unit = ''): string {
  const decimals = decimalPlaces(step);
  return `
    <div class="control-row compact" data-control="${escapeHtml(path)}">
      <div class="control-head">
        <label for="ctl-${escapeHtml(path)}">${escapeHtml(label)}</label>
        <output data-readout-path="${escapeHtml(path)}" data-unit="${escapeHtml(unit)}">${formatNumber(
          round(value, decimals),
          decimals,
        )}</output>
      </div>
      <input id="ctl-${escapeHtml(path)}" class="range full" type="range" min="${min}" max="${max}" step="${step}"
        value="${value}" data-path="${escapeHtml(path)}" data-type="number" />
    </div>`;
}

function selectField(path: string, label: string, value: string, options: { value: string; label: string }[]): string {
  return `
    <label class="select-field">
      <span>${escapeHtml(label)}</span>
      <select data-path="${escapeHtml(path)}" data-type="string" ${path.startsWith('stats.race') || path.startsWith('stats.unitClass') || path.startsWith('stats.ability.kind') ? 'data-rerender="1"' : ''}>
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>`;
}

function colorField(path: string, label: string, value: string): string {
  return `
    <div class="color-field">
      <label><span>${escapeHtml(label)}</span><input type="color" value="${value}" data-path="${escapeHtml(path)}" data-type="color" /></label>
      <input class="hex" type="text" value="${value}" maxlength="7" spellcheck="false" data-path="${escapeHtml(path)}" data-type="color" />
    </div>`;
}

let state = loadSavedState();
let selectedId = UNITS[0].id;
let mode: LabMode = 'balance';
let star = 1;
let selectedPart: string | null = null;
let searchQuery = '';
let raceFilter: Race | 'all' = 'all';
let classFilter: UnitClass | 'all' = 'all';
let autoFight = false;
let paused = false;
let turntable = true;
let saveTimer: number | null = null;
let toastTimer: number | null = null;

const canvas = byId<HTMLCanvasElement>('previewCanvas');
const rosterList = byId('rosterList');
const rosterCount = byId('rosterCount');
const raceFilters = byId('raceFilters');
const classFilters = byId('classFilters');
const searchInput = byId<HTMLInputElement>('searchInput');
const inspector = byId('inspector');
const metricStrip = byId('metricStrip');
const stageTitle = byId('stageTitle');
const stageEyebrow = byId('stageEyebrow');
const hudName = byId('hudName');
const hudMeta = byId('hudMeta');
const hudAbility = byId('hudAbility');
const hudFlavor = byId('hudFlavor');
const stageAbility = byId('stageAbility');
const saveStateLabel = byId('saveStateLabel');
const toast = byId('toast');
const importFile = byId<HTMLInputElement>('importFile');
const timelineAttack = byId('timelineAttack');
const timelineCast = byId('timelineCast');
const playState = byId('playState');
const modifiedCount = byId('modifiedCount');

let preview: UnitPreview | null = null;
try {
  preview = new UnitPreview(canvas);
} catch (error) {
  const wrap = canvas.parentElement;
  if (wrap) {
    wrap.innerHTML = `<div class="preview-error"><b>WebGL недоступен</b><span>${escapeHtml(
      error instanceof Error ? error.message : 'Не удалось запустить 3D-превью.',
    )}</span></div>`;
  }
}

function showToast(message: string, kind: 'ok' | 'warn' | 'error' = 'ok'): void {
  toast.textContent = message;
  toast.className = `toast show ${kind}`;
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.className = 'toast';
  }, 2600);
}

function markSaved(): void {
  saveState(state);
  const time = new Date(state.savedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  saveStateLabel.textContent = `Автосохранение · ${time}`;
  saveStateLabel.dataset.state = 'saved';
  renderRoster();
  updateModifiedCount();
}

function scheduleSave(): void {
  saveStateLabel.textContent = 'Есть несохранённые изменения…';
  saveStateLabel.dataset.state = 'dirty';
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    markSaved();
  }, 380);
}

function flushSave(): void {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
    markSaved();
  }
}

function renderFilterChips(): void {
  raceFilters.innerHTML = [
    `<button type="button" class="chip ${raceFilter === 'all' ? 'active' : ''}" data-filter-race="all">Все</button>`,
    ...RACES.map(
      (race) =>
        `<button type="button" class="chip ${raceFilter === race ? 'active' : ''}" data-filter-race="${race}" style="--chip:${RACE_COLORS[race]}">${escapeHtml(
          RACE_NAMES[race],
        )}</button>`,
    ),
  ].join('');
  classFilters.innerHTML = [
    `<button type="button" class="chip ${classFilter === 'all' ? 'active' : ''}" data-filter-class="all">Все</button>`,
    ...CLASSES.map(
      (unitClass) =>
        `<button type="button" class="chip ${classFilter === unitClass ? 'active' : ''}" data-filter-class="${unitClass}" style="--chip:${CLASS_COLORS[unitClass]}">${escapeHtml(
          CLASS_NAMES[unitClass],
        )}</button>`,
    ),
  ].join('');
}

function filteredUnits(): UnitDef[] {
  const query = searchQuery.trim().toLowerCase();
  return UNITS.filter((def) => {
    const entry = state.units[def.id];
    const stats = entry.stats;
    if (raceFilter !== 'all' && stats.race !== raceFilter) return false;
    if (classFilter !== 'all' && stats.unitClass !== classFilter) return false;
    if (!query) return true;
    return (
      stats.name.toLowerCase().includes(query) ||
      stats.ability.name.toLowerCase().includes(query) ||
      def.id.toLowerCase().includes(query) ||
      stats.flavor.toLowerCase().includes(query) ||
      RACE_NAMES[stats.race].toLowerCase().includes(query) ||
      CLASS_NAMES[stats.unitClass].toLowerCase().includes(query)
    );
  });
}

function renderRoster(): void {
  const list = filteredUnits();
  const modified = modifiedUnitIds(state);
  rosterCount.textContent = `${list.length} / ${UNITS.length}`;
  if (list.length === 0) {
    rosterList.innerHTML = `<div class="roster-empty">Ничего не найдено.<br /><small>Сбросьте фильтры или измените запрос.</small></div>`;
    return;
  }
  rosterList.innerHTML = list
    .map((def) => {
      const entry = state.units[def.id];
      const stats = entry.stats;
      const isSelected = def.id === selectedId;
      const isModified = modified.has(def.id);
      return `
        <button type="button" class="unit-row ${isSelected ? 'selected' : ''} ${isModified ? 'modified' : ''}"
          data-unit-id="${def.id}"
          style="--race:${RACE_COLORS[stats.race]};--class:${CLASS_COLORS[stats.unitClass]};--body:${entry.model.palette.body};--accent:${entry.model.palette.accent};--glow:${entry.model.palette.glow}">
          <span class="cost-gem"><b>${formatNumber(stats.cost)}</b></span>
          <span class="unit-swatch"><i></i></span>
          <span class="unit-copy">
            <b>${escapeHtml(stats.name)}</b>
            <small>${escapeHtml(RACE_NAMES[stats.race])} · ${escapeHtml(CLASS_NAMES[stats.unitClass])}</small>
          </span>
          <span class="unit-badges">
            <span class="mini-ability" title="${escapeHtml(stats.ability.name)}">${ABILITY_GLYPHS[stats.ability.kind]}</span>
            ${isModified ? '<i class="modified-dot" title="Изменено"></i>' : ''}
          </span>
        </button>`;
    })
    .join('');
}

function updateModifiedCount(): void {
  const count = modifiedUnitIds(state).size;
  modifiedCount.textContent = count > 0 ? `${count} изменено` : 'Всё по умолчанию';
  modifiedCount.dataset.state = count > 0 ? 'modified' : 'default';
}

function renderStageHud(): void {
  const entry = selectedEntry();
  const stats = entry.stats;
  stageEyebrow.textContent =
    mode === 'balance' ? 'Баланс и механика' : mode === 'model' ? 'Редактор модели' : 'Редактор анимации';
  stageTitle.textContent = mode === 'balance' ? 'Инструмент настройки юнитов' : 'Unit Lab / Preview';
  hudName.textContent = stats.name;
  hudMeta.innerHTML = `
    <span class="meta-chip" style="--chip:${RACE_COLORS[stats.race]}">${traitIcon(stats.race)}${escapeHtml(
      RACE_NAMES[stats.race],
    )}</span>
    <span class="meta-chip" style="--chip:${CLASS_COLORS[stats.unitClass]}">${traitIcon(stats.unitClass)}${escapeHtml(
      CLASS_NAMES[stats.unitClass],
    )}</span>
    <span class="meta-dot">·</span>
    <span class="meta-text">${formatNumber(stats.cost)} золота</span>
    <span class="meta-dot">·</span>
    <span class="meta-text">${formatNumber(stats.range)} кл.</span>`;
  hudAbility.innerHTML = `
    <span class="ability-glyph" style="--glow:${entry.model.palette.glow}">${ABILITY_GLYPHS[stats.ability.kind]}</span>
    <span><b>${escapeHtml(stats.ability.name)}</b><small>${escapeHtml(
      ABILITY_KIND_NAMES[stats.ability.kind],
    )} · ${formatNumber(stats.ability.power)}</small></span>`;
  hudFlavor.textContent = stats.flavor;
  stageAbility.innerHTML = `
    <span class="stage-ability-label">Способность</span>
    <p>${escapeHtml(abilityDescriptionAtStar(entry, star))}</p>`;
  document.querySelectorAll<HTMLElement>('[data-star]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.star) === star);
  });
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
}

function metricCard(label: string, value: string, hint: string): string {
  return `<div class="metric-card"><span>${escapeHtml(label)}</span><b>${value}</b><small>${escapeHtml(hint)}</small></div>`;
}

function renderMetrics(): void {
  const entry = selectedEntry();
  const derived = deriveStats(entry);
  metricStrip.innerHTML = [
    metricCard('DPS', formatNumber(derived.rawDps, 1), `интервал ${formatNumber(derived.attackInterval, 2)} с`),
    metricCard('DPS vs 10 брони', formatNumber(derived.dpsVs10Armor, 1), 'базовые атаки'),
    metricCard('Эффективное HP', formatNumber(derived.effectiveHp), `−${formatNumber(derived.mitigation * 100, 1)}% урона`),
    metricCard('Атак до каста', formatNumber(derived.attacksToCast), `${formatNumber(derived.secondsToCast, 1)} с`),
    metricCard('Способность', formatNumber(entry.stats.ability.power), `2★ ${formatNumber(derived.power2)} · 3★ ${formatNumber(derived.power3)}`),
    metricCard('Цена', `${formatNumber(entry.stats.cost)}`, 'золота в магазине'),
  ].join('');
}

function renderIdentitySection(entry: UnitLabEntry): string {
  const stats = entry.stats;
  return `
    <section class="panel-section">
      <header class="section-head"><span>Идентичность</span><small>01</small></header>
      <div class="field-grid two">
        <label class="text-field span-2"><span>Название</span><input type="text" maxlength="40" value="${escapeHtml(
          stats.name,
        )}" data-path="stats.name" data-type="string" /></label>
        ${selectField(
          'stats.race',
          'Раса',
          stats.race,
          RACES.map((race) => ({ value: race, label: RACE_NAMES[race] })),
        )}
        ${selectField(
          'stats.unitClass',
          'Класс',
          stats.unitClass,
          CLASSES.map((unitClass) => ({ value: unitClass, label: CLASS_NAMES[unitClass] })),
        )}
      </div>
      <div class="field-grid two">
        <label class="text-field"><span>Стоимость</span>
          <select data-path="stats.cost" data-type="number">
            ${[1, 2, 3, 4, 5]
              .map((cost) => `<option value="${cost}" ${Math.round(stats.cost) === cost ? 'selected' : ''}>${cost} золота</option>`)
              .join('')}
          </select>
        </label>
        <label class="text-field"><span>Флейвор</span><input type="text" maxlength="160" value="${escapeHtml(
          stats.flavor,
        )}" data-path="stats.flavor" data-type="string" /></label>
      </div>
    </section>`;
}

function renderStatsSection(entry: UnitLabEntry): string {
  return `
    <section class="panel-section">
      <header class="section-head"><span>Характеристики</span><small>02</small></header>
      <div class="controls">
        ${STAT_FIELDS.map((field) =>
          inputNumber(
            field.path,
            field.label,
            valueForPath(entry, field.path) as number,
            field.min,
            field.max,
            field.step,
            field.unit,
          ),
        ).join('')}
      </div>
    </section>`;
}

function abilitySecondaryField(entry: UnitLabEntry): string {
  const ability = entry.stats.ability;
  if (ability.kind === 'heal') {
    return `
      <label class="text-field span-2"><span>Цели лечения</span>
        <select data-path="stats.ability.secondary" data-type="number" data-rerender="1">
          <option value="1" ${ability.secondary === 1 ? 'selected' : ''}>Только себе (secondary = 1)</option>
          <option value="0" ${ability.secondary === 0 ? 'selected' : ''}>Самый раненый союзник (secondary = 0)</option>
          <option value="99" ${ability.secondary === 99 ? 'selected' : ''}>Все союзники (secondary = 99)</option>
        </select>
      </label>`;
  }
  if (ability.kind === 'shield') {
    const starweaver = entry.id === 'starweaver';
    return inputNumber(
      'stats.ability.secondary',
      starweaver ? 'Размер щита (secondary)' : 'Целей щита',
      ability.secondary,
      starweaver ? 0 : 1,
      starweaver ? 999 : 99,
      1,
      '',
    );
  }
  if (ability.kind === 'chain') {
    return inputNumber('stats.ability.secondary', 'Целей цепи', ability.secondary, 1, 8, 1, '');
  }
  return '';
}

function renderAbilitySection(entry: UnitLabEntry): string {
  const ability = entry.stats.ability;
  const starweaver = entry.id === 'starweaver';
  const showRadius = ability.kind === 'aoe';
  const showDuration = ability.kind === 'aoe' || ability.kind === 'stun' || ability.kind === 'buff';
  const showSecondary = ability.kind === 'heal' || ability.kind === 'shield' || ability.kind === 'chain';
  const powerField = ABILITY_FIELDS[0];
  const radiusField = ABILITY_FIELDS[1];
  const durationField = ABILITY_FIELDS[2];
  return `
    <section class="panel-section">
      <header class="section-head"><span>Способность</span><small>03</small></header>
      <div class="field-grid two">
        <label class="text-field span-2"><span>Название способности</span>
          <input type="text" maxlength="60" value="${escapeHtml(ability.name)}" data-path="stats.ability.name" data-type="string" />
        </label>
        ${selectField(
          'stats.ability.kind',
          'Тип',
          ability.kind,
          ABILITY_KINDS.map((kind) => ({ value: kind, label: ABILITY_KIND_NAMES[kind] })),
        )}
      </div>
      <div class="controls">
        ${inputNumber(
          powerField.path,
          starweaver ? 'Сила урона' : powerField.label,
          ability.power,
          powerField.min,
          powerField.max,
          powerField.step,
          '',
        )}
        ${showRadius ? inputNumber(radiusField.path, radiusField.label, ability.radius, radiusField.min, radiusField.max, radiusField.step, radiusField.unit) : ''}
        ${showDuration ? inputNumber(durationField.path, durationField.label, ability.duration, durationField.min, durationField.max, durationField.step, durationField.unit) : ''}
      </div>
      ${showSecondary ? `<div class="controls">${abilitySecondaryField(entry)}</div>` : ''}
      <div class="ability-preview-box">
        <span>Автоматическое описание</span>
        <p data-readout="ability-description">${escapeHtml(abilityDescriptionAtStar(entry, star))}</p>
        <small>Описание пересобирается из полей силы, радиуса, длительности и второго параметра.</small>
      </div>
    </section>`;
}

function renderDerivedContent(entry: UnitLabEntry): string {
  const derived = deriveStats(entry);
  const ability = entry.stats.ability;
  return `
    <div class="derived-grid">
      <div><span>Интервал атаки</span><b>${formatNumber(derived.attackInterval, 2)} с</b></div>
      <div><span>Снижение бронёй</span><b>${formatNumber(derived.mitigation * 100, 1)}%</b></div>
      <div><span>Старт маны</span><b>${formatNumber(derived.startMana)}</b></div>
      <div><span>Атак до каста</span><b>${formatNumber(derived.attacksToCast)}</b></div>
      <div><span>Время до каста</span><b>${formatNumber(derived.secondsToCast, 1)} с</b></div>
      <div><span>Урон за ману</span><b>${formatNumber(derived.abilityPerMana, 2)}</b></div>
    </div>
    <div class="star-table">
      <div class="star-table-head"><span>Звезда</span><span>HP</span><span>Атака</span><span>Способность</span></div>
      <div><b>1★</b><span>${formatNumber(entry.stats.hp)}</span><span>${formatNumber(entry.stats.attack)}</span><span>${formatNumber(ability.power)}</span></div>
      <div><b>2★</b><span>${formatNumber(derived.hp2)}</span><span>${formatNumber(derived.attack2)}</span><span>${formatNumber(
        derived.power2,
      )}</span></div>
      <div><b>3★</b><span>${formatNumber(derived.hp3)}</span><span>${formatNumber(derived.attack3)}</span><span>${formatNumber(
        derived.power3,
      )}</span></div>
    </div>`;
}

function renderMechanicsContent(entry: UnitLabEntry): string {
  return mechanicSections(entry)
    .map(
      (section, index) => `
        <details class="mech-section" ${index < 2 ? 'open' : ''}>
          <summary><span>${escapeHtml(section.title)}</span><i></i></summary>
          <div class="mech-body">${section.html}</div>
        </details>`,
    )
    .join('');
}

function renderBalanceInspector(entry: UnitLabEntry): string {
  return `
    ${renderIdentitySection(entry)}
    ${renderStatsSection(entry)}
    ${renderAbilitySection(entry)}
    <section class="panel-section">
      <header class="section-head"><span>Расчёт баланса</span><small>04</small></header>
      <div id="derivedContent" data-readout-region="derived">${renderDerivedContent(entry)}</div>
    </section>
    <section class="panel-section mechanics-panel">
      <header class="section-head"><span>Полная механика</span><small>05</small></header>
      <div id="mechanicsContent" data-readout-region="mechanics">${renderMechanicsContent(entry)}</div>
    </section>`;
}

function renderModelInspector(entry: UnitLabEntry): string {
  const model = entry.model;
  const parts = preview?.getParts() ?? [];
  if (selectedPart && !parts.some((part) => part.key === selectedPart)) selectedPart = null;
  const part = selectedPart;
  const partData = part ? entry.model.parts[part] : undefined;
  return `
    <section class="panel-section">
      <header class="section-head"><span>Палитра</span><small>01</small></header>
      <div class="color-fields">
        ${colorField('model.palette.body', 'Корпус', model.palette.body)}
        ${colorField('model.palette.accent', 'Акцент', model.palette.accent)}
        ${colorField('model.palette.glow', 'Свечение', model.palette.glow)}
      </div>
      <p class="section-hint">Цвета применяются к материалам модели в реальном времени. Свечение влияет на rim-light и GlowLayer.</p>
    </section>
    <section class="panel-section">
      <header class="section-head"><span>Трансформ</span><small>02</small></header>
      <div class="controls">
        ${inputNumber('model.scale', 'Масштаб', model.scale, 0.2, 3, 0.01, '×')}
        ${inputNumber('model.hover', 'Высота парения', model.hover, -0.5, 1, 0.01, '')}
        ${inputNumber('model.yaw', 'Поворот модели', model.yaw, -180, 180, 1, '°')}
      </div>
    </section>
    <section class="panel-section">
      <header class="section-head"><span>Части модели</span><small>${parts.length}</small></header>
      <p class="section-hint">Нажмите на часть, чтобы сместить, повернуть или масштабировать её. Иконка глаза скрывает часть. Кнопка ниже добавляет собственный примитив.</p>
      <button type="button" class="btn small full parts-add" data-action="add-part">+ Добавить примитив</button>
      <div class="parts-list">
        ${parts
          .map((item) => {
            const override = entry.model.parts[item.key];
            const visible = override ? override.visible : true;
            const custom = Boolean(override?.shape);
            return `
              <div class="part-row ${part === item.key ? 'selected' : ''} ${override && isPartModified(override) ? 'modified' : ''}" data-part="${escapeHtml(
                item.key,
              )}">
                <button type="button" class="part-eye ${visible ? '' : 'off'}" data-part-toggle="${escapeHtml(item.key)}" title="${
                  visible ? 'Скрыть часть' : 'Показать часть'
                }">${visible ? '◉' : '○'}</button>
                <span class="part-name">${escapeHtml(item.label)}${custom ? ' · добавочная' : ''}</span>
                ${
                  custom
                    ? `<button type="button" class="part-remove" data-part-remove="${escapeHtml(
                        item.key,
                      )}" title="Удалить примитив">×</button>`
                    : `<code>${escapeHtml(item.key)}</code>`
                }
              </div>`;
          })
          .join('')}
      </div>
    </section>
    ${
      part
        ? `<section class="panel-section part-editor">
            <header class="section-head"><span>${escapeHtml(
              parts.find((item) => item.key === part)?.label ?? part,
            )}</span><small>${escapeHtml(part)}</small></header>
            ${
              partData?.shape
                ? `<div class="field-grid two custom-part-fields">
                    ${selectField('model.parts.' + part + '.shape', 'Примитив', partData.shape, PART_SHAPE_OPTIONS)}
                    ${colorField('model.parts.' + part + '.color', 'Цвет', partData.color ?? model.palette.accent)}
                    <div class="part-axis-group span-2"><span>Размер</span>
                      <div class="triple">
                        ${partNumber('model.parts.' + part + '.width', 'Ш', partData.width ?? 0.2, 0.01, 5, 0.01)}
                        ${partNumber('model.parts.' + part + '.height', 'В', partData.height ?? 0.2, 0.01, 5, 0.01)}
                        ${partNumber('model.parts.' + part + '.depth', 'Г', partData.depth ?? 0.2, 0.01, 5, 0.01)}
                      </div>
                    </div>
                    <label class="check-field span-2">
                      <input type="checkbox" data-path="${escapeHtml('model.parts.' + part + '.glow')}" data-type="boolean" ${
                        partData.glow ? 'checked' : ''
                      } />
                      <span>
                        <b>Свечение</b>
                        <small>Материал начинает светиться и попадает в GlowLayer, как авторские акцентные детали.</small>
                      </span>
                    </label>
                    <p class="section-hint span-2">Ширина — диаметр для сферы, цилиндра, конуса и тора. Глубина — толщина тора. Высота не используется тором.</p>
                  </div>`
                : ''
            }
            <div class="part-axis-group"><span>Позиция</span>
              <div class="triple">
                ${partNumber('model.parts.' + part + '.px', 'X', partValue(entry, part, 'px') as number, -3, 3, 0.01)}
                ${partNumber('model.parts.' + part + '.py', 'Y', partValue(entry, part, 'py') as number, -3, 3, 0.01)}
                ${partNumber('model.parts.' + part + '.pz', 'Z', partValue(entry, part, 'pz') as number, -3, 3, 0.01)}
              </div>
            </div>
            <div class="part-axis-group"><span>Поворот, °</span>
              <div class="triple">
                ${partNumber('model.parts.' + part + '.rx', 'X', partValue(entry, part, 'rx') as number, -720, 720, 1)}
                ${partNumber('model.parts.' + part + '.ry', 'Y', partValue(entry, part, 'ry') as number, -720, 720, 1)}
                ${partNumber('model.parts.' + part + '.rz', 'Z', partValue(entry, part, 'rz') as number, -720, 720, 1)}
              </div>
            </div>
            <div class="part-axis-group"><span>Масштаб</span>
              <div class="triple">
                ${partNumber('model.parts.' + part + '.sx', 'X', partValue(entry, part, 'sx') as number, 0.05, 5, 0.01)}
                ${partNumber('model.parts.' + part + '.sy', 'Y', partValue(entry, part, 'sy') as number, 0.05, 5, 0.01)}
                ${partNumber('model.parts.' + part + '.sz', 'Z', partValue(entry, part, 'sz') as number, 0.05, 5, 0.01)}
              </div>
            </div>
            <div class="part-actions">
              <button type="button" class="btn small" data-action="${partData?.shape ? 'remove-part' : 'reset-part'}">${
                partData?.shape ? 'Удалить примитив' : 'Сбросить часть'
              }</button>
              <span>${
                partData?.shape
                  ? 'Добавленный примитив'
                  : partData
                    ? 'Переопределение активно'
                    : 'Используется авторский трансформ'
              }</span>
            </div>
          </section>`
        : ''
    }
    <section class="panel-section danger-zone">
      <button type="button" class="btn subtle full" data-action="reset-model">Сбросить модель к исходной</button>
    </section>`;
}

function partNumber(path: string, label: string, value: number, min: number, max: number, step: number): string {
  return `<label class="part-num"><span>${label}</span><input type="number" value="${round(value, decimalPlaces(step))}" min="${min}" max="${max}" step="${step}" data-path="${escapeHtml(
    path,
  )}" data-type="number" data-bounds="${min},${max}" /></label>`;
}

function renderAnimationInspector(entry: UnitLabEntry): string {
  const animation = entry.animation;
  const byPath = (path: string) => {
    const field = ANIMATION_SLIDERS.find((item) => item.path === path);
    if (!field) return '';
    return sliderOnly(field.path, field.label, valueForPath(entry, field.path) as number, field.min, field.max, field.step, field.unit);
  };
  const groups: { title: string; note: string; fields: string[] }[] = [
    {
      title: 'Тайминги',
      note: 'Длительность переходов и скорость воспроизведения. Не влияет на боевую логику сервера.',
      fields: ['animation.speed', 'animation.attackDuration', 'animation.castDuration'].map(byPath),
    },
    {
      title: 'Idle',
      note: 'Дыхание и покачивание корпуса в спокойном состоянии.',
      fields: ['animation.idleBobSpeed', 'animation.idleBobAmount', 'animation.idleSwaySpeed', 'animation.idleSwayAmount'].map(byPath),
    },
    {
      title: 'Корпус',
      note: 'Выпад, крен и наклон при атаке и касте.',
      fields: ['animation.lunge', 'animation.bodyPitch', 'animation.meleeRoll', 'animation.beastPitch', 'animation.castScale', 'animation.swingScale'].map(byPath),
    },
    {
      title: 'Оружие и голова',
      note: 'Амплитуды для оружия, второй руки и головы. Работают только если у модели есть эти узлы.',
      fields: ['animation.weaponPower', 'animation.castWeapon', 'animation.offhandPower', 'animation.headPower'].map(byPath),
    },
    {
      title: 'Крылья и свечение',
      note: 'Взмахи крыльев и пульсация emissive-свечения. Для юнитов без крыльев параметры просто игнорируются.',
      fields: ['animation.wingFlap', 'animation.wingCastFlap', 'animation.wingSpeed', 'animation.glowPulse', 'animation.glowPulseSpeed', 'animation.glowCast'].map(
        byPath,
      ),
    },
  ];
  return `
    <section class="panel-section animation-head-panel">
      <header class="section-head"><span>Проверка</span><small>${escapeHtml(
        ATTACK_STYLES.find((style) => style.value === animation.attackStyle)?.label ?? animation.attackStyle,
      )}</small></header>
      <div class="anim-actions">
        <button type="button" class="btn small" data-preview="attack">Атака</button>
        <button type="button" class="btn small" data-preview="cast">Способность</button>
        <button type="button" class="btn small" data-preview="cycle">Цикл</button>
        <button type="button" class="btn small" data-preview="pause">Пауза</button>
      </div>
      <div class="field-grid two">
        ${selectField('animation.attackStyle', 'Стиль боя', animation.attackStyle, ATTACK_STYLES)}
        <label class="text-field"><span>Скорость</span><input type="number" value="${animation.speed}" min="0.1" max="2.5" step="0.05" data-path="animation.speed" data-type="number" /></label>
        <label class="check-field span-2">
          <input type="checkbox" data-path="animation.swapAttackCast" data-type="boolean" ${animation.swapAttackCast ? 'checked' : ''} />
          <span>
            <b>Поменять местами атаку и каст</b>
            <small>Атака проигрывает анимацию способности, а способность — анимацию атаки. Длительности тоже меняются местами.</small>
          </span>
        </label>
      </div>
    </section>
    ${groups
      .map(
        (group, index) => `
          <section class="panel-section">
            <header class="section-head"><span>${escapeHtml(group.title)}</span><small>0${index + 2}</small></header>
            <p class="section-hint">${escapeHtml(group.note)}</p>
            <div class="controls">${group.fields.join('')}</div>
          </section>`,
      )
      .join('')}
    <section class="panel-section danger-zone">
      <button type="button" class="btn subtle full" data-action="reset-animation">Сбросить анимацию к исходной</button>
    </section>`;
}

function renderInspector(): void {
  const entry = selectedEntry();
  const header = `
    <div class="inspector-head">
      <div>
        <span class="eyebrow">Инспектор</span>
        <h2>${mode === 'balance' ? 'Баланс' : mode === 'model' ? 'Модель' : 'Анимация'}</h2>
      </div>
      <div class="inspector-head-actions">
        <button type="button" class="btn small subtle" data-action="reset-unit">Сброс юнита</button>
      </div>
    </div>`;
  if (mode === 'balance') inspector.innerHTML = header + renderBalanceInspector(entry);
  else if (mode === 'model') inspector.innerHTML = header + renderModelInspector(entry);
  else inspector.innerHTML = header + renderAnimationInspector(entry);
}

function revealSelectedPart(): void {
  if (!selectedPart) return;
  const list = inspector.querySelector<HTMLElement>('.parts-list');
  const row = inspector.querySelector<HTMLElement>(`[data-part="${selectedPart}"]`);
  if (!list || !row) return;
  const listRect = list.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  if (rowRect.top < listRect.top || rowRect.bottom > listRect.bottom) {
    list.scrollTop += rowRect.top - listRect.top - (listRect.height - rowRect.height) / 2;
  }
}

function renderStage(): void {
  renderStageHud();
  renderMetrics();
}

function syncPreview(): void {
  if (!preview) return;
  const def = selectedDef();
  const entry = selectedEntry();
  preview.setUnit(unitDefFromEntry(def, entry), entry.model, entry.animation, star);
  preview.setAutoFight(autoFight);
  preview.setPaused(paused);
  preview.setTurntable(turntable);
}

function renderAll(): void {
  renderFilterChips();
  renderRoster();
  updateModifiedCount();
  renderStage();
  syncPreview();
  renderInspector();
  updateControlStates();
  saveStateLabel.textContent = 'Автосохранение включено';
  saveStateLabel.dataset.state = 'saved';
}

function updateControlStates(): void {
  document.querySelectorAll<HTMLElement>('[data-star]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.star) === star);
  });
  document.querySelectorAll<HTMLElement>('[data-preview="cycle"]').forEach((button) => {
    button.classList.toggle('active', autoFight);
  });
  document.querySelectorAll<HTMLElement>('[data-preview="pause"]').forEach((button) => {
    button.classList.toggle('active', paused);
    button.textContent = paused ? 'Продолжить' : 'Пауза';
  });
  document.querySelectorAll<HTMLElement>('[data-preview="turntable"]').forEach((button) => {
    button.classList.toggle('active', turntable);
  });
}

function refreshBalanceReadouts(): void {
  const entry = selectedEntry();
  renderStageHud();
  renderMetrics();
  const derived = byId('derivedContent');
  if (derived) derived.innerHTML = renderDerivedContent(entry);
  const mechanics = byId('mechanicsContent');
  if (mechanics) mechanics.innerHTML = renderMechanicsContent(entry);
  document.querySelectorAll<HTMLElement>('[data-readout="ability-description"]').forEach((element) => {
    element.textContent = abilityDescriptionAtStar(entry, star);
  });
}

function refreshControlReadout(path: string, value: number, unit: string): void {
  document.querySelectorAll<HTMLElement>(`[data-readout-path="${path}"]`).forEach((element) => {
    const step = Number(element.closest<HTMLElement>('[data-control]')?.querySelector<HTMLInputElement>('input[type="range"]')?.step ?? 1);
    const decimals = decimalPlaces(step || 1);
    element.textContent = `${formatNumber(value, decimals)}${unit ? ` ${unit}` : ''}`;
  });
}

function syncInputs(path: string, value: unknown, source: EventTarget | null): void {
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-path="${path}"]`).forEach((element) => {
    if (element === source) return;
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      element.checked = Boolean(value);
    } else {
      element.value = String(value);
    }
  });
  if (typeof value === 'number') {
    const unit = document.querySelector<HTMLElement>(`[data-control="${path}"] output`)?.dataset.unit ?? '';
    refreshControlReadout(path, value, unit);
  }
}

function updateColorPair(path: string, value: string): void {
  document.querySelectorAll<HTMLInputElement>(`[data-path="${path}"]`).forEach((element) => {
    if (element.value.toLowerCase() !== value.toLowerCase()) element.value = value;
  });
}

function applyEntryChange(path: string, options: { rerender?: boolean; previewModel?: boolean; previewAnimation?: boolean } = {}): void {
  const entry = selectedEntry();
  if (path.startsWith('stats') || path.startsWith('model.scale') || path.startsWith('model.hover') || path.startsWith('model.yaw')) {
    refreshBalanceReadouts();
  }
  if (options.previewModel && preview) preview.setModel(entry.model);
  if (options.previewAnimation && preview) preview.setAnimation(entry.animation);
  if (options.rerender) {
    renderInspector();
    updateControlStates();
  }
  renderRoster();
  updateModifiedCount();
  scheduleSave();
}

inspector.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null;
  if (!target || !target.dataset.path) return;
  const path = target.dataset.path;
  const type = target.dataset.type ?? 'string';
  const entry = selectedEntry();
  let partKey: string | null = null;
  if (type === 'boolean') {
    setValueForPath(entry, path, target instanceof HTMLInputElement ? target.checked : false);
  } else if (type === 'number') {
    if (target.value.trim() === '') return;
    const raw = Number(target.value);
    if (!Number.isFinite(raw)) return;
    let value = raw;
    const bounds = target.dataset.bounds?.split(',').map(Number);
    if (bounds && bounds.length === 2) value = Math.min(bounds[1], Math.max(bounds[0], value));
    if (path.endsWith('.cost')) value = Math.min(5, Math.max(1, Math.round(value)));
    if (path.endsWith('.range')) value = Math.min(12, Math.max(1, Math.round(value)));
    if (path.endsWith('.secondary')) value = Math.min(999, Math.max(0, Math.round(value)));
    if (path.includes('.parts.')) {
      const match = path.match(/^model\.parts\.(.+?)\.(px|py|pz|rx|ry|rz|sx|sy|sz)$/);
      if (match) {
        partKey = match[1];
        ensurePart(entry, partKey);
      }
    }
    setValueForPath(entry, path, value);
    if (partKey) prunePart(entry, partKey);
    syncInputs(path, value, target);
  } else if (type === 'color') {
    const value = target.value.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(value)) return;
    setValueForPath(entry, path, value);
    updateColorPair(path, value);
    if (path === 'model.palette.glow') {
      const glow = entry.model.palette.glow;
      hudAbility.style.setProperty('--glow', glow);
    }
    applyEntryChange(path, { previewModel: true });
    return;
  } else {
    setValueForPath(entry, path, target.value);
  }

  const previewModel = path.startsWith('model.');
  const previewAnimation = path.startsWith('animation.');
  const rerender =
    target.dataset.rerender === '1' ||
    path === 'stats.race' ||
    path === 'stats.unitClass' ||
    path === 'stats.ability.kind' ||
    path === 'stats.ability.secondary';
  applyEntryChange(path, { rerender, previewModel, previewAnimation });

  if (partKey) {
    const storedPart = entry.model.parts[partKey];
    const row = inspector.querySelector<HTMLElement>(`[data-part="${partKey}"]`);
    row?.classList.toggle('modified', Boolean(storedPart && isPartModified(storedPart)));
    const status = inspector.querySelector<HTMLElement>('.part-editor .part-actions span');
    if (status) status.textContent = storedPart ? 'Переопределение активно' : 'Используется авторский трансформ';
  }

  if (path === 'stats.name' || path === 'stats.flavor' || path === 'stats.ability.name') {
    renderStageHud();
  }
  if (path === 'stats.ability.kind') {
    selectedPart = null;
  }
});

inspector.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null;
  if (!target || !target.dataset.path) return;
  if (target instanceof HTMLSelectElement && target.dataset.rerender === '1') {
    renderInspector();
    renderStageHud();
    updateControlStates();
  }
});

inspector.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const toggle = target.closest<HTMLElement>('[data-part-toggle]');
  if (toggle) {
    event.stopPropagation();
    const key = toggle.dataset.partToggle as string;
    const entry = selectedEntry();
    const current = partValue(entry, key, 'visible') as boolean;
    ensurePart(entry, key);
    entry.model.parts[key].visible = !current;
    prunePart(entry, key);
    preview?.setModel(entry.model);
    renderInspector();
    scheduleSave();
    updateModifiedCount();
    renderRoster();
    return;
  }
  const partRow = target.closest<HTMLElement>('[data-part]');
  if (partRow) {
    const remove = target.closest<HTMLElement>('[data-part-remove]');
    if (remove) {
      event.stopPropagation();
      const key = remove.dataset.partRemove as string;
      const entry = selectedEntry();
      delete entry.model.parts[key];
      if (selectedPart === key) selectedPart = null;
      preview?.setModel(entry.model);
      renderInspector();
      updateModifiedCount();
      renderRoster();
      scheduleSave();
      showToast('Примитив удалён.');
      return;
    }
    selectedPart = partRow.dataset.part ?? null;
    renderInspector();
    return;
  }
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'reset-unit') {
    state.units[selectedId] = createDefaultUnit(selectedId);
    selectedPart = null;
    syncPreview();
    renderAll();
    markSaved();
    showToast('Юнит сброшен к исходным значениям.');
  } else if (action === 'reset-model') {
    const entry = selectedEntry();
    entry.model = createDefaultModel(selectedDef());
    selectedPart = null;
    preview?.setModel(entry.model);
    renderInspector();
    renderRoster();
    updateModifiedCount();
    scheduleSave();
    showToast('Модель сброшена.');
  } else if (action === 'reset-animation') {
    const entry = selectedEntry();
    entry.animation = createDefaultAnimation(selectedDef());
    preview?.setAnimation(entry.animation);
    renderInspector();
    updateModifiedCount();
    scheduleSave();
    showToast('Анимация сброшена.');
  } else if (action === 'reset-part' && selectedPart) {
    const entry = selectedEntry();
    delete entry.model.parts[selectedPart];
    preview?.setModel(entry.model);
    renderInspector();
    updateModifiedCount();
    scheduleSave();
    showToast('Часть модели сброшена.');
  } else if (action === 'add-part') {
    const entry = selectedEntry();
    const key = nextCustomPartKey(entry.model.parts);
    entry.model.parts[key] = createCustomPart(entry.model.palette.accent);
    selectedPart = key;
    preview?.setModel(entry.model);
    renderInspector();
    revealSelectedPart();
    renderRoster();
    updateModifiedCount();
    scheduleSave();
    showToast(`Примитив «${key}» добавлен.`);
  } else if (action === 'remove-part' && selectedPart) {
    const entry = selectedEntry();
    delete entry.model.parts[selectedPart];
    selectedPart = null;
    preview?.setModel(entry.model);
    renderInspector();
    renderRoster();
    updateModifiedCount();
    scheduleSave();
    showToast('Примитив удалён.');
  }
});

rosterList.addEventListener('click', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-unit-id]');
  if (!row) return;
  selectedId = row.dataset.unitId as string;
  selectedPart = null;
  flushSave();
  renderStage();
  renderRoster();
  syncPreview();
  renderInspector();
});

function createDefaultUnit(id: string): UnitLabEntry {
  return createDefaultEntry(UNIT_BY_ID[id]);
}

function setMode(nextMode: LabMode): void {
  if (mode === nextMode) return;
  mode = nextMode;
  if (mode !== 'model') selectedPart = null;
  renderStage();
  renderInspector();
  updateControlStates();
}

document.querySelectorAll<HTMLElement>('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode as LabMode));
});

document.querySelectorAll<HTMLElement>('[data-star]').forEach((button) => {
  button.addEventListener('click', () => {
    star = Number(button.dataset.star) || 1;
    preview?.setStar(star);
    renderStage();
    renderInspector();
    updateControlStates();
  });
});

function handlePreviewAction(action: string | undefined): void {
  if (action === 'attack') preview?.triggerAttack();
  else if (action === 'cast') preview?.triggerCast();
  else if (action === 'idle') preview?.triggerIdle();
  else if (action === 'cycle') {
    autoFight = !autoFight;
    preview?.setAutoFight(autoFight);
    updateControlStates();
    showToast(autoFight ? 'Цикл атака/способность включён.' : 'Цикл выключен.');
  } else if (action === 'pause') {
    paused = !paused;
    preview?.setPaused(paused);
    updateControlStates();
  } else if (action === 'turntable') {
    turntable = !turntable;
    preview?.setTurntable(turntable);
    updateControlStates();
  }
}

// Delegated so the buttons inside the re-rendered inspector keep working.
document.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-preview]');
  if (!button) return;
  handlePreviewAction(button.dataset.preview);
});

raceFilters.addEventListener('click', (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-filter-race]');
  if (!chip) return;
  raceFilter = (chip.dataset.filterRace as Race | 'all') ?? 'all';
  renderFilterChips();
  renderRoster();
});

classFilters.addEventListener('click', (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-filter-class]');
  if (!chip) return;
  classFilter = (chip.dataset.filterClass as UnitClass | 'all') ?? 'all';
  renderFilterChips();
  renderRoster();
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderRoster();
});

byId('applyBtn').addEventListener('click', async () => {
  flushSave();
  const button = byId<HTMLButtonElement>('applyBtn');
  const originalLabel = button.textContent ?? 'Применить в игру';
  button.disabled = true;
  button.textContent = 'Применяем…';
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = new URLSearchParams(location.search).get('tuningToken');
    if (token) headers['x-tuning-token'] = token;
    const response = await fetch('/api/tuning', {
      method: 'POST',
      headers,
      body: JSON.stringify(state),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      units?: number;
      persisted?: boolean;
      warning?: string;
    };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `HTTP ${response.status}`);
    }
    const units = payload.units ?? 0;
    showToast(
      units > 0
        ? `Тюнинг применён: ${units} юнит(ов). Обновите страницу игры, чтобы увидеть изменения.`
        : 'Тюнинг применён: отличий от исходного баланса нет.',
    );
    if (payload.persisted === false) {
      showToast(
        `Сервер применил тюнинг, но не сохранил файл${payload.warning ? `: ${payload.warning}` : ''}. После перезапуска вернётся исходный баланс.`,
        'warn',
      );
    }
  } catch (error) {
    showToast(
      `Не удалось применить в игру: ${
        error instanceof Error ? error.message : 'сервер недоступен'
      }. Запустите npm run dev и откройте Unit Lab с того же адреса.`,
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
  const filename = `auto-flow-unit-lab-${new Date().toISOString().slice(0, 10)}.json`;
  await saveJsonFile(JSON.stringify(state, null, 2), filename);
});

byId('copyBtn').addEventListener('click', async () => {
  flushSave();
  try {
    await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    showToast('JSON скопирован в буфер обмена.');
  } catch {
    showToast('Браузер не разрешил доступ к буферу обмена.', 'warn');
  }
});

byId('importBtn').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) {
    importFile.value = '';
    return;
  }
  try {
    // Read the file first: clearing the input before the async read aborts it in some
    // Chromium builds and makes file.text() resolve with an empty string.
    const text = await file.text();
    const raw = JSON.parse(text.replace(/^\uFEFF/, ''));
    state = normalizeImportedState(raw);
    saveState(state);
    selectedId = UNITS[0].id;
    selectedPart = null;
    renderAll();
    showToast('Конфигурация импортирована.');
  } catch (error) {
    console.error('Не удалось импортировать конфигурацию Unit Lab', error);
    showToast(
      `Не удалось прочитать JSON: ${
        error instanceof Error ? error.message : 'неизвестная ошибка'
      }. Проверьте формат файла.`,
      'error',
    );
  } finally {
    importFile.value = '';
  }
});

byId('resetAllBtn').addEventListener('click', () => {
  if (!window.confirm('Сбросить весь Unit Lab к значениям из content.ts?')) return;
  state = createDefaultState();
  selectedId = UNITS[0].id;
  selectedPart = null;
  star = 1;
  saveState(state);
  renderAll();
  showToast('Все юниты сброшены к исходному балансу.');
});

window.addEventListener('beforeunload', () => flushSave());
window.addEventListener('resize', () => preview?.resize());

window.setInterval(() => {
  if (!preview) return;
  const playback = preview.getPlayback();
  timelineAttack.style.width = `${Math.min(100, playback.attackProgress * 100)}%`;
  timelineCast.style.width = `${Math.min(100, playback.castProgress * 100)}%`;
  playState.textContent = playback.casting ? 'Способность' : playback.attacking ? 'Атака' : 'Idle';
  playState.dataset.state = playback.casting ? 'cast' : playback.attacking ? 'attack' : 'idle';
}, 70);

renderAll();
