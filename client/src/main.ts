import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Controls }           from './input/controls';
import { SimpleFlight }       from './flight/simple';
import { ChaseCamera }        from './cam/chase';
import { SpawnManager }       from './game/spawn';
import { ModeManager }        from './mode/mode';
import { HUD }                from './hud/hud';
import { BootOverlay }        from './boot/boot';
import { showLanding, LandingResult } from './ui/landing';
import { showLobby }          from './ui/lobby';
import { GameSocket }         from './net/socket';
import type { MultiplayerConfig, Score } from './net/types';
import { RemotePlayerManager } from './game/remote';
import { EffectsManager }     from './effects/particles';
import { createCloudLayer }   from './effects/clouds';

const MODEL_F22  = '/models/f-22_raptor_-_fighter_jet_-_free.glb';
const MODEL_SU57 = '/models/sukhoi_su-57_felon_-_fighter_jet_-_free.glb';

function makeGridTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4a8c3f';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#2e5a28';
  ctx.lineWidth = 2;
  const cells = 8;
  const step = size / cells;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(200, 200);
  return tex;
}

function addBoundaryMountains(scene: THREE.Scene) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x556655, roughness: 0.9 });
  const W = 20000;
  const positions: { x: number; y: number; z: number }[] = [
    ...Array.from({ length: 10 }, (_, i) => ({ x: (i - 4.5) * 4500, y: 1500, z:  W })),
    ...Array.from({ length: 10 }, (_, i) => ({ x: (i - 4.5) * 4500, y: 1500, z: -W })),
    ...Array.from({ length: 10 }, (_, i) => ({ x:  W, y: 1500, z: (i - 4.5) * 4500 })),
    ...Array.from({ length: 10 }, (_, i) => ({ x: -W, y: 1500, z: (i - 4.5) * 4500 })),
  ];
  for (const p of positions) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(800, 3000, 800), mat);
    m.position.set(p.x, p.y, p.z);
    scene.add(m);
  }
}

function autoScale(model: THREE.Group, targetSize = 14): void {
  const box  = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const max  = Math.max(size.x, size.y, size.z);
  if (max > 0) model.scale.setScalar(targetSize / max);
}

export class FlightSim {
  private renderer:    THREE.WebGLRenderer;
  private scene:       THREE.Scene;
  private camera:      THREE.PerspectiveCamera;
  private controls:    Controls;
  private flight:      SimpleFlight;
  private chaseCamera: ChaseCamera;
  private spawn:       SpawnManager;
  private mode:        ModeManager;
  private hud:         HUD;
  private boot:        BootOverlay;
  private effects:     EffectsManager;

  // Multiplayer
  private socket:        GameSocket | null = null;
  private remoteManager: RemotePlayerManager | null = null;
  private myId    = '';
  private myTeam  = 'none';
  private myHp    = 100;
  private gameEndMs = 0;

  // Kill feed
  private killFeedEl:  HTMLDivElement | null = null;
  private killFeed:    { text: string; born: number }[] = [];
  private gameTimerEl: HTMLDivElement | null = null;

  // Avión local
  private lastTime    = 0;
  private accumulator = 0;
  private readonly FIXED_DT = 1 / 120;

  private aircraft    = new THREE.Group();
  private f22Model:   THREE.Group | null = null;
  private su57Model:  THREE.Group | null = null;
  private currentPlane: 'f22' | 'su57';
  private modelsLoaded = 0;

  private wasPlaneToggle = false;
  private wasViewToggle  = false;
  private wasFire        = false;
  private lastFireMs     = 0;

  private missiles: { obj: THREE.Mesh; vel: THREE.Vector3; ttl: number }[] = [];
  private engineCtx: AudioContext | null = null;

  // Estado del vuelo actual (shared con el closure de startStateBroadcast)
  private lastFlightState: ReturnType<SimpleFlight['update']> | null = null;

  constructor(landingResult?: LandingResult, mpConfig?: MultiplayerConfig) {
    this.currentPlane = landingResult?.aircraft === 'dragon' ? 'su57' : 'f22';

    // ── Renderer ─────────────────────────────────────────────────────────────
    this.boot = new BootOverlay();
    this.boot.log('Inicializando renderer...');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ── Escena ───────────────────────────────────────────────────────────────
    this.boot.log('Creando escena...');
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70, window.innerWidth / window.innerHeight, 0.5, 15000
    );
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 800, 8000);

    // ── Terreno procedural ────────────────────────────────────────────────────
    this.boot.log('Generando terreno...');
    const groundGeo = new THREE.PlaneGeometry(100000, 100000, 250, 250);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = Math.sin(x / 600 + z / 600) * 60
              + Math.sin(x / 120) * 12
              + Math.cos(z / 250) * 25;
      pos.setY(i, y);
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ map: makeGridTexture(), roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // ── Iluminación ───────────────────────────────────────────────────────────
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfffbe0, 1.3);
    sun.position.set(500, 800, 300);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = 2000;
    sun.shadow.camera.left   = -600;
    sun.shadow.camera.right  = 600;
    sun.shadow.camera.top    = 600;
    sun.shadow.camera.bottom = -600;
    this.scene.add(sun);

    // ── Montes en los bordes (espacio finito) ─────────────────────────────────
    addBoundaryMountains(this.scene);

    // ── Nubes ─────────────────────────────────────────────────────────────────
    createCloudLayer(this.scene);

    // ── Sistemas ──────────────────────────────────────────────────────────────
    this.boot.log('Iniciando sistemas...');
    this.controls    = new Controls(this.renderer.domElement);
    this.flight      = new SimpleFlight();
    this.chaseCamera = new ChaseCamera(this.camera);
    this.spawn       = new SpawnManager(this.flight, this.scene);
    this.mode        = new ModeManager();
    this.hud         = new HUD();
    this.effects     = new EffectsManager(this.scene);
    this.scene.add(this.aircraft);

    // ── Multiplayer: configurar si hay config ─────────────────────────────────
    if (mpConfig) {
      this.socket   = mpConfig.socket;
      this.myId     = mpConfig.myId;
      this.myTeam   = mpConfig.myTeam;
      this.gameEndMs = Date.now() + mpConfig.duration;

      // Teletransportar al spawn del servidor
      this.flight.teleport(mpConfig.spawnPos, mpConfig.spawnQuat);

      // Crear manager de jugadores remotos
      this.remoteManager = new RemotePlayerManager(this.scene);
      for (const p of mpConfig.otherPlayers) {
        this.remoteManager.add(p);
      }

      // Registrar handlers del socket
      this.socket
        .on('game_state', msg => {
          this.remoteManager?.applyGameState(msg.players, msg.ts);
        })
        .on('hit', msg => {
          if (msg.targetId === this.myId) {
            this.myHp = msg.hp;
            this.flashScreen();
          } else {
            const rp = this.remoteManager?.getPositionOf(msg.targetId);
            if (rp) this.effects.explode(rp);
          }
        })
        .on('player_killed', msg => {
          if (msg.targetId === this.myId) {
            this.myHp = 0;
            this.flashScreen();
          } else {
            const rp = this.remoteManager?.getPositionOf(msg.targetId);
            if (rp) this.effects.explode(rp, 2.0);
          }
          this.addKillFeedEntry(`${msg.killerName}  derribó a  ${msg.targetName}`);
        })
        .on('player_respawn', msg => {
          if (msg.playerId === this.myId) {
            this.myHp = 100;
            this.flight.teleport(msg.position, { x: 0, y: 0, z: 0, w: 1 });
          } else {
            this.remoteManager?.respawn(msg.playerId, msg.position);
          }
        })
        .on('player_left', msg => {
          this.remoteManager?.remove(msg.playerId);
        })
        .on('game_end', msg => {
          this.socket?.stopStateBroadcast();
          this.showGameEndScreen(msg.winner, msg.scores);
        });

      // Enviar estado propio 20 veces por segundo
      this.socket.startStateBroadcast(() => {
        const s = this.lastFlightState;
        if (!s) return { position: { x: 0, y: 600, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, velocity: { x: 0, y: 0, z: 150 }, throttle: 0.5 };
        return {
          position:   { x: s.position.x,   y: s.position.y,   z: s.position.z   },
          quaternion: { x: s.quaternion.x,  y: s.quaternion.y,  z: s.quaternion.z,  w: s.quaternion.w },
          velocity:   { x: s.velocity.x,   y: s.velocity.y,   z: s.velocity.z   },
          throttle:   s.throttle,
        };
      });

      // Kill feed
      this.killFeedEl = document.createElement('div');
      Object.assign(this.killFeedEl.style, {
        position:   'absolute',
        top:        '12px',
        left:       '50%',
        transform:  'translateX(-50%)',
        fontFamily: 'monospace',
        fontSize:   '13px',
        zIndex:     '15',
        pointerEvents: 'none',
        textAlign:  'center',
      });
      document.body.appendChild(this.killFeedEl);

      // Timer
      this.gameTimerEl = document.createElement('div');
      Object.assign(this.gameTimerEl.style, {
        position:   'absolute',
        top:        '12px',
        left:       '50%',
        transform:  'translateX(-50%) translateY(80px)',
        fontFamily: 'monospace',
        fontSize:   '18px',
        fontWeight: 'bold',
        color:      '#ffffff',
        background: 'rgba(0,0,0,0.5)',
        padding:    '4px 12px',
        borderRadius: '4px',
        zIndex:     '15',
        pointerEvents: 'none',
      });
      document.body.appendChild(this.gameTimerEl);
    }

    // ── Carga de modelos 3D ───────────────────────────────────────────────────
    this.boot.log('Cargando modelos 3D...');
    const loader = new GLTFLoader();

    const onModelLoaded = (model: THREE.Group, name: string) => {
      autoScale(model, 14);
      model.rotation.y = Math.PI;
      model.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow    = true;
          child.receiveShadow = true;
        }
      });
      this.boot.log(`${name} cargado`);
      this.modelsLoaded++;
      if (this.modelsLoaded >= 2) this.boot.done();
    };

    loader.load(MODEL_F22, (gltf) => {
      this.f22Model = gltf.scene;
      this.f22Model.visible = this.currentPlane === 'f22';
      this.aircraft.add(this.f22Model);
      onModelLoaded(this.f22Model, 'F-22 Raptor');
    }, undefined, (err) => {
      this.boot.handleError(`F-22: ${(err as Error).message}`);
      const ph = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.5, 7),
        new THREE.MeshStandardMaterial({ color: 0x4488cc })
      );
      this.aircraft.add(ph);
      this.modelsLoaded++;
      if (this.modelsLoaded >= 2) this.boot.done();
    });

    loader.load(MODEL_SU57, (gltf) => {
      this.su57Model = gltf.scene;
      this.su57Model.visible = this.currentPlane === 'su57';
      this.aircraft.add(this.su57Model);
      onModelLoaded(this.su57Model, 'SU-57 Felon');
    }, undefined, (err) => {
      this.boot.handleError(`SU-57: ${(err as Error).message}`);
      this.modelsLoaded++;
      if (this.modelsLoaded >= 2) this.boot.done();
    });

    // ── Motor (audio) ─────────────────────────────────────────────────────────
    if (typeof AudioContext !== 'undefined') {
      this.engineCtx = new AudioContext();
      const osc  = this.engineCtx.createOscillator();
      const gain = this.engineCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 90;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(this.engineCtx.destination);
      osc.start();
    }

    this.boot.log('Iniciando simulador...');
    this.animate(0);
  }

  // ── Game loop ────────────────────────────────────────────────────────────────
  private animate(time: number) {
    requestAnimationFrame(t => this.animate(t));

    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.accumulator += delta;

    while (this.accumulator >= this.FIXED_DT) {
      const inputs = this.controls.update();

      // En modo multijugador no permitir respawn manual
      if (this.socket) inputs.respawn = false;

      this.spawn.update(inputs);
      const state = this.flight.update(inputs, this.FIXED_DT);
      this.lastFlightState = state;

      this.chaseCamera.update(state, { x: inputs.mouseX, y: inputs.mouseY }, this.FIXED_DT, state.speed);

      // Construir datos de radar si hay multiplayer
      const radarData = this.remoteManager ? {
        myTeam: this.myTeam,
        others: this.remoteManager.getRadarEntries(),
      } : undefined;

      this.hud.update(state, this.mode.getMode(),
        this.socket ? this.myHp : undefined,
        radarData
      );

      // Toggle avión (P)
      if (inputs.planeToggle && !this.wasPlaneToggle) {
        if (this.currentPlane === 'f22' && this.su57Model) {
          if (this.f22Model) this.f22Model.visible = false;
          this.su57Model.visible = true;
          this.currentPlane = 'su57';
        } else if (this.f22Model) {
          if (this.su57Model) this.su57Model.visible = false;
          this.f22Model.visible = true;
          this.currentPlane = 'f22';
        }
      }
      this.wasPlaneToggle = inputs.planeToggle;

      // Toggle cámara (V)
      if (inputs.viewToggle && !this.wasViewToggle) this.chaseCamera.toggleView();
      this.wasViewToggle = inputs.viewToggle;

      // Disparar misil (Espacio)
      if (inputs.fire && !this.wasFire && time - this.lastFireMs > 350) {
        this.lastFireMs = time;
        const fwdDir = new THREE.Vector3(0, 0, 1).applyQuaternion(state.quaternion);
        const missile = new THREE.Mesh(
          new THREE.SphereGeometry(0.4),
          new THREE.MeshBasicMaterial({ color: 0xff4400 })
        );
        missile.position.copy(state.position).addScaledVector(fwdDir, 8);
        const vel = new THREE.Vector3(0, 0, 600)
          .applyQuaternion(state.quaternion)
          .add(state.velocity);
        this.scene.add(missile);
        this.missiles.push({ obj: missile, vel, ttl: 5 });

        // Notificar al servidor si hay multiplayer
        this.socket?.fireMissile(
          { x: state.position.x, y: state.position.y, z: state.position.z },
          { x: vel.x, y: vel.y, z: vel.z }
        );

        // Sonido
        if (typeof AudioContext !== 'undefined') {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const g   = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = 250;
          g.gain.value = 0.15;
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start();
          setTimeout(() => { osc.stop(); ctx.close(); }, 180);
        }
      }
      this.wasFire = inputs.fire;

      // Actualizar misiles
      this.missiles = this.missiles.filter(m => {
        m.obj.position.addScaledVector(m.vel, this.FIXED_DT);
        m.ttl -= this.FIXED_DT;
        if (this.spawn.checkHit(m.obj.position)) console.log('Hit!');
        if (m.ttl <= 0) { this.scene.remove(m.obj); return false; }
        return true;
      });

      // Sincronizar mesh con física
      this.aircraft.position.copy(state.position);
      this.aircraft.quaternion.copy(state.quaternion);

      this.accumulator -= this.FIXED_DT;
    }

    // ── Una vez por frame (no fixed-step) ─────────────────────────────────────
    this.effects.update(delta);

    if (this.remoteManager) {
      this.remoteManager.update(this.camera, this.renderer);
    }

    this.updateKillFeed();
    this.updateGameTimer();

    this.renderer.render(this.scene, this.camera);
  }

  // ── Helpers de multiplayer ────────────────────────────────────────────────────

  private flashScreen() {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position:        'fixed',
      inset:           '0',
      background:      'rgba(255,0,0,0.35)',
      zIndex:          '50',
      pointerEvents:   'none',
      transition:      'opacity 0.25s',
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 260);
    });
  }

  private addKillFeedEntry(text: string) {
    this.killFeed.push({ text, born: Date.now() });
    if (this.killFeed.length > 5) this.killFeed.shift();
    this.renderKillFeed();
  }

  private updateKillFeed() {
    const now = Date.now();
    const before = this.killFeed.length;
    this.killFeed = this.killFeed.filter(e => now - e.born < 4000);
    if (this.killFeed.length !== before) this.renderKillFeed();
  }

  private renderKillFeed() {
    if (!this.killFeedEl) return;
    this.killFeedEl.innerHTML = this.killFeed
      .map(e => `<div style="background:rgba(0,0,0,0.6);color:#ffcc00;padding:2px 10px;margin:2px 0;border-radius:3px;">${e.text}</div>`)
      .join('');
  }

  private updateGameTimer() {
    if (!this.gameTimerEl || !this.gameEndMs) return;
    const rem = Math.max(0, this.gameEndMs - Date.now());
    const mm  = Math.floor(rem / 60000);
    const ss  = Math.floor((rem % 60000) / 1000);
    this.gameTimerEl.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    this.gameTimerEl.style.color = rem < 30000 ? '#ff4444' : '#ffffff';
  }

  private showGameEndScreen(winner: string, scores: Record<string, Score>) {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:   'fixed',
      inset:      '0',
      background: 'rgba(0,0,0,0.85)',
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex:     '100',
      fontFamily: 'monospace',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#111',
      border:     '1px solid #00ff88',
      padding:    '32px 40px',
      minWidth:   '320px',
      textAlign:  'center',
    });

    // Título
    const title = document.createElement('div');
    title.style.cssText = 'font-size:22px;color:#00ff88;margin-bottom:8px;letter-spacing:2px;';
    title.textContent = 'FIN DE PARTIDA';
    box.appendChild(title);

    const winnerEl = document.createElement('div');
    winnerEl.style.cssText = 'font-size:16px;color:#fff;margin-bottom:20px;';
    winnerEl.textContent = `Ganador: ${winner}`;
    box.appendChild(winnerEl);

    // Tabla de scores
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;margin-bottom:20px;color:#ccc;font-size:13px;';
    table.innerHTML = `
      <thead>
        <tr style="border-bottom:1px solid #444;color:#00ff88;">
          <th style="padding:4px 8px;text-align:left;">Piloto</th>
          <th style="padding:4px 8px;">Kills</th>
          <th style="padding:4px 8px;">Muertes</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b.kills - a.kills);
    for (const [, s] of sorted) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="padding:4px 8px;text-align:left;">${s.username}</td>
        <td style="padding:4px 8px;text-align:center;">${s.kills}</td>
        <td style="padding:4px 8px;text-align:center;">${s.deaths}</td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    box.appendChild(table);

    // Botón volver
    const btn = document.createElement('button');
    btn.textContent = 'Volver al Lobby';
    btn.style.cssText = 'padding:8px 24px;background:#003300;color:#00ff88;border:1px solid #00ff88;cursor:pointer;font-family:monospace;font-size:14px;';
    btn.onclick = () => location.reload();
    box.appendChild(btn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
}

// ── Punto de entrada ──────────────────────────────────────────────────────────
showLanding(result => {
  const socket = new GameSocket();
  socket.connect()
    .then(() => {
      socket.identify(result.username, result.aircraft === 'dragon' ? 'dragon' : 'f22');
      showLobby(
        socket,
        result.username,
        result.aircraft,
        () => new FlightSim(result),           // Modo solo
        (cfg) => new FlightSim(result, cfg),   // Multijugador
      );
    })
    .catch(() => {
      // Servidor no disponible → entrar directo en modo solo
      console.warn('[Main] Servidor no disponible, entrando en modo solo.');
      new FlightSim(result);
    });
});
