import * as THREE from 'three';
import { SimpleFlightState } from '../flight/simple';

export interface LocalPlayer {
  mesh: THREE.Object3D;
  state: SimpleFlightState;
}

function resetState(state: SimpleFlightState) {
  state.pos.set(0, 50, 0);
  state.vel.set(0, 0, 0);
  state.quat.set(0, 0, 0, 1);
  state.yawRate = 0;
  state.pitchRate = 0;
  state.rollRate = 0;
  state.speed = 120;
  state.speedTarget = 120;
}

export function spawnLocal(): LocalPlayer {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 4),
    new THREE.MeshStandardMaterial({ color: 0x555555 })
  );
  mesh.rotation.y = -Math.PI / 2; // align nose with +X

  const state: SimpleFlightState = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    yawRate: 0,
    pitchRate: 0,
    rollRate: 0,
    speed: 120,
    speedTarget: 120,
  };
  resetState(state);
  mesh.position.copy(state.pos);
  mesh.quaternion.copy(state.quat);
  return { mesh, state };
}

export function respawn(player: LocalPlayer) {
  resetState(player.state);
  player.mesh.position.copy(player.state.pos);
  player.mesh.quaternion.copy(player.state.quat);
}
