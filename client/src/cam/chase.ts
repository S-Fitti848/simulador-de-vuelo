import * as THREE from 'three';

/**
 * Spring-damped third person chase camera. Mouse movement adjusts yaw/pitch
 * and the camera follows the attached target with a critical damping spring.
 */
export class ChaseCamera {
  private target: THREE.Object3D | null = null;
  private cam: THREE.PerspectiveCamera;
  private followOffset = new THREE.Vector3(0, 3.5, -12);
  private current = new THREE.Vector3();
  private look = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;

  constructor(cam: THREE.PerspectiveCamera, target?: THREE.Object3D) {
    this.cam = cam;
    if (target) this.attach(target);
  }

  attach(obj: THREE.Object3D) {
    this.target = obj;
    this.current.copy(obj.position).add(this.followOffset);
  }

  setOffsets(offset: THREE.Vector3) {
    this.followOffset.copy(offset);
  }

  update(dt: number, mouse?: { x: number; y: number }) {
    if (!this.target) return;
    if (mouse) {
      this.yaw -= mouse.x * 0.002;
      this.pitch -= mouse.y * 0.002;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch,
        THREE.MathUtils.degToRad(-60),
        THREE.MathUtils.degToRad(60)
      );
    }
    const rot = new THREE.Euler(this.pitch, this.yaw, 0);
    const off = this.followOffset.clone().applyEuler(rot);
    const desired = off
      .applyQuaternion(this.target.quaternion)
      .add(this.target.position);
    const stiffness = 5; // critical damping approximation
    this.current.lerp(desired, 1 - Math.exp(-stiffness * dt));
    this.cam.position.copy(this.current);
    // look a little ahead of the aircraft to reduce jitter
    this.look
      .set(0, 0, -10)
      .applyQuaternion(this.target.quaternion)
      .add(this.target.position);
    this.cam.lookAt(this.look);
  }
}

