import * as THREE from 'three';

/**
 * Simple spring-damped chase camera.
 */
export class ChaseCamera {
  private target: THREE.Object3D;
  private cam: THREE.PerspectiveCamera;
  private offset = new THREE.Vector3(0, 3.5, -12);
  private current = new THREE.Vector3();
  private look = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;

  constructor(cam: THREE.PerspectiveCamera, target: THREE.Object3D) {
    this.cam = cam;
    this.target = target;
    this.current.copy(target.position).add(this.offset);
  }

  update(dt: number) {
    const rot = new THREE.Euler(this.pitch, this.yaw, 0);
    const off = this.offset.clone().applyEuler(rot);
    const desired = off.applyQuaternion(this.target.quaternion).add(this.target.position);
    const stiffness = 5;
    this.current.lerp(desired, 1 - Math.exp(-stiffness * dt));
    this.cam.position.copy(this.current);
    this.look.copy(this.target.position);
    this.cam.lookAt(this.look);
  }

  setOrbit(yaw: number, pitch: number) {
    this.yaw = THREE.MathUtils.clamp(yaw, THREE.MathUtils.degToRad(-60), THREE.MathUtils.degToRad(60));
    this.pitch = THREE.MathUtils.clamp(pitch, THREE.MathUtils.degToRad(-60), THREE.MathUtils.degToRad(60));
  }
}

