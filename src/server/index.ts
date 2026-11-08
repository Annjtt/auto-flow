import express from 'express';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/types';
import { RoomManager, type Session } from './rooms';
import { getActiveMaps, initMapStore, mapStoreInfo, publishMaps } from './mapStore';
import { getActiveTuning, initTuningStore, publishTuning, resetTuning, tuningStoreInfo } from './tuningStore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../../dist');

const tuning = initTuningStore();
const mapStore = initMapStore();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const manager = new RoomManager();
const socketSessions = new WeakMap<WebSocket, Session>();
const tuningToken = process.env.TUNING_TOKEN ?? '';
const mapsToken = process.env.MAPS_TOKEN ?? '';

function canPublish(req: express.Request): boolean {
  if (!tuningToken) return true;
  return req.get('x-tuning-token') === tuningToken;
}

function canPublishMaps(req: express.Request): boolean {
  if (!mapsToken) return true;
  return req.get('x-maps-token') === mapsToken;
}

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: manager.rooms.size, uptime: process.uptime() });
});

app.get('/api/tuning', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, ...tuningStoreInfo(), tuning: getActiveTuning() });
});

app.post('/api/tuning', (req, res) => {
  if (!canPublish(req)) {
    res.status(403).json({ ok: false, error: 'Неверный токен публикации тюнинга.' });
    return;
  }
  try {
    const result = publishTuning(req.body);
    res.json({
      ok: true,
      units: Object.keys(result.tuning.units).length,
      persisted: result.persisted,
      file: result.file,
      warning: result.error,
      tuning: result.tuning,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Некорректный тюнинг.' });
  }
});

app.post('/api/tuning/reset', (req, res) => {
  if (!canPublish(req)) {
    res.status(403).json({ ok: false, error: 'Неверный токен публикации тюнинга.' });
    return;
  }
  const result = resetTuning();
  res.json({ ok: true, units: 0, persisted: result.persisted, file: result.file, warning: result.error });
});

app.get('/api/maps', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, ...mapStoreInfo(), maps: getActiveMaps() });
});

app.post('/api/maps', (req, res) => {
  if (!canPublishMaps(req)) {
    res.status(403).json({ ok: false, error: 'Неверный токен публикации карт.' });
    return;
  }
  try {
    const result = publishMaps(req.body);
    res.json({
      ok: true,
      maps: result.maps.length,
      persisted: result.persisted,
      file: result.file,
      warning: result.error,
      documents: result.maps,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Некорректные карты.' });
  }
});

app.use(express.static(distDir));
app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html')) {
    res.sendFile(resolve(distDir, 'index.html'), (error) => {
      if (error) next();
    });
    return;
  }
  next();
});

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify(message));
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let message: ClientMessage;
    try {
      const parsed = JSON.parse(raw.toString()) as ClientMessage;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') throw new Error('invalid');
      message = parsed;
    } catch {
      send(ws, { type: 'error', message: 'Некорректный запрос.' });
      return;
    }

    let session = socketSessions.get(ws);
    if (!session) {
      if (message.type !== 'auth') {
        send(ws, { type: 'error', message: 'Сначала пройдите авторизацию.' });
        return;
      }
      session = manager.authenticate(ws, message.name, message.token);
      socketSessions.set(ws, session);
      return;
    }

    if (message.type === 'auth') return;
    manager.handleMessage(session, message);
  });

  ws.on('close', () => {
    const session = socketSessions.get(ws);
    if (session) manager.disconnect(session, ws);
  });

  ws.on('error', () => {
    // The close handler performs all cleanup.
  });
});

setInterval(() => manager.tick(100), 100);

const port = Number(process.env.PORT ?? 3001);
server.listen(port, '0.0.0.0', () => {
  console.log(`Auto Flow server listening on http://localhost:${port}`);
  console.log(
    `[tuning] ${tuning.units} изменённых юнитов${tuning.loaded ? ' (загружено с диска)' : ' (исходный баланс)'} · ${tuning.file}`,
  );
  console.log(
    `[maps] ${mapStore.maps} пользовательских карт${mapStore.loaded ? ' (загружено с диска)' : ' (нет файла)'} · ${mapStore.file}`,
  );
});
