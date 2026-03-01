import * as THREE from 'three';

const vertexShader = /* glsl */`
uniform float pointSize;

attribute vec3 color;

varying vec3 vColor;
varying float vFogDepth;
varying float vHasColor;

void main() {
  vColor = color;
  vHasColor = (color.r + color.g + color.b) > 0.0 ? 1.0 : 0.0;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mvPosition.z;

  gl_PointSize = pointSize * (300.0 / -mvPosition.z);
  gl_PointSize = clamp(gl_PointSize, 1.0, 16.0);

  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = /* glsl */`
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform vec3 fallbackColor;

varying vec3 vColor;
varying float vFogDepth;
varying float vHasColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  if (dot(coord, coord) > 0.25) discard;

  float alpha = 1.0 - smoothstep(0.2, 0.5, length(coord) * 2.0);

  vec3 col = vHasColor > 0.5 ? vColor : fallbackColor;

  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, fogFactor);
  alpha *= (1.0 - fogFactor * 0.8);

  gl_FragColor = vec4(col, alpha);
}
`;

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
