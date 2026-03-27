import * as THREE from 'three';

/**
 * HUD del simulador de vuelo.
 * Muestra: velocidad, altitud, rumbo, throttle, estado y un horizonte artificial.
 */
export class HUD {
  private panel:       HTMLDivElement;
  private canvas:      HTMLCanvasElement;
  private ctx:         CanvasRenderingContext2D;
  private keyHints:    HTMLDivElement;
  private radarCanvas: HTMLCanvasElement;
  private radarCtx:    CanvasRenderingContext2D;

  constructor() {
    // ── Panel de datos (arriba a la derecha) ─────────────────────────────────
    this.panel = document.createElement('div');
    Object.assign(this.panel.style, {
      position:   'absolute',
      top:        '12px',
      right:      '12px',
      color:      '#00ff88',
      background: 'rgba(0,0,0,0.55)',
      padding:    '8px 14px',
      fontFamily: 'monospace',
      fontSize:   '14px',
      lineHeight: '1.75',
      borderRadius: '5px',
      whiteSpace:   'pre',
      zIndex:       '10',
    });
    document.body.appendChild(this.panel);

    // ── Horizonte artificial (abajo al centro) ────────────────────────────────
    this.canvas = document.createElement('canvas');
    this.canvas.width  = 140;
    this.canvas.height = 140;
    Object.assign(this.canvas.style, {
      position:  'absolute',
      bottom:    '20px',
      left:      '50%',
      transform: 'translateX(-50%)',
      borderRadius: '50%',
      border:    '2px solid rgba(255,255,255,0.4)',
      zIndex:    '10',
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // ── Mini-radar (abajo a la derecha) ───────────────────────────────────────
    this.radarCanvas = document.createElement('canvas');
    this.radarCanvas.width  = 120;
    this.radarCanvas.height = 120;
    Object.assign(this.radarCanvas.style, {
      position:  'absolute',
      bottom:    '20px',
      right:     '12px',
      borderRadius: '50%',
      border:    '2px solid rgba(0,255,136,0.5)',
      zIndex:    '10',
      display:   'none',
    });
    document.body.appendChild(this.radarCanvas);
    this.radarCtx = this.radarCanvas.getContext('2d')!;

    // ── Ayuda de controles (abajo a la izquierda) ─────────────────────────────
    this.keyHints = document.createElement('div');
    Object.assign(this.keyHints.style, {
      position:   'absolute',
      bottom:     '12px',
      left:       '12px',
      color:      'rgba(255,255,255,0.6)',
      background: 'rgba(0,0,0,0.45)',
      padding:    '6px 10px',
      fontFamily: 'monospace',
      fontSize:   '11px',
      lineHeight: '1.6',
      borderRadius: '4px',
      whiteSpace:   'pre',
      zIndex:       '10',
    });
    this.keyHints.innerText =
      'W/S   → cabeceo\n' +
      'A/D   → alabeo\n' +
      'Q/E   → guiñada\n' +
      'Shift/Ctrl → motor\n' +
      'V → cámara  P → avión\n' +
      'R → respawn  Esp → misil';
    document.body.appendChild(this.keyHints);
  }

  update(
    flight: {
      throttle:   number;
      velocity:   THREE.Vector3;
      position:   THREE.Vector3;
      quaternion: THREE.Quaternion;
      speed:      number;
      isStall:    boolean;
      aoa:        number;
    },
    mode: string,
    hp?: number,
    radarData?: { myTeam: string; others: { pos: THREE.Vector3; team: string }[] }
  ) {
    const speedKt  = flight.velocity.length() * 1.94384;
    const altM     = flight.position.y;

    // Rumbo a partir de la dirección forward del avión
    const forward    = new THREE.Vector3(0, 0, 1).applyQuaternion(flight.quaternion);
    const headingDeg = ((Math.atan2(forward.x, forward.z) * 180 / Math.PI) + 360) % 360;

    // Factor de carga (g) = sustentación / peso
    const gForce     = flight.velocity.length() > 5
      ? Math.abs(1 + new THREE.Vector3(0,1,0).applyQuaternion(flight.quaternion).dot(
          new THREE.Vector3(0, 9.81, 0).normalize()
        ))
      : 1;

    const stateStr = flight.isStall ? '⚠ STALL' : altM < 5 ? 'Aterrizando' : 'Normal';
    const aoaDeg   = (flight.aoa * 180 / Math.PI).toFixed(1);

    const hpLine = hp !== undefined ? `HP:     ${String(hp).padStart(3)}\n` : '';

    this.panel.innerText =
      `Vel:    ${speedKt.toFixed(0).padStart(4)} kt\n` +
      `Alt:    ${altM.toFixed(0).padStart(4)} m\n` +
      `Rumbo:  ${headingDeg.toFixed(0).padStart(3)}°\n` +
      `Throt:  ${(flight.throttle * 100).toFixed(0).padStart(3)}%\n` +
      `AoA:    ${aoaDeg.padStart(5)}°\n` +
      hpLine +
      `Estado: ${stateStr}\n` +
      `Modo:   ${mode}`;

    // ── Radar (sólo en modo multijugador) ─────────────────────────────────────
    if (radarData) {
      this.radarCanvas.style.display = 'block';
      this.drawRadar(flight.position, radarData.myTeam, radarData.others);
    }

    // ── Dibujar horizonte artificial ──────────────────────────────────────────
    this.drawArtificialHorizon(flight.quaternion);
  }

  private drawArtificialHorizon(q: THREE.Quaternion) {
    const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    const pitch = euler.x;  // radianes: positivo = nariz arriba
    const roll  = euler.z;  // radianes: positivo = alabeo derecha

    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const r  = W / 2 - 2;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    // Recorte circular
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Rotar según el alabeo
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    ctx.translate(-cx, -cy);

    // Pitch → desplazamiento vertical (1° ≈ 2px)
    const pitchPx = pitch * (180 / Math.PI) * 2;

    // Mitad inferior = tierra (marrón)
    ctx.fillStyle = '#7a5c2e';
    ctx.fillRect(0, 0, W, H);

    // Mitad superior = cielo (azul)
    ctx.fillStyle = '#3a7fc1';
    ctx.fillRect(0, 0, W, cy + pitchPx);

    // Línea de horizonte
    ctx.strokeStyle = 'white';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0,  cy + pitchPx);
    ctx.lineTo(W,  cy + pitchPx);
    ctx.stroke();

    // Escalas de pitch (cada 10°)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth   = 1;
    ctx.fillStyle   = 'white';
    ctx.font        = '9px monospace';
    ctx.textAlign   = 'center';
    for (let deg = -30; deg <= 30; deg += 10) {
      if (deg === 0) continue;
      const y = cy + pitchPx - deg * 2;
      const w = deg % 20 === 0 ? 28 : 16;
      ctx.beginPath();
      ctx.moveTo(cx - w, y);
      ctx.lineTo(cx + w, y);
      ctx.stroke();
      if (deg % 20 === 0) ctx.fillText(String(deg), cx + w + 10, y + 3);
    }

    ctx.restore(); // fin rotación

    // Símbolo del avión (fijo, no rota)
    ctx.strokeStyle = '#ffdd00';
    ctx.lineWidth   = 2.5;
    // Alas
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.moveTo(cx + 10, cy);
    ctx.lineTo(cx + 28, cy);
    ctx.stroke();
    // Punto central
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // fin clip
  }

  private drawRadar(
    myPos:  THREE.Vector3,
    myTeam: string,
    others: { pos: THREE.Vector3; team: string }[]
  ) {
    const W  = this.radarCanvas.width;
    const H  = this.radarCanvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const r  = W / 2 - 2;
    const RANGE = 5000; // metros que caben en el radio del radar

    const rc = this.radarCtx;
    rc.clearRect(0, 0, W, H);

    // Fondo circular semitransparente
    rc.save();
    rc.beginPath();
    rc.arc(cx, cy, r, 0, Math.PI * 2);
    rc.clip();

    rc.fillStyle = 'rgba(0,0,0,0.65)';
    rc.fillRect(0, 0, W, H);

    // Anillo de referencia a mitad de rango
    rc.strokeStyle = 'rgba(0,255,136,0.2)';
    rc.lineWidth   = 1;
    rc.beginPath();
    rc.arc(cx, cy, r / 2, 0, Math.PI * 2);
    rc.stroke();

    // Cruz central
    rc.strokeStyle = 'rgba(0,255,136,0.15)';
    rc.beginPath();
    rc.moveTo(cx, cy - r); rc.lineTo(cx, cy + r);
    rc.moveTo(cx - r, cy); rc.lineTo(cx + r, cy);
    rc.stroke();

    // Puntos de otros jugadores
    const DOT_COLORS: Record<string, string> = {
      A:    '#4488ff',
      B:    '#ff4444',
      none: '#ffcc00',
    };

    for (const o of others) {
      const dx = o.pos.x - myPos.x;
      const dz = o.pos.z - myPos.z;
      const px = cx + (dx / RANGE) * r;
      const py = cy + (dz / RANGE) * r;

      // Solo dibujar si está dentro del círculo
      if ((px - cx) ** 2 + (py - cy) ** 2 > r * r) continue;

      const col = DOT_COLORS[o.team] ?? '#ffcc00';
      rc.fillStyle = col;
      rc.beginPath();
      rc.arc(px, py, 4, 0, Math.PI * 2);
      rc.fill();
    }

    // Mi punto (centro, blanco)
    rc.fillStyle = '#ffffff';
    rc.beginPath();
    rc.arc(cx, cy, 4, 0, Math.PI * 2);
    rc.fill();

    rc.restore();

    // Borde exterior
    rc.strokeStyle = 'rgba(0,255,136,0.5)';
    rc.lineWidth   = 1.5;
    rc.beginPath();
    rc.arc(cx, cy, r, 0, Math.PI * 2);
    rc.stroke();
  }
}
