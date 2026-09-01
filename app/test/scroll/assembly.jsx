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
import { buildMosaic, MOSAIC_DEFAULTS } from "@/lib/glass/mosaic";
import { frostValues, hiddenFit, RIM_FRAG, RIM_VERT } from "@/lib/glass/shaders";

/**
 * Scroll-driven assembly: scattered and colourless at progress 0, connected
 * and in colour at 1.
 *
 * This is a test-page scene. It reads from lib/glass but does not modify it,
 * so nothing here can affect the hero or the CTA.
 *
 * Progress arrives through a ref rather than a prop. GSAP writes to it on
 * every scroll frame, and useFrame reads it — driving it as React state
 * would re-render the whole tree sixty times a second.
 */

const FOV = 45;

function noise(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Where a piece sits before it joins up.
 *
 * Deliberately almost flat: the offset is in the plane of the screen, the
 * only rotation is around Z, and Z depth barely moves. That reads as pieces
 * sliding together on a surface — a 2D animation that happens to be lit and
 * refracted in 3D — rather than debris flying in from space.
 */
function apartPose(piece, i, spread, centre) {
  const [x, y] = piece.position;
  const angle = Math.atan2(y - centre.cy, x - centre.cx);
  const push = (0.5 + noise(i * 3.1) * 0.45) * spread;
  return {
    position: [
      x + Math.cos(angle) * push,
      y + Math.sin(angle) * push,
      // A hair of depth so they overlap rather than intersect on the way in.
      (noise(i * 7.7) - 0.5) * 0.3,
    ],
    rotation: [0, 0, (noise(i * 2.9) - 0.5) * 0.3],
  };
}

const GLASS = {
  transmission: 1,
  thickness: 2.79,
  frost: 0.5,
  ior: 1.41,
  chromaticAberration: 0.27,
  distortion: 1.5,
  envIntensity: 0,
  attenuationDistance: 3.34,
  edgeWidth: 0.8,
  rimIntensity: 1.5,
  rimPower: 3.2,
  color: "#ffffff",
  attenuationColor: "#a8c6ff",
  edgeColor: "#e2ecff",
  rimColor: "#9dc0ff",
};

function pieceColours(count, seed) {
  let s = (seed * 7919 + 11) % 2147483647;
  if (s <= 0) s += 2147483646;
  const rand = () => ((s = (s * 16807) % 2147483647), (s - 1) / 2147483646);
  const order = [...Array(count).keys()];
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((k) =>
    new THREE.Color().setHSL(((265 + (k / count) * 320) % 360) / 360, 0.7, 0.55)
  );
}

/**
 * One piece. Its transform and its colour are both driven from the shared
 * progress ref every frame, so nothing here re-renders while scrolling.
 */
function Piece({ piece, index, colour, progress, camZ, spread, stagger, count, centre }) {
  const meshRef = useRef(null);
  const coreRef = useRef(null);
  const coreMat = useRef(null);

  const pose = useMemo(
    () => apartPose(piece, index, spread, centre),
    [piece, index, spread, centre]
  );
  const fit = hiddenFit(piece.inradius, piece.radius, 0.45, 0.12);
  const fr = frostValues(GLASS.frost);
  const phase = noise(index * 13.7) * Math.PI * 2;

  // Grey at the start, full hue once assembled.
  const grey = useMemo(() => new THREE.Color("#3a3a3a"), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  const backdropDepth = 0.35 + 0.45;
  const backdropScale = ((camZ + backdropDepth) / camZ) * 1.02;

  useFrame((state, dt) => {
    const raw = THREE.MathUtils.clamp(progress.current, 0, 1);
    // Each piece gets its own slice of the scroll, so they settle one after
    // another instead of snapping into place together.
    const delay = count > 1 ? (index / count) * stagger : 0;
    const t = THREE.MathUtils.clamp((raw - delay) / Math.max(0.05, 1 - stagger), 0, 1);
    // Ease so the last stretch settles rather than arriving at full speed.
    const e = t * t * (3 - 2 * t);

    const m = meshRef.current;
    if (m) {
      m.position.set(
        THREE.MathUtils.lerp(pose.position[0], piece.position[0], e),
        THREE.MathUtils.lerp(pose.position[1], piece.position[1], e),
        THREE.MathUtils.lerp(pose.position[2], piece.position[2], e)
      );
      m.rotation.set(
        THREE.MathUtils.lerp(pose.rotation[0], piece.rotation[0], e),
        THREE.MathUtils.lerp(pose.rotation[1], piece.rotation[1], e),
        THREE.MathUtils.lerp(pose.rotation[2], piece.rotation[2], e)
      );
    }

    // Colour arrives later than the movement, so the pieces visibly connect
    // first and only then light up.
    const colourT = THREE.MathUtils.clamp((raw - 0.5) / 0.5, 0, 1);
    if (coreMat.current) {
      scratch.copy(grey).lerp(colour, colourT).multiplyScalar(0.35 + colourT * 1.55);
      coreMat.current.color.copy(scratch);
    }

    const c = coreRef.current;
    if (c) {
      c.rotation.z += dt * 0.35;
      const dt2 = state.clock.elapsedTime * 0.5 + phase;
      c.position.x = Math.sin(dt2) * fit.drift;
      c.position.y = Math.cos(dt2 * 0.77 + phase) * fit.drift * 0.7;
    }
  });

  return (
    <mesh ref={meshRef} geometry={piece.geometry}>
      {/* silhouette-shaped backdrop, so the glass has the page colour to
          refract without a canvas-sized rectangle */}
      <mesh
        geometry={piece.geometry}
        scale={backdropScale}
        position={[0, 0, -backdropDepth]}
        renderOrder={-3}
      >
        <meshBasicMaterial color="#171717" toneMapped={false} />
      </mesh>

      <mesh
        ref={coreRef}
        geometry={piece.geometry}
        scale={fit.scale}
        rotation={[0, 0, phase]}
        position={[0, 0, -0.35]}
        renderOrder={-1}
      >
        <meshBasicMaterial ref={coreMat} toneMapped={false} />
      </mesh>

      <MeshTransmissionMaterial
        transmissionSampler
        samples={fr.samples}
        resolution={1024}
        transmission={GLASS.transmission}
        thickness={GLASS.thickness}
        roughness={fr.roughness}
        ior={GLASS.ior}
        chromaticAberration={GLASS.chromaticAberration}
        anisotropicBlur={fr.blur}
        distortion={GLASS.distortion}
        distortionScale={0.3}
        temporalDistortion={0}
        backside={false}
        envMapIntensity={GLASS.envIntensity}
        clearcoat={0.5}
        clearcoatRoughness={0.05}
        color={GLASS.color}
        attenuationColor={GLASS.attenuationColor}
        attenuationDistance={GLASS.attenuationDistance}
      />

      <Edges
        polygonOffset
        polygonOffsetFactor={-6}
        polygonOffsetUnits={-6}
        threshold={15}
        color={GLASS.edgeColor}
        lineWidth={GLASS.edgeWidth}
      />

      <mesh geometry={piece.geometry} renderOrder={2}>
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
            uColor: { value: new THREE.Color(GLASS.rimColor) },
            uIntensity: { value: GLASS.rimIntensity },
            uPower: { value: GLASS.rimPower },
            uLightDir: { value: new THREE.Vector3(0.5, 0.5, 0.7).normalize() },
            uDirectional: { value: 0.75 },
          }}
        />
      </mesh>
    </mesh>
  );
}

function Scene({ progress, seed, zoom, count, spread, stagger, aspect: bandAspect, boundarySides, boundaryJitter, flatten, offsetX, offsetY }) {
  const size = useThree((state) => state.size);
  const viewAspect = size.width / Math.max(1, size.height);
  const half = Math.tan(((FOV * Math.PI) / 180) / 2);

  // Few, chunky, evenly sized pieces — each one reads as its own shard
  // rather than as a fragment of a shattered pane. evenness keeps them from
  // clumping into slivers, and the wider gap makes the seams legible.
  const pieces = useMemo(
    () =>
      buildMosaic({
        ...MOSAIC_DEFAULTS,
        pieces: count,
        seed,
        scatter: 0,
        evenness: 1,
        gap: 0.07,
        topRagged: 0.15,
        // A squat, many-sided outline. Combined with the cover fit below it
        // runs off both edges of the frame, so what you see is a long band
        // rather than a shape sitting in the middle with space around it.
        aspect: bandAspect,
        boundarySides,
        boundaryJitter,
      }),
    [count, seed, bandAspect, boundarySides, boundaryJitter]
  );
  const colours = useMemo(() => pieceColours(pieces.length, seed), [pieces.length, seed]);

  // Measure the assembled band rather than assuming a radius. Distance is
  // then solved from its half-width, so the strip is guaranteed to reach
  // past both edges no matter how wide the window is.
  // The generated outline is not centred on the origin — jitter shifts it,
  // and the ragged top carve takes material off one side — so measure the
  // assembled band and recentre it rather than assuming it sits at 0,0.
  const bounds = useMemo(() => {
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const piece of pieces) {
      const a = piece.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        const x = a[i] + piece.position[0];
        const y = a[i + 1] + piece.position[1];
        if (x < xmin) xmin = x;
        if (x > xmax) xmax = x;
        if (y < ymin) ymin = y;
        if (y > ymax) ymax = y;
      }
    }
    if (!Number.isFinite(xmin)) return { halfWidth: 2, cx: 0, cy: 0 };
    return {
      halfWidth: (xmax - xmin) / 2,
      cx: (xmin + xmax) / 2,
      cy: (ymin + ymax) / 2,
    };
  }, [pieces]);

  // 0.97 so it overshoots slightly instead of landing exactly on the edge.
  const camZ =
    ((bounds.halfWidth / (half * viewAspect)) * 0.97) / Math.max(0.05, zoom);

  return (
    <>
      <PerspectiveCamera makeDefault fov={FOV} position={[0, 0, camZ]} />
      <group
        position={[offsetX * bounds.halfWidth, offsetY * bounds.halfWidth, 0]}
        scale={[1, flatten, 1]}
      >
      <group position={[-bounds.cx, -bounds.cy, 0]}>
      {pieces.map((piece, i) => (
        <Piece
          key={piece.key}
          piece={piece}
          index={i}
          colour={colours[i]}
          progress={progress}
          camZ={camZ}
          spread={spread}
          stagger={stagger}
          count={pieces.length}
          centre={bounds}
        />
      ))}
      </group>
      </group>
      <Environment resolution={256}>
        <color attach="background" args={["#0a0a0c"]} />
        <Lightformer form="rect" intensity={0.4} position={[0, 0, 5]} scale={[8, 8, 1]} />
      </Environment>
    </>
  );
}

export default function Assembly({
  progress,
  seed = 12,
  zoom = 1,
  /** How many shards. Five reads as distinct pieces; twenty reads as debris. */
  count = 5,
  /** How far apart they start, in world units. */
  spread = 1,
  /** Fraction of the scroll spent staggering arrivals, 0 = all together. */
  stagger = 0.35,
  /**
   * Outline height relative to width.
   *
   * Counterintuitively this is also the tile-width control. The band always
   * fills the screen width, so what matters is the fraction of it one tile
   * spans — and in a shallow band five cells sit side by side and get a
   * fifth each, while in a taller one they pack into rows and each spans
   * far more. 0.65 gives 41% per tile, 0.9 gives 48%, 1.5 gives 54%.
   *
   * Raising it also makes the band taller, which `flatten` then takes back
   * out — the two are meant to be tuned together.
   */
  aspect = 0.9,
  boundarySides = 9,
  boundaryJitter = 0.22,
  /**
   * Vertical squash applied to the finished band. 1 leaves it alone, 0.3
   * makes every tile 70% shorter.
   *
   * This is the one axis that is free: the camera fits to width, so tile
   * width as a fraction of the band is fixed no matter what — but nothing
   * normalises the vertical, so scaling Y shortens the tiles without
   * narrowing them.
   */
  flatten = 0.3,
  /** Pan within the frame, in multiples of the band half-width. */
  offsetX = 0,
  offsetY = 0,
}) {
  return (
    <Canvas dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
      <Scene
        progress={progress}
        seed={seed}
        zoom={zoom}
        count={count}
        spread={spread}
        stagger={stagger}
        aspect={aspect}
        boundarySides={boundarySides}
        boundaryJitter={boundaryJitter}
        flatten={flatten}
        offsetX={offsetX}
        offsetY={offsetY}
      />
    </Canvas>
  );
}
