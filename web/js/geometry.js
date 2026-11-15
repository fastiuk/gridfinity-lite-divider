// Parametric Gridfinity bin built with constructive solid geometry (manifold-3d).
// Units are millimetres, Z points up, the bin is centred on the origin with its feet at z = 0.
//
// The model is never loaded from a template: every solid below is computed from the
// parameters and the Gridfinity dimensions in G, then combined with boolean operations.

export const G = {
  grid: 42,        // grid pitch
  hu: 7,           // height unit
  gap: 0.5,        // a 1-unit bin is 41.5 mm wide
  rOut: 3.75,      // outer corner radius
  baseTop: 4.75,   // top of the foot profile (0.8 + 1.8 + 2.15)
  stdFloor: 7,     // floor of a standard (solid) base
  lipTrunc: 0.4,   // flat on top of the lip instead of a knife edge
  stackGap: 0.6,   // dividers and label shelves stop this far below the rim when a lip is present
  magnetDepth: 2.4,
  screwD: 3.0,
  screwDepth: 6.0,
  holeOffset: 13,  // magnet / screw holes sit 13 mm from the cell centre in X and Y
};

export const LIP_STYLES = ['standard', 'thin', 'ultrathin', 'none'];

export const DEFAULTS = Object.freeze({
  ux: 2, uy: 2, uz: 6, lite: true, cx: 3, cy: 2,
  lipStyle: 'standard', label: true, labelRows: false, scoop: false,
  magnets: true, screws: false, magD: 6.5,
  wall: 1.0, floor: 0.8, divT: 1.2, divLower: 0, scoopR: 0, fillet: 2,
});

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Compartments are at least ~10 mm wide.
export function maxComp(units, wall) {
  return Math.max(1, Math.floor((G.grid * units - G.gap - 2 * wall) / 10));
}

// Bring arbitrary input into the supported range.
export function sanitize(input) {
  const P = { ...DEFAULTS, ...input };
  const n = (v, d) => (Number.isFinite(+v) ? +v : d);
  // Older saved settings had a boolean `lip`.
  if (input && input.lipStyle === undefined && input.lip === false) P.lipStyle = 'none';
  delete P.lip;
  if (!LIP_STYLES.includes(P.lipStyle)) P.lipStyle = DEFAULTS.lipStyle;
  P.ux = clamp(Math.round(n(P.ux, DEFAULTS.ux)), 1, 10);
  P.uy = clamp(Math.round(n(P.uy, DEFAULTS.uy)), 1, 10);
  P.uz = clamp(Math.round(n(P.uz, DEFAULTS.uz)), 1, 20);
  for (const k of ['lite', 'label', 'labelRows', 'scoop', 'magnets', 'screws']) P[k] = !!P[k];
  P.fillet = clamp(n(P.fillet, DEFAULTS.fillet), 0, 5);
  P.magD = clamp(n(P.magD, DEFAULTS.magD), 3, 10);
  P.wall = clamp(n(P.wall, DEFAULTS.wall), 0.6, 1.8);
  P.floor = clamp(n(P.floor, DEFAULTS.floor), 0.4, 2);
  P.divT = clamp(n(P.divT, DEFAULTS.divT), 0.6, 4);
  P.divLower = clamp(n(P.divLower, DEFAULTS.divLower), 0, Math.max(0, G.hu * P.uz - 10));
  P.scoopR = clamp(n(P.scoopR, DEFAULTS.scoopR), 0, 40);
  P.cx = clamp(Math.round(n(P.cx, DEFAULTS.cx)), 1, maxComp(P.ux, P.wall));
  P.cy = clamp(Math.round(n(P.cy, DEFAULTS.cy)), 1, maxComp(P.uy, P.wall));
  return P;
}

export function outerSize(P) {
  return {
    W: G.grid * P.ux - G.gap,
    L: G.grid * P.uy - G.gap,
    H: G.hu * P.uz,
    lipH: P.lipStyle === 'none' ? 0 : 2.5 + 1.9 - G.lipTrunc,
  };
}

// Top of dividers and label shelves. With a lip, a stacked bin's feet reach about 0.35 mm
// below the rim, so everything inside stops 0.6 mm below it.
export function dividerTop(P) {
  return G.hu * P.uz - (P.lipStyle === 'none' ? 0 : G.stackGap) - P.divLower;
}

export function compartmentSize(P) {
  const { W, L } = outerSize(P);
  const Wi = W - 2 * P.wall, Li = L - 2 * P.wall;
  return [(Wi - (P.cx - 1) * P.divT) / P.cx, (Li - (P.cy - 1) * P.divT) / P.cy];
}

// Inset of the foot outline from the 41.5 mm cell outline at height z (45° / vertical / 45°).
// Above 4.75 the same 45° line continues outward; the lite pockets use that to form tent-shaped ridges.
function footInset(z) {
  if (z <= 0.8) return 2.95 - z;
  if (z <= 2.6) return 2.15;
  return 4.75 - z;
}

// Inset of the bin's inner wall from the outer outline at height z, including the stacking lip.
// A stacked bin rests on the top chamfer in every style, so it sits at the same height.
//  standard:  two levels: 1.9 chamfer, 1.8 band, 0.7 chamfer to a ledge at 2.6, 45° support below
//  thin:      one level: 1.9 chamfer, 1.8 band, then straight back to the wall at 45°
//  ultrathin: the wall goes straight up; only the top of the chamfer above the wall is kept
function bodyProfile(P, H) {
  const w = P.wall;
  if (P.lipStyle === 'none') return { fn: () => w, breaks: [], top: H };
  const T = H + 2.5 + 1.9 - G.lipTrunc;          // truncated lip top
  if (P.lipStyle === 'ultrathin') {
    const zc = H + 4.4 - w;                      // where the top chamfer meets the wall
    const fn = (z) => (z <= zc ? w : Math.max(G.lipTrunc, 1.9 - (z - H - 2.5)));
    return { fn, breaks: [zc, T], top: T };
  }
  if (P.lipStyle === 'thin') {
    const zb = H + 0.7 - (1.9 - w);              // where the 45° slope under the band meets the wall
    const fn = (z) => {
      if (z <= zb) return w;
      if (z <= H + 0.7) return w + (z - zb);
      if (z <= H + 2.5) return 1.9;
      if (z <= T) return 1.9 - (z - H - 2.5);
      return G.lipTrunc;
    };
    return { fn, breaks: [zb, H + 0.7, H + 2.5, T], top: T };
  }
  const zs = H - (2.6 - w);                      // start of the 45° support under the lip
  const fn = (z) => {
    if (z <= zs) return w;
    if (z <= H) return w + (z - zs);
    if (z <= H + 0.7) return 2.6 - (z - H);
    if (z <= H + 2.5) return 1.9;
    if (z <= T) return 1.9 - (z - H - 2.5);
    return G.lipTrunc;
  };
  return { fn, breaks: [zs, H, H + 0.7, H + 2.5, T], top: T };
}

function sampleProfile(fn, z0, z1, breaks) {
  const zs = [z0, ...breaks.filter((z) => z > z0 + 1e-6 && z < z1 - 1e-6).sort((a, b) => a - b), z1];
  return zs.map((z) => [z, fn(z)]);
}

// Rounded rectangle (outline w × l with corner radius R, inset by e) as 3D points at height z.
function ringPoints(cx, cy, w, l, e, z, R = G.rOut, rMin = 0.3) {
  const hx = w / 2 - e, hy = l / 2 - e;
  let r = Math.min(R - e, hx - 0.05, hy - 0.05);
  r = Math.max(r, rMin);
  const seg = r > 2 ? 8 : r > 0.8 ? 5 : 3;
  const pts = [];
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++) {
    const [sx, sy] = corners[k];
    const ox = cx + sx * (hx - r), oy = cy + sy * (hy - r);
    for (let i = 0; i <= seg; i++) {
      const a = ((k * 90 + (90 * i) / seg) * Math.PI) / 180;
      pts.push([ox + r * Math.cos(a), oy + r * Math.sin(a), z]);
    }
  }
  return pts;
}

/**
 * Build the bin. `M` is the manifold-3d `Manifold` class, `P` the sanitised parameters.
 * Returns the triangle mesh plus a few measurements. All intermediate WASM objects are freed.
 */
export function buildBin(M, P) {
  const made = [];
  const keep = (m) => { made.push(m); return m; };
  const unionAll = (list) => (list.length === 1 ? list[0] : keep(M.union(list)));
  // Loft of rounded rectangles: each pair of rings is convex, so its hull is exact.
  const loft = (prof, cx, cy, w, l) => {
    const parts = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const [z0, e0] = prof[i], [z1, e1] = prof[i + 1];
      if (z1 - z0 < 1e-6) continue;
      parts.push(keep(M.hull([...ringPoints(cx, cy, w, l, e0, z0), ...ringPoints(cx, cy, w, l, e1, z1)])));
    }
    return unionAll(parts);
  };

  try {
    const cell = G.grid - G.gap;
    const { W, L, H } = outerSize(P);
    const body = bodyProfile(P, H);
    const topZ = body.top;

    const centers = [];
    for (let i = 0; i < P.ux; i++) {
      for (let j = 0; j < P.uy; j++) {
        centers.push([(i - (P.ux - 1) / 2) * G.grid, (j - (P.uy - 1) / 2) * G.grid]);
      }
    }

    // ---- outer solid: one foot per grid cell plus the straight body
    const foot = loft([[0, 2.95], [0.8, 2.15], [2.6, 2.15], [G.baseTop, 0]], 0, 0, cell, cell);
    const feet = centers.map(([x, y]) => keep(foot.translate([x, y, 0])));
    const shell = loft([[G.baseTop, 0], [topZ, 0]], 0, 0, W, L);
    const outer = unionAll([...feet, shell]);

    // ---- cavity
    let cavity;
    const zFloor = P.lite ? P.floor : G.stdFloor;
    if (P.lite) {
      // Each cell gets a pocket that follows the foot at a constant horizontal wall thickness.
      // Neighbouring pockets meet at a 45° ridge whose top sits at 5 + wall.
      const zRidge = G.baseTop + G.gap / 2 + P.wall;
      const zPocketTop = zRidge + 0.5;
      const pocket = loft(
        sampleProfile((z) => footInset(z) + P.wall, P.floor, zPocketTop, [0.8, 2.6, G.baseTop]),
        0, 0, cell, cell);
      const pockets = unionAll(centers.map(([x, y]) => keep(pocket.translate([x, y, 0]))));
      const clip = loft(sampleProfile(body.fn, P.floor - 1, zPocketTop, body.breaks), 0, 0, W, L);
      const lower = keep(pockets.intersect(clip));
      const upper = loft(sampleProfile(body.fn, zRidge, topZ + 1, body.breaks), 0, 0, W, L);
      cavity = keep(lower.add(upper));
    } else {
      cavity = loft(sampleProfile(body.fn, G.stdFloor, topZ + 1, body.breaks), 0, 0, W, L);
    }

    // ---- compartments: below the divider top the cavity is limited to one rounded box per
    // compartment, so the gaps between boxes become the dividers. Each box has its vertical
    // edges and its bottom edges rounded with the fillet radius, which puts fillets where the
    // floor meets the walls and the dividers, and in the corners between dividers.
    const Wi = W - 2 * P.wall, Li = L - 2 * P.wall;
    const zTop = dividerTop(P);
    const [cw, cl] = compartmentSize(P);
    const rowFront = (j) => -Li / 2 + j * (cl + P.divT);
    const colLeft = (i) => -Wi / 2 + i * (cw + P.divT);
    const r = Math.min(P.fillet, cw / 2 - 0.05, cl / 2 - 0.05, (zTop - zFloor) / 2);
    const rounded = r >= 0.2;
    if (zTop > zFloor + 0.5 && (P.cx > 1 || P.cy > 1 || rounded)) {
      const boxes = [];
      for (let i = 0; i < P.cx; i++) {
        for (let j = 0; j < P.cy; j++) {
          const x0 = colLeft(i) + cw / 2, y0 = rowFront(j) + cl / 2;
          const pts = [];
          if (rounded) {
            const N = 6;   // quarter-circle steps of the bottom fillet
            for (let k = 0; k <= N; k++) {
              const phi = ((Math.PI / 2) * k) / N;
              pts.push(...ringPoints(x0, y0, cw, cl, r - r * Math.sin(phi), zFloor + r - r * Math.cos(phi), r, 0.01));
            }
          } else {
            pts.push(...ringPoints(x0, y0, cw, cl, 0, zFloor - 1, 0.01, 0.01));
          }
          pts.push(...ringPoints(x0, y0, cw, cl, 0, zTop + 0.5, rounded ? r : 0.01, 0.01));
          boxes.push(keep(M.hull(pts)));
        }
      }
      const slab = keep(keep(M.cube([W + 4, L + 4, topZ + 2 - zTop], false)).translate([-W / 2 - 2, -L / 2 - 2, zTop]));
      cavity = keep(cavity.intersect(unionAll([...boxes, slab])));
    }

    // ---- solids that go back into the cavity: scoops and label shelves
    const adds = [];

    if (P.scoop) {
      const auto = Math.min(cl * 0.5, (zTop - zFloor) * 0.45, 20);
      const R = Math.min(P.scoopR > 0 ? P.scoopR : auto, cl - 1, zTop - zFloor - 1);
      if (R >= 2) {
        const cyl = keep(keep(M.cylinder(Wi + 4, R, R, 72, true)).rotate([0, 90, 0]));
        for (let j = 0; j < P.cy; j++) {
          const y0 = rowFront(j);
          const box = keep(keep(M.cube([Wi + 1, R + 0.5, R + 0.5], false)).translate([-Wi / 2 - 0.5, y0 - 0.5, zFloor - 0.5]));
          const c = keep(cyl.translate([0, y0 + R, zFloor + R]));
          adds.push(keep(box.subtract(c)));
        }
      }
    }

    if (P.label) {
      const tip = 0.6;
      const Lt = Math.min(12, cl * 0.5, zTop - zFloor - tip - 2);
      if (Lt >= 3) {
        const rows = P.labelRows ? [...Array(P.cy).keys()] : [P.cy - 1];
        for (const j of rows) {
          const y1 = rowFront(j) + cl;
          const prof = [[y1 + 0.5, zTop], [y1 - Lt, zTop], [y1 - Lt, zTop - tip], [y1 + 0.5, zTop - tip - Lt - 0.5]];
          const pts = [];
          for (const [y, z] of prof) pts.push([-Wi / 2 - 0.5, y, z], [Wi / 2 + 0.5, y, z]);
          adds.push(keep(M.hull(pts)));
        }
      }
    }

    if (adds.length) cavity = keep(cavity.subtract(unionAll(adds)));
    let result = keep(outer.subtract(cavity));

    // ---- magnet / screw holes (standard base only)
    if (!P.lite && (P.magnets || P.screws)) {
      const mag = P.magnets
        ? keep(keep(M.cylinder(G.magnetDepth + 1, P.magD / 2, P.magD / 2, 40, false)).translate([0, 0, -1]))
        : null;
      const scr = P.screws
        ? keep(keep(M.cylinder(G.screwDepth + 1, G.screwD / 2, G.screwD / 2, 24, false)).translate([0, 0, -1]))
        : null;
      const holes = [];
      const o = G.holeOffset;
      for (const [x, y] of centers) {
        for (const [dx, dy] of [[o, o], [-o, o], [-o, -o], [o, -o]]) {
          if (mag) holes.push(keep(mag.translate([x + dx, y + dy, 0])));
          if (scr) holes.push(keep(scr.translate([x + dx, y + dy, 0])));
        }
      }
      result = keep(result.subtract(unionAll(holes)));
    }

    const status = result.status();
    if (status !== 'NoError') throw new Error(status);
    return {
      mesh: result.getMesh(),
      volume: result.volume(),
      tris: result.numTri(),
      genus: result.genus(),
      dims: [W, L, topZ],
    };
  } finally {
    for (const m of made) {
      try { m.delete(); } catch { /* already freed */ }
    }
  }
}

// Non-indexed triangle positions (shared by the preview and the STL writer).
export function meshPositions(mesh) {
  const np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
  const pos = new Float32Array(tv.length * 3);
  for (let i = 0; i < tv.length; i++) {
    const v = tv[i] * np;
    pos[i * 3] = vp[v];
    pos[i * 3 + 1] = vp[v + 1];
    pos[i * 3 + 2] = vp[v + 2];
  }
  return pos;
}

export function fileBase(P) {
  const parts = ['gridfinity', P.lite ? 'lite' : 'std', `${P.ux}x${P.uy}x${P.uz}`, `${P.cx}x${P.cy}comp`];
  if (P.lipStyle === 'standard') parts.push('lip');
  if (P.lipStyle === 'thin') parts.push('thinlip');
  if (P.lipStyle === 'ultrathin') parts.push('ultrathinlip');
  if (P.label) parts.push(P.labelRows ? 'labels' : 'label');
  if (P.scoop) parts.push('scoop');
  if (!P.lite && P.magnets) parts.push('mag');
  if (!P.lite && P.screws) parts.push('screw');
  return parts.join('_');
}
