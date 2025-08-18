import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';

const app = express();
app.use(cors());
app.get('/health', (req, res) => res.json({ ok: true }));

const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`Server listening on ${process.env.PORT || 3000}`);
});

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('message', (msg) => console.log(`Received: ${msg}`));
  ws.send('Hello from server!');
});
