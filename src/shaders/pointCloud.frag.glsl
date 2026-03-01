uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform vec3 fallbackColor;

varying vec3 vColor;
varying float vFogDepth;
varying float vHasColor;

void main() {
  // Discard fragment corners to make round points
  vec2 coord = gl_PointCoord - vec2(0.5);
  if (dot(coord, coord) > 0.25) discard;

  // Soft edge
  float alpha = 1.0 - smoothstep(0.2, 0.5, length(coord) * 2.0);

  vec3 col = vHasColor > 0.5 ? vColor : fallbackColor;

  // Depth fog
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, fogFactor);
  alpha *= (1.0 - fogFactor * 0.8);

  gl_FragColor = vec4(col, alpha);
}
