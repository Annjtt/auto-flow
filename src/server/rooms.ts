import { randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import {
  DEFAULT_SETTINGS,
  type ClientMessage,
  type LobbySettings,
  type LobbySummary,
  type PublicPlayer,
  type RoomView,
  type ServerMessage,
} from '../shared/types';
import { Game } from './game';

export interface Session {
  id: string;
  token: string;
  name: string;
  ws: WebSocket | null;
  roomCode?: string;
}

interface Seat {
  id: string;
  name: string;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
}

type RoomPhase = 'waiting' | 'playing';

interface Room {
  code: string;
  name: string;
  hostId: string;
  settings: LobbySettings;
  seats: Seat[];
  game: Game | null;
  createdAt: number;
  finishedAt: number | null;
}

const BOT_NAMES = [
  'Морн', 'Ксил', 'Ржавый', 'Игнис', 'Селена', 'Гром', 'Векс', 'Тень',
  'Уголёк', 'Мира', 'Клык', 'Сайрус', 'Пепел', 'Нокс', 'Терн', 'Астра',
];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function sanitizeName(name: unknown, fallback = 'Странник'): string {
  if (typeof name !== 'string') return fallback;
  const clean = name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18);
  return clean.length > 0 ? clean : fallback;
}

function sanitizeRoomName(name: unknown, code: string): string {
  if (typeof name !== 'string') return `Зал ${code}`;
  const clean = name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30);
  return clean.length > 0 ? clean : `Зал ${code}`;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function sanitizeSettings(input: Partial<LobbySettings> = {}): LobbySettings {
  return {
    maxPlayers: clamp(input.maxPlayers, 2, 8, DEFAULT_SETTINGS.maxPlayers),
    startingGold: clamp(input.startingGold, 0, 20, DEFAULT_SETTINGS.startingGold),
    startingLevel: clamp(input.startingLevel, 1, 7, DEFAULT_SETTINGS.startingLevel),
    startingLives: clamp(input.startingLives, 5, 60, DEFAULT_SETTINGS.startingLives),
    prepSeconds: clamp(input.prepSeconds, 10, 90, DEFAULT_SETTINGS.prepSeconds),
    maxRounds: clamp(input.maxRounds, 5, 40, DEFAULT_SETTINGS.maxRounds),
    aiFill: input.aiFill !== false,
    privateLobby: input.privateLobby === true,
  };
}

export class RoomManager {
  rooms = new Map<string, Room>();
  sessions = new Map<string, Session>();
  tokens = new Map<string, Session>();
  private cleanupTimer = 0;

  authenticate(ws: WebSocket, rawName: unknown, token?: unknown): Session {
    const name = sanitizeName(rawName);
    let session: Session | undefined;
    if (typeof token === 'string') session = this.tokens.get(token);
    if (!session) {
      session = {
        id: randomUUID(),
        token: randomUUID(),
        name,
        ws: null,
      };
      this.sessions.set(session.id, session);
      this.tokens.set(session.token, session);
    }
    if (session.ws && session.ws !== ws) {
      try {
        session.ws.close();
      } catch {
        // Ignore sockets that are already closed.
      }
    }
    session.ws = ws;
    session.name = name;

    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    if (room) {
      const seat = room.seats.find((s) => s.id === session.id);
      if (seat) {
        seat.connected = true;
        seat.name = session.name;
        if (room.game) {
          const stillInGame = room.game.players.some((p) => p.id === session.id);
          if (!stillInGame) {
            session.roomCode = undefined;
          }
        }
      } else {
        session.roomCode = undefined;
      }
    } else {
      session.roomCode = undefined;
    }

    this.send(session, {
      type: 'auth',
      playerId: session.id,
      token: session.token,
      playerName: session.name,
    });

    if (session.roomCode) {
      const activeRoom = this.rooms.get(session.roomCode);
      if (activeRoom) {
        this.sendRoom(activeRoom, session.id);
        const snapshot = activeRoom.game?.getBattleSnapshotFor(session.id);
        if (snapshot) this.send(session, { type: 'battle', battle: snapshot });
        this.broadcastRoom(activeRoom);
      }
    }
    this.sendLobbyList(session);
    this.broadcastLobbyList();
    return session;
  }

  disconnect(session: Session, ws: WebSocket): void {
    if (session.ws !== ws) return;
    session.ws = null;
    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    if (!room) return;
    const seat = room.seats.find((s) => s.id === session.id);
    if (!seat) return;
    if (room.game) {
      seat.connected = false;
      this.broadcastRoom(room);
    } else {
      this.removeSeat(room, seat);
      session.roomCode = undefined;
      this.sendLobbyList(session);
      this.broadcastLobbyList();
    }
  }

  handleMessage(session: Session, message: ClientMessage): void {
    switch (message.type) {
      case 'auth':
        return;
      case 'set_name': {
        session.name = sanitizeName(message.name, session.name);
        const room = this.roomOf(session);
        if (room && !room.game) {
          const seat = room.seats.find((s) => s.id === session.id);
          if (seat) seat.name = session.name;
          this.broadcastRoom(room);
        }
        this.send(session, {
          type: 'auth',
          playerId: session.id,
          token: session.token,
          playerName: session.name,
        });
        return;
      }
      case 'list_lobbies':
        this.sendLobbyList(session);
        return;
      case 'create_lobby':
        this.createLobby(session, message.name, message.settings ?? {});
        return;
      case 'join_lobby':
        this.joinLobby(session, message.code);
        return;
      case 'quick_play':
        this.quickPlay(session);
        return;
      case 'leave_lobby':
        this.leaveLobby(session);
        return;
      case 'ready': {
        const room = this.roomOf(session);
        if (!room) return this.error(session, 'Вы не находитесь в лобби.');
        if (room.game) return this.error(session, 'Матч уже начался.');
        const seat = room.seats.find((s) => s.id === session.id);
        if (!seat) return;
        seat.ready = Boolean(message.ready);
        this.broadcastRoom(room);
        return;
      }
      case 'start_game': {
        const room = this.roomOf(session);
        if (!room) return this.error(session, 'Вы не находитесь в лобби.');
        if (room.hostId !== session.id) return this.error(session, 'Только хозяин лобби может начать матч.');
        this.startGame(room, false);
        return;
      }
      default:
        break;
    }

    const room = this.roomOf(session);
    if (!room?.game) return this.error(session, 'Матч ещё не начался.');
    const game = room.game;
    switch (message.type) {
      case 'buy_unit':
        game.buyUnit(session.id, Math.floor(message.index));
        break;
      case 'reroll':
        game.reroll(session.id);
        break;
      case 'buy_xp':
        game.buyXp(session.id);
        break;
      case 'toggle_lock':
        game.toggleLock(session.id);
        break;
      case 'move_unit':
        game.moveUnit(session.id, message.uid, message.to);
        break;
      case 'sell_unit':
        game.sellUnit(session.id, message.uid);
        break;
      case 'surrender':
        game.surrender(session.id);
        break;
      default:
        this.error(session, 'Неизвестное действие.');
    }
  }

  tick(dtMs: number): void {
    for (const room of this.rooms.values()) {
      if (room.game && room.game.phase !== 'finished') {
        room.game.tick(dtMs);
      }
    }
    this.cleanupTimer += dtMs;
    if (this.cleanupTimer >= 20000) {
      this.cleanupTimer = 0;
      this.cleanup();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const humans = room.seats.filter((s) => !s.isBot);
      const connected = humans.filter((s) => s.connected).length;
      if (connected > 0) continue;
      if (!room.game && now - room.createdAt > 60000) this.rooms.delete(code);
      if (room.finishedAt && now - room.finishedAt > 180000) this.rooms.delete(code);
    }
  }

  private createLobby(session: Session, rawName: unknown, rawSettings: Partial<LobbySettings>): void {
    if (session.roomCode) return this.error(session, 'Сначала покиньте текущее лобби.');
    const code = this.newCode();
    const settings = sanitizeSettings(rawSettings);
    const room: Room = {
      code,
      name: sanitizeRoomName(rawName, code),
      hostId: session.id,
      settings,
      seats: [
        {
          id: session.id,
          name: session.name,
          isBot: false,
          ready: false,
          connected: true,
        },
      ],
      game: null,
      createdAt: Date.now(),
      finishedAt: null,
    };
    this.rooms.set(code, room);
    session.roomCode = code;
    this.broadcastRoom(room);
    this.sendLobbyList(session);
    this.broadcastLobbyList();
  }

  private quickPlay(session: Session): void {
    if (session.roomCode) return this.error(session, 'Сначала покиньте текущее лобби.');
    const code = this.newCode();
    const settings = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      maxPlayers: 6,
      aiFill: true,
      privateLobby: true,
      prepSeconds: 30,
      startingLives: 30,
    });
    const room: Room = {
      code,
      name: `Быстрый бой ${code}`,
      hostId: session.id,
      settings,
      seats: [
        {
          id: session.id,
          name: session.name,
          isBot: false,
          ready: true,
          connected: true,
        },
      ],
      game: null,
      createdAt: Date.now(),
      finishedAt: null,
    };
    this.rooms.set(code, room);
    session.roomCode = code;
    this.fillBots(room);
    this.startGame(room, true);
  }

  private joinLobby(session: Session, rawCode: unknown): void {
    if (session.roomCode) return this.error(session, 'Сначала покиньте текущее лобби.');
    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    const room = this.rooms.get(code);
    if (!room) return this.error(session, 'Лобби с таким кодом не найдено.');
    if (room.game) return this.error(session, 'Этот матч уже начался.');
    if (room.seats.length >= room.settings.maxPlayers) return this.error(session, 'В лобби нет свободных мест.');
    if (room.seats.some((s) => s.id === session.id)) return this.error(session, 'Вы уже в этом лобби.');
    room.seats.push({
      id: session.id,
      name: session.name,
      isBot: false,
      ready: false,
      connected: true,
    });
    session.roomCode = code;
    this.broadcastRoom(room);
    this.sendLobbyList(session);
    this.broadcastLobbyList();
  }

  private leaveLobby(session: Session): void {
    const room = this.roomOf(session);
    if (!room) {
      session.roomCode = undefined;
      this.send(session, { type: 'left' });
      this.sendLobbyList(session);
      return;
    }
    if (room.game && room.game.phase !== 'finished') {
      const player = room.game.players.find((p) => p.id === session.id);
      if (player?.alive) {
        return this.error(session, 'Нельзя покинуть идущий матч. Закройте вкладку — место сохранится для переподключения.');
      }
    }
    const seat = room.seats.find((s) => s.id === session.id);
    if (seat) this.removeSeat(room, seat);
    session.roomCode = undefined;
    this.send(session, { type: 'left' });
    this.sendLobbyList(session);
    this.broadcastLobbyList();
  }

  private removeSeat(room: Room, seat: Seat): void {
    room.seats = room.seats.filter((s) => s.id !== seat.id);
    if (room.seats.length === 0) {
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostId === seat.id) {
      const nextHost = room.seats.find((s) => !s.isBot);
      if (nextHost) room.hostId = nextHost.id;
    }
    this.broadcastRoom(room);
  }

  private startGame(room: Room, quick: boolean): void {
    if (room.game) return;
    if (room.seats.filter((s) => !s.isBot).length === 0) return;
    if (room.seats.length < 2 && !room.settings.aiFill) {
      this.errorToHost(room, 'Нужен хотя бы один соперник или включён автозаполнение ботами.');
      return;
    }
    if (room.settings.aiFill) this.fillBots(room);
    if (room.seats.length < 2) {
      this.errorToHost(room, 'Для старта нужно минимум два участника.');
      return;
    }
    if (!quick) {
      const unready = room.seats.filter((s) => !s.isBot && s.id !== room.hostId && !s.ready);
      if (unready.length > 0) {
        this.errorToHost(room, 'Не все игроки готовы.');
        return;
      }
    }

    const roomRef = room;
    room.game = new Game({
      code: room.code,
      roomName: room.name,
      hostId: room.hostId,
      players: room.seats.map((s) => ({ id: s.id, name: s.name, isBot: s.isBot })),
      settings: room.settings,
      callbacks: {
        roomUpdate: () => this.broadcastRoom(roomRef),
        sendBattle: (playerId, snapshot) => {
          const target = this.sessions.get(playerId);
          if (target) this.send(target, { type: 'battle', battle: snapshot });
        },
        gameOver: (playerId, placement, totalPlayers, victory) => {
          roomRef.finishedAt = Date.now();
          const target = this.sessions.get(playerId);
          if (target && target.roomCode === roomRef.code) {
            this.send(target, { type: 'game_over', placement, totalPlayers, victory });
          }
        },
        toast: (playerId, text) => {
          const target = this.sessions.get(playerId);
          if (target) this.send(target, { type: 'toast', message: text });
        },
        isConnected: (playerId) => roomRef.seats.find((s) => s.id === playerId)?.connected ?? false,
      },
    });
    room.game.start();
    this.broadcastLobbyList();
  }

  private fillBots(room: Room): void {
    const usedNames = new Set(room.seats.map((s) => s.name));
    const available = BOT_NAMES.filter((name) => !usedNames.has(name));
    while (room.seats.length < room.settings.maxPlayers) {
      const name = available.shift() ?? `Бот ${room.seats.length + 1}`;
      room.seats.push({
        id: `bot-${randomUUID()}`,
        name,
        isBot: true,
        ready: true,
        connected: true,
      });
    }
  }

  private newCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < 5; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return randomUUID().slice(0, 5).toUpperCase();
  }

  private roomOf(session: Session): Room | undefined {
    return session.roomCode ? this.rooms.get(session.roomCode) : undefined;
  }

  private send(session: Session, message: ServerMessage): void {
    if (!session.ws || session.ws.readyState !== 1) return;
    try {
      session.ws.send(JSON.stringify(message));
    } catch {
      // A broken socket will be handled by the close event.
    }
  }

  private error(session: Session, message: string): void {
    this.send(session, { type: 'error', message });
  }

  private errorToHost(room: Room, message: string): void {
    const host = this.sessions.get(room.hostId);
    if (host) this.error(host, message);
  }

  private sendRoom(room: Room, playerId: string): void {
    const session = this.sessions.get(playerId);
    if (!session) return;
    this.send(session, { type: 'room', room: this.viewFor(room, playerId) });
  }

  private broadcastRoom(room: Room): void {
    for (const seat of room.seats) {
      if (seat.isBot) continue;
      this.sendRoom(room, seat.id);
    }
  }

  private viewFor(room: Room, playerId: string): RoomView {
    if (room.game) return room.game.viewFor(playerId);
    const players: PublicPlayer[] = room.seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      isBot: seat.isBot,
      host: seat.id === room.hostId,
      ready: seat.ready,
      connected: seat.connected,
      alive: true,
      lives: room.settings.startingLives,
      level: room.settings.startingLevel,
      streak: 0,
      placement: null,
      board: [],
      synergies: [],
    }));
    return {
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      settings: room.settings,
      phase: 'waiting',
      round: 0,
      maxRounds: room.settings.maxRounds,
      timeLeft: 0,
      selfId: playerId,
      players,
      self: null,
    };
  }

  private sendLobbyList(session: Session): void {
    this.send(session, { type: 'lobby_list', lobbies: this.lobbyList() });
  }

  private broadcastLobbyList(): void {
    const lobbies = this.lobbyList();
    for (const session of this.sessions.values()) {
      if (session.ws) this.send(session, { type: 'lobby_list', lobbies });
    }
  }

  private lobbyList(): LobbySummary[] {
    const list: LobbySummary[] = [];
    for (const room of this.rooms.values()) {
      if (room.game || room.settings.privateLobby) continue;
      const host = room.seats.find((s) => s.id === room.hostId);
      list.push({
        code: room.code,
        name: room.name,
        hostName: host?.name ?? 'Хозяин',
        players: room.seats.length,
        maxPlayers: room.settings.maxPlayers,
        aiFill: room.settings.aiFill,
        phase: 'waiting',
      });
    }
    return list.sort((a, b) => b.players - a.players).slice(0, 30);
  }
}

export type { Room };
