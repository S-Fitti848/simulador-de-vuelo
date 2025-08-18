import { Vector2 } from 'three';

export interface InputSnapshot {
  pitch: number;
  roll: number;
  yaw: number;
  throttleDelta: number; // -1..1 representing change
  fire: boolean;
  respawn: boolean;
  pause: boolean;
  debug: boolean;
  mouseDelta: Vector2;
  mouseLookActive: boolean;
}

/**
 * Centralized input handler managing keyboard and mouse state.
 * Right mouse button toggles pointer lock for mouselook.
 */
export class Controls {
  private keys = new Set<string>();
  private canvas: HTMLCanvasElement;
  private mouseLook = false;
  private mouseDelta = new Vector2();
  private fire = false;
  private respawn = false;
  private pause = false;
  private debug = false;
  private overlay: HTMLDivElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.tabIndex = 0;
    canvas.style.outline = 'none';

    // overlay helper
    this.overlay = document.createElement('div');
    this.overlay.textContent = 'Click to focus / RMB for mouse-look';
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '50%';
    this.overlay.style.left = '50%';
    this.overlay.style.transform = 'translate(-50%, -50%)';
    this.overlay.style.padding = '8px 12px';
    this.overlay.style.background = 'rgba(0,0,0,0.6)';
    this.overlay.style.color = '#fff';
    this.overlay.style.borderRadius = '4px';
    document.body.appendChild(this.overlay);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    switch (e.key) {
      case ' ':
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'PageUp':
      case 'PageDown':
        e.preventDefault();
        break;
    }
    this.keys.add(e.key);
    if (e.key === ' ') this.fire = true;
    if (e.key === 'r' || e.key === 'R') this.respawn = true;
    if (e.key === 'Escape') {
      this.pause = true;
      document.exitPointerLock();
    }
    if (e.key === 'F1') {
      e.preventDefault();
      this.debug = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 2) {
      this.canvas.requestPointerLock();
      e.preventDefault();
    } else {
      this.canvas.focus();
    }
    this.overlay.style.display = 'none';
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 2) {
      document.exitPointerLock();
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.mouseLook) {
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    }
  };

  private onPointerLockChange = () => {
    this.mouseLook = document.pointerLockElement === this.canvas;
  };

  /**
   * Returns current input snapshot and resets one-frame buttons and mouse delta.
   */
  getInputs(): InputSnapshot {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      this.keys.clear();
      this.mouseDelta.set(0, 0);
      this.fire = false;
      this.respawn = false;
      this.pause = false;
      this.debug = false;
      return {
        pitch: 0,
        roll: 0,
        yaw: 0,
        throttleDelta: 0,
        fire: false,
        respawn: false,
        pause: false,
        debug: false,
        mouseDelta: new Vector2(),
        mouseLookActive: this.mouseLook,
      };
    }

    const pitch = this.keys.has('w') ? 1 : this.keys.has('s') ? -1 : 0;
    const roll = this.keys.has('a') ? 1 : this.keys.has('d') ? -1 : 0;
    const yaw = this.keys.has('q') ? 1 : this.keys.has('e') ? -1 : 0;
    const throttleDelta = this.keys.has('Shift')
      ? 1
      : this.keys.has('Control')
      ? -1
      : 0;
    const snap: InputSnapshot = {
      pitch,
      roll,
      yaw,
      throttleDelta,
      fire: this.fire,
      respawn: this.respawn,
      pause: this.pause,
      debug: this.debug,
      mouseDelta: this.mouseDelta.clone(),
      mouseLookActive: this.mouseLook,
    };
    this.mouseDelta.set(0, 0);
    this.fire = false;
    this.respawn = false;
    this.pause = false;
    this.debug = false;
    return snap;
  }
}

