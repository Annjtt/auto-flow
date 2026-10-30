import { getUnitDef } from '../shared/content';
import {
  BENCH_SIZE,
  CLASS_NAMES,
  DEFAULT_SETTINGS,
  PLAYER_ROWS,
  RACE_NAMES,
  SHOP_ODDS,
  STAR_MULTIPLIER,
  type BattleSnapshot,
  type LobbySettings,
  type RoomView,
  type SelfView,
  type ServerMessage,
  type UnitDef,
  type UnitView,
} from '../shared/types';
import { Net } from './net';
import { traitIcon, traitLabel } from './icons';
import { ArenaScene, MAP_THEME_ACCENTS, type FloatTextKind, type MapId } from './scene';
import { ShopPreview } from './shopPreview';

// Временный переключатель наборного шрифта: ?font=onest|golos|inter|rubik|nunito|manrope
// (после выбора шрифта эту строку и пресеты в style.css можно оставить только для одного)
const bodyFontParam = new URLSearchParams(location.search).get('font');
if (bodyFontParam) document.body.dataset.bodyFont = bodyFontParam;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stars(count: number): string {
  return '★'.repeat(Math.max(0, count));
}

function livesWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'жизнь';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'жизни';
  return 'жизней';
}

function formatNumber(value: number): string {
  return String(Math.round(value));
}

interface MapOption {
  id: MapId;
  name: string;
  subtitle: string;
  light: string;
  dark: string;
  glow: string;
}

const MAP_OPTIONS: MapOption[] = [
  {
    id: 'kara',
    name: 'Upper Tower Kara',
    subtitle: 'Ночная башня',
    light: '#cfd3e8',
    dark: '#211f30',
    glow: '#b07cff',
  },
  {
    id: 'starry',
    name: 'Starry Court',
    subtitle: 'Звёздный двор',
    light: '#dfe9f2',
    dark: '#5f7489',
    glow: '#7fd7ff',
  },
  {
    id: 'ruins',
    name: 'Shatty Ruins',
    subtitle: 'Руины Шатти',
    light: '#d9c4a4',
    dark: '#6b5039',
    glow: '#e8ae63',
  },
  {
    id: 'jaddy',
    name: 'Jaddy Forest',
    subtitle: 'Лес Джадди',
    light: '#a7c994',
    dark: '#33503a',
    glow: '#7de09a',
  },
];

const MAP_IDS = new Set<MapId>(MAP_OPTIONS.map((entry) => entry.id));

function loadMap(): MapId {
  const stored = localStorage.getItem('autoflow.map');
  return stored && MAP_IDS.has(stored as MapId) ? (stored as MapId) : 'jaddy';
}

function mapOption(id: MapId): MapOption {
  return MAP_OPTIONS.find((entry) => entry.id === id) ?? MAP_OPTIONS[3];
}

let room: RoomView | null = null;
let battle: BattleSnapshot | null = null;
let selectedUid: string | null = null;
let lastRoomAt = 0;
let gameOverShown = false;
let surrenderPending = false;
let currentScreen: 'menu' | 'lobby' | 'game' = 'menu';
let lastTooltipDef: string | null = null;
let lastTooltipPlayer: string | null = null;
let shopSig = '';
let benchSig = '';
let selectedSig = '';
let synergySig = '';
let playersSig = '';
let resultSig = '';
let phaseSig = '';
let oddsSig = '';
let currentMap: MapId = loadMap();
let shopOpen = false;

const playerNameInput = byId<HTMLInputElement>('playerName');
const codeInput = byId<HTMLInputElement>('codeInput');
const canvas = byId<HTMLCanvasElement>('renderCanvas');
const connectionBadge = byId('connection');
const lobbyList = byId('lobbyList');
const lobbyPlayers = byId('lobbyPlayers');
const lobbySettings = byId('lobbySettings');
const lobbyHint = byId('lobbyHint');
const readyBtn = byId<HTMLButtonElement>('readyBtn');
const startBtn = byId<HTMLButtonElement>('startBtn');
const shopCards = byId('shopCards');
const benchCards = byId('benchCards');
const selectedPanel = byId('selectedPanel');
const synergyPanel = byId('synergyPanel');
const playersPanel = byId('playersPanel');
const rulesBtn = byId<HTMLButtonElement>('rulesBtn');
const surrenderBtn = byId<HTMLButtonElement>('surrenderBtn');
const shopBar = byId('shopBar');
const benchBar = byId('benchBar');
const battleResult = byId('battleResult');
const phaseBanner = byId('phaseBanner');
const floatLayer = byId('floatLayer');
const tooltip = byId('tooltip');
const modalRoot = byId('modalRoot');
const spectatorBanner = byId('spectatorBanner');
const gameOver = byId('gameOver');
const gameOverTitle = byId('gameOverTitle');
const gameOverText = byId('gameOverText');
const gameOverEmblem = byId('gameOverEmblem');
const mapGrid = byId('mapGrid');
const shopToggleBtn = byId<HTMLButtonElement>('shopToggleBtn');
const shopCloseBtn = byId<HTMLButtonElement>('shopCloseBtn');
const shopOdds = byId('shopOdds');
const shopLevel = byId('shopLevel');
const shopGold = byId('shopGold');
const hudUnitCount = byId('hudUnitCount');
const hudLevelCap = byId('hudLevelCap');
const hudOpponent = byId('hudOpponent');
const hudXpText = byId('hudXpText');
const hudPhaseCard = byId('hudPhaseCard');
const hudFocusRing = document.getElementById('hudFocusRing') as unknown as SVGCircleElement;
const shopToggleLabel = shopToggleBtn.querySelector('b');
const lobbyBoardPreview = byId('lobbyBoardPreview');
const lobbyBoardName = byId('lobbyBoardName');

const storedName = localStorage.getItem('autoflow.name') ?? '';
playerNameInput.value = storedName;
document.body.dataset.map = currentMap;

const net = new Net();
const scene = new ArenaScene(
  canvas,
  {
    onCellClick: (x, y) => {
      if (!room || room.phase !== 'prep' || !room.self?.alive) return;
      if (!selectedUid) return;
      net.send({ type: 'move_unit', uid: selectedUid, to: { type: 'board', x, y } });
      selectedUid = null;
      refreshSelection();
    },
    onUnitClick: (uid) => {
      if (!room || room.phase !== 'prep' || !room.self?.alive) return;
      const self = room.self;
      if (selectedUid && selectedUid !== uid) {
        const target = self.board.find((unit) => unit.uid === uid);
        if (target) {
          net.send({ type: 'move_unit', uid: selectedUid, to: { type: 'board', x: target.x, y: target.y } });
          selectedUid = null;
          refreshSelection();
          return;
        }
      }
      selectedUid = selectedUid === uid ? null : uid;
      refreshSelection();
    },
    onFloatText: spawnFloatText,
  },
  currentMap,
);
const shopPreview = new ShopPreview(byId<HTMLCanvasElement>('shopPreview'));
const benchPreview = new ShopPreview(byId<HTMLCanvasElement>('benchPreview'), {
  capacity: BENCH_SIZE,
  attribute: 'bench-preview',
});

function spawnFloatText(text: string, x: number, y: number, kind: FloatTextKind): void {
  if (floatLayer.childElementCount > 40) floatLayer.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = `float-text ${kind}`;
  el.textContent = text;
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  floatLayer.appendChild(el);
  window.setTimeout(() => el.remove(), 1000);
}

function renderMapGrid(): void {
  mapGrid.innerHTML = MAP_OPTIONS.map((option) => {
    const selected = option.id === currentMap;
    return `
      <button class="map-card ${selected ? 'selected' : ''}" type="button"
        data-map-choice="${option.id}"
        style="--map-light:${option.light};--map-dark:${option.dark};--map-glow:${option.glow}"
        aria-pressed="${selected}">
        <span class="map-art" aria-hidden="true">
          <span class="map-art-grid"></span>
          <span class="map-art-shade"></span>
        </span>
        <span class="map-copy"><b>${option.name}</b><small>${option.subtitle}</small></span>
        <span class="map-check" aria-hidden="true">✓</span>
      </button>`;
  }).join('');
}

function syncMapLabels(): void {
  const option = mapOption(currentMap);
  document.body.dataset.map = currentMap;
  document.body.style.setProperty('--map-accent', MAP_THEME_ACCENTS[currentMap]);
  lobbyBoardPreview.dataset.map = currentMap;
  lobbyBoardName.textContent = option.name;
}

function selectMap(id: MapId): void {
  if (id === currentMap) return;
  currentMap = id;
  localStorage.setItem('autoflow.map', currentMap);
  scene.setMap(currentMap);
  syncMapLabels();
  renderMapGrid();
  toast(`Доска: ${mapOption(currentMap).name}`, 'success');
}

function setShopOpen(open: boolean): void {
  const canPrepare = Boolean(room?.self?.alive && room.phase === 'prep');
  shopOpen = open && canPrepare;
  shopBar.classList.toggle('hidden', !shopOpen);
  shopToggleBtn.classList.toggle('active', shopOpen);
  shopToggleBtn.setAttribute('aria-pressed', String(shopOpen));
}

function showScreen(name: 'menu' | 'lobby' | 'game'): void {
  currentScreen = name;
  for (const screen of document.querySelectorAll<HTMLElement>('.screen')) {
    screen.classList.toggle('active', screen.id === `${name}-screen`);
  }
  document.body.classList.toggle('in-game', name === 'game');
  if (name === 'game') scene.show();
}

function currentName(): string {
  const value = playerNameInput.value.trim().slice(0, 18);
  const name = value || 'Странник';
  localStorage.setItem('autoflow.name', name);
  net.setName(name);
  return name;
}

function syncName(): string {
  const name = currentName();
  if (net.playerId) net.send({ type: 'set_name', name });
  return name;
}

function requireOnline(): boolean {
  if (net.playerId) return true;
  toast('Сервер ещё не ответил. Подождите пару секунд.', 'error');
  return false;
}

function toast(message: string, kind: 'info' | 'error' | 'success' = 'info'): void {
  const container = byId('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind === 'info' ? '' : kind}`.trim();
  el.textContent = message;
  container.appendChild(el);
  while (container.children.length > 5) container.firstElementChild?.remove();
  window.setTimeout(() => el.remove(), 4200);
}

function setConnection(status: 'connecting' | 'online' | 'offline'): void {
  connectionBadge.classList.remove('online', 'offline');
  if (status === 'online') {
    connectionBadge.textContent = 'На связи';
    connectionBadge.classList.add('online');
  } else if (status === 'offline') {
    connectionBadge.textContent = 'Нет связи';
    connectionBadge.classList.add('offline');
  } else {
    connectionBadge.textContent = 'Соединение...';
  }
}

net.onStatus = setConnection;
net.onMessage = handleServerMessage;

function handleServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case 'auth':
      if (!playerNameInput.value.trim()) {
        playerNameInput.value = message.playerName;
      }
      break;
    case 'lobby_list':
      renderLobbyList(message.lobbies);
      break;
    case 'room':
      handleRoom(message.room);
      break;
    case 'battle':
      if (!room || (room.phase !== 'combat' && room.phase !== 'result')) return;
      battle = message.battle;
      scene.updateBattle(message.battle);
      renderBattleResult();
      break;
    case 'toast':
      toast(message.message);
      break;
    case 'error':
      surrenderPending = false;
      toast(message.message, 'error');
      break;
    case 'left':
      resetToMenu();
      break;
    case 'game_over':
      showGameOver(
        message.placement,
        message.totalPlayers,
        message.victory,
        surrenderPending ? 'surrender' : undefined,
      );
      surrenderPending = false;
      break;
  }
}

function handleRoom(nextRoom: RoomView): void {
  const previous = room;
  room = nextRoom;
  lastRoomAt = Date.now();
  if (drag && (nextRoom.phase !== 'prep' || !nextRoom.self?.alive)) cancelDrag();
  if (selectedUid && nextRoom.self) {
    const exists =
      nextRoom.self.board.some((unit) => unit.uid === selectedUid) ||
      nextRoom.self.bench.some((unit) => unit.uid === selectedUid);
    if (!exists) selectedUid = null;
  }
  if (nextRoom.self && !nextRoom.self.alive) selectedUid = null;

  if (nextRoom.phase === 'waiting') {
    battle = null;
    showScreen('lobby');
    renderLobby();
    return;
  }

  if (nextRoom.phase === 'prep' && previous?.phase !== 'prep') {
    battle = null;
    battleResult.classList.add('hidden');
    shopOpen = Boolean(nextRoom.self?.alive);
  }
  if (nextRoom.phase === 'combat' || nextRoom.phase === 'result' || nextRoom.phase === 'finished') {
    shopOpen = false;
  }
  document.body.dataset.phase = nextRoom.phase;

  showScreen('game');
  renderGame();
  syncScene();
  if (surrenderPending && nextRoom.self && !nextRoom.self.alive && nextRoom.phase !== 'finished') {
    showGameOver(
      nextRoom.self.placement ?? nextRoom.players.length,
      nextRoom.players.length,
      false,
      'surrender',
    );
    surrenderPending = false;
  }
  if (nextRoom.phase === 'finished' && nextRoom.self?.placement && !gameOverShown) {
    showGameOver(
      nextRoom.self.placement,
      nextRoom.players.length,
      nextRoom.self.placement === 1,
      surrenderPending ? 'surrender' : undefined,
    );
    surrenderPending = false;
  }
}

function resetToMenu(): void {
  cancelDrag();
  room = null;
  battle = null;
  selectedUid = null;
  gameOverShown = false;
  surrenderPending = false;
  shopOpen = false;
  setShopOpen(false);
  scene.clearUnits();
  shopPreview.setUnits([]);
  benchPreview.setUnits([]);
  shopSig = '';
  benchSig = '';
  delete document.body.dataset.phase;
  gameOver.classList.add('hidden');
  byId('spectatorBanner').classList.add('hidden');
  showScreen('menu');
  net.send({ type: 'list_lobbies' });
}

function syncScene(): void {
  if (!room || !room.self) return;
  if (room.phase === 'prep') {
    if (!room.self.alive) {
      const units = spectateBoard();
      if (units) {
        scene.updatePrep(units, null);
        scene.setPreparing(false);
      } else {
        scene.clearUnits();
      }
      return;
    }
    scene.setPreparing(true);
    scene.updatePrep(room.self.board, selectedUid);
  } else if ((room.phase === 'combat' || room.phase === 'result') && battle) {
    scene.setPreparing(false);
    scene.updateBattle(battle);
  }
}

function spectateBoard(): UnitView[] | null {
  if (!room || room.self?.alive !== false) return null;
  const alive = room.players.filter((player) => player.alive);
  if (alive.length === 0) return null;
  return alive.reduce((best, player) => (player.lives > best.lives ? player : best), alive[0]).board;
}

function refreshSelection(): void {
  if (room?.phase === 'prep' && room.self?.alive) {
    scene.updatePrep(room.self.board, selectedUid);
  }
  renderSelectedPanel();
  renderBench();
}

type DragSource = 'bench' | 'board';

interface DragState {
  uid: string;
  defId: string;
  star: number;
  source: DragSource;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  ghost: HTMLElement | null;
  cell: { x: number; y: number } | null;
  cellValid: boolean;
  overBench: boolean;
  benchValid: boolean;
  fromWorld: { x: number; z: number } | null;
}

let drag: DragState | null = null;
let suppressBenchClick = false;

function dragOrigin(unit: { x: number; y: number } | null): { x: number; z: number } | null {
  if (!unit) return null;
  return { x: unit.x - 3.5, z: unit.y - 3.5 };
}

function beginDrag(uid: string, source: DragSource, event: PointerEvent): void {
  const self = room?.self;
  if (!self || !self.alive || room?.phase !== 'prep') return;
  const unit =
    source === 'bench'
      ? self.bench.find((item) => item.uid === uid)
      : self.board.find((item) => item.uid === uid);
  if (!unit) return;
  let fromWorld = source === 'board' ? dragOrigin(unit as UnitView) : null;
  if (source === 'bench') {
    const card = benchCards.querySelector<HTMLElement>(`[data-bench-uid="${uid}"]`);
    if (card) {
      const rect = card.getBoundingClientRect();
      fromWorld = scene.screenToGround(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }
  drag = {
    uid,
    defId: unit.defId,
    star: unit.star,
    source,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    active: false,
    ghost: null,
    cell: null,
    cellValid: false,
    overBench: false,
    benchValid: false,
    fromWorld,
  };
  if (source === 'board') scene.setDragging(true);
}

function createDragGhost(defId: string, star: number): HTMLElement {
  const def = getUnitDef(defId);
  const el = document.createElement('div');
  el.className = `drag-ghost race-${def.race} cost-${def.cost}`;
  el.innerHTML = `
    <span class="drag-cost">${def.cost}</span>
    <span class="drag-stars">${star > 1 ? stars(star) : ''}</span>
    <span class="drag-name">${escapeHtml(def.name)}</span>
    <span class="drag-traits">${traitLabel(def.race, RACE_NAMES[def.race])}<i>·</i>${traitLabel(def.unitClass, CLASS_NAMES[def.unitClass])}</span>`;
  return el;
}

function activateDrag(): void {
  if (!drag || drag.active) return;
  drag.active = true;
  suppressBenchClick = true;
  hideTooltip();
  if (shopOpen) setShopOpen(false);
  scene.setDragging(true);
  scene.setDraggedUnit(drag.uid);
  if (drag.source === 'bench') {
    drag.ghost = createDragGhost(drag.defId, drag.star);
    document.body.appendChild(drag.ghost);
    const card = benchCards.querySelector<HTMLElement>(`[data-bench-uid="${drag.uid}"]`);
    card?.classList.add('dragging');
  }
  document.body.classList.add('dragging-unit');
}

function updateGhostPosition(x: number, y: number): void {
  if (!drag?.ghost) return;
  drag.ghost.style.left = `${x}px`;
  drag.ghost.style.top = `${y}px`;
}

function pointInRect(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function canDropOnCell(cell: { x: number; y: number }): boolean {
  const self = room?.self;
  if (!self || !drag) return false;
  if (!PLAYER_ROWS.includes(cell.y)) return false;
  const fromBoard = self.board.some((unit) => unit.uid === drag?.uid);
  const occupant = self.board.find(
    (unit) => unit.uid !== drag?.uid && unit.x === cell.x && unit.y === cell.y,
  );
  if (!fromBoard && !occupant && self.board.length >= self.level) return false;
  return true;
}

function updateDropTarget(x: number, y: number): void {
  if (!drag) return;
  const self = room?.self;
  const overBench = drag.source === 'board' && !benchBar.classList.contains('hidden') && pointInRect(benchBar, x, y);
  drag.overBench = overBench;
  benchBar.classList.remove('drop-valid', 'drop-invalid');

  if (overBench) {
    drag.benchValid = Boolean(self && self.bench.length < BENCH_SIZE);
    drag.cell = null;
    drag.cellValid = false;
    benchBar.classList.add(drag.benchValid ? 'drop-valid' : 'drop-invalid');
    scene.setDropHighlight(null, false);
    scene.setDragPath(null, null, false);
    return;
  }

  const cell = scene.pickCellAt(x, y);
  drag.cell = cell;
  drag.cellValid = cell ? canDropOnCell(cell) : false;
  scene.setDropHighlight(cell, drag.cellValid);
  scene.setDragPath(drag.fromWorld, cell, drag.cellValid);
}

function cleanupDrag(): { state: DragState; wasActive: boolean } | null {
  if (!drag) return null;
  const state = drag;
  drag = null;
  const wasActive = state.active;
  state.ghost?.remove();
  document.body.classList.remove('dragging-unit');
  benchBar.classList.remove('drop-valid', 'drop-invalid');
  for (const card of benchCards.querySelectorAll('.bench-card.dragging')) card.classList.remove('dragging');
  scene.setDragging(false);
  scene.setDraggedUnit(null);
  scene.setDropHighlight(null, false);
  scene.hideDragPath();
  window.setTimeout(() => {
    suppressBenchClick = false;
  }, 0);
  return { state, wasActive };
}

function finishDrag(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const cell = drag.cell;
  const cellValid = drag.cellValid;
  const overBench = drag.overBench;
  const benchValid = drag.benchValid;
  const uid = drag.uid;
  const fromWorld = drag.fromWorld;
  const result = cleanupDrag();
  if (!result?.wasActive) return;

  if (overBench && benchValid) {
    net.send({ type: 'move_unit', uid, to: { type: 'bench' } });
    selectedUid = null;
    refreshSelection();
  } else if (cell && cellValid) {
    scene.queueDropJump(uid, fromWorld);
    net.send({ type: 'move_unit', uid, to: { type: 'board', x: cell.x, y: cell.y } });
    selectedUid = null;
    refreshSelection();
  } else if (cell) {
    toast('Сюда ставить нельзя.', 'error');
  }
}

function cancelDrag(): void {
  cleanupDrag();
}


function renderGame(): void {
  if (!room || !room.self) return;
  const self = room.self;
  byId('hudLives').textContent = String(self.lives);
  byId('hudGold').textContent = String(self.gold);
  byId('hudLevel').textContent = String(self.level);
  const xpNeeded = Math.max(1, self.xpNeeded);
  byId('hudXpFill').style.width = `${Math.min(100, (self.xp / xpNeeded) * 100)}%`;
  hudXpText.textContent = `${self.xp} / ${xpNeeded}`;
  byId('hudRound').textContent = String(room.round);
  byId('hudMaxRounds').textContent = String(room.maxRounds);
  hudUnitCount.textContent = String(self.board.length);
  hudLevelCap.textContent = String(self.level);
  const focusPercent = Math.max(0, Math.min(1, self.board.length / Math.max(1, self.level)));
  hudFocusRing.style.strokeDasharray = `${(focusPercent * 276.46).toFixed(1)} 276.46`;
  shopGold.textContent = String(self.gold);
  shopLevel.textContent = `lvl. ${self.level}`;
  updateClock();
  renderPlayers();
  renderSynergies();
  renderShop();
  renderShopOdds();
  renderBench();
  renderSelectedPanel();
  renderBattleResult();
  renderPhaseBanner();

  const canPrepare = self.alive && room.phase === 'prep';
  setShopOpen(canPrepare && shopOpen);
  benchBar.classList.toggle('hidden', !canPrepare);
  spectatorBanner.classList.toggle(
    'hidden',
    self.alive || room.phase === 'waiting' || room.phase === 'finished',
  );
  selectedPanel.classList.toggle('hidden', !canPrepare || !selectedUid);
  const xpBtn = byId<HTMLButtonElement>('xpBtn');
  const rerollBtn = byId<HTMLButtonElement>('rerollBtn');
  const lockBtn = byId<HTMLButtonElement>('lockBtn');
  xpBtn.disabled = !canPrepare || self.level >= 9 || self.gold < 4;
  rerollBtn.disabled = !canPrepare || self.gold < 2;
  lockBtn.disabled = !canPrepare;
  shopToggleBtn.disabled = !canPrepare;
  lockBtn.classList.toggle('active', self.locked);
  byId('lockState').textContent = self.locked ? 'закреплён' : 'замок';
  byId('benchCount').textContent = `${self.bench.length} / ${BENCH_SIZE}`;
  hudOpponent.textContent = opponentLine();
  hudOpponent.classList.toggle('battle', room.phase === 'combat');
  const canSurrender = self.alive && room.phase !== 'finished';
  surrenderBtn.disabled = !canSurrender || surrenderPending;
  surrenderBtn.classList.toggle('hidden', !canSurrender);
  syncMapLabels();
}

function opponentLine(): string {
  if (!room) return '';
  if (room.phase === 'combat') {
    return `Бой против ${room.opponentName ?? 'неизвестного соперника'}`;
  }
  if (room.phase === 'result') {
    const word =
      room.self?.lastResult === 'win'
        ? 'победа'
        : room.self?.lastResult === 'loss'
          ? 'поражение'
          : room.self?.lastResult === 'draw'
            ? 'ничья'
            : 'итоги';
    return `${word} · раунд ${room.round}`;
  }
  if (room.phase === 'prep') {
    return room.opponentName ? `Следующий соперник · ${room.opponentName}` : 'Соперник определится в бою';
  }
  if (room.phase === 'finished') return 'Матч завершён';
  return 'Ожидание соперников';
}

function renderShopOdds(): void {
  if (!room?.self) return;
  const self = room.self;
  const sig = `${self.level}|${self.gold}`;
  if (sig === oddsSig) return;
  oddsSig = sig;
  const odds = SHOP_ODDS[self.level] ?? SHOP_ODDS[1];
  shopOdds.innerHTML = odds
    .map(
      (chance, index) =>
        `<span class="odd cost-${index + 1}" title="Шанс бойца за ${index + 1} золота"><i></i><b>${chance}%</b></span>`,
    )
    .join('');
}


function updateClock(): void {
  if (!room) return;
  const timer = byId('hudTimer');
  const label = byId('hudPhaseLabel');
  const elapsed = (Date.now() - lastRoomAt) / 1000;
  const remaining = Math.max(0, room.timeLeft - elapsed);
  hudPhaseCard.dataset.phase = room.phase;
  if (room.phase === 'finished') {
    timer.textContent = '—';
    label.textContent = 'завершён';
    return;
  }
  timer.textContent = String(Math.ceil(remaining));
  label.textContent =
    room.phase === 'prep' ? 'подготовка' : room.phase === 'combat' ? 'бой' : room.phase === 'result' ? 'итоги' : 'ожидание';
}

function renderPlayers(): void {
  if (!room) return;
  const maxLives = Math.max(1, room.settings.startingLives);
  const sig = `${room.selfId}|${maxLives}|${room.opponentId ?? ''}|${JSON.stringify(room.players)}`;
  if (sig === playersSig) return;
  playersSig = sig;
  const players = [...room.players].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    if (!a.alive) return (a.placement ?? 99) - (b.placement ?? 99);
    if (a.lives !== b.lives) return b.lives - a.lives;
    if (a.streak !== b.streak) return b.streak - a.streak;
    return (a.placement ?? 99) - (b.placement ?? 99);
  });
  const aliveCount = players.filter((player) => player.alive).length;
  const rows = players
    .map((player, index) => {
      const classes = ['leader-row'];
      if (player.id === room?.selfId) classes.push('self');
      if (!player.alive) classes.push('dead');
      const nextOpponent = player.id === room?.opponentId && player.id !== room?.selfId && player.alive;
      if (nextOpponent) classes.push('next-opponent');
      const hpPercent = Math.max(0, Math.min(100, (player.lives / maxLives) * 100));
      if (hpPercent <= 25) classes.push('hp-low');
      const rank = player.alive ? index + 1 : (player.placement ?? index + 1);
      const streak =
        player.streak > 0
          ? `<span class="leader-streak hot" title="Победная серия: ${player.streak}">▲ ${player.streak}</span>`
          : player.streak < 0
            ? `<span class="leader-streak cold" title="Серия поражений: ${Math.abs(player.streak)}">▼ ${Math.abs(player.streak)}</span>`
            : '';
      const initial = escapeHtml(player.name.slice(0, 1).toUpperCase() || '?');
      return `
        <div class="${classes.join(' ')}" data-player-id="${escapeHtml(player.id)}" data-streak="${Math.min(8, Math.max(0, player.streak))}">
          <span class="leader-rank ${rank === 1 ? 'first' : ''}">${rank}</span>
          <span class="leader-avatar">${initial}</span>
          <div class="leader-main">
            <div class="leader-line">
              <b class="leader-name">${escapeHtml(player.name)}</b>
              ${player.isBot ? '<span class="bot-tag">ИИ</span>' : ''}
              ${nextOpponent ? '<span class="opp-tag">соперник</span>' : ''}
              <span class="leader-lives">${player.lives}</span>
            </div>
            <div class="leader-hp" role="progressbar" aria-valuemin="0" aria-valuemax="${maxLives}" aria-valuenow="${player.lives}" aria-label="Здоровье">
              <i style="width:${hpPercent.toFixed(1)}%"></i>
            </div>
            <div class="leader-meta">
              <span>lvl. ${player.level}</span>
              ${streak}
              ${player.alive ? '' : '<span class="dead-tag">выбыл</span>'}
            </div>
          </div>
        </div>`;
    })
    .join('');
  playersPanel.innerHTML = `
    <div class="panel-head">
      <span>Таблица лидеров</span>
      <b>${aliveCount} / ${players.length}</b>
    </div>
    <div class="leader-list">${rows}</div>`;
}

const SYNERGY_ICON_FALLBACK = 'rune';

function renderSynergies(): void {
  if (!room?.self) return;
  const list = room.self.synergies;
  const sig = JSON.stringify(list);
  if (sig === synergySig) return;
  synergySig = sig;
  const activeCount = list.filter((synergy) => synergy.active).length;
  if (list.length === 0) {
    synergyPanel.innerHTML = `
      <div class="panel-head"><span>Синергии</span><b>0</b></div>
      <div class="synergy-empty">
        <span class="syn-icon muted" aria-hidden="true">${traitIcon(SYNERGY_ICON_FALLBACK)}</span>
        <div><b>Пока пусто</b><p>Выставьте бойцов на поле, чтобы открыть бонусы рас и классов.</p></div>
      </div>`;
    return;
  }
  synergyPanel.innerHTML = `
    <div class="panel-head"><span>Синергии</span><b>${activeCount} / ${list.length}</b></div>
    <div class="synergy-list">
      ${list
        .map((synergy) => {
          const target = synergy.next ?? synergy.threshold ?? Math.max(1, synergy.count);
          const percent = Math.max(0, Math.min(100, (synergy.count / Math.max(1, target)) * 100));
          const effect = synergy.effects[Math.max(0, synergy.tier - 1)] ?? synergy.effects[0] ?? '';
          return `
            <div class="synergy-item ${synergy.active ? 'active' : ''} ${synergy.group} race-${synergy.key}">
              <span class="syn-icon" aria-hidden="true">${traitIcon(synergy.key)}</span>
              <div class="syn-body">
                <div class="syn-line"><b>${escapeHtml(synergy.name)}</b><span>${synergy.count} / ${target}</span></div>
                <div class="syn-bar"><i style="width:${percent.toFixed(1)}%"></i></div>
                <div class="syn-desc">${escapeHtml(effect)}</div>
              </div>
            </div>`;
        })
        .join('')}
    </div>`;
}

function unitCardMarkup(
  def: UnitDef,
  star: number,
  attributes: string,
  extraClass = '',
  upgradeReady = false,
  previewIndex = -1,
): string {
  const mult = STAR_MULTIPLIER[star] ?? 1;
  const glow = `race-${def.race}`;
  return `
    <button class="unit-card cost-${def.cost} ${glow} ${extraClass}" ${attributes} data-def="${def.id}" data-star="${star}">
      ${upgradeReady ? '<span class="upgrade-tag">Триплет</span>' : ''}
      <span class="cost">${def.cost}</span>
      <div class="unit-stars">${star > 1 ? stars(star) : ''}</div>
      <div class="unit-name">${escapeHtml(def.name)}</div>
      <div class="unit-preview" data-preview-index="${previewIndex}"></div>
      <div class="unit-traits">${traitLabel(def.race, RACE_NAMES[def.race])}<i>·</i>${traitLabel(def.unitClass, CLASS_NAMES[def.unitClass])}</div>
      <div class="unit-stats">
        <span>HP <b>${formatNumber(def.hp * mult)}</b></span>
        <span>ATK <b>${formatNumber(def.attack * mult)}</b></span>
      </div>
      <div class="unit-ability">${escapeHtml(def.ability.name)}</div>
      <span class="buy-tag">Купить · ${def.cost}</span>
    </button>`;
}

function ownedStarOneCount(self: SelfView, defId: string): number {
  let count = 0;
  for (const unit of self.board) {
    if (unit.defId === defId && unit.star === 1) count++;
  }
  for (const unit of self.bench) {
    if (unit.defId === defId && unit.star === 1) count++;
  }
  return count;
}

function renderShop(): void {
  if (!room?.self) return;
  const self = room.self;
  const owned = [...self.board, ...self.bench]
    .filter((unit) => unit.star === 1)
    .map((unit) => unit.defId)
    .sort()
    .join(',');
  const sig = `${self.shop.join('|')}|${self.gold}|${owned}`;
  if (sig === shopSig) return;
  shopSig = sig;
  shopCards.innerHTML = self.shop
    .map((defId, index) => {
      if (!defId) {
        return '<div class="unit-card empty"><div class="unit-name">Пусто</div><div class="unit-traits">слот продан</div></div>';
      }
      const def = getUnitDef(defId);
      const upgradeReady = ownedStarOneCount(self, defId) >= 2;
      const classes = [self.gold < def.cost ? 'poor' : '', upgradeReady ? 'upgrade-ready' : '']
        .filter(Boolean)
        .join(' ');
      return unitCardMarkup(def, 1, `data-buy="${index}"`, classes, upgradeReady, index);
    })
    .join('');
  shopPreview.setUnits(self.shop);
}

function renderBench(): void {
  if (!room?.self) return;
  const self = room.self;
  const sig = `${selectedUid}|${self.bench.map((unit) => `${unit.uid}:${unit.defId}:${unit.star}`).join('|')}`;
  if (sig === benchSig) return;
  benchSig = sig;
  const cards: string[] = [];
  for (let i = 0; i < 9; i++) {
    const unit = self.bench[i];
    if (!unit) {
      cards.push('<div class="bench-card empty"></div>');
      continue;
    }
    const def = getUnitDef(unit.defId);
    cards.push(`
      <button class="bench-card race-${def.race} ${selectedUid === unit.uid ? 'selected' : ''}"
        data-bench-uid="${unit.uid}" data-def="${def.id}" data-star="${unit.star}">
        <span class="bench-preview" data-bench-preview="${i}" aria-hidden="true"></span>
        <span class="bench-stars">${unit.star > 1 ? stars(unit.star) : ''}</span>
        <span class="bench-cost">${def.cost}</span>
        <span class="bench-name">${traitIcon(def.race)}<em>${escapeHtml(def.name)}</em></span>
      </button>`);
  }
  benchCards.innerHTML = cards.join('');
  benchPreview.setUnits(
    Array.from({ length: BENCH_SIZE }, (_, index) => self.bench[index]?.defId ?? null),
    Array.from({ length: BENCH_SIZE }, (_, index) => self.bench[index]?.star ?? 1),
  );
}

function renderSelectedPanel(): void {
  if (!room?.self || room.phase !== 'prep' || !selectedUid) {
    selectedSig = '';
    selectedPanel.classList.add('hidden');
    return;
  }
  const self = room.self;
  const boardUnit = self.board.find((unit) => unit.uid === selectedUid);
  const benchUnit = self.bench.find((unit) => unit.uid === selectedUid);
  const unit = boardUnit ?? benchUnit;
  if (!unit) {
    selectedUid = null;
    selectedSig = '';
    selectedPanel.classList.add('hidden');
    return;
  }
  const sig = `${selectedUid}|${unit.defId}|${unit.star}|${boardUnit ? 'board' : 'bench'}`;
  if (sig === selectedSig) {
    selectedPanel.classList.remove('hidden');
    return;
  }
  selectedSig = sig;
  const def = getUnitDef(unit.defId);
  const mult = STAR_MULTIPLIER[unit.star] ?? 1;
  const refund = def.cost * Math.pow(3, unit.star - 1);
  selectedPanel.classList.remove('hidden');
  selectedPanel.innerHTML = `
    <h3>${escapeHtml(def.name)}</h3>
    <div class="selected-meta"><span>${traitLabel(def.race, RACE_NAMES[def.race])}</span><i>·</i><span>${traitLabel(def.unitClass, CLASS_NAMES[def.unitClass])}</span><i>·</i><span>${stars(unit.star)}</span></div>
    <div class="selected-stats">
      <span>HP ${formatNumber(def.hp * mult)}</span>
      <span>ATK ${formatNumber(def.attack * mult)}</span>
      <span>ARM ${def.armor}</span>
    </div>
    <div class="selected-ability"><b>${escapeHtml(def.ability.name)}.</b> ${escapeHtml(def.ability.description)}</div>
    <div class="selected-actions">
      ${boardUnit ? '<button class="btn" data-selected-action="bench" type="button">На скамью</button>' : ''}
      <button class="btn" data-selected-action="sell" type="button">Продать +${refund}</button>
    </div>`;
}

function renderBattleResult(): void {
  if (
    !battle?.result ||
    !room ||
    !room.self?.alive ||
    (room.phase !== 'combat' && room.phase !== 'result')
  ) {
    resultSig = '';
    battleResult.classList.add('hidden');
    return;
  }
  const self = room.self;
  const damageTaken = self.lastDamage;
  const damageDealt = self.lastDamageDealt ?? 0;
  const goldEarned = self.lastGoldEarned ?? 0;
  const sig = `${battle.result}|${battle.opponentName}|${room.phase}|${damageTaken}|${damageDealt}|${goldEarned}`;
  if (sig === resultSig) {
    battleResult.classList.remove('hidden');
    return;
  }
  resultSig = sig;

  const outcome = battle.result;
  const word = outcome === 'win' ? 'Победа' : outcome === 'loss' ? 'Поражение' : 'Ничья';
  const art = outcome === 'win' ? '/img/win.png' : outcome === 'loss' ? '/img/loss.png' : '';

  const damage = outcome === 'win' ? damageDealt : damageTaken;
  const damageLabel = outcome === 'win' ? 'урон по врагу' : outcome === 'loss' ? 'урон по вам' : 'урон';
  const damageTile =
    damage > 0
      ? `<div class="result-stat damage ${outcome === 'win' ? 'dealt' : 'taken'}">
          <span class="res-icon heart" aria-hidden="true"></span>
          <span class="result-stat-copy">
            <small>${damageLabel}</small>
            <b>−${damage}</b>
          </span>
        </div>`
      : '';
  const goldTile =
    goldEarned > 0
      ? `<div class="result-stat gold">
          <span class="res-icon coin" aria-hidden="true"></span>
          <span class="result-stat-copy">
            <small>золото за раунд</small>
            <b>+${goldEarned}</b>
          </span>
        </div>`
      : '';

  battleResult.className = `battle-result ${outcome}${art ? ' has-art' : ''}`;
  battleResult.innerHTML = `
    ${
      art
        ? `<div class="result-art">
            <img class="result-art-img" src="${art}" alt="${word}" draggable="false" />
            <div class="result-word">${word}</div>
          </div>`
        : `<div class="result-word result-word-plain">${word}</div>`
    }
    <div class="result-report">
      <div class="result-opponent">
        <span>соперник</span>
        <b>${escapeHtml(battle.opponentName)}</b>
      </div>
      <div class="result-stats">${damageTile}${goldTile}</div>
    </div>`;
}

function renderPhaseBanner(): void {
  if (!room) return;
  const observing = room.self?.alive === false;
  const lastResult = room.self?.lastResult ?? null;
  const lastDamage = room.self?.lastDamage ?? 0;
  const sig = `${room.phase}|${room.round}|${room.opponentName ?? ''}|${observing}|${lastResult}|${lastDamage}`;
  if (sig === phaseSig) return;
  phaseSig = sig;
  if (observing) {
    phaseBanner.innerHTML = `<div class="banner-main">Наблюдение</div><div class="banner-sub">Раунд ${room.round}</div>`;
  } else if (room.phase === 'prep') {
    const opponent = room.opponentName
      ? ` · соперник: ${escapeHtml(room.opponentName)}`
      : '';
    phaseBanner.innerHTML = `<div class="banner-main">Подготовка</div><div class="banner-sub">Раунд ${room.round}${opponent}</div>`;
  } else if (room.phase === 'combat') {
    phaseBanner.innerHTML = `<div class="banner-main">Бой</div><div class="banner-sub">против ${escapeHtml(room.opponentName ?? 'неизвестного соперника')}</div>`;
  } else if (room.phase === 'result') {
    const resultWord = lastResult === 'win' ? 'победа' : lastResult === 'loss' ? 'поражение' : lastResult === 'draw' ? 'ничья' : '';
    const damageText = lastResult && lastResult !== 'win' && lastDamage > 0 ? ` · −${lastDamage} ${livesWord(lastDamage)}` : '';
    const recap = resultWord ? `<div class="banner-sub">${resultWord}${damageText}</div>` : '';
    phaseBanner.innerHTML = `<div class="banner-main">Итоги раунда</div>${recap}`;
  } else {
    phaseBanner.innerHTML = '';
  }
}

function renderLobby(): void {
  if (!room) return;
  syncMapLabels();
  byId('roomName').textContent = room.name;
  byId('roomCode').textContent = room.code;
  byId('lobbyCount').textContent = `${room.players.length} / ${room.settings.maxPlayers}`;
  const me = room.players.find((player) => player.id === room?.selfId);
  const isHost = room.hostId === room.selfId;

  const slots: string[] = [];
  for (let i = 0; i < room.settings.maxPlayers; i++) {
    const player = room.players[i];
    if (!player) {
      slots.push('<div class="player-slot empty"><span>Свободное место</span></div>');
      continue;
    }
    const classes = ['player-slot'];
    if (player.id === room.selfId) classes.push('self');
    if (player.isBot) classes.push('bot');
    const role = player.isBot ? 'Бот' : player.host ? 'Хозяин зала' : 'Игрок';
    slots.push(`
      <div class="${classes.join(' ')}">
        <div class="player-avatar">${escapeHtml(player.name.slice(0, 1).toUpperCase())}</div>
        <div class="player-slot-info">
          <b>${escapeHtml(player.name)}</b>
          <span>${role}${player.id === room.selfId ? ' · вы' : ''}</span>
        </div>
        <span class="ready-pill ${player.ready || player.isBot ? '' : 'not'}">${player.isBot || player.ready ? 'готов' : 'не готов'}</span>
      </div>`);
  }
  lobbyPlayers.innerHTML = slots.join('');

  const settings = room.settings;
  const settingsTiles: [string, string][] = [
    ['Игроки', String(settings.maxPlayers)],
    ['Старт. золото', String(settings.startingGold)],
    ['Старт. уровень', String(settings.startingLevel)],
    ['Жизни', String(settings.startingLives)],
    ['Подготовка', `${settings.prepSeconds} сек`],
    ['Раунды', String(settings.maxRounds)],
    ['Боты', settings.aiFill ? 'добивают' : 'нет'],
    ['Доступ', settings.privateLobby ? 'по коду' : 'публичный'],
  ];
  lobbySettings.innerHTML = settingsTiles
    .map(([label, value]) => `<div class="setting-tile"><span>${label}</span><b>${value}</b></div>`)
    .join('');

  readyBtn.textContent = me?.ready ? 'Не готов' : 'Готов';
  readyBtn.disabled = false;
  startBtn.classList.toggle('hidden', !isHost);
  if (isHost) {
    const unready = room.players.filter((player) => !player.isBot && player.id !== room!.hostId && !player.ready);
    startBtn.disabled = unready.length > 0 || (room.players.length < 2 && !settings.aiFill);
  }
  if (isHost) {
    if (room.players.length < 2 && !settings.aiFill) {
      lobbyHint.textContent = 'Нужен ещё игрок или включите добивание ботами.';
    } else if (room.players.some((player) => !player.isBot && player.id !== room!.hostId && !player.ready)) {
      lobbyHint.textContent = 'Дождитесь готовности всех игроков.';
    } else if (settings.aiFill) {
      lobbyHint.textContent = 'Свободные места займут боты. Можно начинать.';
    } else {
      lobbyHint.textContent = 'Все готовы. Запускайте матч.';
    }
  } else {
    lobbyHint.textContent = me?.ready ? 'Вы готовы. Ждём хозяина зала.' : 'Нажмите «Готов», когда закончите с настройкой.';
  }
}

function renderLobbyList(lobbies: { code: string; name: string; hostName: string; players: number; maxPlayers: number; aiFill: boolean }[]): void {
  if (lobbies.length === 0) {
    lobbyList.innerHTML = '<div class="empty-state">Пока нет открытых лобби.<br />Создайте своё!</div>';
    return;
  }
  lobbyList.innerHTML = lobbies
    .map(
      (lobby) => `
        <div class="lobby-row">
          <div>
            <div class="lobby-code">${escapeHtml(lobby.code)}</div>
            <small>${lobby.players}/${lobby.maxPlayers}${lobby.aiFill ? ' · ИИ' : ''}</small>
          </div>
          <div>
            <div class="lobby-name">${escapeHtml(lobby.name)}</div>
            <small>хозяин: ${escapeHtml(lobby.hostName)}</small>
          </div>
          <button class="btn" data-join="${escapeHtml(lobby.code)}" type="button">Войти</button>
        </div>`,
    )
    .join('');
}

function openCreateModal(): void {
  const name = currentName();
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="createModal">
      <div class="modal">
        <h2>Создать лобби</h2>
        <p class="modal-sub">Настройте правила зала. Код можно отправить друзьям, а свободные места займут боты.</p>
        <form id="createForm">
          <div class="form-grid">
            <label class="form-field full">
              <span>Название зала</span>
              <input name="roomName" maxlength="30" value="${escapeHtml(`${name}: арена`)}" />
            </label>
            <label class="form-field">
              <span>Максимум игроков</span>
              <select name="maxPlayers">
                ${[2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}" ${n === DEFAULT_SETTINGS.maxPlayers ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </label>
            <label class="form-field">
              <span>Стартовое золото</span>
              <input name="startingGold" type="number" min="0" max="20" value="${DEFAULT_SETTINGS.startingGold}" />
            </label>
            <label class="form-field">
              <span>Стартовый уровень</span>
              <select name="startingLevel">
                ${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${n === DEFAULT_SETTINGS.startingLevel ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </label>
            <label class="form-field">
              <span>Жизни</span>
              <input name="startingLives" type="number" min="5" max="60" value="${DEFAULT_SETTINGS.startingLives}" />
            </label>
            <label class="form-field">
              <span>Подготовка, сек</span>
              <input name="prepSeconds" type="number" min="10" max="90" value="${DEFAULT_SETTINGS.prepSeconds}" />
            </label>
            <label class="form-field">
              <span>Максимум раундов</span>
              <input name="maxRounds" type="number" min="5" max="40" value="${DEFAULT_SETTINGS.maxRounds}" />
            </label>
            <div class="check-row full">
              <label class="check-field"><input type="checkbox" name="aiFill" checked /> Добивать свободные места ботами</label>
              <label class="check-field"><input type="checkbox" name="privateLobby" /> Приватное лобби (только по коду)</label>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn" type="button" id="cancelCreate">Отмена</button>
            <button class="btn btn-primary" type="submit">Создать зал</button>
          </div>
        </form>
      </div>
    </div>`;
  byId('cancelCreate').addEventListener('click', closeModal);
  byId('createModal').addEventListener('click', (event) => {
    if ((event.target as HTMLElement).id === 'createModal') closeModal();
  });
  byId<HTMLFormElement>('createForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const settings: Partial<LobbySettings> = {
      maxPlayers: Number(form.get('maxPlayers')),
      startingGold: Number(form.get('startingGold')),
      startingLevel: Number(form.get('startingLevel')),
      startingLives: Number(form.get('startingLives')),
      prepSeconds: Number(form.get('prepSeconds')),
      maxRounds: Number(form.get('maxRounds')),
      aiFill: form.get('aiFill') === 'on',
      privateLobby: form.get('privateLobby') === 'on',
    };
    gameOverShown = false;
    surrenderPending = false;
    net.send({ type: 'create_lobby', name: String(form.get('roomName') ?? 'Арена'), settings });
    closeModal();
  });
}

function openRulesModal(): void {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="rulesModal">
      <div class="modal rules-modal">
        <h2>Правила арены</h2>
        <p class="modal-sub">Короткая памятка по текущему матчу.</p>
        <div class="rules-grid">
          <div class="rule-card">
            <b>Экономика</b>
            <p>Каждый раунд вы получаете базовое золото, проценты с накоплений, бонус за серию и +1 за победу.</p>
          </div>
          <div class="rule-card">
            <b>Магазин</b>
            <p>Пять бойцов. Обновление стоит 2 золота, опыт — 4. Замок сохраняет магазин на следующий раунд.</p>
          </div>
          <div class="rule-card">
            <b>Объединение</b>
            <p>Три одинаковых бойца одного уровня объединяются в бойца следующей звезды. Подсвеченные карточки подскажут триплет.</p>
          </div>
          <div class="rule-card">
            <b>Бой</b>
            <p>Бойцы действуют автоматически. Побеждает отряд, который уничтожит соперника. Ничья ранит обоих.</p>
          </div>
          <div class="rule-card">
            <b>Жизни</b>
            <p>Поражение отнимает жизни. На нуле вы выбываете, но можете наблюдать за матчем до конца.</p>
          </div>
          <div class="rule-card">
            <b>Синергии</b>
            <p>Расы и классы на поле открывают бонусы при достижении порогов. Следите за панелью синергий.</p>
          </div>
          <div class="rule-card">
            <b>Сдача</b>
            <p>Кнопка «Сдаться» сразу завершает ваш матч и фиксирует текущее место. Отменить сдачу нельзя.</p>
          </div>
          <div class="rule-card">
            <b>Победа</b>
            <p>Последний выживший игрок занимает первое место. Общий пул бойцов не даёт собрать всё одним игрокам.</p>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="closeRules" type="button">Понятно</button>
        </div>
      </div>
    </div>`;
  byId('closeRules').addEventListener('click', closeModal);
  byId('rulesModal').addEventListener('click', (event) => {
    if ((event.target as HTMLElement).id === 'rulesModal') closeModal();
  });
}

function openSurrenderModal(): void {
  if (!room?.self?.alive || room.phase === 'finished') return;
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="surrenderModal">
      <div class="modal confirm-modal">
        <h2>Сдаться?</h2>
        <p class="modal-sub">Вы сразу выбудете из матча. Текущее место будет зафиксировано, вернуться в этот бой нельзя.</p>
        <div class="modal-actions">
          <button class="btn" id="cancelSurrender" type="button">Остаться</button>
          <button class="btn btn-danger" id="confirmSurrender" type="button">Сдаться</button>
        </div>
      </div>
    </div>`;
  byId('cancelSurrender').addEventListener('click', closeModal);
  byId('confirmSurrender').addEventListener('click', () => {
    closeModal();
    surrenderPending = true;
    surrenderBtn.disabled = true;
    net.send({ type: 'surrender' });
  });
  byId('surrenderModal').addEventListener('click', (event) => {
    if ((event.target as HTMLElement).id === 'surrenderModal') closeModal();
  });
}

function closeModal(): void {
  modalRoot.innerHTML = '';
}

function showGameOver(
  placement: number,
  totalPlayers: number,
  victory: boolean,
  reason?: 'surrender',
): void {
  if (gameOverShown) return;
  gameOverShown = true;
  if (reason === 'surrender') {
    gameOverTitle.textContent = 'Вы сдались';
    gameOverText.textContent = `Матч завершён для вас. Итоговое место — ${placement} из ${totalPlayers}.`;
  } else {
    gameOverTitle.textContent = victory ? 'Арена ваша' : 'Матч завершён';
    gameOverText.textContent = victory
      ? `Первое место из ${totalPlayers}. Отряд выстоял, синергии сработали, арена покорена.`
      : `Вы заняли ${placement} место из ${totalPlayers}. Соберите новый отряд и попробуйте снова.`;
  }
  gameOverEmblem.style.opacity = victory ? '1' : '0.55';
  gameOver.classList.remove('hidden');
}

function showTooltip(defId: string, star: number, x: number, y: number): void {
  const def = getUnitDef(defId);
  const mult = STAR_MULTIPLIER[star] ?? 1;
  lastTooltipDef = defId;
  lastTooltipPlayer = null;
  tooltip.classList.remove('player-tip');
  tooltip.innerHTML = `
    <div class="tip-name">${escapeHtml(def.name)} ${star > 1 ? stars(star) : ''}</div>
    <div class="tip-meta">${traitLabel(def.race, RACE_NAMES[def.race])}<i>·</i>${traitLabel(def.unitClass, CLASS_NAMES[def.unitClass])}<i>·</i>${def.cost} золота</div>
    <div class="tip-stats">
      <span>HP ${formatNumber(def.hp * mult)}</span>
      <span>ATK ${formatNumber(def.attack * mult)}</span>
      <span>ARM ${def.armor}</span>
      <span>MANA ${def.maxMana}</span>
    </div>
    <div class="tip-ability"><b>${escapeHtml(def.ability.name)}.</b> ${escapeHtml(def.ability.description)}</div>
    <div class="tip-flavor">${escapeHtml(def.flavor)}</div>`;
  tooltip.classList.remove('hidden');
  positionTooltip(x, y);
}

function showPlayerTooltip(playerId: string, x: number, y: number): void {
  if (!room) return;
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) return;
  if (lastTooltipPlayer === playerId && !tooltip.classList.contains('hidden')) return;
  lastTooltipDef = null;
  lastTooltipPlayer = player.id;

  const grouped = new Map<string, { count: number; topStar: number; cost: number }>();
  const races = new Map<string, { name: string; count: number }>();
  const classes = new Map<string, { name: string; count: number }>();
  for (const unit of player.board) {
    const def = getUnitDef(unit.defId);
    const group = grouped.get(unit.defId);
    if (group) {
      group.count += 1;
      group.topStar = Math.max(group.topStar, unit.star);
    } else {
      grouped.set(unit.defId, { count: 1, topStar: unit.star, cost: def.cost });
    }
    const race = races.get(def.race);
    if (race) race.count += 1;
    else races.set(def.race, { name: RACE_NAMES[def.race], count: 1 });
    const unitClass = classes.get(def.unitClass);
    if (unitClass) unitClass.count += 1;
    else classes.set(def.unitClass, { name: CLASS_NAMES[def.unitClass], count: 1 });
  }

  const unitRows = [...grouped.entries()]
    .sort((a, b) => b[1].cost - a[1].cost || b[1].count - a[1].count)
    .map(([defId, info]) => {
      const def = getUnitDef(defId);
      const starText = info.topStar > 1 ? ` <span class="tip-unit-stars">${stars(info.topStar)}</span>` : '';
      return `
        <div class="tip-unit-row">
          <span>${escapeHtml(def.name)}${starText}</span>
          <span class="tip-unit-count">×${info.count}</span>
        </div>`;
    })
    .join('');
  const formatGroup = (groups: Map<string, { name: string; count: number }>) =>
    [...groups.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map((entry) => `${escapeHtml(entry.name)} ${entry.count}`)
      .join(' · ');
  const raceText = formatGroup(races);
  const classText = formatGroup(classes);
  const place = player.placement ? ` · место ${player.placement}` : '';
  const status = player.alive ? '' : ' · выбыл';
  const streakText =
    player.streak > 0
      ? ` · серия ${player.streak}`
      : player.streak < 0
        ? ` · поражений ${Math.abs(player.streak)}`
        : '';

  tooltip.classList.add('player-tip');
  tooltip.innerHTML = `
    <div class="tip-player-head">
      <div class="tip-name">${escapeHtml(player.name)}${player.isBot ? ' · ИИ' : ''}</div>
      <div class="tip-lives">${player.lives} ${livesWord(player.lives)}</div>
    </div>
    <div class="tip-meta">lvl. ${player.level}${place}${streakText}${status}</div>
    <div class="tip-comp-title">Состав · ${player.board.length}</div>
    <div class="tip-units">${unitRows || '<div class="tip-empty">Поле пустое</div>'}</div>
    <div class="tip-synergy-row"><span>Расы</span><b>${raceText || '—'}</b></div>
    <div class="tip-synergy-row"><span>Классы</span><b>${classText || '—'}</b></div>`;
  tooltip.classList.remove('hidden');
  positionTooltip(x, y);
}

function positionTooltip(x: number, y: number): void {
  const width = tooltip.offsetWidth || 260;
  const height = tooltip.offsetHeight || 190;
  let left = x + 16;
  let top = y + 16;
  if (left + width > window.innerWidth - 10) left = x - width - 16;
  if (top + height > window.innerHeight - 10) top = y - height - 16;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function hideTooltip(): void {
  tooltip.classList.add('hidden');
  tooltip.classList.remove('player-tip');
  lastTooltipDef = null;
  lastTooltipPlayer = null;
}

// ---------- Drag & drop ----------

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (!room || room.phase !== 'prep' || !room.self?.alive) return;
  const uid = scene.pickUnitAt(event.clientX, event.clientY);
  if (!uid || !room.self.board.some((unit) => unit.uid === uid)) return;
  beginDrag(uid, 'board', event);
});

benchCards.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (!room || room.phase !== 'prep' || !room.self?.alive) return;
  const target = (event.target as HTMLElement).closest('[data-bench-uid]') as HTMLElement | null;
  if (!target?.dataset.benchUid) return;
  beginDrag(target.dataset.benchUid, 'bench', event);
});

document.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.active) {
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
    activateDrag();
  }
  event.preventDefault();
  updateGhostPosition(event.clientX, event.clientY);
  updateDropTarget(event.clientX, event.clientY);
});

document.addEventListener('pointerup', finishDrag);
document.addEventListener('pointercancel', () => cancelDrag());
window.addEventListener('blur', () => cancelDrag());

// ---------- UI events ----------

playerNameInput.addEventListener('change', () => {
  const name = currentName();
  net.send({ type: 'set_name', name });
});

byId('quickPlay').addEventListener('click', () => {
  if (!requireOnline()) return;
  syncName();
  gameOverShown = false;
  surrenderPending = false;
  net.send({ type: 'quick_play' });
});

byId('openCreate').addEventListener('click', () => {
  if (!requireOnline()) return;
  syncName();
  openCreateModal();
});

byId('joinBtn').addEventListener('click', () => {
  if (!requireOnline()) return;
  syncName();
  const code = codeInput.value.trim().toUpperCase();
  if (code.length < 4) {
    toast('Введите код лобби.', 'error');
    return;
  }
  net.send({ type: 'join_lobby', code });
});

codeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') byId<HTMLButtonElement>('joinBtn').click();
});

codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
});

byId('refreshLobbies').addEventListener('click', () => net.send({ type: 'list_lobbies' }));

mapGrid.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('[data-map-choice]') as HTMLElement | null;
  const id = target?.dataset.mapChoice;
  if (!id || !MAP_IDS.has(id as MapId)) return;
  selectMap(id as MapId);
});

shopToggleBtn.addEventListener('click', () => {
  if (!room?.self?.alive || room.phase !== 'prep') return;
  setShopOpen(!shopOpen);
});

shopCloseBtn.addEventListener('click', () => setShopOpen(false));

lobbyList.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('[data-join]') as HTMLElement | null;
  if (!target) return;
  syncName();
  net.send({ type: 'join_lobby', code: target.dataset.join ?? '' });
});

byId('copyCode').addEventListener('click', async () => {
  if (!room) return;
  try {
    await navigator.clipboard.writeText(room.code);
    toast('Код скопирован.', 'success');
  } catch {
    toast(`Код: ${room.code}`);
  }
});

readyBtn.addEventListener('click', () => {
  const me = room?.players.find((player) => player.id === room?.selfId);
  net.send({ type: 'ready', ready: !me?.ready });
});

startBtn.addEventListener('click', () => {
  net.send({ type: 'start_game' });
});

for (const id of ['leaveLobbyTop']) {
  byId(id).addEventListener('click', () => {
    net.send({ type: 'leave_lobby' });
    resetToMenu();
  });
}

byId('backToMenu').addEventListener('click', () => {
  net.send({ type: 'leave_lobby' });
  resetToMenu();
});

byId('spectatorLeave').addEventListener('click', () => {
  net.send({ type: 'leave_lobby' });
  resetToMenu();
});

rulesBtn.addEventListener('click', openRulesModal);
surrenderBtn.addEventListener('click', openSurrenderModal);

byId('xpBtn').addEventListener('click', () => net.send({ type: 'buy_xp' }));
byId('rerollBtn').addEventListener('click', () => net.send({ type: 'reroll' }));
byId('lockBtn').addEventListener('click', () => net.send({ type: 'toggle_lock' }));

shopCards.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('[data-buy]') as HTMLElement | null;
  if (!target) return;
  net.send({ type: 'buy_unit', index: Number(target.dataset.buy) });
  hideTooltip();
});

benchCards.addEventListener('click', (event) => {
  if (suppressBenchClick) {
    suppressBenchClick = false;
    return;
  }
  const target = (event.target as HTMLElement).closest('[data-bench-uid]') as HTMLElement | null;
  if (!target) return;
  const uid = target.dataset.benchUid ?? null;
  selectedUid = selectedUid === uid ? null : uid;
  refreshSelection();
});

selectedPanel.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('[data-selected-action]') as HTMLElement | null;
  if (!target || !selectedUid) return;
  const action = target.dataset.selectedAction;
  if (action === 'bench') {
    net.send({ type: 'move_unit', uid: selectedUid, to: { type: 'bench' } });
    selectedUid = null;
    refreshSelection();
  } else if (action === 'sell') {
    net.send({ type: 'sell_unit', uid: selectedUid });
    selectedUid = null;
    refreshSelection();
  }
});

document.addEventListener('pointerover', (event) => {
  const playerTarget = (event.target as HTMLElement).closest('[data-player-id]') as HTMLElement | null;
  if (playerTarget?.dataset.playerId) {
    const rect = playerTarget.getBoundingClientRect();
    showPlayerTooltip(playerTarget.dataset.playerId, rect.left + rect.width / 2, rect.top);
    return;
  }
  const target = (event.target as HTMLElement).closest('[data-def]') as HTMLElement | null;
  if (!target || !target.dataset.def) return;
  const star = Number(target.dataset.star ?? 1);
  const rect = target.getBoundingClientRect();
  showTooltip(target.dataset.def, star, rect.left + rect.width / 2, rect.top);
});

document.addEventListener('pointerout', (event) => {
  const from = (event.target as HTMLElement).closest('[data-def], [data-player-id]') as HTMLElement | null;
  if (!from) return;
  const to =
    event.relatedTarget instanceof Element
      ? (event.relatedTarget.closest('[data-def], [data-player-id]') as HTMLElement | null)
      : null;
  if (to === from) return;
  hideTooltip();
});

document.addEventListener('pointermove', (event) => {
  if (!tooltip.classList.contains('hidden')) positionTooltip(event.clientX, event.clientY);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (drag) cancelDrag();
    else if (modalRoot.innerHTML) closeModal();
    else if (shopOpen) setShopOpen(false);
    else if (selectedUid) {
      selectedUid = null;
      refreshSelection();
    }
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
  if ((event.key === 'b' || event.key === 'B') && currentScreen === 'game') {
    if (room?.self?.alive && room.phase === 'prep') {
      event.preventDefault();
      setShopOpen(!shopOpen);
    }
  }
});

window.setInterval(updateClock, 200);

if (storedName) {
  playerNameInput.value = storedName;
}
renderMapGrid();
syncMapLabels();
const initialName = currentName();
net.connect(initialName);
