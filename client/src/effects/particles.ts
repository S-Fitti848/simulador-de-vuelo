import * as THREE from 'three';

interface Particle {
  mesh:    THREE.Mesh;
  vel:     THREE.Vector3;
  life:    number;
  maxLife: number;
}

/** Efecto de explosión: partículas que salen en ráfaga y se desvanecen */
export class ExplosionEffect {
  private particles: Particle[] = [];
  private done = false;
  readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene, position: THREE.Vector3, scale = 1.0) {
    this.scene = scene;
    this.#spawn(position, scale);
  }

  #spawn(pos: THREE.Vector3, scale: number) {
    const N      = Math.round(18 * scale);
    const colors = [0xff4400, 0xff8800, 0xffcc00, 0xffffff, 0xff2200];

    for (let i = 0; i < N; i++) {
      const r    = (0.3 + Math.random() * 1.2) * scale;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 4, 3),
        new THREE.MeshBasicMaterial({
          color:       colors[i % colors.length],
          transparent: true,
          depthWrite:  false,
        })
      );
      mesh.position.copy(pos);

      const speed = (30 + Math.random() * 90) * scale;
      const dir   = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.6 + 0.1,
        Math.random() - 0.5
      ).normalize().multiplyScalar(speed);

      const life = 0.4 + Math.random() * 0.9;
      this.particles.push({ mesh, vel: dir, life, maxLife: life });
      this.scene.add(mesh);
    }
  }

  /** Retorna true cuando la explosión terminó y puede eliminarse */
  update(dt: number): boolean {
    if (this.done) return true;

    let anyAlive = false;
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      anyAlive = true;

      p.life -= dt;
      p.vel.y -= 18 * dt;              // gravedad suave
      p.mesh.position.addScaledVector(p.vel, dt);

      const t = Math.max(0, p.life / p.maxLife);
      p.mesh.scale.setScalar(t * 0.9 + 0.1);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = t;

      if (p.life <= 0) this.scene.remove(p.mesh);
    }

    this.done = !anyAlive;
    return this.done;
  }
}

/** Pool de efectos activos; actualiza y limpia automáticamente */
export class EffectsManager {
  private effects: ExplosionEffect[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) { this.scene = scene; }

  explode(position: THREE.Vector3, scale = 1.0) {
    this.effects.push(new ExplosionEffect(this.scene, position, scale));
  }

  update(dt: number) {
    this.effects = this.effects.filter(e => !e.update(dt));
  }
}
