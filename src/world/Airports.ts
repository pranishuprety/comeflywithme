import * as THREE from 'three';

export interface Airport {
  id: string;
  name: string;
  x: number;
  z: number;
  heading: number; // runway heading degrees
  length: number;
  width: number;
}

/** Hand-placed airports across the procedural world */
export const AIRPORTS: Airport[] = [
  { id: 'home', name: 'Home Field', x: 0, z: 0, heading: 90, length: 140, width: 18 },
  { id: 'north', name: 'North Ridge', x: 1800, z: -2200, heading: 45, length: 120, width: 16 },
  { id: 'east', name: 'East Bay', x: 3200, z: 800, heading: 0, length: 160, width: 20 },
  { id: 'west', name: 'West Meadow', x: -2500, z: 600, heading: 120, length: 110, width: 15 },
  { id: 'south', name: 'South Lake', x: -400, z: 2800, heading: 270, length: 130, width: 16 },
];

export function isOnRunway(x: number, z: number, margin = 4): boolean {
  for (const a of AIRPORTS) {
    if (pointOnRunway(x, z, a, margin)) return true;
  }
  return false;
}

export function pointOnRunway(x: number, z: number, a: Airport, margin = 4): boolean {
  const rad = THREE.MathUtils.degToRad(a.heading);
  const dx = x - a.x;
  const dz = z - a.z;
  // Rotate into runway local space (along heading = local Z)
  const localZ = dx * Math.sin(rad) + dz * Math.cos(rad);
  const localX = dx * Math.cos(rad) - dz * Math.sin(rad);
  return Math.abs(localZ) < a.length / 2 + margin && Math.abs(localX) < a.width / 2 + margin;
}

export function getAirport(id: string): Airport {
  return AIRPORTS.find((a) => a.id === id) ?? AIRPORTS[0];
}

/** Flatten terrain near airports */
export function airportFlatten(x: number, z: number, baseHeight: number): number {
  let h = baseHeight;
  for (const a of AIRPORTS) {
    const dx = x - a.x;
    const dz = z - a.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const influence = a.length * 0.9;
    if (dist < influence) {
      const t = 1 - dist / influence;
      const smooth = t * t * (3 - 2 * t);
      // Flatten to a consistent plateau height near 8
      const plateau = 8;
      h = THREE.MathUtils.lerp(h, plateau, smooth);
    }
  }
  return h;
}

export function createAirportMeshes(parent: THREE.Group): void {
  for (const a of AIRPORTS) {
    const group = new THREE.Group();
    group.position.set(a.x, 8.05, a.z);
    group.rotation.y = THREE.MathUtils.degToRad(a.heading);

    // Runway surface
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(a.width, a.length),
      new THREE.MeshStandardMaterial({
        color: 0x3a3a3c,
        roughness: 0.9,
        metalness: 0.05,
        flatShading: true,
      }),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.receiveShadow = true;
    group.add(runway);

    // Centerline dashes
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, flatShading: true });
    const dashCount = Math.floor(a.length / 12);
    for (let i = 0; i < dashCount; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 4), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, -a.length / 2 + 8 + i * 12);
      group.add(dash);
    }

    // Threshold markings
    const thrMat = new THREE.MeshStandardMaterial({ color: 0xf0ebe0, flatShading: true });
    for (const end of [-1, 1]) {
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 8), thrMat);
        mark.rotation.x = -Math.PI / 2;
        mark.position.set(i * 1.8, 0.03, end * (a.length / 2 - 10));
        group.add(mark);
      }
    }

    // Tiny terminal / hangar
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(14, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a9094, flatShading: true, roughness: 0.85 }),
    );
    hangar.position.set(a.width / 2 + 18, 3, 0);
    hangar.castShadow = true;
    group.add(hangar);

    // Windsock pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x666666, flatShading: true }),
    );
    pole.position.set(-a.width / 2 - 10, 4, a.length / 2 - 15);
    group.add(pole);

    // Airport label beacon (subtle)
    const beacon = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.3, 2),
      new THREE.MeshStandardMaterial({ color: 0xc4a35a, flatShading: true }),
    );
    beacon.position.set(a.width / 2 + 18, 6.2, 0);
    group.add(beacon);

    parent.add(group);
  }
}
