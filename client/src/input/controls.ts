export class Controls {
  private canvas: HTMLCanvasElement;
  private keys: { [key: string]: boolean } = {};
  private mouse: { x: number; y: number; down: boolean } = { x: 0, y: 0, down: false };
  private pointerLocked = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.tabIndex = 0;
    this.setupEventListeners();
    this.showFocusHint();
  }

  private showFocusHint() {
    const hint = document.createElement('div');
    hint.style.position = 'absolute';
    hint.style.top = '10px';
    hint.style.left = '10px';
    hint.style.color = 'white';
    hint.style.background = 'rgba(0,0,0,0.5)';
    hint.style.padding = '5px';
    hint.innerText = 'Click para enfocar | Clic derecho para cámara libre';
    document.body.appendChild(hint);
    this.canvas.addEventListener('focus', () => hint.remove());
  }

  private setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      e.preventDefault();
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        this.canvas.requestPointerLock();
        this.mouse.down = true;
      }
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.mouse.down = false;
        this.mouse.x = 0;
        this.mouse.y = 0;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouse.x += e.movementX * 0.002;
        this.mouse.y += e.movementY * 0.002;
      }
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update() {
    return {
      // W/S → cabeceo (nose up / nose down)
      pitch: (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0),
      // A/D → alabeo (roll left / roll right)
      roll:  (this.keys['KeyA'] ? 1 : 0) - (this.keys['KeyD'] ? 1 : 0),
      // Q/E → guiñada (yaw left / yaw right)
      yaw:   (this.keys['KeyQ'] ? 1 : 0) - (this.keys['KeyE'] ? 1 : 0),
      // Shift / Ctrl → throttle
      throttle: (this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? 1 : 0) -
                (this.keys['ControlLeft'] || this.keys['ControlRight'] ? 1 : 0),
      fire:        !!this.keys['Space'],
      respawn:     !!this.keys['KeyR'],
      pause:       !!this.keys['Escape'],
      planeToggle: !!this.keys['KeyP'],
      viewToggle:  !!this.keys['KeyV'],
      mouseX: this.mouse.down ? this.mouse.x : 0,
      mouseY: this.mouse.down ? this.mouse.y : 0,
    };
  }
}
