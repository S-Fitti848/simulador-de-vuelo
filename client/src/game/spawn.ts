import { SimpleFlight } from '../flight/simple';

export class SpawnManager {
  constructor(private flight: SimpleFlight) {}

  spawn() {
    this.flight.reset();
  }

  update(inputs: { respawn: boolean }) {
    if (inputs.respawn) {
      this.spawn();
    }
  }
}
