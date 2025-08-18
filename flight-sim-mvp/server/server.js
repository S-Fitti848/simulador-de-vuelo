import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';

const app = express();
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({ origin: allowed, credentials: true }));
app.get('/health', (req, res) => res.json({ ok: true }));

const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`Server listening on ${process.env.PORT || 3000}`);
});

const wss = new WebSocketServer({ server });

let nextId = 1;
const players = new Map();
const projectiles = [];
const TICK = 50; // 20Hz

wss.on('connection', (ws) => {
  if (players.size >= 2) {
    ws.close();
    return;
  }
  const id = String(nextId++);
  players.set(id, {
    ws,
    state: { pos: [0, 0, 0], quat: [0, 0, 0, 1], vel: [0, 0, 0], hp: 3 },
  });
  ws.send(JSON.stringify({ type: 'hello', id }));
  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }
    if (data.type === 'state') {
      const p = players.get(id);
      if (p) p.state = { ...p.state, ...data.state };
    } else if (data.type === 'projectile') {
      projectiles.push({ ...data.projectile, owner: id });
    }
  });
  ws.on('close', () => {
    players.delete(id);
  });
});

setInterval(() => {
  const dt = TICK / 1000;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.pos[0] += p.vel[0] * dt;
    p.pos[1] += p.vel[1] * dt;
    p.pos[2] += p.vel[2] * dt;
    p.ttl -= dt;
    for (const [pid, pl] of players) {
      if (pid === p.owner) continue;
      const s = pl.state;
      const dx = s.pos[0] - p.pos[0];
      const dy = s.pos[1] - p.pos[1];
      const dz = s.pos[2] - p.pos[2];
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 1) {
        s.hp = (s.hp || 3) - 1;
        wss.clients.forEach((c) => c.send(JSON.stringify({ type: 'hit', id: pid })));
        p.ttl = 0;
      }
    }
    if (p.ttl <= 0) projectiles.splice(i, 1);
  }
  const snapshot = {
    type: 'snapshot',
    players: [...players.entries()].map(([id, p]) => ({ id, state: p.state })),
    projectiles: projectiles.map((p) => ({ id: p.id, pos: p.pos })),
  };
  wss.clients.forEach((c) => {
    if (c.readyState === c.OPEN) c.send(JSON.stringify(snapshot));
  });
}, TICK);
