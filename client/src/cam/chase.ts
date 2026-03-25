import * as THREE from 'three';

export class ChaseCamera {
  private camera: THREE.PerspectiveCamera;
  private camPos      = new THREE.Vector3();
  private camVel      = new THREE.Vector3();
  private mouseOff    = new THREE.Vector2();
  private isCockpit   = false;
  private initialized = false;

  // Tercera persona: suficientemente lejos para ver el modelo completo
  private readonly CAM_BACK    = 22;   // m detrás del avión
  private readonly CAM_UP      = 7;    // m sobre el avión
  private readonly LOOK_AHEAD  = 50;   // m adelante del avión para apuntar cámara
  private readonly SPRING_K    = 25;   // rigidez del resorte
  private readonly DAMPING     = 10;   // amortiguación

  // Vista cabina: justo detrás del tablero
  private readonly COCKPIT_OFFSET = new THREE.Vector3(0, 1.0, 4.5);

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  toggleView() {
    this.isCockpit = !this.isCockpit;
  }

  update(
    aircraft: { position: THREE.Vector3; quaternion: THREE.Quaternion },
    mouse:    { x: number; y: number },
    dt:       number
  ) {
    let desiredPos: THREE.Vector3;
    let lookTarget: THREE.Vector3;

    if (this.isCockpit) {
      // Cabina: la cámara está fija respecto al avión
      const offset = this.COCKPIT_OFFSET.clone().applyQuaternion(aircraft.quaternion);
      desiredPos = aircraft.position.clone().add(offset);
      lookTarget = aircraft.position.clone().add(
        new THREE.Vector3(0, 0, 50).applyQuaternion(aircraft.quaternion)
      );
      // En cabina la cámara sigue instantáneamente (sin resorte)
      this.camPos.copy(desiredPos);
      this.camVel.set(0, 0, 0);
    } else {
      // Tercera persona: resorte amortiguado para seguimiento suave
      const offset = new THREE.Vector3(0, this.CAM_UP, -this.CAM_BACK)
        .applyQuaternion(aircraft.quaternion);
      desiredPos = aircraft.position.clone().add(offset);
      lookTarget = aircraft.position.clone().add(
        new THREE.Vector3(0, 0, this.LOOK_AHEAD).applyQuaternion(aircraft.quaternion)
      );

      if (!this.initialized) {
        this.camPos.copy(desiredPos);
        this.camVel.set(0, 0, 0);
        this.initialized = true;
      } else {
        const delta = desiredPos.clone().sub(this.camPos);
        const accel = delta.clone().multiplyScalar(this.SPRING_K)
          .sub(this.camVel.clone().multiplyScalar(this.DAMPING));
        this.camVel.addScaledVector(accel, dt);
        this.camPos.addScaledVector(this.camVel, dt);
      }
    }

    // Ajuste por mouse (clic derecho): desplazar el punto de mira
    this.mouseOff.x = THREE.MathUtils.lerp(this.mouseOff.x, mouse.x, 5 * dt);
    this.mouseOff.y = THREE.MathUtils.lerp(this.mouseOff.y, mouse.y, 5 * dt);
    if (!mouse.x && !mouse.y) {
      this.mouseOff.lerp(new THREE.Vector2(), 3 * dt);
    }
    lookTarget.addScaledVector(
      new THREE.Vector3(this.mouseOff.x * 30, -this.mouseOff.y * 20, 0)
        .applyQuaternion(aircraft.quaternion),
      1
    );

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(lookTarget);
  }
}
