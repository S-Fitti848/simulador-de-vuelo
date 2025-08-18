export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(name, ownerId) {
    const id = Math.random().toString(36).slice(2, 8);
    const room = {
      id,
      name,
      status: 'waiting',
      players: [],
      max: 2,
      ownerId,
    };
    this.rooms.set(id, room);
    return room;
  }

  listRooms() {
    return Array.from(this.rooms.values());
  }

  joinRoom(id, player) {
    const room = this.rooms.get(id);
    if (!room) return null;
    if (room.players.length >= room.max || room.status === 'in-game') return null;
    room.players.push(player);
    return room;
  }

  leaveRoom(playerId) {
    for (const room of this.rooms.values()) {
      const idx = room.players.findIndex((p) => p.id === playerId);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.ownerId === playerId) {
          room.ownerId = room.players[0]?.id || '';
        }
        if (room.players.length === 0) {
          this.rooms.delete(room.id);
        }
        return room;
      }
    }
    return null;
  }

  setReady(roomId, playerId, ready) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;
    player.ready = ready;
    if (room.players.length === room.max && room.players.every((p) => p.ready)) {
      room.status = 'ready';
    } else {
      room.status = 'waiting';
    }
    return room;
  }

  startMatch(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== 'ready') return null;
    room.status = 'in-game';
    return room;
  }
}
