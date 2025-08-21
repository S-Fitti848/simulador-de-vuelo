import * as THREE from 'three';

export class SimpleFlight {
  private position = new THREE.Vector3(0, 50, 0);
  private quaternion = new THREE.Quaternion();
  private velocity = new THREE.Vector3(0, 0, 120);
  private throttle = 0.6;
  private speed = 120;
  private angularRates = new THREE.Vector3();
  private hp = 100;

  private readonly MIN_SPEED = 50;
  private readonly MAX_SPEED = 200;
  private readonly SPEED_GAIN = 2;
  private readonly ROLL_MAX = 1;
  private readonly PITCH_MAX = 1;
  private readonly YAW_MAX = 0.5;
  private readonly DRAG = 0.1;

  reset() {
    this.position.set(0, 50, 0);
    this.quaternion.set(0, 0, 0, 1).normalize();
    this.velocity.set(0, 0, 120);
    this.throttle = 0.6;
    this.speed = 120;
    this.angularRates.set(0, 0, 0);
    this.hp = 100;
  }

  update(inputs: { pitch: number; roll: number; yaw: number; throttle: number }, h: number) {
    this.throttle = Math.max(0, Math.min(1, this.throttle + inputs.throttle * h));
    const speedTarget = THREE.MathUtils.lerp(this.MIN_SPEED, this.MAX_SPEED, this.throttle);
    this.speed += (speedTarget - this.speed) * this.SPEED_GAIN * h;
    this.speed *= 1 - this.DRAG * h;

    const targetRates = new THREE.Vector3(
      inputs.pitch * this.PITCH_MAX,
      inputs.yaw * this.YAW_MAX,
      inputs.roll * this.ROLL_MAX
    );
    this.angularRates.lerp(targetRates, 5 * h);

    const rot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.angularRates.x * h, this.angularRates.y * h, -this.angularRates.z * h, 'YXZ')
    );
    this.quaternion.multiply(rot).normalize();

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion);
    this.velocity.copy(forward).multiplyScalar(this.speed);
    this.position.addScaledVector(this.velocity, h);

    this.position.y = Math.max(0, Math.min(4000, this.position.y));
    if (this.position.x < -50000 || this.position.x > 50000 || 
        this.position.z < -50000 || this.position.z > 50000 || 
        isNaN(this.position.x) || isNaN(this.position.y) || isNaN(this.position.z)) {
      this.reset();
    }

    return { position: this.position, quaternion: this.quaternion, velocity: this.velocity, throttle: this.throttle, hp: this.hp };
  }
}
