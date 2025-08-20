/client/src/hud/hud.ts
export class HUD {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.position = 'absolute';
    this.element.style.top = '10px';
    this.element.style.right = '10px';
    this.element.style.color = 'white';
    this.element.style.background = 'rgba(0,0,0,0.5)';
    this.element.style.padding = '5px';
    document.body.appendChild(this.element);
  }

  update(flight: { throttle: number; velocity: THREE.Vector3; position: THREE.Vector3 }, mode: string) {
    const speedKt = flight.velocity.length() * 1.94384; // m/s to knots
    const altM = flight.position.y;
    this.element.innerText = `Speed: ${speedKt.toFixed(0)} kt\nAltitude: ${altM.toFixed(0)} m\nThrottle: ${(flight.throttle * 100).toFixed(0)}%\nMode: ${mode}`;
  }
}
