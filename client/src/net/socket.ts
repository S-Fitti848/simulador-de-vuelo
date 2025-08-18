import { FlightState } from '../physics/flight';
import * as THREE from 'three';
import type { AircraftChoice } from '../ui/landing';
import type { LobbyMessage } from './types';

export interface PlayerSnapshot {
  id: string;
  username?: string;
  aircraft?: AircraftChoice;
  state: {
    pos: [number, number, number];
    quat: [number, number, number, number];
    vel: [number, number, number];
    hp?: number;
  };
}

export interface Snapshot {
  type: 'snapshot';
  players: PlayerSnapshot[];
  projectiles: { id: string; pos: [number, number, number] }[];
}

let socket: WebSocket | null = null;
let clientId: string | null = null;
let user = 'anon';
let craft: AircraftChoice = 'raptor';

export function connect(
  username: string,
  aircraft: AircraftChoice,
  onSnapshot: (snap: Snapshot) => void,
  onHit: (id: string) => void,
  onLobby?: (msg: LobbyMessage) => void
) {
  user = username;
  craft = aircraft;
  const url = (import.meta.env.VITE_SERVER_URL || '').replace(/^http/, 'ws');
  socket = new WebSocket(url);
  socket.addEventListener('open', () => {
    const join = { type: 'join', username: user, aircraft: craft };
    socket?.send(JSON.stringify(join));
  });
  socket.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'hello') {
      clientId = msg.id;
    } else if (msg.type === 'snapshot') {
      onSnapshot(msg as Snapshot);
    } else if (msg.type === 'hit') {
      onHit(msg.id);
    } else {
      onLobby?.(msg as LobbyMessage);
    }
  });
}

export function id() {
  return clientId;
}

export function sendState(state: FlightState) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const payload = {
    type: 'state',
    username: user,
    aircraft: craft,
    state: {
      pos: [state.position.x, state.position.y, state.position.z],
      quat: [state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w],
      vel: [state.velocity.x, state.velocity.y, state.velocity.z],
      hp: 1,
    },
  };
  socket.send(JSON.stringify(payload));
}

export function sendProjectile(pos: THREE.Vector3, vel: THREE.Vector3, ttl: number) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const payload = {
    type: 'projectile',
    projectile: {
      id: Math.random().toString(36).slice(2),
      pos: [pos.x, pos.y, pos.z],
      vel: [vel.x, vel.y, vel.z],
      ttl,
    },
  };
  socket.send(JSON.stringify(payload));
  return payload.projectile.id;
}
