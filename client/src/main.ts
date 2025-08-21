import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
  private aircraft?: THREE.Object3D;

  constructor() {
    this.boot = new BootOverlay();
    this.boot.log('Initializing renderer...');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.boot.log('Creating scene...');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

    this.controls = new Controls(this.renderer.domElement);
    this.flight = new SimpleFlight();
    this.chaseCamera = new ChaseCamera(this.camera);
    this.spawn = new SpawnManager(this.flight);
    this.mode = new ModeManager();
    this.hud = new HUD();

    this.load().then(() => {
      this.boot.log('Starting game loop...');
      this.boot.done();
      this.animate(0);
    });
  }

  private async load() {
    this.boot.log('Setting up ground and sky...');
    this.setupEnvironment();

    this.boot.log('Loading aircraft model...');
    await this.loadAircraft();

    this.boot.log('Aircraft ready.');
  }

  private setupEnvironment() {
    const groundTexture = this.generateGroundTexture();
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(1000, 1000);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100000, 100000),
      new THREE.MeshStandardMaterial({ map: groundTexture })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const skyTexture = this.generateSkyTexture();
    this.scene.background = skyTexture;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(100, 100, 50);
    this.scene.add(ambient);
    this.scene.add(dir);
  }

  private generateGroundTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const g = 80 + Math.random() * 80;
        ctx.fillStyle = `rgb(${g * 0.3},${g},${g * 0.3})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return new THREE.CanvasTexture(canvas);
  }

  private generateSkyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#87CEEB');
    grad.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, 256);
    return new THREE.CanvasTexture(canvas);
  }

  private loadAircraft() {
    return new Promise<void>((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        '/models/f-22_raptor_-_fighter_jet_-_free.glb',
        (gltf) => {
          this.aircraft = gltf.scene;
          this.aircraft.scale.set(0.01, 0.01, 0.01);
          this.aircraft.rotateY(Math.PI / 2);
          this.scene.add(this.aircraft);
          resolve();
        },
        undefined,
        (err) => {
          console.error('Failed to load aircraft model', err);
          reject(err);
        }
      );
    });
  }

  private animate(time: number) {
    requestAnimationFrame((t) => this.animate(t));
    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.accumulator += delta;

    while (this.accumulator >= this.h) {
      const inputs = this.controls.update();
      this.spawn.update(inputs);
      const flightState = this.flight.update(inputs, this.h);
      if (this.aircraft) {
        this.aircraft.position.copy(flightState.position);
        this.aircraft.quaternion.copy(flightState.quaternion);
      }
      this.chaseCamera.update(flightState, { x: inputs.mouseX, y: inputs.mouseY }, this.h);
      this.hud.update(flightState, this.mode.getMode());
      this.accumulator -= this.h;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

new FlightSim();
