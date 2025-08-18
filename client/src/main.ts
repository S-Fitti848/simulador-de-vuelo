import * as THREE from 'three';
import { FlightState, FlightInput, step } from './physics/flight';
import { connect, sendState, sendProjectile, Snapshot, id as clientId } from './net/socket';
import { showLanding, AircraftChoice } from './ui/landing';
import { showLobby } from './ui/lobby';
import { createAircraft } from './game/spawn';
import { createHUD } from './hud/hud';
import { ChaseCamera } from './cam/chase';
import { Controls } from './input/controls';
import { GameMode, getMode } from './mode/mode';
import { createPauseMenu } from './ui/pause';
import { createStatusChip } from './ui/statusChip';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const mode = getMode();

if (mode === GameMode.Multiplayer) {
  showLanding((result) => showLobby(result, startGame));
} else {
  showLanding(startGame);
}

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
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    orientation: new THREE.Quaternion(),
    angularVelocity: new THREE.Vector3(),
    throttle: 0.6,
  };

  const input: FlightInput = { pitch: 0, roll: 0, yaw: 0 };
  let hp = 1;

  function resetState() {
    hp = 1;
    state.position.set(0, 50, 0);
    state.velocity.set(0, 0, -30);
    state.orientation.set(0, 0, 0, 1);
    state.throttle = 0.6;
  }
  resetState();

  const hud = createHUD();
  const chase = new ChaseCamera(camera, local);
  const controls = new Controls(canvas);
  const _status = createStatusChip(mode);
  let paused = false;
  const pauseMenu = createPauseMenu(
    mode,
    () => {
      paused = false;
    },
    () => {
      resetState();
      paused = false;
    }
  );
  const debugEl = document.createElement('div');
  debugEl.style.position = 'absolute';
  debugEl.style.bottom = '10px';
  debugEl.style.left = '10px';
  debugEl.style.color = 'yellow';
  debugEl.style.fontFamily = 'monospace';
  debugEl.style.whiteSpace = 'pre';
  debugEl.style.display = 'none';
  document.body.appendChild(debugEl);
  let debugVisible = false;

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

  if (mode === GameMode.Multiplayer) {
    connect(username, aircraft, handleSnapshot, handleHit);
    setInterval(() => sendState(state), 50);
  }

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

  let last = performance.now();
  let acc = 0;
  const FIXED_DT = 1 / 120;

  function animate(now: number) {
    const dt = (now - last) / 1000;
    last = now;
    const snap = controls.getInputs();

    if (snap.pause) {
      paused = !paused;
      if (paused) {
        pauseMenu.show(mode);
      } else {
        pauseMenu.hide();
      }
    }
    if (snap.debug) {
      debugVisible = !debugVisible;
      debugEl.style.display = debugVisible ? 'block' : 'none';
    }

    if (!paused) {
      input.pitch = snap.pitch;
      input.roll = snap.roll;
      input.yaw = snap.yaw;
      state.throttle = THREE.MathUtils.clamp(
        state.throttle + snap.throttleDelta * dt,
        0,
        1
      );
      if (snap.fire) fire();
      if (snap.respawn) resetState();

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
    }

    const mouse = snap.mouseLookActive
      ? { x: snap.mouseDelta.x, y: snap.mouseDelta.y }
      : undefined;
    chase.update(dt, mouse);

    if (debugVisible) {
      const fps = 1 / dt;
      const localVel = state.velocity
        .clone()
        .applyQuaternion(state.orientation.clone().invert());
      const aoa = THREE.MathUtils.radToDeg(
        Math.atan2(localVel.y, -localVel.z)
      );
      debugEl.textContent =
        `FPS ${fps.toFixed(0)}\nDT ${(dt * 1000).toFixed(1)}ms\nTHR ${state.throttle.toFixed(
          2
        )}\nAoA ${aoa.toFixed(1)}\nInput P${input.pitch.toFixed(2)} R${input.roll.toFixed(2)} Y${input.yaw.toFixed(
          2
        )} T${snap.throttleDelta.toFixed(2)}`;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}
