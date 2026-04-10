import * as THREE from 'three';
import fragmentShader from '../shaders/pointCloud.frag.glsl?raw';
import vertexShader from '../shaders/pointCloud.vert.glsl?raw';

export interface RendererOptions {
  pointSize?: number;
  fogNear?: number;
  fogFar?: number;
  fogColor?: THREE.Color;
  fallbackColor?: THREE.Color;
}

export class PointCloudRenderer {
  readonly mesh: THREE.Points;
  private material: THREE.ShaderMaterial;

  constructor(geometry: THREE.BufferGeometry, options: RendererOptions = {}) {
    const {
      pointSize = 2.0,
      fogNear = 4,
      fogFar = 12,
      fogColor = new THREE.Color(0x000000),
      fallbackColor = new THREE.Color(0xaaaaaa),
    } = options;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        pointSize: { value: pointSize },
        fogNear: { value: fogNear },
        fogFar: { value: fogFar },
        fogColor: { value: fogColor },
        fallbackColor: { value: fallbackColor },
      },
      transparent: true,
      depthWrite: false,
      vertexColors: false, // colours come from attribute in shader
    });

    this.mesh = new THREE.Points(geometry, this.material);
  }

  setPointSize(size: number) {
    this.material.uniforms.pointSize.value = size;
  }

  setFog(near: number, far: number, color?: THREE.Color) {
    this.material.uniforms.fogNear.value = near;
    this.material.uniforms.fogFar.value = far;
    if (color) this.material.uniforms.fogColor.value = color;
  }

  dispose() {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
