import * as THREE from 'three';

export class ChaseCamera {
  private camera:      THREE.PerspectiveCamera;
  private camPos      = new THREE.Vector3();
  private camVel      = new THREE.Vector3();
  private mouseOff    = new THREE.Vector2();
  private isCockpit   = false;
  private initialized = false;

  // Offset LOCAL respecto al avión: X=centrado, Y=arriba, Z negativo=atrás en frame local.
  // Se transforma con el quaternion del avión → la cámara banquea con él.
  private readonly LOCAL_OFFSET   = new THREE.Vector3(0, 3.5, -12);
  private readonly COCKPIT_OFFSET = new THREE.Vector3(0, 1.0, -4.5);

  // Resorte críticamente amortiguado: DAMPING = 2 × √SPRING_K
  // → respuesta rápida sin overshoot ni efecto "slingshot"
  private readonly SPRING_K = 60;
  private readonly DAMPING  = 15.5;   // 2 × √60 ≈ 15.49

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  toggleView() {
    this.isCockpit   = !this.isCockpit;
    this.initialized = false;   // re-snap al cambiar de vista
    this.camVel.set(0, 0, 0);
  }

  update(
    aircraft: { position: THREE.Vector3; quaternion: THREE.Quaternion; velocity: THREE.Vector3 },
    mouse:    { x: number; y: number },
    dt:       number,
    speed     = 150
  ) {
    let desiredPos: THREE.Vector3;
    let lookTarget: THREE.Vector3;

    if (this.isCockpit) {
      // ── Vista cabina ──────────────────────────────────────────────────────
      const offset   = this.COCKPIT_OFFSET.clone().applyQuaternion(aircraft.quaternion);
      desiredPos     = aircraft.position.clone().add(offset);
      const fwdLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(aircraft.quaternion);
      lookTarget     = aircraft.position.clone().addScaledVector(fwdLocal, 50);
      this.camPos.copy(desiredPos);
      this.camVel.set(0, 0, 0);

    } else {
      // ── Vista tercera persona ─────────────────────────────────────────────
      // El offset LOCAL se rota con el quaternion → cámara banquea con el avión
      const offset = this.LOCAL_OFFSET.clone().applyQuaternion(aircraft.quaternion);
      desiredPos   = aircraft.position.clone().add(offset);
      lookTarget   = aircraft.position.clone();

      if (!this.initialized) {
        // Snap en el primer frame: sin efecto slingshot al arrancar
        this.camPos.copy(desiredPos);
        this.camVel.set(0, 0, 0);
        this.initialized = true;
      } else {
        // Resorte críticamente amortiguado (DAMPING = 2√K → sin oscilaciones)
        const delta = desiredPos.clone().sub(this.camPos);
        const accel = delta.clone().multiplyScalar(this.SPRING_K)
          .sub(this.camVel.clone().multiplyScalar(this.DAMPING));
        this.camVel.addScaledVector(accel, dt);
        this.camPos.addScaledVector(this.camVel, dt);
      }
    }

    // ── Mouse look (clic derecho) ─────────────────────────────────────────
    this.mouseOff.x = THREE.MathUtils.lerp(this.mouseOff.x, mouse.x, 5 * dt);
    this.mouseOff.y = THREE.MathUtils.lerp(this.mouseOff.y, mouse.y, 5 * dt);
    if (!mouse.x && !mouse.y) this.mouseOff.lerp(new THREE.Vector2(), 3 * dt);

    const rightAircraft = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quaternion);
    const upAircraft    = new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quaternion);
    lookTarget.addScaledVector(rightAircraft,  this.mouseOff.x * 30);
    lookTarget.addScaledVector(upAircraft,    -this.mouseOff.y * 20);

    // ── FOV dinámico (sensación de velocidad) ────────────────────────────
    const t = THREE.MathUtils.clamp((speed - 55) / (560 - 55), 0, 1);
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      THREE.MathUtils.lerp(65, 95, t),
      4 * dt
    );
    this.camera.updateProjectionMatrix();

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(lookTarget);
  }
}
