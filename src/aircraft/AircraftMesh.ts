import * as THREE from 'three';
import type { AircraftDef } from './AircraftDefs';
import type { AircraftId } from '../core/settings';

/** Build a recognizable low-poly aircraft mesh */
export function createAircraftMesh(def: AircraftDef): THREE.Group {
  switch (def.id) {
    case 'cessna':
      return buildCessna(def);
    case 'twinotter':
      return buildTwinOtter(def);
    case 'f16':
      return buildF16(def);
    default:
      return buildCessna(def);
  }
}

function mat(color: number, rough = 0.75): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: 0.15,
    flatShading: true,
  });
}

function buildCessna(def: AircraftDef): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = mat(def.colors.body);
  const wingMat = mat(def.colors.wing);
  const accent = mat(def.colors.accent, 0.6);

  // Fuselage
  const fuse = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 5.5), bodyMat);
  fuse.position.z = 0.2;
  g.add(fuse);

  // Nose
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 1.2), accent);
  nose.position.set(0, -0.05, -2.8);
  g.add(nose);

  // Cabin windows
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.45, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1a3040, roughness: 0.3, metalness: 0.4, flatShading: true }),
  );
  win.position.set(0, 0.4, -0.6);
  g.add(win);

  // High wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.15, 1.6), wingMat);
  wing.position.set(0, 0.85, -0.2);
  g.add(wing);

  // Struts
  const strutGeo = new THREE.BoxGeometry(0.08, 1.0, 0.08);
  for (const x of [-2.2, 2.2]) {
    const strut = new THREE.Mesh(strutGeo, accent);
    strut.position.set(x, 0.3, 0.1);
    strut.rotation.z = x > 0 ? 0.35 : -0.35;
    g.add(strut);
  }

  // Tail
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.9), wingMat);
  hstab.position.set(0, 0.2, 2.6);
  g.add(hstab);
  const vstab = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 1.1), accent);
  vstab.position.set(0, 0.9, 2.5);
  g.add(vstab);

  // Prop disc
  const prop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 0.05, 16),
    new THREE.MeshStandardMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.35,
      flatShading: true,
      roughness: 0.5,
    }),
  );
  prop.rotation.z = Math.PI / 2;
  prop.rotation.y = Math.PI / 2;
  prop.position.set(0, 0, -3.5);
  prop.name = 'prop';
  g.add(prop);

  // Gear
  addGear(g, [
    [0, -0.9, -1.8],
    [-1.2, -0.95, 0.5],
    [1.2, -0.95, 0.5],
  ]);

  g.scale.setScalar(def.scale);
  g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return g;
}

function buildTwinOtter(def: AircraftDef): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = mat(def.colors.body);
  const wingMat = mat(def.colors.wing);
  const accent = mat(def.colors.accent);

  const fuse = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 8), bodyMat);
  g.add(fuse);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.5), bodyMat);
  nose.position.set(0, -0.1, -4.5);
  g.add(nose);

  // High wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 2.2), wingMat);
  wing.position.set(0, 1.1, -0.5);
  g.add(wing);

  // Twin engines
  for (const x of [-3.5, 3.5]) {
    const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 2.2), accent);
    nacelle.position.set(x, 0.7, -1.2);
    g.add(nacelle);
    const prop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 0.04, 12),
      new THREE.MeshStandardMaterial({
        color: 0x999999,
        transparent: true,
        opacity: 0.3,
        flatShading: true,
      }),
    );
    prop.rotation.y = Math.PI / 2;
    prop.position.set(x, 0.7, -2.4);
    prop.name = 'prop';
    g.add(prop);
  }

  // Tail boom / empennage
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, 1.2), wingMat);
  hstab.position.set(0, 0.4, 4);
  g.add(hstab);
  const vstab = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2, 1.4), accent);
  vstab.position.set(0, 1.3, 3.9);
  g.add(vstab);

  // Cabin windows strip
  const wins = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.35, 4),
    new THREE.MeshStandardMaterial({ color: 0x1a2830, flatShading: true, roughness: 0.3 }),
  );
  wins.position.set(0, 0.35, -0.5);
  g.add(wins);

  addGear(g, [
    [0, -1.15, -3.2],
    [-1.4, -1.2, 1],
    [1.4, -1.2, 1],
  ]);

  g.scale.setScalar(def.scale);
  g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return g;
}

function buildF16(def: AircraftDef): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = mat(def.colors.body, 0.45);
  const wingMat = mat(def.colors.wing, 0.5);
  const accent = mat(def.colors.accent, 0.4);

  // Slender fuselage
  const fuse = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.95, 9), bodyMat);
  fuse.position.z = 0.3;
  g.add(fuse);

  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 6), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -5.2);
  g.add(nose);

  // Bubble canopy
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x1a3048,
      transparent: true,
      opacity: 0.75,
      roughness: 0.2,
      metalness: 0.5,
      flatShading: true,
    }),
  );
  canopy.position.set(0, 0.45, -1.5);
  g.add(canopy);

  // Cropped delta wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.12, 2.8), wingMat);
  wing.position.set(0, 0, 0.8);
  g.add(wing);

  // Wing leading edge sweep via tapered boxes
  const leL = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.2), wingMat);
  leL.position.set(-2.8, 0, -0.6);
  leL.rotation.y = 0.4;
  g.add(leL);
  const leR = leL.clone();
  leR.position.x = 2.8;
  leR.rotation.y = -0.4;
  g.add(leR);

  // Vertical stabilizer
  const vstab = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 1.8), accent);
  vstab.position.set(0, 1.3, 3.2);
  g.add(vstab);

  // Horizontal stabs
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.0), wingMat);
  hstab.position.set(0, 0.1, 3.8);
  g.add(hstab);

  // Intake
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1.5), accent);
  intake.position.set(0, -0.55, -1.5);
  g.add(intake);

  // Exhaust
  const exhaust = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 0.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x222222, flatShading: true, emissive: 0x331100, emissiveIntensity: 0.3 }),
  );
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0, 0, 4.8);
  exhaust.name = 'exhaust';
  g.add(exhaust);

  addGear(g, [
    [0, -0.85, -2.5],
    [-1.1, -0.9, 1.2],
    [1.1, -0.9, 1.2],
  ]);

  g.scale.setScalar(def.scale);
  g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return g;
}

function addGear(g: THREE.Group, positions: [number, number, number][]): void {
  const gearGroup = new THREE.Group();
  gearGroup.name = 'gear';
  const legMat = mat(0x333333, 0.8);
  const wheelMat = mat(0x1a1a1a, 0.9);
  for (const [x, y, z] of positions) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), legMat);
    leg.position.set(x, y + 0.25, z);
    gearGroup.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 8), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y - 0.15, z);
    gearGroup.add(wheel);
  }
  g.add(gearGroup);
}

export function updateAircraftVisuals(
  mesh: THREE.Group,
  throttle: number,
  gearDown: boolean,
  airspeed: number,
  aircraftId: AircraftId,
  dt: number,
): void {
  const gear = mesh.getObjectByName('gear');
  if (gear) gear.visible = gearDown;

  mesh.traverse((c) => {
    if (c.name === 'prop') {
      c.rotation.x += throttle * 40 * dt + airspeed * 0.02 * dt;
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = 0.15 + throttle * 0.25;
    }
    if (c.name === 'exhaust' && aircraftId === 'f16') {
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = 0.2 + throttle * 1.2;
    }
  });
}
