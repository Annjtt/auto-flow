import express from 'express';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/types';
import { RoomManager, type Session } from './rooms';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../../dist');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const manager = new RoomManager();
const socketSessions = new WeakMap<WebSocket, Session>();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: manager.rooms.size, uptime: process.uptime() });
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
});
