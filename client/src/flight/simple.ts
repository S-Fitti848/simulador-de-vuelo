/client/src/flight/simple.ts
// Changes: Smoother movement—increased LIFT_K to 0.008 for easier climbs, reduced DRAG_K to 0.0003 for less slowdown, max speed to 350. Added banking: roll affects yaw slightly for natural turns. Stall now gradual (lift reduces to 0.7 min instead of 0.5). Tuned angular rates for responsive control.
import * as THREE from 'three';

export class SimpleFlight {
  private position = new THREE.Vector3(0, 50, 0);
  private quaternion = new THREE.Quaternion();
  private velocity = new THREE.Vector3(0, 0, 120);
  private throttle = 0.6;
  private angularRates = new THREE.Vector3();
  private hp = 100;

  private readonly MIN_SPEED = 60;
  private readonly MAX_SPEED = 350;
  private readonly THRUST_MAX = 250;
  private readonly LIFT_K = 0.008;
  private readonly DRAG_K = 0.0003;
  private readonly GRAVITY = 9.81;
  private readonly ROLL_MAX = 2.5;
  private readonly PITCH_MAX = 1.8;
  private readonly YAW_MAX = 1.2;
  private readonly BANK_FACTOR = 0.5; // Roll affects yaw for banking turns

  reset() {
    this.position.set(0, 50, 0);
    this.quaternion.set(0, 0, 0, 1).normalize();
    this.velocity.set(0, 0, 120);
    this.throttle = 0.6;
    this.angularRates.set(0, 0, 0);
    this.hp = 100;
  }

  update(inputs: { pitch: number; roll: number; yaw: number; throttle: number }, h: number) {
    this.throttle = Math.max(0, Math.min(1, this.throttle + inputs.throttle * 0.5 * h));

    // Angular rates with banking
    const targetRates = new THREE.Vector3(
      inputs.pitch * this.PITCH_MAX,
      (inputs.yaw * this.YAW_MAX) + (inputs.roll * this.BANK_FACTOR), // Banking adds yaw
      inputs.roll * this.ROLL_MAX
    );
    this.angularRates.lerp(targetRates, 5 * h);

    // Rotate quaternion
    const rot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.angularRates.x * h, this.angularRates.y * h, -this.angularRates.z * h, 'YXZ')
    );
    this.quaternion.multiply(rot).normalize();

    // Forces
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion);
    const speed = this.velocity.length();

    // Thrust
    const thrust = forward.clone().multiplyScalar(this.throttle * this.THRUST_MAX * h);

    // Lift
    const aoa = Math.sin(this.angularRates.x);
    const lift = up.clone().multiplyScalar(this.LIFT_K * speed * speed * aoa * h);

    // Drag
    const drag = this.velocity.clone().normalize().multiplyScalar(-this.DRAG_K * speed * speed * h);

    // Gravity
    const gravity = new THREE.Vector3(0, -this.GRAVITY * h, 0);

    // Stall: Gradual lift reduction
    const effectiveLift = (speed < this.MIN_SPEED) ? lift.multiplyScalar(0.7 + (speed / this.MIN_SPEED) * 0.3) : lift;

    // Apply forces
    this.velocity.add(thrust).add(effectiveLift).add(drag).add(gravity);

    // Cap speed
    if (speed > this.MAX_SPEED) {
      this.velocity.normalize().multiplyScalar(this.MAX_SPEED);
    }

    // Update position
    this.position.add(this.velocity.clone().multiplyScalar(h));

    // Bounds and ground clamp
    this.position.y = Math.max(0, Math.min(4000, this.position.y));
    if (this.position.x < -50000 || this.position.x > 50000 || 
        this.position.z < -50000 || this.position.z > 50000 || 
        isNaN(this.position.x) || isNaN(this.position.y) || isNaN(this.position.z) ||
        this.position.y <= 0 && speed > 0) {
      this.hp -= 50;
      if (this.hp <= 0) this.reset();
    }

    return { position: this.position, quaternion: this.quaternion, velocity: this.velocity, throttle: this.throttle, hp: this.hp, speed };
  }
}
