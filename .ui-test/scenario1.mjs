import { connect, launch } from './cdp.mjs';
import fs from 'node:fs';

const out = 'C:\\Windows\\Temp\\opencode\\shots';
fs.mkdirSync(out, { recursive: true });

const result = await (async () => {
await launch();
const c = await connect();
await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await c.send('Page.navigate', { url: 'http://localhost:5173/' });
await c.waitFor(`document.readyState === 'complete'`, 30000);
await new Promise((r) => setTimeout(r, 1200));
await c.shot(`${out}/01-menu.png`);
const menuInfo = await c.evaluate(`(() => {
  const shell = document.querySelector('.menu-shell');
  const grid = document.querySelector('#mapGrid');
  const cards = [...document.querySelectorAll('.map-card')];
  return {
    innerWidth: window.innerWidth,
    shellCols: getComputedStyle(shell).gridTemplateColumns,
    gridCols: getComputedStyle(grid).gridTemplateColumns,
    cards: cards.map(c => ({ name: c.querySelector('b')?.textContent, selected: c.classList.contains('selected'), w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height) })),
    bodyScrollHeight: document.body.scrollHeight,
  };
})()`);

// select each map to verify theme switching
const mapNames = [];
for (const idx of [0, 1, 2, 3]) {
  await c.evaluate(`document.querySelectorAll('.map-card')[${idx}].click()`);
  const info = await c.evaluate(`({ map: document.body.dataset.map, accent: getComputedStyle(document.body).getPropertyValue('--map-accent').trim(), selected: [...document.querySelectorAll('.map-card')].findIndex(c => c.classList.contains('selected')) })`);
  mapNames.push(info);
  await c.shot(`${out}/02-map-${idx}-${info.map}.png`);
}

// quick play
await c.evaluate(`document.getElementById('quickPlay').click()`);
await c.waitFor(`document.getElementById('game-screen').classList.contains('active')`, 15000);
await new Promise((r) => setTimeout(r, 2500));
await c.shot(`${out}/10-game-prep.png`);

const world = await c.evaluate(`(() => {
  const q = (s) => document.querySelector(s);
  const rect = (s) => { const el = q(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility }; };
  return {
    map: document.body.dataset.map,
    phase: q('#hudPhaseCard')?.dataset.phase,
    round: q('#hudRound')?.textContent,
    phaseTimer: q('#hudTimer')?.textContent,
    shopHidden: q('#shopBar')?.classList.contains('hidden'),
    shopRect: rect('#shopBar'),
    benchRect: rect('#benchCards'),
    benchCards: [...document.querySelectorAll('#benchCards > *')].length,
    dockRect: rect('.board-dock'),
    players: rect('.players-panel'),
    synergy: rect('.synergy-panel'),
    shopCards: [...document.querySelectorAll('#shopCards > *')].map(el => ({ cls: el.className, name: el.querySelector('.unit-name')?.textContent, w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) })),
    shopBtn: rect('#shopToggleBtn'),
    xpBtn: rect('#xpBtn'),
    leaderRows: [...document.querySelectorAll('.leader-row')].length,
    synergyItems: [...document.querySelectorAll('.synergy-item')].length,
    errors: window.__errs || null,
  };
})()`);

// toggle shop closed and open
await c.evaluate(`document.getElementById('shopCloseBtn').click()`);
await new Promise((r) => setTimeout(r, 400));
const closed = await c.evaluate(`({ hidden: document.getElementById('shopBar').classList.contains('hidden'), toggleActive: document.getElementById('shopToggleBtn').classList.contains('active') })`);
await c.shot(`${out}/11-game-shop-closed.png`);
await c.evaluate(`document.getElementById('shopToggleBtn').click()`);
await new Promise((r) => setTimeout(r, 400));
const opened = await c.evaluate(`({ hidden: document.getElementById('shopBar').classList.contains('hidden'), toggleActive: document.getElementById('shopToggleBtn').classList.contains('active') })`);
await c.shot(`${out}/12-game-shop-open.png`);

// buy first affordable card
const buy = await c.evaluate(`(() => {
  const card = [...document.querySelectorAll('#shopCards .unit-card')].find(el => !el.classList.contains('empty'));
  if (!card) return { bought: false, reason: 'no card' };
  card.click();
  return { bought: true, name: card.querySelector('.unit-name')?.textContent };
})()`);
await new Promise((r) => setTimeout(r, 600));
await c.shot(`${out}/13-after-buy.png`);
const afterBuy = await c.evaluate(`({ bench: [...document.querySelectorAll('#benchCards > *')].map(el => el.className + ':' + (el.textContent||'').trim().slice(0,16)), shopCards: [...document.querySelectorAll('#shopCards > *')].length, gold: document.querySelector('#hudGold')?.textContent })`);

return { menuInfo, mapNames, world, closed, opened, buy, afterBuy, files: fs.readdirSync(out) };
})();
console.log(JSON.stringify(result, null, 2));