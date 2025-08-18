import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import 'dotenv/config';

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

const port = process.env.PORT || 3000;
const host = '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.send('hello');
});
