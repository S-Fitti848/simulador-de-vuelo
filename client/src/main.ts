/client/src/main.ts
import * as THREE from 'three';
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

  constructor() {
    this.boot = new BootOverlay();
    this.boot.log('Initializing renderer...');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.boot.log('Creating scene...');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

    this.boot.log('Setting up ground and sky...');
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100000, 100000),
      new THREE.MeshBasicMaterial({ color: 0x228B22 })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    this.scene.background = new THREE.Color(0x87CEEB);

    this.boot.log('Initializing systems...');
    this.controls = new Controls(this.renderer.domElement);
    this.flight = new SimpleFlight();
    this.chaseCamera = new ChaseCamera(this.camera);
    this.spawn = new SpawnManager(this.flight);
    this.mode = new ModeManager();
    this.hud = new HUD();

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
      this.spawn.update(inputs);
      const flightState = this.flight.update(inputs, this.h);
      this.chaseCamera.update(flightState, { x: inputs.mouseX, y: inputs.mouseY }, this.h);
      this.hud.update(flightState, this.mode.getMode());
      this.accumulator -= this.h;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

new FlightSim();
