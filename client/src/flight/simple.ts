import * as THREE from 'three';

export interface SimpleFlightState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  yawRate: number;
  pitchRate: number;
  rollRate: number;
  speed: number;
  speedTarget: number;
}

export interface SimpleFlightInput {
  pitch: number;
  roll: number;
  yaw: number;
  throttle: number;
}

export const H = 1 / 120;
export const YAW_MAX = 0.6;
export const PITCH_MAX = 0.8;
export const ROLL_MAX = 1.2;
export const RATE_SMOOTH = 0.15;
export const SPEED_GAIN = 1.5;
export const COORD_YAW_GAIN = 0.2;
export const DRAG_K = 0.0004;
export const GROUND_Y = 0;
export const SKY_Y = 4000;
export const WORLD_HALF = 50000;

export function step(state: SimpleFlightState, input: SimpleFlightInput, h: number) {
  state.yawRate += (input.yaw * YAW_MAX - state.yawRate) * RATE_SMOOTH;
  state.pitchRate += (input.pitch * PITCH_MAX - state.pitchRate) * RATE_SMOOTH;
  state.rollRate += (input.roll * ROLL_MAX - state.rollRate) * RATE_SMOOTH;
  state.yawRate += state.rollRate * COORD_YAW_GAIN;

  const wx = state.rollRate;
  const wy = state.pitchRate;
  const wz = state.yawRate;
  const q = state.quat;
  const dq = new THREE.Quaternion(wx, wy, wz, 0).multiply(q);
  q.x += dq.x * 0.5 * h;
  q.y += dq.y * 0.5 * h;
  q.z += dq.z * 0.5 * h;
  q.w += dq.w * 0.5 * h;
  q.normalize();

  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  state.speed += (state.speedTarget - state.speed) * SPEED_GAIN * h;
  state.speed -= DRAG_K * state.speed * state.speed * h;
  if (state.speed < 0) state.speed = 0;
  state.vel.copy(forward).multiplyScalar(state.speed);
  state.pos.addScaledVector(state.vel, h);

  if (state.pos.y < GROUND_Y) {
    state.pos.y = GROUND_Y;
    if (state.vel.y < 0) state.vel.y = 0;
  }
  if (state.pos.y > SKY_Y) {
    state.pos.y = SKY_Y;
    if (state.vel.y > 0) state.vel.y = 0;
  }
  if (state.pos.x < -WORLD_HALF) {
    state.pos.x = -WORLD_HALF;
    state.vel.x = Math.abs(state.vel.x);
  }
  if (state.pos.x > WORLD_HALF) {
    state.pos.x = WORLD_HALF;
    state.vel.x = -Math.abs(state.vel.x);
  }
  if (state.pos.z < -WORLD_HALF) {
    state.pos.z = -WORLD_HALF;
    state.vel.z = Math.abs(state.vel.z);
  }
  if (state.pos.z > WORLD_HALF) {
    state.pos.z = WORLD_HALF;
    state.vel.z = -Math.abs(state.vel.z);
  }
}

export function isFiniteState(state: SimpleFlightState): boolean {
  return [
    state.pos.x,
    state.pos.y,
    state.pos.z,
    state.vel.x,
    state.vel.y,
    state.vel.z,
    state.quat.x,
    state.quat.y,
    state.quat.z,
    state.quat.w,
    state.yawRate,
    state.pitchRate,
    state.rollRate,
    state.speed,
    state.speedTarget,
  ].every(Number.isFinite);
}
