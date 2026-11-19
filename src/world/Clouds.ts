import * as THREE from 'three';
import { hash2 } from '../utils/math';

export class CloudField {
  readonly group = new THREE.Group();
  private clouds: THREE.Group[] = [];

  constructor(count: number) {
    this.rebuild(count);
  }

  rebuild(count: number): void {
    for (const c of this.clouds) {
      this.group.remove(c);
    }
    this.clouds = [];

    const mat = new THREE.MeshStandardMaterial({
      color: 0xf2f0ea,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
      roughness: 1,
      metalness: 0,
      depthWrite: false,
    });

    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(hash2(i, 1) * 4);
      for (let j = 0; j < puffs; j++) {
        const s = 8 + hash2(i, j) * 18;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 5, 4), mat);
        mesh.position.set(
          (hash2(j, i) - 0.5) * 30,
          (hash2(i + j, j) - 0.5) * 6,
          (hash2(j * 3, i) - 0.5) * 20,
        );
        mesh.scale.y = 0.45 + hash2(j, i + 2) * 0.3;
        cloud.add(mesh);
      }
      cloud.position.set(
        (hash2(i, 10) - 0.5) * 6000,
        280 + hash2(i, 20) * 400,
        (hash2(i, 30) - 0.5) * 6000,
      );
      this.group.add(cloud);
      this.clouds.push(cloud);
    }
  }

  update(px: number, pz: number, dt: number): void {
    // Slow drift + wrap around player
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.position.x += 2 * dt;
      const dx = c.position.x - px;
      const dz = c.position.z - pz;
      if (dx > 3500) c.position.x -= 7000;
      if (dx < -3500) c.position.x += 7000;
      if (dz > 3500) c.position.z -= 7000;
      if (dz < -3500) c.position.z += 7000;
    }
  }
}
