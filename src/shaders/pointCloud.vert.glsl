uniform float pointSize;
uniform float fogNear;
uniform float fogFar;

attribute vec3 color;

varying vec3 vColor;
varying float vFogDepth;
varying float vHasColor;

void main() {
  vColor = color;
  // If color attribute is all zero we'll fall back to uniform color in frag
  vHasColor = (color.r + color.g + color.b) > 0.0 ? 1.0 : 0.0;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mvPosition.z;

  // Size attenuates with distance — bigger near, smaller far
  gl_PointSize = pointSize * (300.0 / -mvPosition.z);
  gl_PointSize = clamp(gl_PointSize, 1.0, 16.0);

  gl_Position = projectionMatrix * mvPosition;
}
