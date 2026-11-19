import type { AircraftId } from '../core/settings';

export interface AircraftDef {
  id: AircraftId;
  name: string;
  description: string;
  /** Max thrust force (N-ish units) */
  maxThrust: number;
  /** Empty mass kg */
  mass: number;
  /** Wing area for lift */
  wingArea: number;
  /** Lift coefficient at optimal AoA */
  clMax: number;
  /** Drag coefficient base */
  cd0: number;
  /** Induced drag factor */
  inducedDrag: number;
  /** Stall airspeed m/s */
  stallSpeed: number;
  /** Max speed m/s (~knots * 0.514) */
  maxSpeed: number;
  /** Pitch rate rad/s at full deflection */
  pitchRate: number;
  /** Roll rate rad/s */
  rollRate: number;
  /** Yaw rate rad/s */
  yawRate: number;
  /** Elevator authority */
  elevatorAuthority: number;
  /** Aileron authority */
  aileronAuthority: number;
  /** Rudder authority */
  rudderAuthority: number;
  /** Wheel friction / brake strength */
  brakeStrength: number;
  /** Ground roll friction */
  rollingFriction: number;
  /** Gear down drag multiplier */
  gearDrag: number;
  /** Visual scale */
  scale: number;
  /** Color accents */
  colors: {
    body: number;
    wing: number;
    accent: number;
  };
}

export const AIRCRAFT: Record<AircraftId, AircraftDef> = {
  cessna: {
    id: 'cessna',
    name: 'Skyhopper',
    description: 'Light trainer. Forgiving stalls, short takeoff, leisurely cruise.',
    maxThrust: 2800,
    mass: 1100,
    wingArea: 16,
    clMax: 1.5,
    cd0: 0.035,
    inducedDrag: 0.05,
    stallSpeed: 25,
    maxSpeed: 70,
    pitchRate: 1.2,
    rollRate: 1.8,
    yawRate: 0.9,
    elevatorAuthority: 1.0,
    aileronAuthority: 1.0,
    rudderAuthority: 1.0,
    brakeStrength: 0.55,
    rollingFriction: 0.025,
    gearDrag: 1.15,
    scale: 1,
    colors: { body: 0xe8e4df, wing: 0xd4cfc8, accent: 0x2a5a8c },
  },
  twinotter: {
    id: 'twinotter',
    name: 'Twin Hauler',
    description: 'STOL turboprop. Strong climb, heavy feel, short-field capable.',
    maxThrust: 5200,
    mass: 4200,
    wingArea: 39,
    clMax: 1.7,
    cd0: 0.04,
    inducedDrag: 0.045,
    stallSpeed: 28,
    maxSpeed: 85,
    pitchRate: 0.9,
    rollRate: 1.2,
    yawRate: 0.7,
    elevatorAuthority: 0.9,
    aileronAuthority: 0.85,
    rudderAuthority: 1.1,
    brakeStrength: 0.65,
    rollingFriction: 0.03,
    gearDrag: 1.2,
    scale: 1.35,
    colors: { body: 0xf0f0ee, wing: 0xc8c4be, accent: 0xc45c26 },
  },
  f16: {
    id: 'f16',
    name: 'Viper',
    description: 'Fighter jet. Blistering speed, sharp turns, high stall speed.',
    maxThrust: 14000,
    mass: 9000,
    wingArea: 28,
    clMax: 1.4,
    cd0: 0.022,
    inducedDrag: 0.035,
    stallSpeed: 55,
    maxSpeed: 280,
    pitchRate: 2.4,
    rollRate: 4.5,
    yawRate: 1.2,
    elevatorAuthority: 1.3,
    aileronAuthority: 1.4,
    rudderAuthority: 0.8,
    brakeStrength: 0.7,
    rollingFriction: 0.028,
    gearDrag: 1.4,
    scale: 1.1,
    colors: { body: 0x6b7368, wing: 0x5a6258, accent: 0x3a4038 },
  },
};

export const AIRCRAFT_LIST = Object.values(AIRCRAFT);
