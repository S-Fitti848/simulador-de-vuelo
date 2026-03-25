/**
 * Lobby: gestiona las colas de espera para cada tipo de sala.
 * Cuando hay suficientes jugadores, llama a onRoomReady con la lista de jugadores.
 */
const QUEUE_SIZES = { ffa: 4, '1v1': 2, '2v2': 4 };

export class LobbyManager {
  #queues    = { ffa: [], '1v1': [], '2v2': [] };
  #onReady;

  constructor(onRoomReady) {
    this.#onReady = onRoomReady;  // (roomType, players[]) => void
  }

  join(ws, playerId, username, aircraft, roomType) {
    const q = this.#queues[roomType];
    if (!q) return false;
    this.leave(playerId);          // un jugador no puede estar en 2 colas
    q.push({ ws, id: playerId, username, aircraft });
    this.#tryStart(roomType);
    return true;
  }

  leave(playerId) {
    for (const q of Object.values(this.#queues)) {
      const i = q.findIndex(p => p.id === playerId);
      if (i >= 0) { q.splice(i, 1); return; }
    }
  }

  #tryStart(roomType) {
    const q = this.#queues[roomType];
    if (q.length >= QUEUE_SIZES[roomType]) {
      this.#onReady(roomType, q.splice(0, QUEUE_SIZES[roomType]));
    }
  }

  state() {
    return {
      queues: Object.fromEntries(
        Object.entries(this.#queues).map(([k, v]) => [k, v.length])
      ),
      sizes: QUEUE_SIZES,
    };
  }
}
