import './landing.css';
import { GameSocket } from '../net/socket';
import type { LobbyState, RoomType, MultiplayerConfig } from '../net/types';

interface RoomDef { type: RoomType; label: string; desc: string; emoji: string; needed: number; }

const ROOMS: RoomDef[] = [
  { type: '1v1', label: '1 vs 1',          emoji: '⚔',  desc: 'Duelo · 3 min',         needed: 2 },
  { type: '2v2', label: '2 vs 2',          emoji: '🛡',  desc: 'Equipos A vs B · 5 min', needed: 4 },
  { type: 'ffa', label: 'Libre para Todos', emoji: '💥', desc: 'Todos vs Todos · 5 min',  needed: 4 },
];

/** Pantalla de lobby multiplayer. Retorna función de limpieza. */
export function showLobby(
  socket:      GameSocket,
  username:    string,
  _aircraft:   string,
  onSolo:      () => void,
  onGameStart: (cfg: MultiplayerConfig) => void
): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'landing-overlay';

  const box = document.createElement('div');
  box.className = 'landing-box';
  Object.assign(box.style, { maxWidth: '540px', width: '100%' });

  box.innerHTML = `
    <div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:32px;">✈</div>
      <h2 style="margin:4px 0;font-size:18px;color:#00ff88;font-family:monospace;letter-spacing:3px;">FLIGHT SIM</h2>
      <p style="margin:0;color:#888;font-size:12px;font-family:monospace;">
        Piloto: <strong style="color:#fff">${username}</strong>
      </p>
    </div>
  `;

  // Botón modo solo
  const soloBtn = document.createElement('button');
  soloBtn.className = 'enter-btn';
  soloBtn.style.width = '100%';
  soloBtn.style.marginBottom = '14px';
  soloBtn.textContent = '🎮  Modo Practica (Solo)';
  soloBtn.onclick = () => { overlay.remove(); onSolo(); };
  box.appendChild(soloBtn);

  const sep = document.createElement('div');
  sep.style.cssText = 'text-align:center;color:#444;font-size:11px;font-family:monospace;margin-bottom:14px;letter-spacing:3px;';
  sep.textContent = '── MULTIJUGADOR ──';
  box.appendChild(sep);

  // Tarjetas de sala
  const cardsEl = document.createElement('div');
  cardsEl.className = 'aircraft-cards';
  const countEls: Record<string, HTMLElement> = {};

  for (const r of ROOMS) {
    const card = document.createElement('div');
    card.className = 'aircraft-card';
    card.style.padding = '12px 8px';

    const cnt = document.createElement('div');
    cnt.style.cssText = 'font-size:22px;font-weight:bold;color:#00ff88;font-family:monospace;margin:4px 0;';
    cnt.textContent = `0/${r.needed}`;
    countEls[r.type] = cnt;

    card.innerHTML = `<div style="font-size:22px;">${r.emoji}</div>
      <div style="font-weight:bold;font-family:monospace;font-size:13px;color:#fff;margin:4px 0;">${r.label}</div>`;
    card.appendChild(cnt);

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:10px;color:#666;margin-bottom:8px;';
    desc.textContent = r.desc;
    card.appendChild(desc);

    const btn = document.createElement('button');
    btn.textContent = 'Entrar';
    btn.dataset.rt = r.type;
    btn.style.cssText = 'width:100%;padding:5px;background:#003300;color:#00ff88;border:1px solid #00ff88;cursor:pointer;font-family:monospace;font-size:12px;';
    card.appendChild(btn);
    cardsEl.appendChild(card);
  }
  box.appendChild(cardsEl);

  // Área de espera
  const waitArea = document.createElement('div');
  waitArea.style.cssText = 'display:none;text-align:center;padding:16px;border:1px solid #333;margin-top:12px;';

  const waitMsg   = document.createElement('p');
  waitMsg.style.cssText = 'color:#00ff88;font-family:monospace;margin:0 0 6px;font-size:14px;';
  const waitCount = document.createElement('p');
  waitCount.style.cssText = 'color:#888;font-family:monospace;margin:0 0 10px;font-size:12px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕ Cancelar';
  cancelBtn.style.cssText = 'padding:5px 14px;background:#1a0000;color:#ff4444;border:1px solid #ff4444;cursor:pointer;font-family:monospace;';
  cancelBtn.onclick = () => {
    socket.leaveQueue();
    waitArea.style.display = 'none';
    cardsEl.style.display  = 'flex';
    soloBtn.style.display  = 'block';
    sep.style.display      = 'block';
  };
  waitArea.append(waitMsg, waitCount, cancelBtn);
  box.appendChild(waitArea);

  // Ping
  const pingEl = document.createElement('div');
  pingEl.style.cssText = 'text-align:right;font-family:monospace;font-size:10px;color:#444;margin-top:8px;';
  box.appendChild(pingEl);
  const pingTimer = setInterval(() => { pingEl.textContent = `Ping: ${socket.ping} ms`; }, 2000);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // ── Eventos ────────────────────────────────────────────────────────────────

  cardsEl.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest('button[data-rt]') as HTMLButtonElement | null;
    if (!btn) return;
    const rt = btn.dataset.rt as RoomType;
    socket.joinQueue(rt);
    cardsEl.style.display  = 'none';
    soloBtn.style.display  = 'none';
    sep.style.display      = 'none';
    waitArea.style.display = 'block';
    waitMsg.textContent    = `Buscando · ${ROOMS.find(r => r.type === rt)?.label ?? rt}`;
    waitCount.textContent  = 'Esperando jugadores...';
  });

  function applyState(state: LobbyState) {
    for (const r of ROOMS) {
      const el = countEls[r.type];
      if (el) el.textContent = `${state.queues[r.type] ?? 0}/${state.sizes?.[r.type] ?? r.needed}`;
    }
  }

  socket.on('lobby_update', msg => applyState(msg));
  socket.on('queue_joined', msg => {
    applyState(msg);
    const n = msg.queues[msg.roomType] ?? 1;
    const s = msg.sizes?.[msg.roomType] ?? '?';
    waitCount.textContent = `Jugadores en cola: ${n}/${s}`;
  });
  socket.on('game_start', msg => {
    clearInterval(pingTimer);
    overlay.remove();
    onGameStart({
      socket,
      roomId:       msg.roomId,
      roomType:     msg.roomType,
      myId:         msg.myId,
      myTeam:       msg.myTeam,
      spawnPos:     msg.spawnPos,
      spawnQuat:    msg.spawnQuat,
      duration:     msg.duration,
      otherPlayers: msg.players,
    });
  });

  return () => { clearInterval(pingTimer); overlay.remove(); };
}
