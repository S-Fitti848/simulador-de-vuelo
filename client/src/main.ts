import * as THREE from 'three';
import { FlightState, FlightInput, step } from './physics/flight';
import { connect, sendState, sendProjectile, Snapshot, id as clientId } from './net/socket';
import { showLanding, AircraftChoice } from './ui/landing';
import { createAircraft } from './game/spawn';
import { createHUD } from './hud/hud';
import { ChaseCamera } from './cam/chase';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

showLanding(startGame);

function startGame(result: { username: string; aircraft: AircraftChoice }) {
  const { username, aircraft } = result;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 50, 300);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(10, 20, 10);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x404040));

  const groundGeo = new THREE.PlaneGeometry(1000, 1000);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const local = createAircraft(aircraft);
  scene.add(local);

  const state: FlightState = {
    position: new THREE.Vector3(0, 5, 0),
    velocity: new THREE.Vector3(),
    orientation: new THREE.Quaternion(),
    angularVelocity: new THREE.Vector3(),
    throttle: 0,
  };

  const input: FlightInput = { pitch: 0, roll: 0, yaw: 0 };
  let hp = 1;

  const hud = createHUD();
  const chase = new ChaseCamera(camera, local);

  const remotes = new Map<string, {
    mesh: THREE.Group;
    targetPos: THREE.Vector3;
    targetQuat: THREE.Quaternion;
    currentPos: THREE.Vector3;
    currentQuat: THREE.Quaternion;
    aircraft: AircraftChoice;
  }>();

  function handleSnapshot(snap: Snapshot) {
    const self = clientId();
    const seen = new Set<string>();
    snap.players.forEach((p) => {
      if (p.id === self) {
        if (p.state.hp !== undefined) hp = p.state.hp;
        return;
      }
      seen.add(p.id);
      let entry = remotes.get(p.id);
      if (!entry) {
        const mesh = createAircraft(p.aircraft || 'raptor');
        scene.add(mesh);
        entry = {
          mesh,
          targetPos: new THREE.Vector3(),
          targetQuat: new THREE.Quaternion(),
          currentPos: new THREE.Vector3(),
          currentQuat: new THREE.Quaternion(),
          aircraft: p.aircraft || 'raptor',
        };
        remotes.set(p.id, entry);
      }
      entry.targetPos.fromArray(p.state.pos);
      entry.targetQuat.set(...p.state.quat);
    });
    for (const [id, entry] of remotes) {
      if (!seen.has(id)) {
        scene.remove(entry.mesh);
        remotes.delete(id);
      }
    }
  }

  function handleHit(id: string) {
    if (id === clientId()) {
      hp = Math.max(0, hp - 1);
    }
  }

  connect(username, aircraft, handleSnapshot, handleHit);

  window.addEventListener('keydown', (e) => {
    if (orbit) return;
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
      case 'r':
      case 'R':
        hp = 1;
        state.position.set(0, 5, 0);
        state.velocity.set(0, 0, 0);
        state.orientation.set(0, 0, 0, 1);
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

  let orbit = false;
  let yaw = 0;
  let pitch = 0;
  window.addEventListener('mousedown', (e) => {
    if (e.button === 2) orbit = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) orbit = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (orbit) {
      yaw -= e.movementX * 0.005;
      pitch -= e.movementY * 0.005;
      chase.setOrbit(yaw, pitch);
    }
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  const projectiles = new Map<string, { mesh: THREE.Mesh; vel: THREE.Vector3; ttl: number }>();

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

    local.position.copy(state.position);
    local.quaternion.copy(state.orientation);

    remotes.forEach((entry) => {
      entry.currentPos.lerp(entry.targetPos, 0.1);
      entry.currentQuat.slerp(entry.targetQuat, 0.1);
      entry.mesh.position.copy(entry.currentPos);
      entry.mesh.quaternion.copy(entry.currentQuat);
    });

    const speed = state.velocity.length() * 1.94384;
    const altitude = state.position.y;
    const euler = new THREE.Euler().setFromQuaternion(state.orientation, 'XYZ');
    const pitchDeg = THREE.MathUtils.radToDeg(euler.x);
    const rollDeg = THREE.MathUtils.radToDeg(euler.z);
    hud.update({
      spd: speed,
      alt: altitude,
      pit: pitchDeg,
      rol: rollDeg,
      hp,
      name: username,
      aircraft: aircraft === 'raptor' ? 'Raptor-like' : 'Mighty-Dragon-like',
    });

    chase.update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}
