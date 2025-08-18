import * as THREE from 'three';
import { buildRaptorLike, buildDragonLike } from '../aircraft/models';
import type { AircraftChoice } from '../ui/landing';

export function createAircraft(choice: AircraftChoice) {
  switch (choice) {
    case 'dragon':
      return buildDragonLike();
    case 'raptor':
    default:
      return buildRaptorLike();
  }
}
