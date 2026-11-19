import type { AircraftState } from '../aircraft/Physics';
import type { FlightPhysics } from '../aircraft/Physics';
import { AIRPORTS } from '../world/Airports';

export class HUD {
  readonly root: HTMLElement;
  private speedEl: HTMLElement;
  private altEl: HTMLElement;
  private hdgEl: HTMLElement;
  private vsEl: HTMLElement;
  private thrEl: HTMLElement;
  private gearEl: HTMLElement;
  private stallEl: HTMLElement;
  private horizonBank: HTMLElement;
  private horizonPitch: HTMLElement;
  private minimap: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  private hintEl: HTMLElement;
  private messageEl: HTMLElement;
  private scoreEl: HTMLElement;
  private showMinimap: boolean;

  constructor(parent: HTMLElement, showMinimap: boolean) {
    this.showMinimap = showMinimap;
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="hud-corner hud-left">
        <div class="hud-readout"><span class="label">SPD</span><span class="value" id="hud-spd">0</span><span class="unit">kts</span></div>
        <div class="hud-readout"><span class="label">ALT</span><span class="value" id="hud-alt">0</span><span class="unit">ft</span></div>
        <div class="hud-readout"><span class="label">V/S</span><span class="value" id="hud-vs">0</span><span class="unit">fpm</span></div>
      </div>
      <div class="hud-corner hud-right">
        <div class="hud-readout"><span class="label">HDG</span><span class="value" id="hud-hdg">000</span></div>
        <div class="hud-readout"><span class="label">THR</span><span class="value" id="hud-thr">0</span><span class="unit">%</span></div>
        <div class="hud-readout"><span class="label">GEAR</span><span class="value" id="hud-gear">DOWN</span></div>
      </div>
      <div class="hud-horizon" id="hud-horizon">
        <div class="horizon-outer">
          <div class="horizon-bank" id="horizon-bank">
            <div class="horizon-pitch" id="horizon-pitch">
              <div class="horizon-sky"></div>
              <div class="horizon-ground"></div>
              <div class="horizon-line"></div>
            </div>
          </div>
          <div class="horizon-aircraft">
            <span class="ah-wing left"></span>
            <span class="ah-dot"></span>
            <span class="ah-wing right"></span>
          </div>
        </div>
      </div>
      <div class="hud-stall" id="hud-stall">STALL</div>
      <canvas id="hud-minimap" width="160" height="160"></canvas>
      <div class="hud-hint" id="hud-hint">Click to capture mouse · Esc to release · C camera · P pause · R restart</div>
      <div class="hud-message" id="hud-message"></div>
      <div class="hud-score" id="hud-score"></div>
    `;
    parent.appendChild(this.root);

    this.speedEl = this.root.querySelector('#hud-spd')!;
    this.altEl = this.root.querySelector('#hud-alt')!;
    this.hdgEl = this.root.querySelector('#hud-hdg')!;
    this.vsEl = this.root.querySelector('#hud-vs')!;
    this.thrEl = this.root.querySelector('#hud-thr')!;
    this.gearEl = this.root.querySelector('#hud-gear')!;
    this.stallEl = this.root.querySelector('#hud-stall')!;
    this.horizonBank = this.root.querySelector('#horizon-bank')!;
    this.horizonPitch = this.root.querySelector('#horizon-pitch')!;
    this.minimap = this.root.querySelector('#hud-minimap')!;
    this.minimapCtx = this.minimap.getContext('2d')!;
    this.hintEl = this.root.querySelector('#hud-hint')!;
    this.messageEl = this.root.querySelector('#hud-message')!;
    this.scoreEl = this.root.querySelector('#hud-score')!;
    this.minimap.style.display = showMinimap ? 'block' : 'none';
  }

  setMinimapVisible(v: boolean): void {
    this.showMinimap = v;
    this.minimap.style.display = v ? 'block' : 'none';
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? 'block' : 'none';
  }

  showMessage(text: string, durationMs = 2500): void {
    this.messageEl.textContent = text;
    this.messageEl.classList.add('visible');
    window.setTimeout(() => this.messageEl.classList.remove('visible'), durationMs);
  }

  setScore(text: string): void {
    this.scoreEl.textContent = text;
    this.scoreEl.style.display = text ? 'block' : 'none';
  }

  setHint(text: string): void {
    this.hintEl.textContent = text;
  }

  update(physics: FlightPhysics, state: AircraftState): void {
    this.speedEl.textContent = String(Math.round(physics.airspeedKts));
    this.altEl.textContent = String(Math.round(physics.altitudeFt));
    this.hdgEl.textContent = String(Math.round(state.heading)).padStart(3, '0');
    const vs = Math.round(physics.verticalSpeedFpm / 10) * 10;
    this.vsEl.textContent = (vs >= 0 ? '+' : '') + String(vs);
    this.thrEl.textContent = String(Math.round(state.throttle * 100));
    this.gearEl.textContent = state.gearDown ? 'DOWN' : 'UP';
    this.gearEl.classList.toggle('warn', !state.gearDown && state.onGround);
    this.stallEl.classList.toggle('visible', state.stalled && !state.onGround);

    this.horizonBank.style.transform = `rotate(${-state.bankAngle}deg)`;
    const pitchOffset = clampPitch(state.pitchAngle) * 1.1;
    this.horizonPitch.style.transform = `translateY(${pitchOffset}px)`;

    if (this.showMinimap) this.drawMinimap(state);
  }

  private drawMinimap(state: AircraftState): void {
    const ctx = this.minimapCtx;
    const w = this.minimap.width;
    const h = this.minimap.height;
    const scale = 0.028;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(20, 28, 32, 0.55)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(w / 2, h / 2);
    ctx.rotate((-state.heading * Math.PI) / 180);

    // Airports
    for (const a of AIRPORTS) {
      const dx = (a.x - state.position.x) * scale;
      const dy = (a.z - state.position.z) * scale;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate((a.heading * Math.PI) / 180);
      ctx.fillStyle = 'rgba(220, 210, 180, 0.85)';
      ctx.fillRect(-1.5, -6, 3, 12);
      ctx.restore();
    }

    ctx.restore();

    // Aircraft triangle (fixed center, nose up)
    ctx.fillStyle = '#e8e4dc';
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2 - 7);
    ctx.lineTo(w / 2 - 5, h / 2 + 6);
    ctx.lineTo(w / 2 + 5, h / 2 + 6);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function clampPitch(p: number): number {
  return Math.max(-40, Math.min(40, p));
}
