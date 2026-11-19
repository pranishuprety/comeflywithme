import * as THREE from 'three';
import { fbm, hash2 } from '../utils/math';
import { airportFlatten, createAirportMeshes, AIRPORTS } from './Airports';
import { GRAPHICS_CONFIG, type GraphicsPreset } from '../core/settings';

export class TerrainWorld {
  readonly group = new THREE.Group();
  private chunks = new Map<string, THREE.Mesh>();
  private treeMeshes = new Map<string, THREE.InstancedMesh>();
  private townMeshes = new Map<string, THREE.Group>();
  private chunkSize: number;
  private segments: number;
  private treeDensity: number;
  private radius: number;
  private water: THREE.Mesh;
  private lastCx = NaN;
  private lastCz = NaN;

  private grassMat: THREE.MeshStandardMaterial;

  constructor(preset: GraphicsPreset) {
    const cfg = GRAPHICS_CONFIG[preset];
    this.chunkSize = cfg.chunkSize;
    this.segments = cfg.terrainSegments;
    this.treeDensity = cfg.treeDensity;
    this.radius = cfg.chunkRadius;

    this.grassMat = new THREE.MeshStandardMaterial({
      color: 0x4a7a45,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
      vertexColors: true,
    });

    // Infinite-ish water plane under everything
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(40000, 40000),
      new THREE.MeshStandardMaterial({
        color: 0x2a5a6e,
        roughness: 0.35,
        metalness: 0.2,
        flatShading: true,
      }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 2.5;
    this.water.receiveShadow = true;
    this.group.add(this.water);

    const airports = new THREE.Group();
    createAirportMeshes(airports);
    this.group.add(airports);
  }

  setPreset(preset: GraphicsPreset): void {
    const cfg = GRAPHICS_CONFIG[preset];
    this.chunkSize = cfg.chunkSize;
    this.segments = cfg.terrainSegments;
    this.treeDensity = cfg.treeDensity;
    this.radius = cfg.chunkRadius;
    this.clearChunks();
    this.lastCx = NaN;
  }

  /** Sample terrain height at world xz */
  getHeight(x: number, z: number): number {
    return sampleHeight(x, z);
  }

  update(px: number, pz: number): void {
    const cx = Math.floor(px / this.chunkSize);
    const cz = Math.floor(pz / this.chunkSize);
    if (cx === this.lastCx && cz === this.lastCz) return;
    this.lastCx = cx;
    this.lastCz = cz;

    const needed = new Set<string>();
    for (let dz = -this.radius; dz <= this.radius; dz++) {
      for (let dx = -this.radius; dx <= this.radius; dx++) {
        // Circular-ish load
        if (dx * dx + dz * dz > this.radius * this.radius + 1) continue;
        const key = `${cx + dx},${cz + dz}`;
        needed.add(key);
        if (!this.chunks.has(key)) {
          this.buildChunk(cx + dx, cz + dz);
        }
      }
    }

    // Unload far chunks
    for (const key of [...this.chunks.keys()]) {
      if (!needed.has(key)) {
        const mesh = this.chunks.get(key)!;
        this.group.remove(mesh);
        mesh.geometry.dispose();
        this.chunks.delete(key);

        const trees = this.treeMeshes.get(key);
        if (trees) {
          this.group.remove(trees);
          trees.dispose();
          this.treeMeshes.delete(key);
        }
        const town = this.townMeshes.get(key);
        if (town) {
          this.group.remove(town);
          this.townMeshes.delete(key);
        }
      }
    }
  }

  private clearChunks(): void {
    for (const mesh of this.chunks.values()) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunks.clear();
    for (const t of this.treeMeshes.values()) {
      this.group.remove(t);
      t.dispose();
    }
    this.treeMeshes.clear();
    for (const t of this.townMeshes.values()) {
      this.group.remove(t);
    }
    this.townMeshes.clear();
  }

  private buildChunk(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    const size = this.chunkSize;
    const seg = this.segments;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const ox = cx * size;
    const oz = cz * size;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + ox;
      const z = pos.getZ(i) + oz;
      const h = sampleHeight(x, z);
      pos.setY(i, h);

      // Vertex colors: grass / rock / sand / snow
      let r = 0.29;
      let g = 0.48;
      let b = 0.27;
      if (h < 4) {
        r = 0.72;
        g = 0.68;
        b = 0.48; // sand near water
      } else if (h > 180) {
        const t = Math.min(1, (h - 180) / 80);
        r = 0.29 + t * 0.55;
        g = 0.48 + t * 0.4;
        b = 0.27 + t * 0.5; // snow
      } else if (h > 100) {
        const t = (h - 100) / 80;
        r = 0.29 + t * 0.25;
        g = 0.48 - t * 0.15;
        b = 0.27 + t * 0.1; // rock
      } else {
        // Vary grass
        const n = hash2(Math.floor(x * 0.1), Math.floor(z * 0.1));
        r += n * 0.05;
        g += n * 0.08;
        b += n * 0.02;
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.grassMat);
    mesh.position.set(ox, 0, oz);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.group.add(mesh);
    this.chunks.set(key, mesh);

    this.scatterTrees(cx, cz, key);
    this.scatterTown(cx, cz, key);
  }

  private scatterTrees(cx: number, cz: number, key: string): void {
    if (this.treeDensity <= 0) return;
    const size = this.chunkSize;
    const ox = cx * size;
    const oz = cz * size;
    const count = Math.floor(80 * this.treeDensity);
    const dummy = new THREE.Object3D();

    // Shared low-poly tree: trunk + cone
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 1.2, 5);
    const leafGeo = new THREE.ConeGeometry(1.1, 2.4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, flatShading: true });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a30, flatShading: true });

    // Use one instanced mesh for leaves only (dominant visual); trunks as second
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, count);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    leafMesh.castShadow = true;
    trunkMesh.castShadow = true;

    let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const lx = (hash2(cx * 50 + i, cz * 50 + i * 3) - 0.5) * size * 0.95;
      const lz = (hash2(cx * 50 + i * 7, cz * 50 + i) - 0.5) * size * 0.95;
      const wx = ox + lx;
      const wz = oz + lz;
      // Skip near airports / water / peaks
      let nearAirport = false;
      for (const a of AIRPORTS) {
        if ((wx - a.x) ** 2 + (wz - a.z) ** 2 < (a.length * 0.8) ** 2) {
          nearAirport = true;
          break;
        }
      }
      if (nearAirport) continue;
      const h = sampleHeight(wx, wz);
      if (h < 6 || h > 95) continue;
      // Forest density from noise
      const forest = fbm(wx * 0.004, wz * 0.004, 3);
      if (forest < 0.42) continue;

      const scale = 0.7 + hash2(i, cx + cz) * 1.1;
      dummy.position.set(wx, h + 1.2 * scale, wz);
      dummy.scale.setScalar(scale);
      dummy.rotation.y = hash2(i * 2, cz) * Math.PI * 2;
      dummy.updateMatrix();
      leafMesh.setMatrixAt(placed, dummy.matrix);

      dummy.position.set(wx, h + 0.6 * scale, wz);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    leafMesh.count = placed;
    trunkMesh.count = placed;
    leafMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.instanceMatrix.needsUpdate = true;

    // Parent both under a group tracked as one entry — store leaf, add trunk with same lifecycle
    const wrap = new THREE.Group();
    wrap.add(leafMesh);
    wrap.add(trunkMesh);
    this.group.add(wrap);
    // Store as InstancedMesh reference for dispose — keep wrap in treeMeshes via hack
    (wrap as unknown as { dispose: () => void }).dispose = () => {
      leafMesh.dispose();
      trunkMesh.dispose();
      trunkGeo.dispose();
      leafGeo.dispose();
    };
    this.treeMeshes.set(key, wrap as unknown as THREE.InstancedMesh);
  }

  private scatterTown(cx: number, cz: number, key: string): void {
    // Occasional small town clusters
    const seed = hash2(cx + 100, cz + 200);
    if (seed < 0.88) return;
    if (cx === 0 && cz === 0) return; // keep home field clear

    const size = this.chunkSize;
    const ox = cx * size + (seed - 0.5) * size * 0.4;
    const oz = cz * size + (hash2(cz, cx) - 0.5) * size * 0.4;
    const h = sampleHeight(ox, oz);
    if (h < 5 || h > 70) return;

    const town = new THREE.Group();
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x8a8580,
      flatShading: true,
      roughness: 0.9,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x6a4030,
      flatShading: true,
    });
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x3c3c3e,
      flatShading: true,
    });

    const buildings = 6 + Math.floor(seed * 8);
    for (let i = 0; i < buildings; i++) {
      const bx = ox + (hash2(i, cx) - 0.5) * 60;
      const bz = oz + (hash2(cz, i) - 0.5) * 60;
      const bh = sampleHeight(bx, bz);
      const w = 3 + hash2(i * 3, i) * 5;
      const ht = 3 + hash2(i, i * 5) * 8;
      const d = 3 + hash2(i * 7, i) * 4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), buildingMat);
      b.position.set(bx, bh + ht / 2, bz);
      b.castShadow = true;
      town.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), roofMat);
      roof.position.set(bx, bh + ht + 0.2, bz);
      town.add(roof);
    }

    // Simple road
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 80), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(ox, h + 0.15, oz);
    town.add(road);

    this.group.add(town);
    this.townMeshes.set(key, town);
  }
}

/** Global height function used by physics and terrain */
export function sampleHeight(x: number, z: number): number {
  // Continent-scale shape — bias upward so most of the map is land
  const continent = fbm(x * 0.00035, z * 0.00035, 4);
  const hills = fbm(x * 0.002, z * 0.002, 5);
  const detail = fbm(x * 0.01, z * 0.01, 3);

  let h = continent * 200 + hills * 50 + detail * 8 + 12;

  // Keep a broad landmass near the origin (home field region)
  const distOrigin = Math.sqrt(x * x + z * z);
  if (distOrigin < 2500) {
    const boost = (1 - distOrigin / 2500) * 28;
    h = Math.max(h, 14 + boost * 0.3) + boost * 0.15;
  }

  // River valleys carved by noise ridges
  const river = Math.abs(fbm(x * 0.0012 + 40, z * 0.0012, 3) - 0.5);
  if (river < 0.035 && distOrigin > 400) {
    h = Math.min(h, 4 + river * 50);
  }

  // Lakes (away from home field)
  const lake = fbm(x * 0.0008 + 100, z * 0.0008 + 50, 2);
  if (lake > 0.74 && h < 45 && distOrigin > 600) {
    h = Math.min(h, 2.5);
  }

  // Mountain ridges
  const ridge = 1 - Math.abs(fbm(x * 0.0009, z * 0.0009, 3) * 2 - 1);
  if (ridge > 0.7) {
    h += (ridge - 0.7) * 260;
  }

  h = airportFlatten(x, z, h);
  return Math.max(h, 1.5);
}
