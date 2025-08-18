import * as THREE from 'three';
import { SimpleFlightState } from '../flight/simple';

const OFFSET = new THREE.Vector3(-12, 3.5, 0); // local offset (up, back)
const LOOK_AHEAD = 20;

/** Third person chase camera with critically damped spring and mouse-look. */
export class ChaseCamera {
  private cam: THREE.PerspectiveCamera;
  private position = new THREE.Vector3();
  private velocity = new THREE.Vector3();

  constructor(cam: THREE.PerspectiveCamera) {
    this.cam = cam;
  }

  update(dt: number, state: SimpleFlightState, lookYaw: number, lookPitch: number) {
    const desiredPos = state.pos
      .clone()
      .add(OFFSET.clone().applyQuaternion(state.quat));

    const lookRot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(lookPitch, lookYaw, 0, 'YXZ')
    );

    // critically damped spring toward desiredPos
    const stiffness = 40;
    const damping = 2 * Math.sqrt(stiffness);
    const accel = desiredPos
      .clone()
      .sub(this.position)
      .multiplyScalar(stiffness)
      .add(this.velocity.clone().multiplyScalar(-damping));
    this.velocity.addScaledVector(accel, dt);
    this.position.addScaledVector(this.velocity, dt);
    this.cam.position.copy(this.position);

    // look target ahead of aircraft with local yaw/pitch offsets
    const lookDir = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(lookRot)
      .applyQuaternion(state.quat);
    const target = state.pos.clone().addScaledVector(lookDir, LOOK_AHEAD);
    this.cam.lookAt(target);
  }
}
