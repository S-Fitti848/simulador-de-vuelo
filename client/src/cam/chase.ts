/client/src/cam/chase.ts
// Changes: Made camera closer (CAM_BACK = 3 instead of 10, CAM_UP = 1.5 instead of 2). Ensured it stays strictly behind the plane with better spring damping for smooth following. Cockpit view unchanged.
import * as THREE from 'three';

export class ChaseCamera {
  private camera: THREE.PerspectiveCamera;
  private position = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private mouseOffset = new THREE.Vector2();
  private isCockpit = false;
  private readonly CAM_UP = 1.5;
  private readonly CAM_BACK = 3;
  private readonly LOOK_AHEAD = 10;
  private readonly SPRING_K = 30; // Increased for tighter follow
  private readonly DAMPING = 12; // Smoother damping
  private readonly COCKPIT_OFFSET = new THREE.Vector3(0, 1, 2);

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  toggleView() {
    this.isCockpit = !this.isCockpit;
  }

  update(aircraft: { position: THREE.Vector3; quaternion: THREE.Quaternion }, mouse: { x: number; y: number }, h: number) {
    let desired, look;
    if (this.isCockpit) {
      desired = aircraft.position.clone().add(this.COCKPIT_OFFSET.applyQuaternion(aircraft.quaternion));
      look = aircraft.position.clone().add(new THREE.Vector3(0, 0, 50).applyQuaternion(aircraft.quaternion));
    } else {
      const offset = new THREE.Vector3(0, this.CAM_UP, -this.CAM_BACK).applyQuaternion(aircraft.quaternion);
      desired = aircraft.position.clone().add(offset);
      look = aircraft.position.clone().add(
        new THREE.Vector3(0, 0, this.LOOK_AHEAD).applyQuaternion(aircraft.quaternion)
      );
    }

    const mouseAdjust = new THREE.Vector3(0, Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.mouseOffset.y)), this.mouseOffset.x);
    look.add(new THREE.Vector3(0, mouseAdjust.y * 5, 0).applyQuaternion(aircraft.quaternion));

    const delta = desired.clone().sub(this.position);
    const accel = delta.multiplyScalar(this.SPRING_K).sub(this.velocity.clone().multiplyScalar(this.DAMPING));
    this.velocity.addScaledVector(accel, h);
    this.position.addScaledVector(this.velocity, h);

    this.camera.position.copy(this.position);
    this.camera.lookAt(look);

    this.mouseOffset.x = THREE.MathUtils.lerp(this.mouseOffset.x, mouse.x, 5 * h);
    this.mouseOffset.y = THREE.MathUtils.lerp(this.mouseOffset.y, mouse.y, 5 * h);
    if (!mouse.x && !mouse.y) {
      this.mouseOffset.lerp(new THREE.Vector2(), 5 * h);
    }
  }
}
