/client/src/input/controls.ts
import * as THREE from 'three';

export class Controls {
  private canvas: HTMLCanvasElement;
  private keys: { [key: string]: boolean } = {};
  private mouse: { x: number; y: number; down: boolean } = { x: 0, y: 0, down: false };
  private inputs = { pitch: 0, roll: 0, yaw: 0, throttle: 0, fire: false, respawn: false, pause: false };
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
    hint.innerText = 'Click canvas to focus';
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
    this.inputs.pitch = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    this.inputs.roll = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    this.inputs.yaw = (this.keys['KeyE'] ? 1 : 0) - (this.keys['KeyQ'] ? 1 : 0);
    this.inputs.throttle = (this.keys['ShiftLeft'] ? 1 : 0) - (this.keys['ControlLeft'] ? 1 : 0);
    this.inputs.fire = this.keys['Space'];
    this.inputs.respawn = this.keys['KeyR'];
    this.inputs.pause = this.keys['Escape'];
    return {
      pitch: this.inputs.pitch,
      roll: this.inputs.roll,
      yaw: this.inputs.yaw,
      throttle: this.inputs.throttle,
      fire: this.inputs.fire,
      respawn: this.inputs.respawn,
      pause: this.inputs.pause,
      mouseX: this.mouse.down ? this.mouse.x : 0,
      mouseY: this.mouse.down ? this.mouse.y : 0,
    };
  }
}
