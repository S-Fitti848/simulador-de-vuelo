import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Controls } from './input/controls';
import { SimpleFlight } from './flight/simple';
import { ChaseCamera } from './cam/chase';
import { SpawnManager } from './game/spawn';
import { ModeManager } from './mode/mode';
import { HUD } from './hud/hud';
import { BootOverlay } from './boot/boot';
import { showLanding, LandingResult } from './ui/landing';

// Nombres reales de los archivos de modelos 3D subidos
const MODEL_F22  = '/models/f-22_raptor_-_fighter_jet_-_free.glb';
const MODEL_SU57 = '/models/sukhoi_su-57_felon_-_fighter_jet_-_free.glb';

// Normaliza el tamaño de un modelo al tamaño objetivo (en metros)
function autoScale(model: THREE.Group, targetSize = 14): void {
  const box  = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const max  = Math.max(size.x, size.y, size.z);
  if (max > 0) model.scale.setScalar(targetSize / max);
}

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

  private lastTime   = 0;
  private accumulator = 0;
  private readonly FIXED_DT = 1 / 120;

  private aircraft    = new THREE.Group();
  private f22Model:  THREE.Group | null = null;
  private su57Model: THREE.Group | null = null;
  private currentPlane: 'f22' | 'su57';
  private modelsLoaded = 0;

  private wasPlaneToggle = false;
  private wasViewToggle  = false;
  private wasFire        = false;

  private missiles: { obj: THREE.Mesh; vel: THREE.Vector3; ttl: number }[] = [];
  private engineCtx: AudioContext | null = null;

  constructor(landingResult?: LandingResult) {
    this.currentPlane = landingResult?.aircraft === 'dragon' ? 'su57' : 'f22';

    // ── Renderer ─────────────────────────────────────────────────────────────
    this.boot = new BootOverlay();
    this.boot.log('Inicializando renderer...');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Redimensionar al cambiar el tamaño de ventana
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ── Escena ───────────────────────────────────────────────────────────────
    this.boot.log('Creando escena...');
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70, window.innerWidth / window.innerHeight, 0.5, 15000
    );

    // Cielo azul claro + niebla para dar sensación de horizonte y profundidad
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 3000, 10000);

    // ── Terreno procedural ────────────────────────────────────────────────────
    this.boot.log('Generando terreno...');
    const groundGeo = new THREE.PlaneGeometry(100000, 100000, 250, 250);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = Math.sin(x / 600 + z / 600) * 60
              + Math.sin(x / 120) * 12
              + Math.cos(z / 250) * 25;
      pos.setY(i, y);
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ color: 0x4a8c3f, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // ── Iluminación ───────────────────────────────────────────────────────────
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfffbe0, 1.3);
    sun.position.set(500, 800, 300);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = 2000;
    sun.shadow.camera.left   = -600;
    sun.shadow.camera.right  = 600;
    sun.shadow.camera.top    = 600;
    sun.shadow.camera.bottom = -600;
    this.scene.add(sun);

    // ── Sistemas ──────────────────────────────────────────────────────────────
    this.boot.log('Iniciando sistemas...');
    this.controls    = new Controls(this.renderer.domElement);
    this.flight      = new SimpleFlight();
    this.chaseCamera = new ChaseCamera(this.camera);
    this.spawn       = new SpawnManager(this.flight, this.scene);
    this.mode        = new ModeManager();
    this.hud         = new HUD();
    this.scene.add(this.aircraft);

    // ── Carga de modelos 3D ───────────────────────────────────────────────────
    this.boot.log('Cargando modelos 3D...');
    const loader = new GLTFLoader();

    const onModelLoaded = (model: THREE.Group, name: string) => {
      // Auto-escalar al tamaño real del avión (~14m de longitud)
      autoScale(model, 14);
      model.rotation.y = Math.PI; // girar para que mire hacia adelante
      model.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow    = true;
          child.receiveShadow = true;
        }
      });
      this.boot.log(`${name} cargado`);
      this.modelsLoaded++;
      if (this.modelsLoaded >= 2) this.boot.done();
    };

    loader.load(MODEL_F22, (gltf) => {
      this.f22Model = gltf.scene;
      this.f22Model.visible = this.currentPlane === 'f22';
      this.aircraft.add(this.f22Model);
      onModelLoaded(this.f22Model, 'F-22 Raptor');
    }, undefined, (err) => {
      this.boot.handleError(`F-22: ${(err as Error).message}`);
      // Placeholder si falla la carga
      const ph = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.5, 7),
        new THREE.MeshStandardMaterial({ color: 0x4488cc })
      );
      this.aircraft.add(ph);
      this.modelsLoaded++;
      if (this.modelsLoaded >= 2) this.boot.done();
    });

    loader.load(MODEL_SU57, (gltf) => {
      this.su57Model = gltf.scene;
      this.su57Model.visible = this.currentPlane === 'su57';
      this.aircraft.add(this.su57Model);
      onModelLoaded(this.su57Model, 'SU-57 Felon');
    }, undefined, (err) => {
      this.boot.handleError(`SU-57: ${(err as Error).message}`);
      this.modelsLoaded++;
      if (this.modelsLoaded >= 2) this.boot.done();
    });

    // ── Sonido del motor ──────────────────────────────────────────────────────
    if (typeof AudioContext !== 'undefined') {
      this.engineCtx = new AudioContext();
      const osc  = this.engineCtx.createOscillator();
      const gain = this.engineCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 90;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(this.engineCtx.destination);
      osc.start();
    }

    this.boot.log('Iniciando simulador...');
    this.animate(0);
  }

  // ── Game loop ───────────────────────────────────────────────────────────────
  private animate(time: number) {
    requestAnimationFrame(t => this.animate(t));

    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.accumulator += delta;

    while (this.accumulator >= this.FIXED_DT) {
      const inputs     = this.controls.update();
      this.spawn.update(inputs);
      const state      = this.flight.update(inputs, this.FIXED_DT);
      this.chaseCamera.update(state, { x: inputs.mouseX, y: inputs.mouseY }, this.FIXED_DT);
      this.hud.update(state, this.mode.getMode());

      // Toggle avión (P)
      if (inputs.planeToggle && !this.wasPlaneToggle) {
        if (this.currentPlane === 'f22' && this.su57Model) {
          if (this.f22Model) this.f22Model.visible = false;
          this.su57Model.visible = true;
          this.currentPlane = 'su57';
        } else if (this.f22Model) {
          if (this.su57Model) this.su57Model.visible = false;
          this.f22Model.visible = true;
          this.currentPlane = 'f22';
        }
      }
      this.wasPlaneToggle = inputs.planeToggle;

      // Toggle cámara (V)
      if (inputs.viewToggle && !this.wasViewToggle) {
        this.chaseCamera.toggleView();
      }
      this.wasViewToggle = inputs.viewToggle;

      // Disparar misil (Espacio)
      if (inputs.fire && !this.wasFire) {
        const missile = new THREE.Mesh(
          new THREE.SphereGeometry(0.4),
          new THREE.MeshBasicMaterial({ color: 0xff4400 })
        );
        missile.position.copy(state.position);
        const vel = new THREE.Vector3(0, 0, 600)
          .applyQuaternion(state.quaternion)
          .add(state.velocity);
        this.scene.add(missile);
        this.missiles.push({ obj: missile, vel, ttl: 5 });

        if (typeof AudioContext !== 'undefined') {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const g   = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = 250;
          g.gain.value = 0.15;
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start();
          setTimeout(() => { osc.stop(); ctx.close(); }, 180);
        }
      }
      this.wasFire = inputs.fire;

      // Actualizar misiles
      this.missiles = this.missiles.filter(m => {
        m.obj.position.addScaledVector(m.vel, this.FIXED_DT);
        m.ttl -= this.FIXED_DT;
        if (this.spawn.checkHit(m.obj.position)) console.log('Hit!');
        if (m.ttl <= 0) { this.scene.remove(m.obj); return false; }
        return true;
      });

      // Sincronizar mesh del avión con la física
      this.aircraft.position.copy(state.position);
      this.aircraft.quaternion.copy(state.quaternion);

      this.accumulator -= this.FIXED_DT;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Mostrar pantalla de inicio, luego arrancar el simulador
showLanding(result => new FlightSim(result));
