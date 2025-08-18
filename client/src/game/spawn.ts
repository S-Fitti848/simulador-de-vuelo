import * as THREE from 'three';
import { buildRaptorLike } from '../aircraft/models';
import { SimpleFlightState } from '../flight/simple';

export interface LocalPlayer {
  mesh: THREE.Object3D;
  state: SimpleFlightState;
}

export function spawnLocal(): LocalPlayer {
  const mesh = buildRaptorLike();
  mesh.rotation.y = -Math.PI / 2; // align nose with +X

  const state: SimpleFlightState = {
    pos: new THREE.Vector3(0, 50, 0),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    yawRate: 0,
    pitchRate: 0,
    rollRate: 0,
    speed: 120,
    speedTarget: 120,
  };
  mesh.position.copy(state.pos);
  mesh.quaternion.copy(state.quat);
  return { mesh, state };
}

export function respawn(player: LocalPlayer) {
  player.state.pos.set(0, 50, 0);
  player.state.vel.set(0, 0, 0);
  player.state.quat.set(0, 0, 0, 1);
  player.state.yawRate = 0;
  player.state.pitchRate = 0;
  player.state.rollRate = 0;
  player.state.speed = 120;
  player.state.speedTarget = 120;
  player.mesh.position.copy(player.state.pos);
  player.mesh.quaternion.copy(player.state.quat);
}
