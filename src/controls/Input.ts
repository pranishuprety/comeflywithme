import { clamp } from '../utils/math';
import type { Settings } from '../core/settings';

export interface ControlState {
  /** Mouse-driven pitch impulse this frame */
  mousePitch: number;
  /** Mouse-driven roll impulse this frame */
  mouseRoll: number;
  /** Keyboard pitch -1..1 */
  keyPitch: number;
  /** Keyboard roll -1..1 */
  keyRoll: number;
  yaw: number;
  throttleDelta: number;
  brakes: boolean;
  gearToggle: boolean;
  cameraToggle: boolean;
  pauseToggle: boolean;
  restart: boolean;
  releasePointer: boolean;
}

export class Input {
  private keys = new Set<string>();
  private mouseDx = 0;
  private mouseDy = 0;
  private pointerLocked = false;
  private settings: Settings;
  private canvas: HTMLElement;

  private gearPressed = false;
  private cameraPressed = false;
  private pausePressed = false;
  private restartPressed = false;
  private escapePressed = false;

  constructor(canvas: HTMLElement, settings: Settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.bind();
  }

  updateSettings(s: Settings): void {
    this.settings = s;
  }

  get isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  requestPointerLock(): void {
    this.canvas.requestPointerLock();
  }

  private bind(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyG') this.gearPressed = true;
      if (e.code === 'KeyC') this.cameraPressed = true;
      if (e.code === 'KeyP') this.pausePressed = true;
      if (e.code === 'KeyR') this.restartPressed = true;
      if (e.code === 'Escape') this.escapePressed = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDx += e.movementX;
      this.mouseDy += e.movementY;
    });

    this.canvas.addEventListener('click', () => {
      if (!this.pointerLocked) this.requestPointerLock();
    });
  }

  poll(): ControlState {
    const sens = 0.0035 * this.settings.mouseSensitivity;
    const invert = this.settings.invertY ? -1 : 1;

    const mousePitch = -this.mouseDy * sens * invert;
    const mouseRoll = this.mouseDx * sens;
    this.mouseDx = 0;
    this.mouseDy = 0;

    let keyPitch = 0;
    let keyRoll = 0;
    if (this.keys.has('ArrowUp')) keyPitch += 1;
    if (this.keys.has('ArrowDown')) keyPitch -= 1;
    if (this.keys.has('ArrowLeft')) keyRoll -= 1;
    if (this.keys.has('ArrowRight')) keyRoll += 1;

    let yaw = 0;
    if (this.keys.has('KeyQ')) yaw -= 1;
    if (this.keys.has('KeyE')) yaw += 1;

    let throttleDelta = 0;
    if (this.keys.has('KeyW')) throttleDelta += 1;
    if (this.keys.has('KeyS')) throttleDelta -= 1;

    const state: ControlState = {
      mousePitch,
      mouseRoll,
      keyPitch: clamp(keyPitch, -1, 1),
      keyRoll: clamp(keyRoll, -1, 1),
      yaw: clamp(yaw, -1, 1),
      throttleDelta,
      brakes: this.keys.has('Space'),
      gearToggle: this.gearPressed,
      cameraToggle: this.cameraPressed,
      pauseToggle: this.pausePressed,
      restart: this.restartPressed,
      releasePointer: this.escapePressed,
    };

    this.gearPressed = false;
    this.cameraPressed = false;
    this.pausePressed = false;
    this.restartPressed = false;
    this.escapePressed = false;

    return state;
  }

  dispose(): void {}
}
