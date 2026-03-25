import * as THREE from 'three';

interface Snapshot {
  ts:   number;
  pos:  THREE.Vector3;
  quat: THREE.Quaternion;
  vel:  THREE.Vector3;
}

/**
 * Interpola entre snapshots de red con un buffer de 120ms.
 * Esto suaviza el movimiento aunque los paquetes lleguen irregularmente.
 */
export class Interpolator {
  private snaps: Snapshot[] = [];
  private readonly BUFFER = 120; // ms de delay para suavizado

  push(ts: number, pos: { x: number; y: number; z: number },
       quat: { x: number; y: number; z: number; w: number },
       vel:  { x: number; y: number; z: number }) {
    this.snaps.push({
      ts,
      pos:  new THREE.Vector3(pos.x, pos.y, pos.z),
      quat: new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w),
      vel:  new THREE.Vector3(vel.x, vel.y, vel.z),
    });
    if (this.snaps.length > 12) this.snaps.shift();
  }

  /** Retorna la posición/rotación interpolada para el tiempo actual */
  get(): { pos: THREE.Vector3; quat: THREE.Quaternion; vel: THREE.Vector3 } | null {
    if (this.snaps.length === 0) return null;
    if (this.snaps.length === 1) {
      const s = this.snaps[0];
      return { pos: s.pos.clone(), quat: s.quat.clone(), vel: s.vel.clone() };
    }

    const targetTs = Date.now() - this.BUFFER;
    const last = this.snaps[this.snaps.length - 1];

    // Si el tiempo objetivo está más adelante del último snapshot → extrapolar
    if (targetTs >= last.ts) {
      const dt = Math.min((targetTs - last.ts) / 1000, 0.15);
      return {
        pos:  last.pos.clone().addScaledVector(last.vel, dt),
        quat: last.quat.clone(),
        vel:  last.vel.clone(),
      };
    }

    // Buscar los dos snapshots entre los que interpolar
    for (let i = this.snaps.length - 2; i >= 0; i--) {
      const a = this.snaps[i];
      const b = this.snaps[i + 1];
      if (a.ts <= targetTs && b.ts >= targetTs) {
        const t = b.ts === a.ts ? 0 : (targetTs - a.ts) / (b.ts - a.ts);
        return {
          pos:  a.pos.clone().lerp(b.pos, t),
          quat: a.quat.clone().slerp(b.quat, t),
          vel:  a.vel.clone().lerp(b.vel, t),
        };
      }
    }

    // Fallback: primer snapshot disponible
    const first = this.snaps[0];
    return { pos: first.pos.clone(), quat: first.quat.clone(), vel: first.vel.clone() };
  }
}
