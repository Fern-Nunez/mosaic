import * as THREE from "three";

/**
 * A mosaic of glass pieces: a Voronoi tessellation clipped to an irregular
 * convex boundary, each cell inset to leave a seam, then extruded into a
 * thin bevelled slab.
 *
 * The Voronoi is built by half-plane clipping — start from the boundary
 * polygon and, for every other site, cut away the half of the plane that
 * is closer to it. O(n²) but n is ~40, so it costs nothing and avoids
 * pulling in a triangulation library.
 */

export type MosaicParams = {
  /** How many pieces to break the plane into. */
  pieces: number;
  /** Corners of the overall silhouette. */
  boundarySides: number;
  /** 0 = regular polygon outline, 1 = a ragged edge. */
  boundaryJitter: number;
  /** Overall stretch of the silhouette. */
  aspect: number;
  /** Seam width between pieces. */
  gap: number;
  /** Extrusion depth per piece. Keep low — these are flat shards. */
  depth: number;
  /** Rim bevel, what lights each piece's outline. */
  bevel: number;
  /** How evenly sized the pieces are. 0 = organic clumping, 1 = even. */
  evenness: number;
  /** Random tilt and depth offset per piece — the "broken pane" look. */
  scatter: number;
  /** How far the ragged top edge cuts down into the shape. 0 = flat top. */
  topRagged: number;
  /** Number of peaks along that top edge. */
  topPeaks: number;
  seed: number;
};

export const MOSAIC_DEFAULTS: MosaicParams = {
  pieces: 22,
  boundarySides: 7,
  boundaryJitter: 0.35,
  aspect: 1,
  gap: 0.05,
  // A wide bevel is what makes the border refract. At 0.02 there is
  // barely an edge for light to bend through, and pieces read as flat fills.
  depth: 0.1,
  bevel: 0.05,
  evenness: 0.6,
  scatter: 0.35,
  topRagged: 0.5,
  topPeaks: 7,
  seed: 12,
};

export type MosaicPiece = {
  key: number;
  geometry: THREE.BufferGeometry;
  /** In-plane radius, so a gradient across the piece can be normalised. */
  radius: number;
  /** Largest circle centred on the piece that fits inside it. Bounds how
   *  big an inner copy can be while still hiding behind this one. */
  inradius: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

function rng(seed: number) {
  let s = Math.floor(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type P = { x: number; y: number };

/** Irregular convex outline for the mosaic as a whole. */
function boundary(p: MosaicParams, rand: () => number): P[] {
  const n = Math.max(3, Math.round(p.boundarySides));
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / n) * p.boundaryJitter;
    const r = 1 + (rand() - 0.5) * 0.7 * p.boundaryJitter;
    pts.push({ x: Math.cos(a) * r * 1.9, y: Math.sin(a) * r * 1.9 * p.aspect });
  }
  return pts;
}

/** Clip a convex polygon by the half-plane { p : dot(n, p) <= d }. */
function clipHalfPlane(poly: P[], nx: number, ny: number, d: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = nx * a.x + ny * a.y - d;
    const db = nx * b.x + ny * b.y - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function centroid(poly: P[]): P {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p0 = poly[i];
    const p1 = poly[(i + 1) % poly.length];
    const cross = p0.x * p1.y - p1.x * p0.y;
    a += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) return { x: 0, y: 0 };
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

function area(poly: P[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p0 = poly[i];
    const p1 = poly[(i + 1) % poly.length];
    a += p0.x * p1.y - p1.x * p0.y;
  }
  return Math.abs(a) * 0.5;
}

function inside(poly: P[], p: P): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) return false;
  }
  return true;
}

/** Pull every edge inward by `g`, then re-intersect. Convex cells only. */
function inset(poly: P[], g: number): P[] {
  const n = poly.length;
  if (n < 3 || g <= 0) return poly;

  const lines: { nx: number; ny: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    // CCW winding => inward normal is the left normal
    const nx = -ey / len;
    const ny = ex / len;
    lines.push({ nx, ny, d: nx * a.x + ny * a.y + g });
  }

  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const l0 = lines[(i - 1 + n) % n];
    const l1 = lines[i];
    const det = l0.nx * l1.ny - l1.nx * l0.ny;
    if (Math.abs(det) < 1e-9) return [];
    out.push({
      x: (l0.d * l1.ny - l1.d * l0.ny) / det,
      y: (l0.nx * l1.d - l1.nx * l0.d) / det,
    });
  }
  return out;
}

/** Ensure counter-clockwise winding, which the inset and Shape both assume. */
function ccw(poly: P[]): P[] {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p0 = poly[i];
    const p1 = poly[(i + 1) % poly.length];
    a += p0.x * p1.y - p1.x * p0.y;
  }
  return a < 0 ? [...poly].reverse() : poly;
}

/**
 * A ragged upper edge, as a left-to-right polyline.
 *
 * Cells are cut against this rather than against the flat top of the convex
 * outline, so the pieces along the top end in angled faces at differing
 * heights — a broken skyline instead of a clean hull. Some points are left
 * at full height on purpose, so a few pieces still spike up.
 */
function skyline(
  bounds: P[],
  p: MosaicParams,
  rand: () => number,
  baseline: number,
  height: number
): { a: P; b: P }[] {
  if (p.topRagged <= 0.001 || p.topPeaks < 2) return [];

  let xmin = Infinity;
  let xmax = -Infinity;
  for (const v of bounds) {
    xmin = Math.min(xmin, v.x);
    xmax = Math.max(xmax, v.x);
  }

  const n = Math.max(2, Math.round(p.topPeaks));
  // Widen past the outline so the end segments cover the corner cells too.
  const pad = (xmax - xmin) * 0.08;
  const swing = p.topRagged * height * 0.45;

  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = xmin - pad + t * (xmax - xmin + pad * 2);
    // Swings above and below the nominal top line. Above is what makes a
    // piece spike up; the headroom added in buildMosaic is what it spikes
    // into. Every third point is forced high so the peaks are pronounced.
    const u = i % 3 === 0 ? 0.55 + rand() * 0.45 : rand();
    pts.push({ x, y: baseline + (u * 2 - 1) * swing });
  }

  const segs: { a: P; b: P }[] = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push({ a: pts[i], b: pts[i + 1] });
  return segs;
}

/** Cut a cell down to whatever sits below the skyline above it. */
function clipUnderSkyline(poly: P[], segs: { a: P; b: P }[]): P[] {
  if (segs.length === 0 || poly.length < 3) return poly;

  let xmin = Infinity;
  let xmax = -Infinity;
  for (const v of poly) {
    xmin = Math.min(xmin, v.x);
    xmax = Math.max(xmax, v.x);
  }

  let out = poly;
  for (const seg of segs) {
    // Only the segments actually overhanging this cell. Clipping by all of
    // them would intersect every half-plane and carve a convex silhouette,
    // which is exactly the ragged profile we are trying not to get.
    const sxmin = Math.min(seg.a.x, seg.b.x);
    const sxmax = Math.max(seg.a.x, seg.b.x);
    if (sxmax < xmin || sxmin > xmax) continue;

    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const len = Math.hypot(dx, dy) || 1;
    // Upward normal, so "keep" is everything below the line.
    const nx = -dy / len;
    const ny = dx / len;
    out = clipHalfPlane(out, nx, ny, nx * seg.a.x + ny * seg.a.y);
    if (out.length < 3) return [];
  }
  return out;
}

export function buildMosaic(p: MosaicParams): MosaicPiece[] {
  const rand = rng(p.seed * 613 + 29);
  let bounds = ccw(boundary(p, rand));

  // Stretch the outline upward about its own base before carving the top.
  // Without that headroom the skyline can only cut downward, which flattens
  // the silhouette instead of letting pieces spike above the nominal line.
  let sky: { a: P; b: P }[] = [];
  if (p.topRagged > 0.001 && p.topPeaks >= 2) {
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const v of bounds) {
      ymin = Math.min(ymin, v.y);
      ymax = Math.max(ymax, v.y);
    }
    const h = ymax - ymin;
    const headroom = p.topRagged * 0.5 * h;
    const k = (h + headroom) / (h || 1);
    // Scaling about y = ymin is affine, so the outline stays convex.
    bounds = bounds.map((v) => ({ x: v.x, y: ymin + (v.y - ymin) * k }));
    sky = skyline(bounds, p, rand, ymax, h);
  }

  // --- scatter sites inside the outline ---
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const v of bounds) {
    xmin = Math.min(xmin, v.x);
    xmax = Math.max(xmax, v.x);
    ymin = Math.min(ymin, v.y);
    ymax = Math.max(ymax, v.y);
  }

  const sites: P[] = [];
  const target = Math.max(2, Math.round(p.pieces));
  for (let guard = 0; sites.length < target && guard < target * 200; guard++) {
    const c = { x: xmin + rand() * (xmax - xmin), y: ymin + rand() * (ymax - ymin) };
    if (inside(bounds, c)) sites.push(c);
  }

  const cellFor = (i: number, from: P[]) => {
    let poly = bounds;
    for (let j = 0; j < from.length; j++) {
      if (j === i) continue;
      const nx = from[j].x - from[i].x;
      const ny = from[j].y - from[i].y;
      const mx = (from[j].x + from[i].x) / 2;
      const my = (from[j].y + from[i].y) / 2;
      poly = clipHalfPlane(poly, nx, ny, nx * mx + ny * my);
      if (poly.length < 3) return [];
    }
    return poly;
  };

  // Lloyd relaxation — nudging sites toward their cell centroid evens the
  // pieces out. `evenness` controls how far along that path we go.
  const rounds = Math.round(p.evenness * 4);
  for (let r = 0; r < rounds; r++) {
    const moved: P[] = sites.map((s, i) => {
      const cell = cellFor(i, sites);
      if (cell.length < 3) return s;
      const c = centroid(cell);
      return { x: s.x + (c.x - s.x) * 0.8, y: s.y + (c.y - s.y) * 0.8 };
    });
    sites.splice(0, sites.length, ...moved);
  }

  // --- turn each cell into a piece ---
  const pieces: MosaicPiece[] = [];
  for (let i = 0; i < sites.length; i++) {
    let cell = ccw(cellFor(i, sites));
    if (cell.length < 3) continue;

    // Carve the ragged top before insetting, so the seam follows the new edge.
    cell = ccw(clipUnderSkyline(cell, sky));
    if (cell.length < 3) continue;

    const shrunk = inset(cell, p.gap / 2);
    if (shrunk.length < 3 || area(shrunk) < 0.004) continue;

    const c = centroid(shrunk);
    const shape = new THREE.Shape();
    shape.moveTo(shrunk[0].x - c.x, shrunk[0].y - c.y);
    for (let k = 1; k < shrunk.length; k++) {
      shape.lineTo(shrunk[k].x - c.x, shrunk[k].y - c.y);
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, p.depth),
      bevelEnabled: p.bevel > 0.001,
      bevelSize: p.bevel,
      bevelThickness: p.bevel,
      bevelSegments: 2,
      curveSegments: 1,
    });

    let radius = 0;
    for (const v of shrunk) {
      radius = Math.max(radius, Math.hypot(v.x - c.x, v.y - c.y));
    }

    let pieceInradius = Infinity;
    for (let k = 0; k < shrunk.length; k++) {
      const a = shrunk[k];
      const bb = shrunk[(k + 1) % shrunk.length];
      const ex = bb.x - a.x;
      const ey = bb.y - a.y;
      const len = Math.hypot(ex, ey) || 1;
      pieceInradius = Math.min(
        pieceInradius,
        Math.abs((-ey * (c.x - a.x) + ex * (c.y - a.y)) / len)
      );
    }

    pieces.push({
      key: i,
      geometry,
      radius,
      inradius: pieceInradius,
      position: [c.x, c.y, (rand() - 0.5) * p.scatter * 0.5],
      rotation: [
        (rand() - 0.5) * p.scatter * 0.28,
        (rand() - 0.5) * p.scatter * 0.28,
        (rand() - 0.5) * p.scatter * 0.1,
      ],
    });
  }

  return pieces;
}

/** Largest circle centred on the origin that the outline still contains. */
export function mosaicInradius(p: MosaicParams): number {
  const rand = rng(p.seed * 613 + 29);
  const bounds = ccw(boundary(p, rand));
  let min = Infinity;
  for (let i = 0; i < bounds.length; i++) {
    const a = bounds[i];
    const b = bounds[(i + 1) % bounds.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    min = Math.min(min, Math.abs((-ey * (0 - a.x) + ex * (0 - a.y)) / len));
  }
  return min;
}
