import * as THREE from 'three';

export interface InputState {
  pitch: number; // W/S [-1,1]
  roll: number;  // A/D [-1,1]
  yaw: number;   // Q/E [-1,1]
  throttle: number; // Shift/Ctrl [-1,1]
  fire: boolean;
  respawn: boolean;
  lookYaw: number; // radians
  lookPitch: number; // radians
}

/** Centralised keyboard and mouse controls with RMB pointer lock. */
export class Controls {
  private keys = new Set<string>();
  private canvas: HTMLCanvasElement;
  private yaw = 0;
  private pitch = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.tabIndex = 0;
    canvas.style.outline = 'none';
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        canvas.requestPointerLock();
      } else {
        canvas.focus();
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 2) document.exitPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) {
        // nothing
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.yaw -= e.movementX * 0.002;
        this.pitch -= e.movementY * 0.002;
        const yawLim = THREE.MathUtils.degToRad(90);
        const pitchLim = THREE.MathUtils.degToRad(60);
        this.yaw = THREE.MathUtils.clamp(this.yaw, -yawLim, yawLim);
        this.pitch = THREE.MathUtils.clamp(this.pitch, -pitchLim, pitchLim);
      }
    });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  getInputs(): InputState {
    const pitch = (this.keys.has('KeyW') ? 1 : 0) + (this.keys.has('KeyS') ? -1 : 0);
    const roll = (this.keys.has('KeyD') ? 1 : 0) + (this.keys.has('KeyA') ? -1 : 0);
    const yaw = (this.keys.has('KeyE') ? 1 : 0) + (this.keys.has('KeyQ') ? -1 : 0);
    const throttle =
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1 : 0) +
      (this.keys.has('ControlLeft') || this.keys.has('ControlRight') ? -1 : 0);
    const fire = this.keys.has('Space');
    const respawn = this.keys.has('KeyR');

    if (document.pointerLockElement !== this.canvas) {
      this.yaw *= 0.9;
      this.pitch *= 0.9;
    }

    return {
      pitch,
      roll,
      yaw,
      throttle,
      fire,
      respawn,
      lookYaw: this.yaw,
      lookPitch: this.pitch,
    };
  }
}
