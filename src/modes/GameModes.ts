import * as THREE from 'three';
import { AIRPORTS, getAirport } from '../world/Airports';
import type { FlightPhysics } from '../aircraft/Physics';
import type { GameModeId } from '../core/settings';

export interface ModeUpdateResult {
  scoreText: string;
  message?: string;
  complete?: boolean;
}

export interface GameMode {
  id: GameModeId;
  name: string;
  setup(scene: THREE.Scene, physics: FlightPhysics): void;
  update(dt: number, physics: FlightPhysics): ModeUpdateResult;
  dispose(scene: THREE.Scene): void;
  getSpawn(): { position: THREE.Vector3; heading: number; airborne: boolean };
}

export class FreeFlightMode implements GameMode {
  id: GameModeId = 'freeflight';
  name = 'Free Flight';

  setup(): void {}
  update(): ModeUpdateResult {
    return { scoreText: '' };
  }
  dispose(): void {}
  getSpawn() {
    const a = getAirport('home');
    const rad = THREE.MathUtils.degToRad(a.heading);
    // Start near threshold, facing along the runway
    return {
      position: new THREE.Vector3(
        a.x - Math.sin(rad) * (a.length * 0.35),
        10,
        a.z - Math.cos(rad) * (a.length * 0.35),
      ),
      heading: a.heading,
      airborne: false,
    };
  }
}

export class LandingChallengeMode implements GameMode {
  id: GameModeId = 'landing';
  name = 'Landing Challenge';
  private target = getAirport('east');
  private approached = false;
  private scored = false;
  private lastScore = '';
  private marker: THREE.Group | null = null;
  private forceAirborne: boolean;

  constructor(forceAirborne = true) {
    this.forceAirborne = forceAirborne;
  }

  setup(scene: THREE.Scene): void {
    this.scored = false;
    this.approached = false;
    this.lastScore = 'Approach East Bay · land on the runway';
    this.marker = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(30, 36, 32),
      new THREE.MeshBasicMaterial({ color: 0xc4a35a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.target.x, 10, this.target.z);
    this.marker.add(ring);
    scene.add(this.marker);
  }

  getSpawn() {
    // Start on approach to East Bay
    const a = this.target;
    const rad = THREE.MathUtils.degToRad(a.heading);
    const dist = 2200;
    const x = a.x - Math.sin(rad) * dist;
    const z = a.z - Math.cos(rad) * dist;
    return {
      position: new THREE.Vector3(x, 280, z),
      heading: a.heading,
      airborne: this.forceAirborne,
    };
  }

  update(_dt: number, physics: FlightPhysics): ModeUpdateResult {
    const s = physics.state;
    const dx = s.position.x - this.target.x;
    const dz = s.position.z - this.target.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 800) this.approached = true;

    if (!this.scored && s.onGround && dist < this.target.length) {
      this.scored = true;
      const speedKts = physics.airspeedKts;
      const vs = Math.abs(physics.verticalSpeedFpm);
      const centerline = Math.abs(dx * Math.cos(THREE.MathUtils.degToRad(this.target.heading)) - dz * Math.sin(THREE.MathUtils.degToRad(this.target.heading)));
      let score = 1000;
      score -= Math.max(0, speedKts - 50) * 8;
      score -= vs * 0.15;
      score -= centerline * 4;
      if (!s.gearDown) score -= 400;
      score = Math.max(0, Math.round(score));
      this.lastScore = `Touchdown! Score: ${score}`;
      return {
        scoreText: this.lastScore,
        message: `Landed — ${score} pts (spd ${Math.round(speedKts)} kts, vs ${Math.round(vs)} fpm)`,
        complete: true,
      };
    }

    if (s.crashed) {
      return { scoreText: 'Crashed — press R', message: 'Crash! Press R to retry' };
    }

    return {
      scoreText: this.scored
        ? this.lastScore
        : `East Bay ${Math.round(dist)} m · ${this.approached ? 'Final' : 'Approach'}`,
    };
  }

  dispose(scene: THREE.Scene): void {
    if (this.marker) {
      scene.remove(this.marker);
      this.marker = null;
    }
  }
}

export class CheckpointChallengeMode implements GameMode {
  id: GameModeId = 'checkpoint';
  name = 'Checkpoints';
  private checkpoints: THREE.Vector3[] = [];
  private index = 0;
  private rings: THREE.Mesh[] = [];
  private startTime = 0;
  private finished = false;

  setup(scene: THREE.Scene): void {
    this.index = 0;
    this.finished = false;
    this.startTime = performance.now();
    this.checkpoints = [
      new THREE.Vector3(400, 120, -600),
      new THREE.Vector3(1200, 180, -1400),
      new THREE.Vector3(1800, 200, -2200), // near North Ridge
      new THREE.Vector3(2600, 160, -800),
      new THREE.Vector3(3200, 120, 800), // East Bay
      new THREE.Vector3(1000, 150, 1600),
      new THREE.Vector3(0, 100, 400),
    ];

    const mat = new THREE.MeshBasicMaterial({
      color: 0x7a9e7e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    this.rings = this.checkpoints.map((p, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(28, 1.2, 8, 24), mat.clone());
      ring.position.copy(p);
      ring.userData.index = i;
      scene.add(ring);
      return ring;
    });
    this.highlight();
  }

  getSpawn() {
    const a = AIRPORTS[0];
    return {
      position: new THREE.Vector3(a.x, 80, a.z - 200),
      heading: a.heading,
      airborne: true,
    };
  }

  private highlight(): void {
    this.rings.forEach((r, i) => {
      const m = r.material as THREE.MeshBasicMaterial;
      if (i === this.index) {
        m.color.setHex(0xc4a35a);
        m.opacity = 0.9;
        r.scale.setScalar(1.1);
      } else if (i < this.index) {
        m.color.setHex(0x4a5a4e);
        m.opacity = 0.25;
        r.scale.setScalar(0.8);
      } else {
        m.color.setHex(0x7a9e7e);
        m.opacity = 0.55;
        r.scale.setScalar(1);
      }
    });
  }

  update(dt: number, physics: FlightPhysics): ModeUpdateResult {
    // Face rings toward player-ish / spin
    for (const r of this.rings) {
      r.rotation.y += dt * 0.5;
    }

    if (this.finished) {
      return { scoreText: this.timeText(), complete: true };
    }

    if (this.index < this.checkpoints.length) {
      const cp = this.checkpoints[this.index];
      const dist = physics.state.position.distanceTo(cp);
      if (dist < 30) {
        this.index++;
        this.highlight();
        if (this.index >= this.checkpoints.length) {
          this.finished = true;
          return {
            scoreText: this.timeText(),
            message: `Course complete! ${this.timeText()}`,
            complete: true,
          };
        }
        return {
          scoreText: `Gate ${this.index + 1}/${this.checkpoints.length}`,
          message: `Checkpoint ${this.index}/${this.checkpoints.length}`,
        };
      }
      return {
        scoreText: `Gate ${this.index + 1}/${this.checkpoints.length} · ${Math.round(dist)} m`,
      };
    }
    return { scoreText: '' };
  }

  private timeText(): string {
    const sec = ((performance.now() - this.startTime) / 1000).toFixed(1);
    return `Finished in ${sec}s`;
  }

  dispose(scene: THREE.Scene): void {
    for (const r of this.rings) scene.remove(r);
    this.rings = [];
  }
}

export function createMode(id: GameModeId): GameMode {
  switch (id) {
    case 'landing':
      return new LandingChallengeMode(true);
    case 'checkpoint':
      return new CheckpointChallengeMode();
    default:
      return new FreeFlightMode();
  }
}
