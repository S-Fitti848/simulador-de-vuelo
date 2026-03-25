import * as THREE from 'three';

export class HUD {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.position = 'absolute';
    this.element.style.top = '10px';
    this.element.style.right = '10px';
    this.element.style.color = '#00ff88';
    this.element.style.background = 'rgba(0,0,0,0.55)';
    this.element.style.padding = '8px 12px';
    this.element.style.fontFamily = 'monospace';
    this.element.style.fontSize = '14px';
    this.element.style.lineHeight = '1.7';
    this.element.style.borderRadius = '4px';
    this.element.style.whiteSpace = 'pre';
    document.body.appendChild(this.element);
  }

  update(
    flight: {
      throttle: number;
      velocity: THREE.Vector3;
      position: THREE.Vector3;
      quaternion: THREE.Quaternion;
      speed: number;
    },
    mode: string
  ) {
    const speedKt = flight.velocity.length() * 1.94384; // m/s → nudos
    const altM = flight.position.y;

    // Rumbo: proyectar el vector forward al plano XZ
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(flight.quaternion);
    const headingRad = Math.atan2(forward.x, forward.z);
    const headingDeg = ((headingRad * 180 / Math.PI) + 360) % 360;

    // Estado del avión
    let state = 'Normal';
    if (flight.speed < 60) state = '⚠ Stall';
    else if (altM < 5) state = 'Aterrizando';

    this.element.innerText =
      `Vel:    ${speedKt.toFixed(0)} kt\n` +
      `Alt:    ${altM.toFixed(0)} m\n` +
      `Rumbo:  ${headingDeg.toFixed(0)}°\n` +
      `Throt:  ${(flight.throttle * 100).toFixed(0)}%\n` +
      `Estado: ${state}\n` +
      `Modo:   ${mode}`;
  }
}
