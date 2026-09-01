import * as THREE from "three";

/**
 * Shared glass internals: the two additive shell shaders and the maths that
 * keeps the hidden inner shard hidden.
 *
 * Both the tuning lab at /test and the site component import these, so the
 * two cannot drift apart — tune in the lab, and the site gets the same
 * material behaviour by construction.
 */

export function frostValues(frost: number) {
  const f = THREE.MathUtils.clamp(frost, 0, 1);
  return {
    roughness: 0.5 * Math.pow(f, 1.2),
    blur: 2.2 * f,
    samples: Math.round(THREE.MathUtils.clamp(8 + 28 * f, 8, 24)),
  };
}


export function hiddenFit(
  inradius: number,
  circumradius: number,
  wantScale: number,
  wantDrift: number
) {
  const budget = Math.max(0, inradius * 0.9);
  const circ = circumradius > 0 ? circumradius : 1;
  const scale = Math.max(0.02, Math.min(wantScale, budget / circ));
  const drift = Math.max(0, Math.min(wantDrift, budget - scale * circ));
  return { scale, drift };
}

export const SHEEN_VERT = /* glsl */ `
  varying vec2 vLocal;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vLocal = position.xy;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * A gradient in the piece's own plane, running along the light direction.
 * Additive, so it can only brighten: the dark half of each piece is simply
 * where this contributes nothing, which keeps the falloff smooth instead of
 * stamping a shape onto the tile.
 */
export const SHEEN_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec2 uDir;
  uniform float uRadius;
  uniform float uSoft;
  uniform float uIntensity;
  uniform float uBias;
  varying vec2 vLocal;
  varying vec3 vNormalW;
  varying vec3 vViewW;

  void main() {
    // Position along the light axis, normalised to the piece's own size so
    // every piece gets the same sweep regardless of how big it is.
    float t = dot(vLocal, normalize(uDir)) / max(uRadius, 0.0001);
    t = t * 0.5 + 0.5 + uBias;

    float g = smoothstep(0.5 - uSoft, 0.5 + uSoft, t);

    // Lift the grazing edges slightly so the bright half meets its rim.
    float fres = 1.0 - abs(dot(normalize(vNormalW), normalize(vViewW)));
    g = clamp(g + fres * 0.25 * g, 0.0, 1.4);

    gl_FragColor = vec4(uColor * g * uIntensity, g);
  }
`;

export const RIM_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const RIM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  uniform vec3 uLightDir;
  uniform float uDirectional;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vec3 n = normalize(vNormalW);

    // Fresnel: bright at grazing angles, so it traces the silhouette.
    float f = 1.0 - abs(dot(n, normalize(vViewW)));
    f = pow(clamp(f, 0.0, 1.0), uPower);

    // Directional term. A uniform rim reads as a vector stroke; real glass
    // catches the light on the side facing it and goes dark opposite.
    float lit = max(dot(n, normalize(uLightDir)), 0.0);
    lit = pow(lit, 1.6);
    float shaped = f * mix(1.0, lit * 2.2, uDirectional);

    gl_FragColor = vec4(uColor * shaped * uIntensity, shaped);
  }
`;
