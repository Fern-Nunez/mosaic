"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Edges,
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  PerspectiveCamera,
} from "@react-three/drei";
import { buildShape } from "@/lib/glass/shape2d";
import { buildMosaic } from "@/lib/glass/mosaic";
import { frostValues, hiddenFit, RIM_FRAG, RIM_VERT } from "@/lib/glass/shaders";
import { markReady } from "@/components/web/loader/ready";

/**
 * The glass scene, without any of the tuning UI.
 *
 * Everything here is driven by a config object from ./presets — nothing is
 * hard-coded, so a look tuned at /test lands here unchanged. The maths and
 * shaders come from lib/glass, shared with the lab.
 */

/* ---------------------------------------------------------------- */

/** Hue per piece, shuffled so neighbouring pieces never match. */
function pieceColours(count, p) {
  let s = (p.seed * 7919 + 11) % 2147483647;
  if (s <= 0) s += 2147483646;
  const rand = () => ((s = (s * 16807) % 2147483647), (s - 1) / 2147483646);

  const order = [...Array(count).keys()];
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order.map((k) => {
    const t = count > 1 ? k / count : 0;
    const hue = (p.hue + t * p.spread + (rand() - 0.5) * p.jitter * 360 + 360) % 360;
    return new THREE.Color().setHSL(hue / 360, p.saturation, p.lightness);
  });
}

/**
 * A stable 0..1 from any number. Everything animated is driven by one shared
 * clock, so without an offset per shard — and per piece inside a mosaic —
 * they all move in perfect lockstep, which is what makes it read as one
 * mechanical thing rather than several drifting ones.
 */
function noise(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function lightVector(light) {
  const a = (light.angle * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(a), Math.sin(a), 0.55).normalize();
}

/* ---------------------------------------------------------------- */

/**
 * A smaller, brighter copy of the same geometry sitting behind the glass.
 * Unlit, so it acts purely as a light source. `hiddenFit` shares one budget
 * between its scale and its drift so it can never travel out from behind
 * the piece in front of it.
 */
function InnerShard({ geometry, color, core, inradius, circumradius, animate, phase }) {
  const ref = useRef(null);
  const tint = useMemo(
    () => new THREE.Color(color).multiplyScalar(core.brightness),
    [color, core.brightness]
  );
  const fit = hiddenFit(inradius, circumradius, core.scale, core.drift);

  useFrame((state, dt) => {
    const m = ref.current;
    if (!m || !animate) return;
    // Rate varies +-25% per shard so they slide out of step over time
    // rather than staying offset by a fixed amount.
    if (core.spin !== 0) m.rotation.z += dt * core.spin * (0.75 + noise(phase) * 0.5);
    if (fit.drift > 0) {
      const t = state.clock.elapsedTime * core.driftSpeed + phase;
      m.position.x = Math.sin(t) * fit.drift;
      m.position.y = Math.cos(t * 0.77 + phase) * fit.drift * 0.7;
    }
  });

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      scale={fit.scale}
      rotation={[0, 0, phase]}
      position={[0, 0, -core.offset]}
      renderOrder={-1}
    >
      <meshBasicMaterial color={tint} toneMapped={false} />
    </mesh>
  );
}

/** Fresnel rim, biased toward the light. Kept off the surface depth-wise. */
function RimGlow({ geometry, color, glass, light }) {
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <shaderMaterial
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        blending={THREE.AdditiveBlending}
        vertexShader={RIM_VERT}
        fragmentShader={RIM_FRAG}
        uniforms={{
          uColor: { value: new THREE.Color(color) },
          uIntensity: { value: glass.rimIntensity },
          uPower: { value: glass.rimPower },
          uLightDir: { value: lightVector(light) },
          uDirectional: { value: light.directional },
        }}
      />
    </mesh>
  );
}

function GlassSurface({ glass, fr }) {
  return (
    <MeshTransmissionMaterial
      transmissionSampler
      samples={fr.samples}
      resolution={1024}
      transmission={glass.transmission}
      thickness={glass.thickness}
      roughness={fr.roughness}
      ior={glass.ior}
      chromaticAberration={glass.chromaticAberration}
      anisotropicBlur={fr.blur}
      distortion={glass.distortion}
      distortionScale={0.3}
      temporalDistortion={0}
      backside={false}
      envMapIntensity={glass.envIntensity}
      clearcoat={0.5}
      clearcoatRoughness={0.05}
      color={glass.color}
      attenuationColor={glass.attenuationColor}
      attenuationDistance={glass.attenuationDistance}
    />
  );
}

function EdgeLines({ glass }) {
  return (
    <Edges
      polygonOffset
      polygonOffsetFactor={-6}
      polygonOffsetUnits={-6}
      threshold={15}
      color={glass.edgeColor}
      lineWidth={glass.edgeWidth}
    />
  );
}

/* ---------------------------------------------------------------- */

function Shards({ config, pointer, animate, radius, zoom, fit, backdrop, idle, offsetX, offsetY }) {
  const group = useRef(null);
  const { glass, core, light, piece } = config;
  const fr = frostValues(glass.frost);
  const camZ = useFitDistance(radius, zoom, fit);
  // Far enough back to sit behind the drifting inner shard.
  const backdropDepth = core.offset + 0.45;

  const single = config.variant === "single";
  const seed = single ? config.shape.seed : config.mosaic.seed;
  const phase = noise(seed) * Math.PI * 2;
  const rateA = 0.13 + noise(seed + 1) * 0.09;
  const rateB = 0.09 + noise(seed + 2) * 0.08;

  const geometry = useMemo(
    () => (single ? buildShape(config.shape) : null),
    [single, config.shape]
  );
  const pieces = useMemo(
    () => (single ? [] : buildMosaic(config.mosaic)),
    [single, config.mosaic]
  );
  const colours = useMemo(
    () => pieceColours(single ? 1 : pieces.length, piece),
    [single, pieces.length, piece]
  );

  useFrame((state) => {
    const g = group.current;
    if (!g || !animate) return;
    const t = state.clock.elapsedTime;

    // Two slow sines at rates that do not divide into each other, offset by
    // this instance's phase — so the motion never visibly repeats and no two
    // shards on the page reach the same pose at the same time.
    const floatY = Math.sin(t * rateA + phase) * 0.14 * idle;
    const floatX = Math.cos(t * rateB + phase * 1.7) * 0.1 * idle;
    const bob = Math.sin(t * rateB * 0.8 + phase) * 0.05 * idle;

    // Pointer comes from the window, not the canvas, because the canvas is
    // pointer-events:none so it cannot swallow clicks on the page beneath.
    const ty = (config.sway ? pointer.current.x * config.tilt : 0) + floatY;
    const tx = (config.sway ? -pointer.current.y * config.tilt : 0) + floatX;

    g.rotation.y += (ty - g.rotation.y) * 0.06;
    g.rotation.x += (tx - g.rotation.x) * 0.06;
    g.position.y += (bob - g.position.y) * 0.05;
  });

  if (single) {
    return (
      // Outer group pans; the inner one carries the tilt and float, so the
      // two do not fight over the same transform.
      <group position={[offsetX * radius, offsetY * radius, 0]}>
        <group ref={group}>
          <mesh geometry={geometry}>
          {backdrop && (
            <ShardBackdrop
              geometry={geometry}
              color={backdrop}
              depth={backdropDepth}
              camZ={camZ}
            />
          )}
          {core.enabled && (
            <InnerShard
              geometry={geometry}
              color={core.color}
              core={core}
              inradius={geometry.userData.inradius ?? 0}
              circumradius={geometry.userData.circumradius ?? 1}
              animate={animate}
              phase={phase}
            />
          )}
          <GlassSurface glass={glass} fr={fr} />
          {glass.edges && <EdgeLines glass={glass} />}
            {glass.rim && (
              <RimGlow
                geometry={geometry}
                color={glass.rimColor}
                glass={glass}
                light={light}
              />
            )}
          </mesh>
        </group>
      </group>
    );
  }

  return (
    <group position={[offsetX * radius, offsetY * radius, 0]}>
    <group ref={group}>
      {pieces.map((p, i) => (
        <mesh key={p.key} geometry={p.geometry} position={p.position} rotation={p.rotation}>
          {backdrop && (
            <ShardBackdrop
              geometry={p.geometry}
              color={backdrop}
              depth={backdropDepth}
              camZ={camZ}
            />
          )}
          {core.enabled && (
            <InnerShard
              geometry={p.geometry}
              color={colours[i]}
              core={core}
              inradius={p.inradius}
              circumradius={p.radius}
              animate={animate}
              phase={noise(seed + i * 13.7) * Math.PI * 2}
            />
          )}
          <GlassSurface glass={glass} fr={fr} />
          {glass.edges && <EdgeLines glass={glass} />}
          {glass.rim && (
            <RimGlow
              geometry={p.geometry}
              color={piece.tintRim ? `#${colours[i].getHexString()}` : glass.rimColor}
              glass={glass}
              light={light}
            />
          )}
        </mesh>
      ))}
    </group>
    </group>
  );
}

/** Lightformer rig. Contributes nothing when light.intensity is 0. */
function Studio({ light }) {
  const dir = lightVector(light);
  const key = [dir.x * 6, dir.y * 6, dir.z * 6 + 2];
  return (
    <Environment resolution={256}>
      <color attach="background" args={["#0a0a0c"]} />
      <Lightformer form="rect" intensity={9 * light.intensity} position={key} scale={[7, 7, 1]} />
      <Lightformer form="rect" intensity={2.5 * light.intensity} position={[0, 0, 5]} scale={[8, 8, 1]} />
      <Lightformer
        form="ring"
        intensity={6 * light.intensity}
        color="#8ab4ff"
        position={[-key[0], -key[1], 3]}
        scale={[5, 5, 1]}
      />
    </Environment>
  );
}

/**
 * Pulls the camera back far enough that the shard fits the container at any
 * shape of box.
 *
 * A perspective camera's fov is vertical, so the horizontal view narrows
 * with the container — in a tall, narrow box the shard runs off the sides.
 * Fitting both axes and taking whichever needs more distance means the box
 * can be any proportion without cropping, and `zoom` then changes the
 * apparent size without touching the element's width or height.
 */
/**
 * Reports the last loading milestone.
 *
 * onCreated fires when the context exists, but the transmission shaders only
 * compile on first draw — so a few real frames are the difference between
 * "ready" and "ready and not about to hitch".
 */
function ReportFrames() {
  const seen = useRef(0);
  useFrame(() => {
    seen.current += 1;
    if (seen.current === 3) markReady("frames");
  });
  return null;
}

const FOV = 45;

/**
 * Camera distance for the current canvas.
 *
 * `contain` takes whichever axis needs more room, so the whole shape stays
 * visible with space to spare on the other axis. `cover` takes the lesser,
 * so the shape fills the box and overflows the other axis — which is what
 * keeps a wide desktop box looking like a narrow phone one, instead of
 * shrinking the shape down to fit the height.
 */
function useFitDistance(radius, zoom, fit) {
  const size = useThree((state) => state.size);
  const aspect = size.width / Math.max(1, size.height);
  const half = Math.tan(((FOV * Math.PI) / 180) / 2);
  const forHeight = radius / half;
  const forWidth = radius / (half * aspect);
  const d =
    fit === "cover"
      ? Math.min(forHeight, forWidth)
      : Math.max(forHeight, forWidth);
  return (d * 1.12) / Math.max(0.05, zoom);
}

function FitCamera({ radius, zoom, fit }) {
  const z = useFitDistance(radius, zoom, fit);
  // Declarative rather than writing to the camera the renderer handed us.
  return <PerspectiveCamera makeDefault fov={FOV} position={[0, 0, z]} />;
}

/**
 * A copy of the shard's own silhouette, filled flat and parked behind
 * everything else.
 *
 * On a transparent canvas the glass has nothing to refract but empty
 * framebuffer, which shifts its colour. This gives it the page colour back
 * in the shape of the shard, so the tint is right without a canvas-sized
 * rectangle covering whatever is behind.
 *
 * It sits further from the camera than the shard in front, so perspective
 * would shrink it and leave the silhouette's edges uncovered — hence
 * scaling by the distance ratio.
 */
function ShardBackdrop({ geometry, color, depth, camZ }) {
  const scale = ((camZ + depth) / camZ) * 1.02;
  return (
    <mesh geometry={geometry} scale={scale} position={[0, 0, -depth]} renderOrder={-3}>
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

export default function GlassScene({
  config,
  background,
  dpr,
  animate,
  frameloop,
  pointer,
  zoom = 1,
  fit = "contain",
  backdrop,
  idle = 1,
  offsetX = 0,
  offsetY = 0,
}) {
  const radius = config.variant === "single" ? 1.7 : 2.4;
  return (
    <Canvas
      dpr={dpr}
      frameloop={frameloop}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, alpha: background === null }}
      onCreated={() => markReady("canvas")}
    >
      {background !== null && <color attach="background" args={[background]} />}
      <ambientLight intensity={0.4 * config.light.intensity} />
      <directionalLight position={[3, 4, 6]} intensity={1.5 * config.light.intensity} />
      <ReportFrames />
      <FitCamera radius={radius} zoom={zoom} fit={fit} />
      <Shards
        config={config}
        pointer={pointer}
        animate={animate}
        radius={radius}
        zoom={zoom}
        fit={fit}
        backdrop={backdrop}
        idle={idle}
        offsetX={offsetX}
        offsetY={offsetY}
      />
      <Studio light={config.light} />
    </Canvas>
  );
}
