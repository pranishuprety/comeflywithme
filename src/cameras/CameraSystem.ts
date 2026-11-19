import * as THREE from 'three';
import type { CameraMode } from '../core/settings';
import { damp } from '../utils/math';

export class CameraSystem {
  mode: CameraMode = 'chase';
  readonly camera: THREE.PerspectiveCamera;

  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private cinematicAngle = 0;
  private shake = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.5, 12000);
  }

  cycle(): CameraMode {
    const modes: CameraMode[] = ['chase', 'cockpit', 'cinematic'];
    const i = modes.indexOf(this.mode);
    this.mode = modes[(i + 1) % modes.length];
    return this.mode;
  }

  setMode(m: CameraMode): void {
    this.mode = m;
  }

  /** Instantly place chase camera behind the aircraft (call on spawn/restart) */
  snapToAircraft(aircraftPos: THREE.Vector3, aircraftQuat: THREE.Quaternion): void {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraftQuat);
    this.camera.position.copy(aircraftPos).addScaledVector(forward, -20).add(new THREE.Vector3(0, 6, 0));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(aircraftPos.clone().addScaledVector(forward, 10));
    this.targetPos.copy(this.camera.position);
    this.shake = 0;
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.5, this.shake + amount);
  }

  update(
    dt: number,
    aircraftPos: THREE.Vector3,
    aircraftQuat: THREE.Quaternion,
    airspeed: number,
  ): void {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraftQuat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(aircraftQuat);

    this.shake = damp(this.shake, 0, 3, dt);

    if (this.mode === 'chase') {
      const back = forward.clone().multiplyScalar(-18 - airspeed * 0.04);
      const lift = new THREE.Vector3(0, 5 + airspeed * 0.01, 0);
      this.targetPos.copy(aircraftPos).add(back).add(lift);
      this.targetLook.copy(aircraftPos).add(forward.clone().multiplyScalar(12));

      this.camera.position.x = damp(this.camera.position.x, this.targetPos.x, 6, dt);
      this.camera.position.y = damp(this.camera.position.y, this.targetPos.y, 6, dt);
      this.camera.position.z = damp(this.camera.position.z, this.targetPos.z, 6, dt);
      this.camera.lookAt(this.targetLook);
      this.camera.fov = damp(this.camera.fov, 58 + Math.min(12, airspeed * 0.03), 2, dt);
    } else if (this.mode === 'cockpit') {
      const cockpit = aircraftPos.clone().add(up.clone().multiplyScalar(1.1)).add(forward.clone().multiplyScalar(0.6));
      this.camera.position.copy(cockpit);
      const look = aircraftPos.clone().add(forward.clone().multiplyScalar(40)).add(up.clone().multiplyScalar(0.5));
      this.camera.up.copy(up);
      this.camera.lookAt(look);
      this.camera.fov = 70;
    } else {
      // Cinematic orbit
      this.cinematicAngle += dt * 0.15;
      const radius = 35 + airspeed * 0.05;
      this.targetPos.set(
        aircraftPos.x + Math.cos(this.cinematicAngle) * radius,
        aircraftPos.y + 12,
        aircraftPos.z + Math.sin(this.cinematicAngle) * radius,
      );
      this.camera.position.x = damp(this.camera.position.x, this.targetPos.x, 2.5, dt);
      this.camera.position.y = damp(this.camera.position.y, this.targetPos.y, 2.5, dt);
      this.camera.position.z = damp(this.camera.position.z, this.targetPos.z, 2.5, dt);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(aircraftPos);
      this.camera.fov = 50;
    }

    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.4;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.3;
    }

    this.camera.updateProjectionMatrix();
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
