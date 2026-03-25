import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Interpolator } from '../net/interpolation';
import type { RemotePlayerInfo, RemotePlayerState } from '../net/types';

const MODEL_F22  = '/models/f-22_raptor_-_fighter_jet_-_free.glb';
const MODEL_SU57 = '/models/sukhoi_su-57_felon_-_fighter_jet_-_free.glb';

function autoScale(model: THREE.Group, size = 14) {
  const box = new THREE.Box3().setFromObject(model);
  const max = Math.max(...box.getSize(new THREE.Vector3()).toArray());
  if (max > 0) model.scale.setScalar(size / max);
}

// Color de equipo
const TEAM_COLOR: Record<string, number> = {
  A: 0x2244ff,
  B: 0xff2222,
  none: 0xffcc00,
};

/** Representa un avión de otro jugador en escena */
class RemotePlayer {
  readonly group  = new THREE.Group();
  private nameTag: HTMLDivElement;
  private hpBar:   HTMLDivElement;
  private interp   = new Interpolator();
  private hp       = 100;
  private alive    = true;

  readonly id:       string;
  readonly username: string;
  readonly team:     string;

  constructor(info: RemotePlayerInfo, scene: THREE.Scene) {
    this.id       = info.id;
    this.username = info.username;
    this.team     = info.team;

    scene.add(this.group);

    // Posición inicial
    this.group.position.set(info.position.x, info.position.y, info.position.z);
    this.group.quaternion.set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w);

    // Cargar modelo
    const loader = new GLTFLoader();
    const path   = info.aircraft === 'dragon' ? MODEL_SU57 : MODEL_F22;
    loader.load(path, gltf => {
      const model = gltf.scene;
      autoScale(model, 14);
      model.rotation.y = Math.PI;

      const emissiveColor = new THREE.Color(TEAM_COLOR[info.team] ?? TEAM_COLOR['none']);
      model.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          // Clonar material para no afectar al avión local
          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material = child.material.clone();
            child.material.emissive          = emissiveColor;
            child.material.emissiveIntensity = 0.35;
          }
        }
      });
      this.group.add(model);
    });

    // ── Nombre + barra de vida (HTML overlay) ────────────────────────────────
    const color = `#${(TEAM_COLOR[info.team] ?? TEAM_COLOR['none']).toString(16).padStart(6, '0')}`;

    this.nameTag = document.createElement('div');
    Object.assign(this.nameTag.style, {
      position:     'absolute',
      color:        color,
      fontFamily:   'monospace',
      fontSize:     '12px',
      fontWeight:   'bold',
      background:   'rgba(0,0,0,0.55)',
      padding:      '2px 6px',
      borderRadius: '3px',
      pointerEvents:'none',
      zIndex:       '20',
      display:      'none',
      whiteSpace:   'nowrap',
    });
    document.body.appendChild(this.nameTag);

    this.hpBar = document.createElement('div');
    Object.assign(this.hpBar.style, {
      position:     'absolute',
      height:       '4px',
      background:   '#00ff00',
      zIndex:       '20',
      pointerEvents:'none',
      display:      'none',
    });
    document.body.appendChild(this.hpBar);
  }

  pushState(state: RemotePlayerState, serverTs: number) {
    this.interp.push(serverTs, state.position, state.quaternion, state.velocity);
    this.hp    = state.hp;
    this.alive = state.alive;
    this.group.visible = state.alive;
  }

  respawn(pos: { x: number; y: number; z: number }) {
    this.hp = 100;
    this.alive = true;
    this.group.visible = true;
    this.group.position.set(pos.x, pos.y, pos.z);
  }

  update(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
    const state = this.interp.get();
    if (state) {
      this.group.position.copy(state.pos);
      this.group.quaternion.copy(state.quat);
    }

    if (!this.alive) {
      this.nameTag.style.display = 'none';
      this.hpBar.style.display   = 'none';
      return;
    }

    // Proyectar posición 3D → pantalla para el nombre tag
    const screenPos = this.group.position.clone().project(camera);
    const x = (screenPos.x *  0.5 + 0.5) * renderer.domElement.clientWidth;
    const y = (screenPos.y * -0.5 + 0.5) * renderer.domElement.clientHeight;
    const inFront = screenPos.z < 1;

    if (inFront) {
      this.nameTag.style.display  = 'block';
      this.nameTag.style.left     = `${x - 30}px`;
      this.nameTag.style.top      = `${y - 32}px`;
      this.nameTag.innerText      = `${this.username}`;

      const hpW = Math.max(0, this.hp);
      this.hpBar.style.display    = 'block';
      this.hpBar.style.left       = `${x - 30}px`;
      this.hpBar.style.top        = `${y - 22}px`;
      this.hpBar.style.width      = `${hpW * 0.6}px`;
      this.hpBar.style.background = hpW > 50 ? '#00ff00' : hpW > 25 ? '#ffaa00' : '#ff0000';
    } else {
      this.nameTag.style.display = 'none';
      this.hpBar.style.display   = 'none';
    }
  }

  getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  getTeam() { return this.team; }

  destroy() {
    this.group.parent?.remove(this.group);
    this.nameTag.remove();
    this.hpBar.remove();
  }
}

/** Gestiona todos los jugadores remotos en escena */
export class RemotePlayerManager {
  private players = new Map<string, RemotePlayer>();
  private scene:   THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  add(info: RemotePlayerInfo) {
    if (this.players.has(info.id)) return;
    this.players.set(info.id, new RemotePlayer(info, this.scene));
  }

  remove(id: string) {
    const p = this.players.get(id);
    if (p) { p.destroy(); this.players.delete(id); }
  }

  applyGameState(states: RemotePlayerState[], serverTs: number) {
    for (const s of states) {
      const p = this.players.get(s.id);
      if (p) p.pushState(s, serverTs);
    }
  }

  respawn(playerId: string, pos: { x: number; y: number; z: number }) {
    this.players.get(playerId)?.respawn(pos);
  }

  update(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
    for (const [, p] of this.players) p.update(camera, renderer);
  }

  /** Para radar: [ { pos, team } ] */
  getRadarEntries(): { pos: THREE.Vector3; team: string }[] {
    return [...this.players.values()]
      .filter(p => p.group.visible)
      .map(p => ({ pos: p.getPosition(), team: p.getTeam() }));
  }

  getPositionOf(id: string): THREE.Vector3 | null {
    const p = this.players.get(id);
    return p ? p.getPosition() : null;
  }

  clear() {
    for (const [id] of [...this.players]) this.remove(id);
  }
}
