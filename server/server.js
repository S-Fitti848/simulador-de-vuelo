import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import 'dotenv/config';
import { RoomManager } from './net/rooms.js';

const app = express();

const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors(
    allowed.length
      ? { origin: allowed, credentials: true }
      : { origin: true, credentials: true }
  )
);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const rooms = new RoomManager();
const players = new Map(); // ws -> player

app.get('/status', (_req, res) => {
  res.json({
    onlineCount: players.size,
    rooms: rooms.listRooms().map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      count: r.players.length,
      max: r.max,
    })),
  });
});

const port = process.env.PORT || 3000;
const host = '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});

const wss = new WebSocketServer({ server });

function broadcast(data, filter) {
  const str = JSON.stringify(data);
  wss.clients.forEach((c) => {
    if (c.readyState === c.OPEN && (!filter || filter(c))) {
      c.send(str);
    }
  });
}

function broadcastPresence() {
  broadcast({ type: 'presence', onlineCount: players.size });
}

function broadcastRooms() {
  broadcast({ type: 'rooms', list: rooms.listRooms() });
}

function broadcastRoom(roomId, data) {
  broadcast(data, (c) => players.get(c)?.roomId === roomId);
}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2);
  players.set(ws, { id, username: '', roomId: null, ready: false });
  ws.send(
    JSON.stringify({ type: 'hello', id, serverTime: Date.now() })
  );
  broadcastPresence();
  broadcastRooms();

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const player = players.get(ws);
    if (!player) return;
    switch (msg.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', id: msg.id, time: msg.time }));
        break;
      case 'join':
        player.username = msg.username || '';
        player.aircraft = msg.aircraft || '';
        break;
      case 'createRoom': {
        const room = rooms.createRoom(msg.name, player.id);
        rooms.joinRoom(room.id, {
          id: player.id,
          username: player.username,
          aircraft: player.aircraft,
          ready: false,
        });
        player.roomId = room.id;
        ws.send(JSON.stringify({ type: 'roomCreated', room }));
        broadcastRooms();
        break;
      }
      case 'joinRoom': {
        const room = rooms.joinRoom(msg.id, {
          id: player.id,
          username: player.username,
          aircraft: player.aircraft,
          ready: false,
        });
        if (room) {
          player.roomId = room.id;
          ws.send(JSON.stringify({ type: 'joined', room }));
          broadcastRooms();
        }
        break;
      }
      case 'leaveRoom':
        rooms.leaveRoom(player.id);
        player.roomId = null;
        player.ready = false;
        broadcastRooms();
        break;
      case 'setReady':
        if (player.roomId) {
          rooms.setReady(player.roomId, player.id, !!msg.ready);
          player.ready = !!msg.ready;
          broadcastRooms();
        }
        break;
      case 'startMatch':
        if (player.roomId) {
          const room = rooms.startMatch(player.roomId);
          if (room) {
            broadcastRoom(room.id, {
              type: 'matchStart',
              roomId: room.id,
              startTime: Date.now(),
            });
            broadcastRooms();
          }
        }
        break;
    }
  });

  ws.on('close', () => {
    const player = players.get(ws);
    if (player) {
      rooms.leaveRoom(player.id);
      players.delete(ws);
      broadcastPresence();
      broadcastRooms();
    }
  });
});

setInterval(() => {
  broadcastPresence();
  broadcastRooms();
}, 3000);
