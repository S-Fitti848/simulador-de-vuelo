import * as THREE from 'three';
import { SimpleFlight } from '../flight/simple';

export class SpawnManager {
  constructor(private flight: SimpleFlight, private _scene: THREE.Scene) {}

  spawn() {
    this.flight.reset();
  }

  checkHit(_pos: THREE.Vector3): boolean {
    return false;
  }

  update(inputs: { respawn: boolean }) {
    if (inputs.respawn) {
      this.spawn();
    }
  }
}
