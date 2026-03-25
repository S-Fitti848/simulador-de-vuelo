/**
 * GameManager: gestiona salas activas, tick de 20Hz, detección de impactos y puntajes.
 */

const TICK_MS    = 50;     // 20 Hz
const HIT_RADIUS = 8;      // metros, esfera de colisión
const RESPAWN_MS = 5000;   // ms antes de respawn

// Posiciones de spawn según el tipo de sala
function spawnFor(type, index) {
  const h = 600;
  const TABLE = {
    '1v1': [
      [0, h, 2000, Math.PI],
      [0, h, -2000, 0],
    ],
    '2v2': [
      [-400, h, 2200, Math.PI], [400, h, 2200, Math.PI],
      [-400, h, -2200, 0],      [400, h, -2200, 0],
    ],
    ffa: Array.from({ length: 4 }, (_, i) => {
      const a = (i / 4) * Math.PI * 2;
      return [Math.cos(a) * 1400, h, Math.sin(a) * 1400, a + Math.PI];
    }),
  };
  const row = (TABLE[type] ?? TABLE.ffa)[index % 4];
  const [x, y, z, yaw] = row;
  return {
    pos:  { x, y, z },
    quat: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
  };
}

function assignTeam(type, index) {
  if (type === '2v2') return index < 2 ? 'A' : 'B';
  return 'none';
}

export class GameManager {
  #rooms  = new Map();   // roomId → room
  #wsInfo = new Map();   // ws → { roomId, playerId }
  #sendFn;

  constructor(sendFn) {
    this.#sendFn = sendFn;  // (ws, data) => void
  }

  // ── Utilidades ───────────────────────────────────────────────────────────────

  send(ws, data) {
    this.#sendFn(ws, data);
  }

  broadcastRoom(roomId, data, excludeWs = null) {
    const room = this.#rooms.get(roomId);
    if (!room) return;
    for (const [, p] of room.players) {
      if (p.ws !== excludeWs) this.send(p.ws, data);
    }
  }

  getRoomId(ws) { return this.#wsInfo.get(ws)?.roomId; }
  isInGame(ws)  { return this.#wsInfo.has(ws); }

  // ── Crear sala ────────────────────────────────────────────────────────────────

  createRoom(type, players) {
    const id   = `${type}_${Date.now()}`;
    const room = {
      id, type,
      players:   new Map(),
      missiles:  new Map(),
      scores:    new Map(),
      active:    true,
      duration:  type === '1v1' ? 180_000 : 300_000,
    };

    players.forEach((p, i) => {
      const { pos, quat } = spawnFor(type, i);
      room.players.set(p.id, {
        id: p.id, ws: p.ws,
        username: p.username, aircraft: p.aircraft || 'f22',
        team: assignTeam(type, i),
        position: pos, quaternion: quat,
        velocity: { x: 0, y: 0, z: 150 },
        throttle: 0.5, hp: 100, alive: true,
      });
      room.scores.set(p.id, { kills: 0, deaths: 0, username: p.username });
      this.#wsInfo.set(p.ws, { roomId: id, playerId: p.id });
    });

    this.#rooms.set(id, room);

    // Notificar a cada jugador
    for (const [, p] of room.players) {
      const others = [...room.players.values()]
        .filter(o => o.id !== p.id)
        .map(o => ({
          id: o.id, username: o.username,
          aircraft: o.aircraft, team: o.team,
          position: o.position, quaternion: o.quaternion,
        }));

      this.send(p.ws, {
        type: 'game_start',
        roomId: id, roomType: type,
        myId: p.id, myTeam: p.team,
        spawnPos: p.position, spawnQuat: p.quaternion,
        duration: room.duration,
        players: others,
      });
    }

    room.tick     = setInterval(() => this.#tick(room), TICK_MS);
    room.endTimer = setTimeout(() => this.#end(room, 'time'), room.duration);
    console.log(`[Game] ${id} (${type}) iniciado con ${players.length} jugadores`);
  }

  // ── Recibir estado del jugador ────────────────────────────────────────────────

  handleState(ws, d) {
    const info = this.#wsInfo.get(ws);
    if (!info) return;
    const room = this.#rooms.get(info.roomId);
    if (!room?.active) return;
    const p = room.players.get(info.playerId);
    if (!p?.alive) return;
    p.position   = d.position;
    p.quaternion = d.quaternion;
    p.velocity   = d.velocity;
    p.throttle   = d.throttle;
  }

  // ── Misil disparado ───────────────────────────────────────────────────────────

  handleMissile(ws, d) {
    const info = this.#wsInfo.get(ws);
    if (!info) return;
    const room = this.#rooms.get(info.roomId);
    if (!room?.active) return;
    const shooter = room.players.get(info.playerId);
    if (!shooter?.alive) return;

    const mid = `${info.playerId}_${Date.now()}`;
    room.missiles.set(mid, {
      id: mid, ownerId: info.playerId, ownerTeam: shooter.team,
      pos: { ...d.position }, vel: { ...d.velocity }, ttl: 5,
    });

    // Notificar a los demás para que vean el misil visualmente
    this.broadcastRoom(info.roomId, {
      type: 'missile_spawned', id: mid,
      ownerId: info.playerId, position: d.position, velocity: d.velocity,
    }, ws);
  }

  // ── Jugador desconectado ──────────────────────────────────────────────────────

  handleLeave(ws) {
    const info = this.#wsInfo.get(ws);
    if (!info) return;
    const room = this.#rooms.get(info.roomId);
    if (room) {
      room.players.delete(info.playerId);
      this.broadcastRoom(info.roomId, {
        type: 'player_left', playerId: info.playerId,
      });
      if (room.players.size < 2 && room.active) this.#end(room, 'disconnect');
    }
    this.#wsInfo.delete(ws);
  }

  // ── Tick del juego (20 Hz) ────────────────────────────────────────────────────

  #tick(room) {
    if (!room.active) return;
    const dt = TICK_MS / 1000;

    // Avanzar misiles y verificar impactos
    for (const [mid, m] of room.missiles) {
      m.pos.x += m.vel.x * dt;
      m.pos.y += m.vel.y * dt;
      m.pos.z += m.vel.z * dt;
      m.ttl   -= dt;

      if (m.ttl <= 0) { room.missiles.delete(mid); continue; }

      for (const [, tgt] of room.players) {
        if (!tgt.alive || tgt.id === m.ownerId) continue;
        if (room.type === '2v2' && tgt.team === m.ownerTeam) continue; // no daño al equipo

        const dx = m.pos.x - tgt.position.x;
        const dy = m.pos.y - tgt.position.y;
        const dz = m.pos.z - tgt.position.z;

        if (dx * dx + dy * dy + dz * dz < HIT_RADIUS * HIT_RADIUS) {
          room.missiles.delete(mid);
          tgt.hp -= 50;

          this.broadcastRoom(room.id, {
            type: 'hit', targetId: tgt.id, shooterId: m.ownerId, hp: tgt.hp,
          });

          if (tgt.hp <= 0) {
            tgt.alive = false;
            room.scores.get(m.ownerId).kills++;
            room.scores.get(tgt.id).deaths++;

            this.broadcastRoom(room.id, {
              type: 'player_killed',
              targetId: tgt.id, killerId: m.ownerId,
              killerName: room.players.get(m.ownerId)?.username ?? '?',
              targetName:  tgt.username,
              scores: Object.fromEntries(room.scores),
            });

            // Respawn automático tras 5 segundos
            setTimeout(() => {
              if (!room.active || !room.players.has(tgt.id)) return;
              tgt.hp = 100; tgt.alive = true;
              const { pos } = spawnFor(room.type, Math.floor(Math.random() * 4));
              tgt.position = pos;
              this.broadcastRoom(room.id, {
                type: 'player_respawn', playerId: tgt.id, position: pos,
              });
            }, RESPAWN_MS);
          }
          break;
        }
      }
    }

    // Broadcast snapshot consolidado del estado de todos los jugadores
    this.broadcastRoom(room.id, {
      type: 'game_state',
      ts: Date.now(),
      players: [...room.players.values()].map(p => ({
        id: p.id,
        position: p.position, quaternion: p.quaternion,
        velocity: p.velocity, throttle: p.throttle,
        hp: p.hp, alive: p.alive,
      })),
    });
  }

  // ── Fin de partida ────────────────────────────────────────────────────────────

  #end(room, reason) {
    if (!room.active) return;
    room.active = false;
    clearInterval(room.tick);
    clearTimeout(room.endTimer);

    let winner = 'Nadie';
    if (room.type === '2v2') {
      let kA = 0, kB = 0;
      for (const [pid, s] of room.scores) {
        if (room.players.get(pid)?.team === 'A') kA += s.kills;
        else kB += s.kills;
      }
      winner = kA >= kB ? 'Equipo A' : 'Equipo B';
    } else {
      let max = -1;
      for (const [, s] of room.scores) {
        if (s.kills > max) { max = s.kills; winner = s.username; }
      }
    }

    this.broadcastRoom(room.id, {
      type: 'game_end', reason, winner,
      scores: Object.fromEntries(room.scores),
    });

    setTimeout(() => {
      for (const [, p] of room.players) this.#wsInfo.delete(p.ws);
      this.#rooms.delete(room.id);
    }, 30_000);
  }
}
