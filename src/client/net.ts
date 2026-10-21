import type { ClientMessage, ServerMessage } from '../shared/types';

type StatusHandler = (status: 'connecting' | 'online' | 'offline') => void;
type MessageHandler = (message: ServerMessage) => void;

export class Net {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private manualClose = false;
  private name = 'Странник';
  playerId = '';
  token = localStorage.getItem('autoflow.token') ?? '';
  onStatus: StatusHandler = () => {};
  onMessage: MessageHandler = () => {};

  connect(name: string): void {
    this.name = name;
    this.manualClose = false;
    this.open();
  }

  private open(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.onStatus('connecting');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws`);
    this.ws = socket;
    socket.addEventListener('open', () => {
      this.onStatus('online');
      this.send({ type: 'auth', name: this.name, token: this.token || undefined });
    });
    socket.addEventListener('message', (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      if (message.type === 'auth') {
        this.playerId = message.playerId;
        this.token = message.token;
        localStorage.setItem('autoflow.token', message.token);
      }
      this.onMessage(message);
    });
    socket.addEventListener('close', () => {
      if (this.ws === socket) this.ws = null;
      this.onStatus('offline');
      if (!this.manualClose) {
        if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null;
          this.open();
        }, 2200);
      }
    });
    socket.addEventListener('error', () => {
      socket.close();
    });
  }

  send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  setName(name: string): void {
    this.name = name;
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
