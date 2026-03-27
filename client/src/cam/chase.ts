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
  private readonly SPRING_K    = 6;    // rigidez del resorte (suelto para dar inercia)
  private readonly DAMPING     = 4;    // amortiguación

  // Vista cabina: justo detrás del tablero
  private readonly COCKPIT_OFFSET = new THREE.Vector3(0, 1.0, 4.5);

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  toggleView() {
    this.isCockpit = !this.isCockpit;
  }

  update(
    aircraft: { position: THREE.Vector3; quaternion: THREE.Quaternion; velocity: THREE.Vector3 },
    mouse:    { x: number; y: number },
    dt:       number,
    speed     = 150
  ) {
    let desiredPos: THREE.Vector3;
    let lookTarget: THREE.Vector3;

    // Dirección real de vuelo — independiente de la orientación visual del modelo
    const vel = aircraft.velocity;
    const fwdWorld = vel.length() > 5
      ? vel.clone().normalize()
      : new THREE.Vector3(0, 0, 1).applyQuaternion(aircraft.quaternion);

    // UP siempre en world-space para la cámara de persecución.
    // Si se usara el "up" local del avión, cuando el avión banquea la cámara
    // quedaría de costado en lugar de arriba.
    const WORLD_UP = new THREE.Vector3(0, 1, 0);

    if (this.isCockpit) {
      // Cabina: usa el frame local del avión (estás dentro de la cabina)
      const cockpitOffset = this.COCKPIT_OFFSET.clone().applyQuaternion(aircraft.quaternion);
      desiredPos = aircraft.position.clone().add(cockpitOffset);
      lookTarget = aircraft.position.clone().addScaledVector(fwdWorld, 50);
      // En cabina la cámara sigue instantáneamente (sin resorte)
      this.camPos.copy(desiredPos);
      this.camVel.set(0, 0, 0);
    } else {
      // Tercera persona: atrás en la dirección opuesta al vuelo, arriba en world-up
      const backWorld = fwdWorld.clone().negate();
      const offset = backWorld.clone().multiplyScalar(this.CAM_BACK)
        .addScaledVector(WORLD_UP, this.CAM_UP);
      desiredPos = aircraft.position.clone().add(offset);
      lookTarget = aircraft.position.clone();

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
    const rightWorld = fwdWorld.clone().cross(WORLD_UP).normalize();
    lookTarget.addScaledVector(rightWorld, this.mouseOff.x * 30);
    lookTarget.addScaledVector(WORLD_UP, -this.mouseOff.y * 20);

    // FOV dinámico: más ancho a mayor velocidad (sensación de aceleración)
    const t = THREE.MathUtils.clamp((speed - 55) / (560 - 55), 0, 1);
    const targetFov = THREE.MathUtils.lerp(65, 95, t);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 4 * dt);
    this.camera.updateProjectionMatrix();

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(lookTarget);
  }
}
