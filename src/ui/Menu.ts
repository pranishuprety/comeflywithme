import { AIRCRAFT_LIST } from '../aircraft/AircraftDefs';
import type { AircraftId, GameModeId, GraphicsPreset, Settings, StartPosition } from '../core/settings';

export interface MenuSelections {
  aircraft: AircraftId;
  mode: GameModeId;
  start: StartPosition;
  settings: Settings;
}

export class Menu {
  readonly root: HTMLElement;
  private onPlay: (sel: MenuSelections) => void;
  private settings: Settings;
  private aircraft: AircraftId = 'cessna';
  private mode: GameModeId = 'freeflight';
  private start: StartPosition = 'runway';
  private panel: 'main' | 'settings' = 'main';

  constructor(parent: HTMLElement, settings: Settings, onPlay: (sel: MenuSelections) => void) {
    this.settings = { ...settings };
    this.onPlay = onPlay;
    this.root = document.createElement('div');
    this.root.id = 'menu';
    parent.appendChild(this.root);
    this.render();
  }

  show(): void {
    this.root.style.display = 'flex';
    this.panel = 'main';
    this.render();
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  private render(): void {
    if (this.panel === 'settings') {
      this.root.innerHTML = this.settingsHTML();
      this.bindSettings();
      return;
    }

    this.root.innerHTML = `
      <div class="menu-panel">
        <div class="menu-brand">
          <div class="menu-wordmark">
            <svg class="menu-mark" viewBox="0 0 40 40" aria-hidden="true">
              <path class="menu-mark-horizon" d="M3 30h34" />
              <path class="menu-mark-plane" d="M4 21h17l3.5-9h2l1.5 9H36l-7 3.5V28h-2.5l-1.5-3.5H16L13 28H10.5l1.2-3.5H4z" />
            </svg>
            <h1 class="menu-title">comeflywithme</h1>
          </div>
          <p class="menu-tagline">The sky is yours.</p>
        </div>

        <div class="menu-section">
          <div class="menu-label">Aircraft</div>
          <div class="menu-options" id="aircraft-options">
            ${AIRCRAFT_LIST.map(
              (a) => `
              <button type="button" class="menu-option ${a.id === this.aircraft ? 'selected' : ''}" data-aircraft="${a.id}">
                <span class="opt-name">${a.name}</span>
                <span class="opt-desc">${a.description}</span>
              </button>`,
            ).join('')}
          </div>
        </div>

        <div class="menu-section">
          <div class="menu-label">Mode</div>
          <div class="menu-options row" id="mode-options">
            <button type="button" class="menu-chip ${this.mode === 'freeflight' ? 'selected' : ''}" data-mode="freeflight">Free Flight</button>
            <button type="button" class="menu-chip ${this.mode === 'landing' ? 'selected' : ''}" data-mode="landing">Landing Challenge</button>
            <button type="button" class="menu-chip ${this.mode === 'checkpoint' ? 'selected' : ''}" data-mode="checkpoint">Checkpoints</button>
          </div>
        </div>

        <div class="menu-section">
          <div class="menu-label">Start</div>
          <div class="menu-options row" id="start-options">
            <button type="button" class="menu-chip ${this.start === 'runway' ? 'selected' : ''}" data-start="runway">On Runway</button>
            <button type="button" class="menu-chip ${this.start === 'airborne' ? 'selected' : ''}" data-start="airborne">Midair</button>
          </div>
        </div>

        <div class="menu-actions">
          <button type="button" class="menu-btn secondary" id="btn-settings">Settings</button>
          <button type="button" class="menu-btn primary" id="btn-play">Play</button>
        </div>

        <div class="menu-controls">
          Mouse pitch/roll · Arrows · Q/E rudder · W/S throttle · G gear · Space brakes · C camera
        </div>
      </div>
    `;

    this.root.querySelectorAll('[data-aircraft]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.aircraft = (btn as HTMLElement).dataset.aircraft as AircraftId;
        this.render();
      });
    });
    this.root.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mode = (btn as HTMLElement).dataset.mode as GameModeId;
        this.render();
      });
    });
    this.root.querySelectorAll('[data-start]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.start = (btn as HTMLElement).dataset.start as StartPosition;
        this.render();
      });
    });
    this.root.querySelector('#btn-settings')!.addEventListener('click', () => {
      this.panel = 'settings';
      this.render();
    });
    this.root.querySelector('#btn-play')!.addEventListener('click', () => {
      this.onPlay({
        aircraft: this.aircraft,
        mode: this.mode,
        start: this.start,
        settings: { ...this.settings },
      });
    });
  }

  private settingsHTML(): string {
    return `
      <div class="menu-panel">
        <div class="menu-brand compact">
          <div class="menu-wordmark">
            <svg class="menu-mark" viewBox="0 0 40 40" aria-hidden="true">
              <path class="menu-mark-horizon" d="M3 30h34" />
              <path class="menu-mark-plane" d="M4 21h17l3.5-9h2l1.5 9H36l-7 3.5V28h-2.5l-1.5-3.5H16L13 28H10.5l1.2-3.5H4z" />
            </svg>
            <h1 class="menu-title">settings</h1>
          </div>
        </div>
        <div class="menu-section">
          <div class="menu-label">Mouse sensitivity <span id="sens-val">${this.settings.mouseSensitivity.toFixed(1)}</span></div>
          <input type="range" id="sens" min="0.3" max="2.5" step="0.1" value="${this.settings.mouseSensitivity}" />
        </div>
        <div class="menu-section">
          <label class="menu-check">
            <input type="checkbox" id="invert-y" ${this.settings.invertY ? 'checked' : ''} />
            Invert Y-axis
          </label>
        </div>
        <div class="menu-section">
          <label class="menu-check">
            <input type="checkbox" id="minimap" ${this.settings.showMinimap ? 'checked' : ''} />
            Show navigation map
          </label>
        </div>
        <div class="menu-section">
          <div class="menu-label">Graphics</div>
          <div class="menu-options row">
            ${(['low', 'medium', 'high'] as GraphicsPreset[])
              .map(
                (g) =>
                  `<button type="button" class="menu-chip ${this.settings.graphics === g ? 'selected' : ''}" data-gfx="${g}">${g[0].toUpperCase() + g.slice(1)}</button>`,
              )
              .join('')}
          </div>
        </div>
        <div class="menu-section">
          <div class="menu-label">Volume <span id="vol-val">${Math.round(this.settings.masterVolume * 100)}%</span></div>
          <input type="range" id="vol" min="0" max="1" step="0.05" value="${this.settings.masterVolume}" />
        </div>
        <div class="menu-actions">
          <button type="button" class="menu-btn secondary" id="btn-back">Back</button>
        </div>
      </div>
    `;
  }

  private bindSettings(): void {
    const sens = this.root.querySelector('#sens') as HTMLInputElement;
    sens.addEventListener('input', () => {
      this.settings.mouseSensitivity = parseFloat(sens.value);
      (this.root.querySelector('#sens-val') as HTMLElement).textContent =
        this.settings.mouseSensitivity.toFixed(1);
    });
    const vol = this.root.querySelector('#vol') as HTMLInputElement;
    vol.addEventListener('input', () => {
      this.settings.masterVolume = parseFloat(vol.value);
      (this.root.querySelector('#vol-val') as HTMLElement).textContent =
        `${Math.round(this.settings.masterVolume * 100)}%`;
    });
    (this.root.querySelector('#invert-y') as HTMLInputElement).addEventListener('change', (e) => {
      this.settings.invertY = (e.target as HTMLInputElement).checked;
    });
    (this.root.querySelector('#minimap') as HTMLInputElement).addEventListener('change', (e) => {
      this.settings.showMinimap = (e.target as HTMLInputElement).checked;
    });
    this.root.querySelectorAll('[data-gfx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.settings.graphics = (btn as HTMLElement).dataset.gfx as GraphicsPreset;
        this.render();
      });
    });
    this.root.querySelector('#btn-back')!.addEventListener('click', () => {
      this.panel = 'main';
      this.render();
    });
  }
}
