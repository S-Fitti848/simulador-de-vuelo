import type { ServerMsg, ClientMsg, Vec3, Quat } from './types';

type Handler<T> = (data: T) => void;
type AnyHandler = Handler<ServerMsg>;

/** Calcula la URL del servidor WebSocket */
function serverUrl(): string {
  const env = (import.meta as any).env?.VITE_SERVER_URL as string | undefined;
  if (env) return env.replace(/^http/, 'ws');
  if (window.location.hostname === 'localhost') return 'ws://localhost:3000';
  // En producción: misma URL pero con subdominio de servidor
  return `wss://${window.location.hostname}`;
}

export class GameSocket {
  private ws:       WebSocket | null = null;
  private handlers: Partial<Record<ServerMsg['type'], AnyHandler>> = {};
  private _id       = '';
  private _ping     = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private stateTimer: ReturnType<typeof setInterval> | null = null;

  // ── Conexión ──────────────────────────────────────────────────────────────

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = serverUrl();
      console.log('[Socket] conectando a', url);
      this.ws = new WebSocket(url);
      this.ws.onopen    = () => { this.#startPing(); resolve(); };
      this.ws.onerror   = () => reject(new Error('No se pudo conectar al servidor'));
      this.ws.onclose   = () => { this.#stopPing(); this.stopStateBroadcast(); };
      this.ws.onmessage = e => {
        try {
          const msg = JSON.parse(e.data) as ServerMsg;
          if (msg.type === 'welcome')     this._id = msg.playerId;
          if (msg.type === 'pong')        this._ping = Date.now() - msg.t;
          const h = this.handlers[msg.type] as Handler<typeof msg> | undefined;
          h?.(msg);
        } catch { /* ignorar errores de parseo */ }
      };
    });
  }

  // ── Registro de handlers ──────────────────────────────────────────────────

  on<T extends ServerMsg['type']>(
    type: T,
    handler: Handler<Extract<ServerMsg, { type: T }>>
  ): this {
    this.handlers[type] = handler as AnyHandler;
    return this;
  }

  // ── Envío de mensajes ─────────────────────────────────────────────────────

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ── Helpers de protocolo ──────────────────────────────────────────────────

  identify(username: string, aircraft: string) {
    this.send({ type: 'hello', username, aircraft });
  }

  joinQueue(roomType: 'ffa' | '1v1' | '2v2') {
    this.send({ type: 'join_queue', roomType });
  }

  leaveQueue() {
    this.send({ type: 'leave_queue' });
  }

  fireMissile(position: Vec3, velocity: Vec3) {
    this.send({ type: 'missile_fired', position, velocity });
  }

  /** Empieza a enviar el estado del jugador 20 veces por segundo */
  startStateBroadcast(
    getState: () => { position: Vec3; quaternion: Quat; velocity: Vec3; throttle: number }
  ) {
    this.stopStateBroadcast();
    this.stateTimer = setInterval(() => {
      const s = getState();
      this.send({ type: 'player_state', ...s });
    }, 50);
  }

  stopStateBroadcast() {
    if (this.stateTimer) { clearInterval(this.stateTimer); this.stateTimer = null; }
  }

  // ── Ping ──────────────────────────────────────────────────────────────────

  #startPing() {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping', t: Date.now() });
    }, 2000);
  }

  #stopPing() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get playerId() { return this._id; }
  get ping()     { return this._ping; }

  close() {
    this.stopStateBroadcast();
    this.#stopPing();
    this.ws?.close();
  }
}
