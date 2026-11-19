import * as THREE from 'three';
import { AIRCRAFT } from '../aircraft/AircraftDefs';
import { FlightPhysics } from '../aircraft/Physics';
import { createAircraftMesh, updateAircraftVisuals } from '../aircraft/AircraftMesh';
import { Input } from '../controls/Input';
import { CameraSystem } from '../cameras/CameraSystem';
import { TerrainWorld } from '../world/Terrain';
import { CloudField } from '../world/Clouds';
import { createEnvironment } from '../world/Environment';
import { isOnRunway } from '../world/Airports';
import { AudioSystem } from '../audio/AudioSystem';
import { HUD } from '../ui/HUD';
import { Menu, type MenuSelections } from '../ui/Menu';
import { createMode, type GameMode } from '../modes/GameModes';
import {
  GRAPHICS_CONFIG,
  loadSettings,
  saveSettings,
  type Settings,
  type AircraftId,
  type StartPosition,
} from './settings';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameras: CameraSystem;
  private input: Input;
  private physics: FlightPhysics;
  private aircraftMesh: THREE.Group;
  private terrain: TerrainWorld;
  private clouds: CloudField;
  private audio = new AudioSystem();
  private hud: HUD;
  private menu: Menu;
  private env: ReturnType<typeof createEnvironment>;

  private settings: Settings;
  private mode: GameMode | null = null;
  private aircraftId: AircraftId = 'cessna';
  private startPos: StartPosition = 'runway';
  private playing = false;
  private paused = false;
  private wasOnGround = true;
  private clock = new THREE.Clock();
  private overlay: HTMLElement;
  private pauseEl: HTMLElement;
  private menuCamPos = new THREE.Vector3(120, 220, 640);
  private menuLook = new THREE.Vector3(400, 40, -200);

  constructor(container: HTMLElement) {
    this.settings = loadSettings();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.env = createEnvironment(this.scene, this.renderer, this.settings.graphics);

    this.cameras = new CameraSystem(window.innerWidth / window.innerHeight);
    this.cameras.camera.fov = 48;
    this.cameras.camera.updateProjectionMatrix();
    this.input = new Input(this.renderer.domElement, this.settings);

    this.terrain = new TerrainWorld(this.settings.graphics);
    this.scene.add(this.terrain.group);

    this.clouds = new CloudField(GRAPHICS_CONFIG[this.settings.graphics].cloudCount);
    this.scene.add(this.clouds.group);

    this.physics = new FlightPhysics(AIRCRAFT.cessna);
    this.aircraftMesh = createAircraftMesh(AIRCRAFT.cessna);
    this.aircraftMesh.visible = false;
    this.scene.add(this.aircraftMesh);

    this.hud = new HUD(container, this.settings.showMinimap);
    this.hud.setVisible(false);

    this.overlay = document.createElement('div');
    this.overlay.id = 'crash-overlay';
    this.overlay.innerHTML = `<div><p>Crashed</p><span>Press R to restart · Esc for menu</span></div>`;
    container.appendChild(this.overlay);

    this.pauseEl = document.createElement('div');
    this.pauseEl.id = 'pause-overlay';
    this.pauseEl.innerHTML = `<div><p>Paused</p><span>P to resume · Esc for menu (when unlocked)</span></div>`;
    container.appendChild(this.pauseEl);

    this.menu = new Menu(container, this.settings, (sel) => this.startGame(sel));

    window.addEventListener('resize', () => this.onResize());
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private startGame(sel: MenuSelections): void {
    this.settings = sel.settings;
    saveSettings(this.settings);
    this.input.updateSettings(this.settings);
    this.audio.setVolume(this.settings.masterVolume);
    void this.audio.ensureStarted();

    this.aircraftId = sel.aircraft;
    this.startPos = sel.start;
    this.physics.setDef(AIRCRAFT[sel.aircraft]);

    // Rebuild aircraft mesh
    this.scene.remove(this.aircraftMesh);
    this.aircraftMesh = createAircraftMesh(AIRCRAFT[sel.aircraft]);
    this.scene.add(this.aircraftMesh);

    // Graphics
    this.env.applyPreset(this.settings.graphics);
    this.terrain.setPreset(this.settings.graphics);
    this.clouds.rebuild(GRAPHICS_CONFIG[this.settings.graphics].cloudCount);
    this.hud.setMinimapVisible(this.settings.showMinimap);

    if (this.mode) this.mode.dispose(this.scene);
    this.mode = createMode(sel.mode);
    this.mode.setup(this.scene, this.physics);

    this.menu.hide();
    this.hud.setVisible(true);
    this.playing = true;
    this.paused = false;
    this.aircraftMesh.visible = true;
    this.cameras.camera.fov = 60;
    this.cameras.camera.updateProjectionMatrix();
    this.pauseEl.classList.remove('visible');
    this.overlay.classList.remove('visible');

    this.restart();
    this.input.requestPointerLock();

    const hints: Record<string, string> = {
      freeflight: 'Free Flight — explore the world',
      landing: 'Landing Challenge — land at East Bay',
      checkpoint: 'Fly through the gates in order',
    };
    this.hud.showMessage(hints[sel.mode] ?? 'Have fun');
  }

  private restart(): void {
    if (!this.mode) return;
    const spawn = this.mode.getSpawn();
    const airborne = this.startPos === 'airborne' || spawn.airborne;
    let pos = spawn.position.clone();
    if (!airborne) {
      const gy = this.terrain.getHeight(pos.x, pos.z);
      pos.y = gy + 2.5 * AIRCRAFT[this.aircraftId].scale;
    } else if (this.startPos === 'airborne' && this.mode.id === 'freeflight') {
      pos = new THREE.Vector3(0, 450, 0);
    }
    this.physics.reset(pos, spawn.heading, airborne);
    if (airborne) this.physics.state.gearDown = false;
    // Sync mesh immediately
    this.aircraftMesh.position.copy(this.physics.state.position);
    this.aircraftMesh.quaternion.copy(this.physics.state.quaternion);
    this.wasOnGround = this.physics.state.onGround;
    this.overlay.classList.remove('visible');
    this.cameras.setMode('chase');
    this.cameras.snapToAircraft(this.physics.state.position, this.physics.state.quaternion);
    this.terrain.update(pos.x, pos.z);

    // Reset mode visuals
    this.mode.dispose(this.scene);
    this.mode.setup(this.scene, this.physics);
    this.hud.setScore('');
  }

  private returnToMenu(): void {
    this.playing = false;
    this.paused = false;
    document.exitPointerLock();
    this.hud.setVisible(false);
    this.aircraftMesh.visible = false;
    this.cameras.camera.fov = 48;
    this.cameras.camera.updateProjectionMatrix();
    this.overlay.classList.remove('visible');
    this.pauseEl.classList.remove('visible');
    if (this.mode) {
      this.mode.dispose(this.scene);
      this.mode = null;
    }
    this.menu.show();
  }

  private updateMenuCamera(dt: number): void {
    const t = performance.now() * 0.000038;
    // Slow cinematic drift inland over hills and valleys
    const x = 700 + Math.sin(t) * 1400 + Math.cos(t * 0.31) * 260;
    const z = -500 + Math.cos(t * 0.74) * 1200;
    const ground = this.terrain.getHeight(x, z);
    const y = Math.max(ground + 210, 240) + Math.sin(t * 1.1) * 22;

    const lookX = x + Math.sin(t + 0.55) * 520;
    const lookZ = z - 520 + Math.cos(t * 0.45) * 120;
    const lookGround = this.terrain.getHeight(lookX, lookZ);

    this.menuCamPos.set(x, y, z);
    this.menuLook.set(lookX, lookGround + 28 + Math.sin(t * 0.55) * 10, lookZ);

    const cam = this.cameras.camera;
    cam.position.lerp(this.menuCamPos, 1 - Math.exp(-0.9 * dt));
    cam.up.set(0, 1, 0);
    cam.lookAt(this.menuLook);

    this.env.sun.target.position.set(x, ground, z);
    this.env.sun.position.set(x + 420, y + 560, z + 180);
    this.terrain.update(x, z);
    this.clouds.update(x, z, dt);
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (!this.playing) {
      this.updateMenuCamera(dt);
      this.renderer.render(this.scene, this.cameras.camera);
      return;
    }

    const controls = this.input.poll();

    if (controls.releasePointer) {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      } else if (this.paused) {
        this.returnToMenu();
        return;
      }
    }

    if (controls.pauseToggle) {
      this.paused = !this.paused;
      this.pauseEl.classList.toggle('visible', this.paused);
      if (this.paused) document.exitPointerLock();
      else this.input.requestPointerLock();
    }

    if (controls.restart) {
      this.restart();
      this.paused = false;
      this.pauseEl.classList.remove('visible');
    }

    if (controls.cameraToggle) {
      const m = this.cameras.cycle();
      this.hud.showMessage(
        m === 'chase' ? 'Chase camera' : m === 'cockpit' ? 'Cockpit' : 'Cinematic',
        1200,
      );
    }

    if (this.paused) {
      this.renderer.render(this.scene, this.cameras.camera);
      return;
    }

    if (!this.physics.state.crashed) {
      this.physics.update(
        dt,
        controls,
        (x, z) => this.terrain.getHeight(x, z),
        (x, z) => isOnRunway(x, z),
      );
    } else {
      this.overlay.classList.add('visible');
    }

    // Touchdown / crash audio
    if (this.physics.state.onGround && !this.wasOnGround) {
      this.audio.playTouchdown();
      this.cameras.addShake(0.25);
    }
    if (this.physics.state.crashed && !this.overlay.classList.contains('audio-played')) {
      this.audio.playCrash();
      this.cameras.addShake(1);
      this.overlay.classList.add('audio-played');
    }
    if (!this.physics.state.crashed) this.overlay.classList.remove('audio-played');
    this.wasOnGround = this.physics.state.onGround;

    // Sync mesh
    const s = this.physics.state;
    this.aircraftMesh.position.copy(s.position);
    this.aircraftMesh.quaternion.copy(s.quaternion);
    updateAircraftVisuals(
      this.aircraftMesh,
      s.throttle,
      s.gearDown,
      s.airspeed,
      this.aircraftId,
      dt,
    );

    // Hide aircraft body slightly in cockpit
    this.aircraftMesh.visible = this.cameras.mode !== 'cockpit';

    this.terrain.update(s.position.x, s.position.z);
    this.clouds.update(s.position.x, s.position.z, dt);

    // Shadow follows
    this.env.sun.target.position.copy(s.position);
    this.env.sun.position.set(s.position.x + 400, s.position.y + 800, s.position.z + 200);

    this.cameras.update(dt, s.position, s.quaternion, s.airspeed);
    this.audio.update(s.throttle, s.airspeed, s.stalled, s.onGround);
    this.hud.update(this.physics, s);

    if (this.mode) {
      const result = this.mode.update(dt, this.physics);
      this.hud.setScore(result.scoreText);
      if (result.message) this.hud.showMessage(result.message);
    }

    this.renderer.render(this.scene, this.cameras.camera);
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.cameras.resize(w / h);
  }
}
