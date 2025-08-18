import * as THREE from 'three';
import { BootOverlay, ensureWebGL, must, tryStep } from './boot/boot';
import { Controls } from './input/controls';
import { ChaseCamera } from './cam/chase';
import {
  step,
  SimpleFlightInput,
  SimpleFlightState,
  H,
  isFiniteState,
} from './flight/simple';
import { spawnLocal, respawn, LocalPlayer } from './game/spawn';
import { createStatusChip } from './ui/statusChip';

BootOverlay.step('DOM ready');
const app = must(document.getElementById('app'), '#app not found') as HTMLDivElement;

let canvas: HTMLCanvasElement;
let renderer: THREE.WebGLRenderer;
tryStep('WebGL ok', () => {
  ensureWebGL();
  canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  app.appendChild(canvas);
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(10, 20, 10);
scene.add(sun);
scene.add(new THREE.AmbientLight(0x404040));

const groundGeo = new THREE.PlaneGeometry(100000, 100000);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x226622 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const player: LocalPlayer = spawnLocal();
scene.add(player.mesh);

const controls = new Controls(canvas);
const chase = new ChaseCamera(camera);
createStatusChip();

const focusHint = document.createElement('div');
focusHint.textContent = 'Click to focus / RMB to look';
focusHint.style.position = 'absolute';
focusHint.style.top = '50%';
focusHint.style.left = '50%';
focusHint.style.transform = 'translate(-50%, -50%)';
focusHint.style.color = 'white';
focusHint.style.background = 'rgba(0,0,0,0.5)';
focusHint.style.padding = '8px 12px';
focusHint.style.fontFamily = 'sans-serif';
document.body.appendChild(focusHint);
canvas.addEventListener(
  'focus',
  () => {
    focusHint.remove();
  },
  { once: true }
);

const hud = document.createElement('div');
hud.style.position = 'absolute';
hud.style.top = '10px';
hud.style.left = '10px';
hud.style.color = 'white';
hud.style.fontFamily = 'monospace';
hud.style.whiteSpace = 'pre';
document.body.appendChild(hud);

function updateHUD() {
  const kts = player.state.speed * 1.94384;
  const alt = player.state.pos.y;
  hud.textContent = `SPD ${kts.toFixed(0)}kt\nALT ${alt.toFixed(0)}m`;
}

let last = performance.now();
let acc = 0;
const MIN_SPEED = 50;
const MAX_SPEED = 250;
const SPEED_RANGE = MAX_SPEED - MIN_SPEED;
let throttle = (player.state.speedTarget - MIN_SPEED) / SPEED_RANGE;

function loop(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  acc += dt;
  const input = controls.getInputs();

  throttle = THREE.MathUtils.clamp(throttle + input.throttle * dt, 0, 1);
  player.state.speedTarget = MIN_SPEED + throttle * SPEED_RANGE;

  while (acc >= H) {
    const fi: SimpleFlightInput = {
      pitch: input.pitch,
      roll: input.roll,
      yaw: input.yaw,
      throttle: throttle,
    };
    step(player.state, fi, H);
    acc -= H;
  }

  player.mesh.position.copy(player.state.pos);
  player.mesh.quaternion.copy(player.state.quat);

  if (input.respawn || !isFiniteState(player.state)) {
    respawn(player);
    throttle = (player.state.speedTarget - MIN_SPEED) / SPEED_RANGE;
  }

  chase.update(dt, player.state, input.lookYaw, input.lookPitch);
  updateHUD();

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
