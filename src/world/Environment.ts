import * as THREE from 'three';
import { GRAPHICS_CONFIG, type GraphicsPreset } from '../core/settings';

export function createEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  preset: GraphicsPreset,
): {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  applyPreset: (p: GraphicsPreset) => void;
} {
  const cfg = GRAPHICS_CONFIG[preset];

  scene.background = new THREE.Color(0x87b5d4);
  scene.fog = new THREE.Fog(0x9bb8cc, 200, cfg.fogFar);

  const hemi = new THREE.HemisphereLight(0xd0e4f2, 0x6a7a5a, 1.05);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x6a7a88, 0.35);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff2dd, 1.05);
  sun.position.set(400, 800, 200);
  sun.castShadow = cfg.shadowMapSize > 0;
  if (sun.castShadow) {
    sun.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 2500;
    sun.shadow.camera.left = -600;
    sun.shadow.camera.right = 600;
    sun.shadow.camera.top = 600;
    sun.shadow.camera.bottom = -600;
    sun.shadow.bias = -0.0002;
  }
  scene.add(sun);
  scene.add(sun.target);

  renderer.shadowMap.enabled = cfg.shadowMapSize > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const applyPreset = (p: GraphicsPreset) => {
    const c = GRAPHICS_CONFIG[p];
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.far = c.fogFar;
    }
    sun.castShadow = c.shadowMapSize > 0;
    renderer.shadowMap.enabled = c.shadowMapSize > 0;
    if (c.shadowMapSize > 0) {
      sun.shadow.mapSize.set(c.shadowMapSize, c.shadowMapSize);
    }
  };

  return { sun, hemi, applyPreset };
}
