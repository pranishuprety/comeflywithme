import * as THREE from 'three';
import type { AircraftDef } from './AircraftDefs';
import type { ControlState } from '../controls/Input';
import { clamp, damp } from '../utils/math';

const GRAVITY = 9.81;
const MPS_TO_KTS = 1.94384;
const M_TO_FT = 3.28084;

export interface AircraftState {
  position: THREE.Vector3;
  /** Body quaternion (nose +Z in Three with our mesh convention: nose -Z actually) */
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  throttle: number;
  gearDown: boolean;
  onGround: boolean;
  stalled: boolean;
  crashed: boolean;
  airspeed: number; // m/s
  altitude: number; // m AGL approx (world y)
  heading: number; // deg 0-360
  verticalSpeed: number; // m/s
  pitchAngle: number; // deg
  bankAngle: number; // deg
  aoa: number; // deg
}

export class FlightPhysics {
  def: AircraftDef;
  state: AircraftState;

  private elev = 0;
  private ail = 0;
  private rud = 0;

  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private up = new THREE.Vector3();
  private right = new THREE.Vector3();
  private euler = new THREE.Euler();

  constructor(def: AircraftDef) {
    this.def = def;
    this.state = this.createInitialState();
  }

  private createInitialState(): AircraftState {
    return {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      throttle: 0,
      gearDown: true,
      onGround: true,
      stalled: false,
      crashed: false,
      airspeed: 0,
      altitude: 0,
      heading: 0,
      verticalSpeed: 0,
      pitchAngle: 0,
      bankAngle: 0,
      aoa: 0,
    };
  }

  reset(position: THREE.Vector3, headingDeg: number, airborne: boolean): void {
    this.state = this.createInitialState();
    this.state.position.copy(position);
    // Heading 0 = north (-Z), 90 = east (+X). Aircraft forward is -Z.
    const yaw = -THREE.MathUtils.degToRad(headingDeg);
    this.state.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
    this.state.gearDown = true;
    this.elev = 0;
    this.ail = 0;
    this.rud = 0;

    if (airborne) {
      this.state.onGround = false;
      this.state.throttle = 0.75;
      const speed = this.def.stallSpeed * 1.8;
      this.forward.set(0, 0, -1).applyQuaternion(this.state.quaternion);
      this.state.velocity.copy(this.forward).multiplyScalar(speed);
      this.state.position.y = Math.max(this.state.position.y, 400);
    } else {
      this.state.onGround = true;
      this.state.throttle = 0;
      this.state.velocity.set(0, 0, 0);
    }
  }

  setDef(def: AircraftDef): void {
    this.def = def;
  }

  get airspeedKts(): number {
    return this.state.airspeed * MPS_TO_KTS;
  }

  get altitudeFt(): number {
    return this.state.altitude * M_TO_FT;
  }

  get verticalSpeedFpm(): number {
    return this.state.verticalSpeed * M_TO_FT * 60;
  }

  update(
    dt: number,
    controls: ControlState,
    groundY: (x: number, z: number) => number,
    isRunway: (x: number, z: number) => boolean,
  ): void {
    if (this.state.crashed) return;

    const d = this.def;
    const s = this.state;

    // Throttle
    if (controls.throttleDelta !== 0) {
      s.throttle = clamp(s.throttle + controls.throttleDelta * 0.45 * dt, 0, 1);
    }

    if (controls.gearToggle) {
      s.gearDown = !s.gearDown;
    }

    // Arrow keys: absolute deflection. Mouse: relative impulses that auto-center.
    if (controls.keyPitch !== 0) {
      this.elev = damp(this.elev, controls.keyPitch, 10, dt);
    } else {
      this.elev = clamp(this.elev + controls.mousePitch, -1, 1);
      this.elev = damp(this.elev, 0, 2.4, dt);
    }

    if (controls.keyRoll !== 0) {
      this.ail = damp(this.ail, controls.keyRoll, 10, dt);
    } else {
      this.ail = clamp(this.ail + controls.mouseRoll, -1, 1);
      this.ail = damp(this.ail, 0, 2.4, dt);
    }

    this.rud = damp(this.rud, controls.yaw, 10, dt);

    // Axes in aircraft body: forward = -Z, up = +Y, right = +X
    this.forward.set(0, 0, -1).applyQuaternion(s.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(s.quaternion);
    this.right.set(1, 0, 0).applyQuaternion(s.quaternion);

    const speed = s.velocity.length();
    s.airspeed = speed;

    // Angle of attack: angle between velocity and forward in pitch plane
    let aoa = 0;
    if (speed > 1) {
      this.tmpV.copy(s.velocity).normalize();
      const cos = clamp(this.tmpV.dot(this.forward), -1, 1);
      const signed = Math.sign(this.tmpV.dot(this.up));
      aoa = Math.acos(cos) * signed;
    }
    s.aoa = THREE.MathUtils.radToDeg(aoa);

    // Aerodynamics
    const rho = 1.225 * Math.exp(-s.position.y / 8500);
    const q = 0.5 * rho * speed * speed;

    // Lift curve: peaks near 12° AoA, stalls after ~16°
    const aoaDeg = s.aoa;
    const stallAoa = 15;
    let cl = (aoaDeg / stallAoa) * d.clMax;
    s.stalled = false;
    if (Math.abs(aoaDeg) > stallAoa) {
      s.stalled = true;
      const excess = Math.abs(aoaDeg) - stallAoa;
      cl *= Math.max(0.15, 1 - excess / 20);
      cl *= Math.sign(aoaDeg) !== 0 ? Math.sign(cl || aoaDeg) : 1;
    }
    cl = clamp(cl, -d.clMax * 1.1, d.clMax);

    // When nearly aligned and flying, give baseline lift from pitch attitude for game feel
    if (!s.onGround && speed > d.stallSpeed * 0.6) {
      const pitchLift = Math.sin(THREE.MathUtils.degToRad(s.pitchAngle)) * 0.35;
      cl += pitchLift;
    }

    const liftMag = q * d.wingArea * cl;
    // Lift direction perpendicular to velocity toward up
    let liftDir: THREE.Vector3;
    if (speed > 0.5) {
      this.tmpV.copy(s.velocity).normalize();
      liftDir = this.tmpV2.crossVectors(this.tmpV, this.right).normalize();
      if (liftDir.dot(this.up) < 0) liftDir.negate();
    } else {
      liftDir = this.up.clone();
    }

    const lift = liftDir.multiplyScalar(liftMag);

    // Drag
    const cd = d.cd0 * (s.gearDown ? d.gearDrag : 1) + d.inducedDrag * cl * cl;
    const dragMag = q * d.wingArea * cd;
    const drag = this.tmpV.copy(s.velocity).normalize().multiplyScalar(-dragMag);

    // Thrust along forward
    const thrust = this.forward.clone().multiplyScalar(d.maxThrust * s.throttle);

    // Gravity
    const gravity = new THREE.Vector3(0, -GRAVITY * d.mass, 0);

    // Ground handling
    const gy = groundY(s.position.x, s.position.z);
    const gearHeight = s.gearDown ? 1.8 * (d.scale) : 0.6;
    const agl = s.position.y - gy - gearHeight;

    const force = new THREE.Vector3().add(thrust).add(lift).add(drag).add(gravity);

    if (agl <= 0.05 && s.velocity.y <= 0.5) {
      // On ground
      const wasAirborne = !s.onGround;
      s.onGround = true;
      s.position.y = gy + gearHeight;

      // Hard landing / crash
      const sink = -s.verticalSpeed;
      const touchSpeed = speed;
      if (wasAirborne) {
        if (!s.gearDown || sink > 8 || (sink > 4 && !isRunway(s.position.x, s.position.z) && touchSpeed > 40)) {
          if (sink > 6 || (!s.gearDown && sink > 2) || (touchSpeed > d.stallSpeed * 2.5 && sink > 3)) {
            s.crashed = true;
            s.velocity.set(0, 0, 0);
            return;
          }
        }
      }

      // Kill downward velocity; rolling resistance / brakes as deceleration
      if (s.velocity.y < 0) s.velocity.y = 0;
      const mu = controls.brakes ? d.brakeStrength : d.rollingFriction;
      const horiz = new THREE.Vector3(s.velocity.x, 0, s.velocity.z);
      const hSpeed = horiz.length();
      if (hSpeed > 0.05) {
        const decel = mu * GRAVITY * dt;
        const newSpeed = Math.max(0, hSpeed - decel);
        horiz.multiplyScalar(newSpeed / (hSpeed || 1));
        s.velocity.x = horiz.x;
        s.velocity.z = horiz.z;
      } else if (s.throttle < 0.05) {
        s.velocity.x = 0;
        s.velocity.z = 0;
      }

      // Ground steering with rudder when slow
      if (hSpeed < 40) {
        const steer = this.rud * 0.8 * dt * (hSpeed > 1 ? 1 : 0);
        this.tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -steer);
        s.quaternion.premultiply(this.tmpQ);
        s.velocity.applyQuaternion(this.tmpQ);
      }

      // Can't pitch nose into ground; limited rotation on ground
      // Thrust still applies for takeoff roll
      force.y = Math.max(0, force.y); // normal force cancels downward
      // Cancel downward aero into ground
      if (lift.y < 0) force.y -= lift.y;

      // Takeoff: rotate when fast enough with nose-up input, or when lift exceeds weight
      const weight = d.mass * GRAVITY;
      const rotateSpeed = d.stallSpeed * 0.92;
      if (
        (liftMag > weight * 0.9 && speed > d.stallSpeed * 0.8) ||
        (speed > rotateSpeed && this.elev > 0.2)
      ) {
        s.onGround = false;
        s.velocity.y = Math.max(s.velocity.y, 1.5);
      }
    } else {
      s.onGround = false;
      // Crash into terrain
      if (agl < -2 || (agl < 0.5 && speed > 30 && !s.gearDown && s.velocity.y < -5)) {
        if (s.position.y < gy + 0.5) {
          s.crashed = true;
          s.position.y = gy + 1;
          s.velocity.set(0, 0, 0);
          return;
        }
      }
      if (s.position.y < gy) {
        // Impact
        const impact = -s.velocity.y + speed * 0.3;
        if (impact > 5 || !s.gearDown) {
          s.crashed = true;
          s.velocity.set(0, 0, 0);
          s.position.y = gy + gearHeight;
          return;
        }
        s.position.y = gy + gearHeight;
        s.onGround = true;
        s.velocity.y = 0;
      }
    }

    // Integrate linear
    const accel = force.multiplyScalar(1 / d.mass);
    s.velocity.addScaledVector(accel, dt);
    s.position.addScaledVector(s.velocity, dt);

    // Angular control (arcade-assisted)
    const pitchInput = this.elev * d.elevatorAuthority * d.pitchRate;
    const rollInput = this.ail * d.aileronAuthority * d.rollRate;
    const yawInput = this.rud * d.rudderAuthority * d.yawRate;

    // Stall reduces control authority
    const auth = s.stalled ? 0.35 : 1;

    if (!s.onGround) {
      // Pitch around right axis
      this.tmpQ.setFromAxisAngle(this.right, pitchInput * auth * dt);
      s.quaternion.premultiply(this.tmpQ);
      // Roll around forward
      this.tmpQ.setFromAxisAngle(this.forward, -rollInput * auth * dt);
      s.quaternion.premultiply(this.tmpQ);
      // Yaw around up
      this.tmpQ.setFromAxisAngle(this.up, -yawInput * auth * dt);
      s.quaternion.premultiply(this.tmpQ);

      // Coordinated turn assist: bank induces yaw
      this.euler.setFromQuaternion(s.quaternion, 'YXZ');
      const bank = this.euler.z;
      const turnRate = -Math.sin(bank) * 0.55 * clamp(speed / 40, 0, 2);
      this.tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turnRate * dt);
      s.quaternion.premultiply(this.tmpQ);

      // Slight auto-stabilize roll when no input
      if (Math.abs(this.ail) < 0.05) {
        this.euler.setFromQuaternion(s.quaternion, 'YXZ');
        this.euler.z = damp(this.euler.z, 0, 0.6, dt);
        s.quaternion.setFromEuler(this.euler);
      }
    } else {
      // On ground: allow slight pitch for rotation, limited roll
      this.euler.setFromQuaternion(s.quaternion, 'YXZ');
      this.euler.x = clamp(this.euler.x + pitchInput * 0.3 * dt, -0.15, 0.25);
      this.euler.z = damp(this.euler.z, 0, 8, dt);
      s.quaternion.setFromEuler(this.euler);
    }

    s.quaternion.normalize();

    // Derived instruments
    this.euler.setFromQuaternion(s.quaternion, 'YXZ');
    s.pitchAngle = THREE.MathUtils.radToDeg(this.euler.x);
    s.bankAngle = THREE.MathUtils.radToDeg(this.euler.z);
    let hdg = -THREE.MathUtils.radToDeg(this.euler.y);
    hdg = ((hdg % 360) + 360) % 360;
    s.heading = hdg;
    s.verticalSpeed = s.onGround ? 0 : s.velocity.y;
    s.altitude = Math.max(0, s.position.y - gy);

    // Soft world bounds nudge (very large world)
    const bound = 12000;
    if (Math.abs(s.position.x) > bound || Math.abs(s.position.z) > bound) {
      s.position.x = clamp(s.position.x, -bound, bound);
      s.position.z = clamp(s.position.z, -bound, bound);
    }
  }
}
