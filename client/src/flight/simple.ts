import * as THREE from 'three';

/**
 * Modelo de vuelo simplificado pero físicamente razonable para un caza.
 * Usa fuerzas reales: empuje, sustentación, arrastre y gravedad.
 * Unidades: metros, segundos, Newtons, kg.
 */
export class SimpleFlight {
  private position     = new THREE.Vector3(0, 600, 0);
  private quaternion   = new THREE.Quaternion();
  private velocity     = new THREE.Vector3(0, 0, 150);   // ~290 nudos inicial
  private throttle     = 0.5;
  private angVel       = new THREE.Vector3();             // rad/s en body frame: x=pitch, y=yaw, z=roll
  private hp           = 100;

  // ─── Parámetros del avión (inspirado en F-22) ────────────────────────────
  private readonly MASS        = 20000;   // kg
  private readonly THRUST_MAX  = 200000;  // N (2× F119 ~105 kN c/u)
  private readonly WING_AREA   = 78;      // m²
  private readonly RHO         = 1.0;     // kg/m³ (densidad aire a ~3000m)

  // Aerodinámica
  private readonly CL_SLOPE    = 4.2;    // dCL/dAoA (rad⁻¹)
  private readonly CL_MAX      = 1.35;   // máx antes de stall profundo
  private readonly STALL_AOA   = 0.28;   // ~16° en radianes
  private readonly CD0         = 0.022;  // arrastre parásito
  private readonly CD_K        = 0.14;   // factor arrastre inducido

  // Tasas angulares máximas (rad/s)
  private readonly PITCH_RATE  = 1.5;
  private readonly ROLL_RATE   = 2.6;
  private readonly YAW_RATE    = 0.7;
  private readonly ANG_DAMP    = 3.5;    // amortiguación natural

  // Límites
  private readonly V_MAX       = 560;    // m/s (~Mach 1.65)
  private readonly V_STALL     = 55;     // m/s velocidad de stall
  private readonly ALT_MAX     = 9000;   // m techo operativo

  reset() {
    this.position.set(0, 600, 0);
    this.quaternion.identity();
    this.velocity.set(0, 0, 150);
    this.throttle = 0.5;
    this.angVel.set(0, 0, 0);
    this.hp = 100;
  }

  /** Teletransporta el avión a una posición/orientación arbitraria (para spawns multiplayer) */
  teleport(
    pos:  { x: number; y: number; z: number },
    quat: { x: number; y: number; z: number; w: number }
  ) {
    this.position.set(pos.x, pos.y, pos.z);
    this.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    this.velocity.set(0, 0, 150);
    this.angVel.set(0, 0, 0);
  }

  update(inputs: { pitch: number; roll: number; yaw: number; throttle: number }, dt: number) {

    // ── 1. Throttle ──────────────────────────────────────────────────────────
    this.throttle = THREE.MathUtils.clamp(
      this.throttle + inputs.throttle * 0.6 * dt, 0, 1
    );

    // ── 2. Vectores de base en world frame ───────────────────────────────────
    const fwd   = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion);
    const up    = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion);

    const speed  = this.velocity.length();
    const q_dyn  = 0.5 * this.RHO * speed * speed;   // presión dinámica [Pa]

    // ── 3. Ángulo de ataque (AoA) ─────────────────────────────────────────────
    // aoa > 0: nariz por encima del vector velocidad → sustentación positiva
    let aoa = 0;
    if (speed > 1) {
      const vn = this.velocity.clone().normalize();
      aoa = Math.asin(THREE.MathUtils.clamp(-up.dot(vn), -1, 1));
    }

    // ── 4. Coeficiente de sustentación con stall ──────────────────────────────
    let CL = this.CL_SLOPE * aoa;
    if (Math.abs(aoa) > this.STALL_AOA) {
      const over = (Math.abs(aoa) - this.STALL_AOA) / this.STALL_AOA;
      CL *= Math.max(0.2, 1 - over * 1.8);
    }
    CL = THREE.MathUtils.clamp(CL, -this.CL_MAX, this.CL_MAX);

    // ── 5. Fuerzas ────────────────────────────────────────────────────────────
    // Empuje: a lo largo del eje de la nariz
    const thrustForce = fwd.clone().multiplyScalar(this.throttle * this.THRUST_MAX);

    // Sustentación: perpendicular a la velocidad, en el plano del avión
    const liftMag   = CL * q_dyn * this.WING_AREA;
    const liftForce = up.clone().multiplyScalar(liftMag);

    // Arrastre: opuesto a la velocidad
    const CD       = this.CD0 + this.CD_K * CL * CL;
    const dragMag  = CD * q_dyn * this.WING_AREA;
    const dragForce = this.velocity.length() > 0
      ? this.velocity.clone().normalize().multiplyScalar(-dragMag)
      : new THREE.Vector3();

    // Gravedad
    const gravityForce = new THREE.Vector3(0, -this.GRAVITY_N, 0);

    // ── 6. Integrar velocidad (F = ma) ────────────────────────────────────────
    const acc = new THREE.Vector3()
      .add(thrustForce).add(liftForce).add(dragForce).add(gravityForce)
      .divideScalar(this.MASS);
    this.velocity.addScaledVector(acc, dt);

    // Limitar velocidad máxima
    if (this.velocity.length() > this.V_MAX) {
      this.velocity.normalize().multiplyScalar(this.V_MAX);
    }

    // ── 7. Velocidad angular (controles del piloto) ───────────────────────────
    const tgtPitch = inputs.pitch * this.PITCH_RATE;
    const tgtYaw   = inputs.yaw   * this.YAW_RATE;
    const tgtRoll  = inputs.roll  * this.ROLL_RATE;

    const blend = Math.min(1, 8 * dt);
    this.angVel.x = THREE.MathUtils.lerp(this.angVel.x, tgtPitch, blend);
    this.angVel.y = THREE.MathUtils.lerp(this.angVel.y, tgtYaw,   blend * 0.7);
    this.angVel.z = THREE.MathUtils.lerp(this.angVel.z, tgtRoll,  blend);

    // Amortiguación natural cuando no hay input
    const dampFactor = Math.exp(-this.ANG_DAMP * dt);
    if (!inputs.pitch) this.angVel.x *= dampFactor;
    if (!inputs.yaw)   this.angVel.y *= dampFactor;
    if (!inputs.roll)  this.angVel.z *= dampFactor;

    // Auto-nivelado suave (ayuda a pilotos nuevos, no muy agresivo)
    if (!inputs.roll && !inputs.yaw) {
      // Extraer ángulo de banco del quaternion
      const bankAngle = Math.atan2(
        2 * (this.quaternion.w * this.quaternion.z + this.quaternion.x * this.quaternion.y),
        1 - 2 * (this.quaternion.y ** 2 + this.quaternion.z ** 2)
      );
      // Corrección proporcional muy suave
      this.angVel.z -= bankAngle * 0.4 * dt;
    }

    // ── 8. Integrar rotación ──────────────────────────────────────────────────
    // Convención: x=pitch, y=yaw, z=roll (todos en body frame)
    const dRot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        this.angVel.x  * dt,
        -this.angVel.y * dt,
        -this.angVel.z * dt,
        'YXZ'
      )
    );
    this.quaternion.multiply(dRot).normalize();

    // ── 9. Integrar posición ──────────────────────────────────────────────────
    this.position.addScaledVector(this.velocity, dt);

    // Clamping de altitud
    const hitGround = this.position.y < 1 && speed > 20;
    this.position.y = THREE.MathUtils.clamp(this.position.y, 1, this.ALT_MAX);

    // Penalización por choque con el suelo
    if (hitGround) {
      this.hp -= 50;
      if (this.hp <= 0) this.reset();
    }

    // Fuera de límites → respawn
    if (Math.abs(this.position.x) > 48000 || Math.abs(this.position.z) > 48000 ||
        !isFinite(this.position.x) || !isFinite(this.position.y)) {
      this.reset();
    }

    return {
      position:   this.position,
      quaternion: this.quaternion,
      velocity:   this.velocity,
      throttle:   this.throttle,
      hp:         this.hp,
      speed,
      aoa,
      isStall:    Math.abs(aoa) > this.STALL_AOA || speed < this.V_STALL,
    };
  }

  private get GRAVITY_N() { return 9.81 * this.MASS; }
}
