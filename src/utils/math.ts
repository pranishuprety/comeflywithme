/** Clamp value between min and max */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth damp toward target */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Degrees to radians */
export function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Radians to degrees */
export function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

/** Wrap angle to [-PI, PI] */
export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Wrap degrees to [0, 360) */
export function wrapHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Seeded hash for procedural generation */
export function hash2(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Smooth noise (value noise with bilinear interp) */
export function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sz);
}

/** Fractal Brownian motion */
export function fbm(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise(x * freq, z * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return value;
}
