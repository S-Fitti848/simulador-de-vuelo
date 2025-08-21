import * as THREE from 'three';

export class ChaseCamera {
  private camera: THREE.PerspectiveCamera;
  private position = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private mouseOffset = new THREE.Vector2();
  private readonly CAM_UP = 0.5;
  private readonly CAM_BACK = 2;
  private readonly LOOK_AHEAD = 10;
  private readonly SPRING_K = 25;
  private readonly DAMPING = 10;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  update(aircraft: { position: THREE.Vector3; quaternion: THREE.Quaternion }, mouse: { x: number; y: number }, h: number) {
    const offset = new THREE.Vector3(0, this.CAM_UP, -this.CAM_BACK).applyQuaternion(aircraft.quaternion);
    const desired = aircraft.position.clone().add(offset);
    const look = aircraft.position.clone().add(
      new THREE.Vector3(0, 0, this.LOOK_AHEAD).applyQuaternion(aircraft.quaternion)
    );

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
