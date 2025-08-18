import * as THREE from 'three';

export interface FlightState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  orientation: THREE.Quaternion;
  angularVelocity: THREE.Vector3;
  throttle: number; // 0..1
}

export interface FlightInput {
  pitch: number;
  roll: number;
  yaw: number;
}

const GRAVITY = new THREE.Vector3(0, -9.81, 0);
const MAX_THRUST = 30; // arbitrary units
const MASS = 1; // simple unit mass
const DRAG_COEFF = 0.02;
const AREA = 1; // wing reference area
const RHO = 1.225; // air density at sea level
const MAX_AOA = THREE.MathUtils.degToRad(15); // stall angle

// Update flight dynamics for fixed time step dt (seconds)
export function step(state: FlightState, input: FlightInput, dt: number) {
  // Angular dynamics from input
  const maxRate = THREE.MathUtils.degToRad(90); // deg/s -> rad/s
  state.angularVelocity.set(
    input.pitch * maxRate,
    input.yaw * maxRate,
    input.roll * maxRate
  );

  // Integrate orientation
  const w = state.angularVelocity;
  const q = state.orientation;
  const dq = new THREE.Quaternion(w.x, w.y, w.z, 0)
    .multiply(q)
    .multiplyScalar(0.5 * dt);
  q.add(dq).normalize();

  // Force calculations
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const speed = state.velocity.length();
  const vDir = speed > 0 ? state.velocity.clone().normalize() : new THREE.Vector3();

  // Thrust
  const thrust = forward.clone().multiplyScalar(MAX_THRUST * state.throttle);

  // Drag (quadratic)
  const drag = vDir.clone().multiplyScalar(-DRAG_COEFF * speed * speed);

  // Lift
  const localVel = state.velocity.clone().applyQuaternion(q.clone().invert());
  let alpha = Math.atan2(localVel.y, -localVel.z); // angle of attack
  const stall = Math.abs(alpha) > MAX_AOA;
  alpha = THREE.MathUtils.clamp(alpha, -MAX_AOA, MAX_AOA);
  let cl = 2 * Math.PI * alpha; // linear lift curve
  if (stall) cl *= 0.2; // soft stall reduces lift
  const liftMag = 0.5 * RHO * speed * speed * AREA * cl;
  const lift = up.clone().multiplyScalar(liftMag);
  if (stall) drag.add(vDir.clone().multiplyScalar(-speed * 0.5)); // extra drag on stall

  // Sum forces
  const totalForce = new THREE.Vector3()
    .add(GRAVITY.clone().multiplyScalar(MASS))
    .add(thrust)
    .add(drag)
    .add(lift);

  const accel = totalForce.clone().multiplyScalar(1 / MASS);
  state.velocity.add(accel.multiplyScalar(dt));
  state.position.add(state.velocity.clone().multiplyScalar(dt));
}
