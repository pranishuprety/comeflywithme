export type GraphicsPreset = 'low' | 'medium' | 'high';
export type AircraftId = 'cessna' | 'twinotter' | 'f16';
export type GameModeId = 'freeflight' | 'landing' | 'checkpoint';
export type CameraMode = 'chase' | 'cockpit' | 'cinematic';
export type StartPosition = 'runway' | 'airborne';

export interface Settings {
  mouseSensitivity: number;
  invertY: boolean;
  graphics: GraphicsPreset;
  masterVolume: number;
  showMinimap: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mouseSensitivity: 1.0,
  invertY: false,
  graphics: 'medium',
  masterVolume: 0.7,
  showMinimap: true,
};

export const GRAPHICS_CONFIG = {
  low: {
    chunkRadius: 2,
    chunkSize: 256,
    terrainSegments: 32,
    treeDensity: 0.3,
    cloudCount: 20,
    fogFar: 1800,
    shadowMapSize: 0,
  },
  medium: {
    chunkRadius: 3,
    chunkSize: 256,
    terrainSegments: 48,
    treeDensity: 0.6,
    cloudCount: 40,
    fogFar: 2800,
    shadowMapSize: 1024,
  },
  high: {
    chunkRadius: 4,
    chunkSize: 256,
    terrainSegments: 64,
    treeDensity: 1.0,
    cloudCount: 60,
    fogFar: 4000,
    shadowMapSize: 2048,
  },
} as const;

const STORAGE_KEY = 'cfwm-settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
