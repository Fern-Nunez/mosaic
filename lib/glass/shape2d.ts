import * as THREE from "three";

/**
 * A single flat 2D silhouette, extruded just enough to have an edge.
 *
 * The shape lives in the XY plane and faces the camera — it reads as 2D.
 * `depth` and `bevel` stay small on purpose: they exist only so the rim
 * catches a highlight, which is most of what makes a flat plane look like
 * a piece of glass rather than a tinted rectangle. The *refraction* depth
 * is faked separately by the material's `thickness` uniform, so the shape
 * can stay paper-thin and still bend the background like a thick slab.
 */

export type ShapeParams = {
  /** Corner count. 3 = triangle, 4 = quad, high = disc. */
  sides: number;
  /** 0 = regular polygon, 1 = a jagged break. */
  irregularity: number;
  /** Corner rounding, 0 = sharp points, 1 = fully filleted. */
  roundness: number;
  /** Pulls one corner out into a point. */
  tip: number;
  /** Rotation of the outline in its own plane, radians. */
  rotation: number;
  /** Non-uniform stretch: < 1 wide, > 1 tall. */
  aspect: number;
  /** Extrusion depth. Keep low — this is a 2D shape. */
  depth: number;
  /** Rim bevel. This is what lights the outline up. */
  bevel: number;
  /** Change it for a completely different outline. */
  seed: number;
};

export const SHAPE_DEFAULTS: ShapeParams = {
  sides: 5,
  irregularity: 0.45,
  roundness: 0,
  tip: 0.6,
  rotation: 0.2,
  aspect: 1,
  depth: 0.1,
  bevel: 0.05,
  seed: 7,
};

export const SHAPE_PRESETS: { label: string; params: Partial<ShapeParams> }[] = [
  {
    label: "Shard",
    params: { sides: 4, irregularity: 0.55, roundness: 0, tip: 1.1, aspect: 1.15, depth: 0.1, bevel: 0.05 },
  },
  {
    label: "Triangle",
    params: { sides: 3, irregularity: 0, roundness: 0, tip: 0, rotation: Math.PI / 2, aspect: 1, depth: 0.12, bevel: 0.06 },
  },
  {
    label: "Diamond",
    params: { sides: 4, irregularity: 0, roundness: 0, tip: 0, rotation: Math.PI / 4, aspect: 1.5, depth: 0.12, bevel: 0.06 },
  },
  {
    label: "Hexagon",
    params: { sides: 6, irregularity: 0, roundness: 0.05, tip: 0, rotation: 0, aspect: 1, depth: 0.14, bevel: 0.07 },
  },
  {
    label: "Pill",
    params: { sides: 12, irregularity: 0, roundness: 1, tip: 0, rotation: 0, aspect: 0.55, depth: 0.16, bevel: 0.08 },
  },
  {
    label: "Blob",
    params: { sides: 9, irregularity: 0.5, roundness: 1, tip: 0, rotation: 0, aspect: 1, depth: 0.18, bevel: 0.08 },
  },
  {
    label: "Pane",
    params: { sides: 4, irregularity: 0, roundness: 0.12, tip: 0, rotation: Math.PI / 4, aspect: 1.3, depth: 0.06, bevel: 0.03 },
  },
];

function rng(seed: number) {
  let s = Math.floor(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** The outline, as a list of 2D corners. */
function corners(p: ShapeParams): THREE.Vector2[] {
  const rand = rng(p.seed * 977 + 13);
  const n = Math.max(3, Math.round(p.sides));
  const pts: THREE.Vector2[] = [];

  for (let i = 0; i < n; i++) {
    const jitterA = (rand() - 0.5) * (Math.PI / n) * 1.4 * p.irregularity;
    const a = (i / n) * Math.PI * 2 + jitterA + p.rotation;
    let r = 1 + (rand() - 0.5) * 1.1 * p.irregularity;
    if (i === 0) r *= 1 + p.tip;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r * p.aspect));
  }
  return pts;
}

/** Corners → THREE.Shape, filleting each corner by `roundness`. */
function outline(pts: THREE.Vector2[], roundness: number): THREE.Shape {
  const shape = new THREE.Shape();
  const n = pts.length;

  if (roundness <= 0.001) {
    shape.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) shape.lineTo(pts[i].x, pts[i].y);
    shape.closePath();
    return shape;
  }

  // Cut each corner back along both its edges, then arc across the gap.
  const inset: { a: THREE.Vector2; b: THREE.Vector2; v: THREE.Vector2 }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const toPrev = new THREE.Vector2().subVectors(prev, curr);
    const toNext = new THREE.Vector2().subVectors(next, curr);
    const cut = 0.5 * roundness * Math.min(toPrev.length(), toNext.length());

    inset.push({
      a: curr.clone().add(toPrev.normalize().multiplyScalar(cut)),
      b: curr.clone().add(toNext.normalize().multiplyScalar(cut)),
      v: curr,
    });
  }

  shape.moveTo(inset[0].b.x, inset[0].b.y);
  for (let i = 1; i <= n; i++) {
    const c = inset[i % n];
    shape.lineTo(c.a.x, c.a.y);
    shape.quadraticCurveTo(c.v.x, c.v.y, c.b.x, c.b.y);
  }
  shape.closePath();
  return shape;
}

/**
 * Largest scale at which a copy of this outline, rotated to any angle about
 * the shape's centre, still fits inside the original: inradius / circumradius.
 *
 * A spiky outline wastes most of its bounding circle — a triangle can only
 * hide a third of itself — so this cannot be a fixed constant.
 */
function shapeBounds(pts: THREE.Vector2[]): { inr: number; circum: number } {
  // Match the translation buildShape applies, so distances are measured from
  // the same origin the mesh will spin around.
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const v of pts) {
    xmin = Math.min(xmin, v.x);
    xmax = Math.max(xmax, v.x);
    ymin = Math.min(ymin, v.y);
    ymax = Math.max(ymax, v.y);
  }
  const cx = (xmin + xmax) / 2;
  const cy = (ymin + ymax) / 2;

  let circum = 0;
  let inr = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    circum = Math.max(circum, Math.hypot(a.x - cx, a.y - cy));

    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    inr = Math.min(inr, Math.abs((-ey * (cx - a.x) + ex * (cy - a.y)) / len));
  }

  return { inr: isFinite(inr) ? inr : 0, circum: circum > 0 ? circum : 1 };
}

export function buildShape(p: ShapeParams): THREE.BufferGeometry {
  const pts = corners(p);
  const shape = outline(pts, p.roundness);

  const flat = p.depth <= 0.001 && p.bevel <= 0.001;
  const g = flat
    ? new THREE.ShapeGeometry(shape, 24)
    : new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.001, p.depth),
        bevelEnabled: p.bevel > 0.001,
        bevelSize: p.bevel,
        bevelThickness: p.bevel,
        bevelSegments: 3,
        curveSegments: 24,
      });

  g.center();

  // Normalise so the shape fills a consistent amount of frame.
  g.computeBoundingSphere();
  const s = 1.5 / (g.boundingSphere?.radius || 1);
  g.scale(s, s, s);
  g.computeBoundingSphere();

  // Carried on the geometry so the inner-shard copy knows how big it can be
  // without ever showing past this outline — in the same units as the final
  // mesh, so an absolute drift distance can be subtracted from it.
  const bounds = shapeBounds(pts);
  g.userData.inradius = bounds.inr * s;
  g.userData.circumradius = bounds.circum * s;

  return g;
}
