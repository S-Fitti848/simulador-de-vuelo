
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Controls } from './input/controls';
import { SimpleFlight } from './flight/simple';
import { ChaseCamera } from './cam/chase';
import { SpawnManager } from './game/spawn';
import { ModeManager } from './mode/mode';
import { HUD } from './hud/hud';
import { BootOverlay } from './boot/boot';

export class FlightSim {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: Controls;
  private flight: SimpleFlight;
  private chaseCamera: ChaseCamera;
  private spawn: SpawnManager;
  private mode: ModeManager;
  private hud: HUD;
  private boot: BootOverlay;
  private lastTime = 0;
  private accumulator = 0;
  private readonly h = 1 / 120;
  private aircraft: THREE.Group = new THREE.Group();
  private f22Model: THREE.Group | null = null;
  private su57Model: THREE.Group | null = null;
  private currentPlane = 'f22';
  private wasPlaneToggle = false;
  private wasViewToggle = false;
  private missiles: { obj: THREE.Mesh; vel: THREE.Vector3; time: number }[] = [];
  private engineSound: AudioContext | null = null;
  private fireSound: AudioContext | null = null;
  private wasFire = false;

  constructor() {
    this.boot = new BootOverlay();
    this.boot.log('Initializing renderer...');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.boot.log('Creating scene...');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

    this.boot.log('Setting up ground and sky...');
    const groundGeo = new THREE.PlaneGeometry(100000, 100000, 200, 200);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = Math.sin(x / 500 + z / 500) * 50 + Math.sin(x / 100) * 10 + Math.cos(z / 200) * 20;
      pos.setY(i, y);
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.scene.background = new THREE.Color(0x87CEEB);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 5000;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    this.scene.add(directionalLight);

    this.boot.log('Initializing systems...');
    this.controls = new Controls(this.renderer.domElement);
    this.flight = new SimpleFlight();
    this.chaseCamera = new ChaseCamera(this.camera);
    this.spawn = new SpawnManager(this.flight, this.scene);
    this.mode = new ModeManager();
    this.hud = new HUD();
    this.scene.add(this.aircraft);

    this.boot.log('Loading 3D models...');
    const loader = new GLTFLoader();
    loader.load('/models/f22.glb', (gltf) => {
      this.f22Model = gltf.scene;
      this.f22Model.scale.set(1, 1, 1); // Adjusted for smaller models; change to 0.05 if using original big ones
      this.f22Model.rotation.y = Math.PI;
      this.f22Model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.aircraft.add(this.f22Model);
      this.boot.log('F-22 model loaded');
    }, undefined, (error) => {
      this.boot.handleError(`F-22 load error: ${error.message}`); // Show specific error in overlay
      // Placeholder if failed
      const placeholder = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 10), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
      placeholder.rotation.y = Math.PI;
      this.aircraft.add(placeholder);
      this.boot.log('Using placeholder plane (F-22 failed)');
    });

    loader.load('/models/su57.glb', (gltf) => {
      this.su57Model = gltf.scene;
      this.su57Model.scale.set(1, 1, 1); // Adjusted for smaller models
      this.su57Model.rotation.y = Math.PI;
      this.su57Model.visible = false;
      this.su57Model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.aircraft.add(this.su57Model);
      this.boot.log('SU-57 model loaded');
    }, undefined, (error) => {
      this.boot.handleError(`SU-57 load error: ${error.message}`);
      this.boot.log('SU-57 failed, sticking with F-22 or placeholder');
    });

    // Sounds
    if (AudioContext) {
      this.engineSound = new AudioContext();
      const oscillator = this.engineSound.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = 100;
      const gain = this.engineSound.createGain();
      gain.gain.value = 0.1;
      oscillator.connect(gain);
      gain.connect(this.engineSound.destination);
      oscillator.start();
    }

    this.boot.log('Starting game loop...');
    this.animate(0);
  }

  private animate(time: number) {
    requestAnimationFrame((t) => this.animate(t));
    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.accumulator += delta;

    while (this.accumulator >= this.h) {
      const inputs = this.controls.update();
      this.spawn.update(inputs, this.h, this.flight.position);
      const flightState = this.flight.update(inputs, this.h);
      this.chaseCamera.update(flightState, { x: inputs.mouseX, y: inputs.mouseY }, this.h);
      this.hud.update(flightState, this.mode.getMode());

      if (inputs.planeToggle && !this.wasPlaneToggle) {
        if (this.currentPlane === 'f22' && this.su57Model) {
          if (this.f22Model) this.f22Model.visible = false;
          this.su57Model.visible = true;
          this.currentPlane = 'su57';
        } else if (this.f22Model) {
          this.su57Model.visible = false;
          this.f22Model.visible = true;
          this.currentPlane = 'f22';
        }
      }
      this.wasPlaneToggle = inputs.planeToggle;

      if (inputs.viewToggle && !this.wasViewToggle) {
        this.chaseCamera.toggleView();
      }
      this.wasViewToggle = inputs.viewToggle;

      if (inputs.fire && !this.wasFire) {
        const missile = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        missile.position.copy(flightState.position);
        const vel = new THREE.Vector3(0, 0, 500).applyQuaternion(flightState.quaternion).add(flightState.velocity);
        this.scene.add(missile);
        this.missiles.push({ obj: missile, vel, time: 5 });
        if (AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.value = 200;
          const gain = ctx.createGain();
          gain.gain.value = 0.2;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          setTimeout(() => osc.stop(), 200);
        }
      }
      this.wasFire = inputs.fire;

      this.missiles = this.missiles.filter((m) => {
        m.obj.position.add(m.vel.clone().multiplyScalar(this.h));
        m.time -= this.h;
        if (this.spawn.checkHit(m.obj.position)) {
          console.log('Hit!');
        }
        if (m.time <= 0) {
          this.scene.remove(m.obj);
          return false;
        }
        return true;
      });

      this.aircraft.position.copy(flightState.position);
      this.aircraft.quaternion.copy(flightState.quaternion);

      this.accumulator -= this.h;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

new FlightSim();
