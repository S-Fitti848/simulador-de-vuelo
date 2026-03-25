import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import 'dotenv/config';
import { LobbyManager } from './net/lobby.js';
import { GameManager }  from './game.js';

const app     = express();
const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors(allowed.length
  ? { origin: allowed, credentials: true }
  : { origin: true,   credentials: true }
));

app.get('/health', (_, res) => res.json({ ok: true }));
app.get('/status', (_, res) => res.json({
  players: players.size,
  lobby:   lobbyManager.state(),
}));

const port   = process.env.PORT || 3000;
const server = app.listen(port, '0.0.0.0', () =>
  console.log(`[Server] escuchando en :${port}`)
);

const wss = new WebSocketServer({ server });

// registry de jugadores: ws → { id, username, aircraft }
const players = new Map();

function send(ws, data) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

// ── Instanciar managers ────────────────────────────────────────────────────────

const gameManager = new GameManager(send);

const lobbyManager = new LobbyManager((roomType, roomPlayers) => {
  gameManager.createRoom(roomType, roomPlayers);
  // Actualizar lobby a todos los que no están en partida
  broadcastLobby();
});

// ── Broadcast helpers ──────────────────────────────────────────────────────────

function broadcastLobby() {
  const state = lobbyManager.state();
  for (const [ws] of players) {
    if (!gameManager.isInGame(ws)) {
      send(ws, { type: 'lobby_update', ...state });
    }
  }
}

// ── WebSocket ──────────────────────────────────────────────────────────────────

wss.on('connection', ws => {
  const id = Math.random().toString(36).slice(2, 10);
  players.set(ws, { id, username: 'Pilot', aircraft: 'f22' });

  send(ws, { type: 'welcome', playerId: id, lobbyState: lobbyManager.state() });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const player = players.get(ws);
    if (!player) return;

    switch (msg.type) {

      case 'ping':
        send(ws, { type: 'pong', t: msg.t });
        break;

      case 'hello':
        player.username = (msg.username || 'Pilot').slice(0, 20);
        player.aircraft = msg.aircraft || 'f22';
        broadcastLobby();
        break;

      case 'join_queue':
        if (gameManager.isInGame(ws)) break;
        lobbyManager.join(ws, player.id, player.username, player.aircraft, msg.roomType);
        send(ws, {
          type: 'queue_joined',
          roomType: msg.roomType,
          ...lobbyManager.state(),
        });
        broadcastLobby();
        break;

      case 'leave_queue':
        lobbyManager.leave(player.id);
        broadcastLobby();
        break;

      case 'player_state':
        gameManager.handleState(ws, msg);
        break;

      case 'missile_fired':
        gameManager.handleMissile(ws, msg);
        break;
    }
  });

  ws.on('close', () => {
    const player = players.get(ws);
    if (player) {
      lobbyManager.leave(player.id);
      gameManager.handleLeave(ws);
      players.delete(ws);
      broadcastLobby();
    }
  });
});

// Refrescar lobby cada 5s para clientes inactivos
setInterval(broadcastLobby, 5000);
