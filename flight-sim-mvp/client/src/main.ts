import * as THREE from 'three';
import { FlightState, FlightInput, step } from './physics/flight';
import { connect, sendState, sendProjectile, Snapshot, id as clientId } from './net/socket';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);

const light = new THREE.HemisphereLight(0xffffff, 0x444444);
scene.add(light);

// Local aircraft
const planeGeom = new THREE.BoxGeometry(1, 0.2, 3);
const planeMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const plane = new THREE.Mesh(planeGeom, planeMat);
scene.add(plane);

// Remote aircraft
const remoteMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const remote = new THREE.Mesh(planeGeom, remoteMat);
scene.add(remote);

const state: FlightState = {
  position: new THREE.Vector3(0, 5, 0),
  velocity: new THREE.Vector3(),
  orientation: new THREE.Quaternion(),
  angularVelocity: new THREE.Vector3(),
  throttle: 0,
};

const input: FlightInput = { pitch: 0, roll: 0, yaw: 0 };
let hp = 3;

const hud = document.createElement('div');
hud.style.position = 'absolute';
hud.style.top = '10px';
hud.style.left = '10px';
hud.style.color = 'white';
hud.style.fontFamily = 'monospace';
hud.style.whiteSpace = 'pre';
document.body.appendChild(hud);

const remoteTarget = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const remoteCurrent = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };

const projectiles = new Map<string, { mesh: THREE.Mesh; vel: THREE.Vector3; ttl: number }>();

function handleSnapshot(snap: Snapshot) {
  const self = clientId();
  const seenProj = new Set<string>();
  snap.players.forEach((p) => {
    if (p.id === self) {
      if (p.state.hp !== undefined) hp = p.state.hp;
    } else {
      remoteTarget.pos.fromArray(p.state.pos);
      remoteTarget.quat.set(...p.state.quat);
    }
  });
  snap.projectiles.forEach((pr) => {
    seenProj.add(pr.id);
    let entry = projectiles.get(pr.id);
    if (!entry) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
      mesh.position.fromArray(pr.pos);
      scene.add(mesh);
      entry = { mesh, vel: new THREE.Vector3(), ttl: 2 };
      projectiles.set(pr.id, entry);
    } else {
      const newPos = new THREE.Vector3().fromArray(pr.pos);
      entry.vel.copy(newPos.clone().sub(entry.mesh.position));
      entry.mesh.position.copy(newPos);
      entry.ttl = 2;
    }
  });
  for (const [id, p] of projectiles) {
    if (!seenProj.has(id)) {
      scene.remove(p.mesh);
      projectiles.delete(id);
    }
  }
}

function handleHit(id: string) {
  if (id === clientId()) {
    hp = Math.max(0, hp - 1);
  }
}

connect(handleSnapshot, handleHit);

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'w':
      input.pitch = 1;
      break;
    case 's':
      input.pitch = -1;
      break;
    case 'a':
      input.roll = 1;
      break;
    case 'd':
      input.roll = -1;
      break;
    case 'q':
      input.yaw = 1;
      break;
    case 'e':
      input.yaw = -1;
      break;
    case 'Shift':
    case 'ShiftLeft':
    case 'ShiftRight':
      state.throttle = Math.min(1, state.throttle + 0.1);
      break;
    case 'Control':
    case 'ControlLeft':
    case 'ControlRight':
      state.throttle = Math.max(0, state.throttle - 0.1);
      break;
    case ' ':
      fire();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.key) {
    case 'w':
    case 's':
      input.pitch = 0;
      break;
    case 'a':
    case 'd':
      input.roll = 0;
      break;
    case 'q':
    case 'e':
      input.yaw = 0;
      break;
  }
});

function fire() {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(state.orientation).normalize();
  const pos = state.position.clone().add(forward.clone().multiplyScalar(1));
  const vel = forward.clone().multiplyScalar(50).add(state.velocity);
  const id = sendProjectile(pos, vel, 2);
  if (id) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
    mesh.position.copy(pos);
    scene.add(mesh);
    projectiles.set(id, { mesh, vel, ttl: 2 });
  }
}

setInterval(() => sendState(state), 50);

let last = performance.now();
let acc = 0;
const FIXED_DT = 1 / 120;

function animate(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  acc += dt;
  while (acc >= FIXED_DT) {
    step(state, input, FIXED_DT);
    for (const [id, p] of projectiles) {
      p.mesh.position.add(p.vel.clone().multiplyScalar(FIXED_DT));
      p.ttl -= FIXED_DT;
      if (p.ttl <= 0) {
        scene.remove(p.mesh);
        projectiles.delete(id);
      }
    }
    acc -= FIXED_DT;
  }

  plane.position.copy(state.position);
  plane.quaternion.copy(state.orientation);

  remoteCurrent.pos.lerp(remoteTarget.pos, 0.1);
  remoteCurrent.quat.slerp(remoteTarget.quat, 0.1);
  remote.position.copy(remoteCurrent.pos);
  remote.quaternion.copy(remoteCurrent.quat);

  const speed = state.velocity.length() * 1.94384; // m/s -> knots
  const altitude = state.position.y;
  const euler = new THREE.Euler().setFromQuaternion(state.orientation, 'XYZ');
  const pitch = THREE.MathUtils.radToDeg(euler.x);
  const roll = THREE.MathUtils.radToDeg(euler.z);
  hud.textContent = `SPD ${speed.toFixed(0)}kt\nALT ${altitude.toFixed(0)}m\nPIT ${pitch.toFixed(0)}\u00b0\nROL ${roll.toFixed(0)}\u00b0\nHP ${hp}`;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
