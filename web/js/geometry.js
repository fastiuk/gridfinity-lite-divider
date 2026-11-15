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
  rimR: 0.6,       // round on top of the lip
  tabAngle: 36,    // label tab underside, degrees from horizontal
  tabDepth: 14.2,  // label tab depth from the face it hangs on
  tabFront: 1.2,   // height of the label tab's front face
  magnetDepth: 2.4,
  screwD: 3.0,
  screwDepth: 6.0,
  holeOffset: 13,  // magnet / screw holes sit 13 mm from the cell centre in X and Y
};

export const LIP_STYLES = ['standard', 'thin', 'ultrathin', 'none'];

export const DEFAULTS = Object.freeze({
  ux: 2, uy: 2, uz: 6, lite: true, cx: 1, cy: 1,
  lipStyle: 'thin', label: false, labelRows: false, scoop: false, gridTall: false,
  magnets: false, screws: false, magD: 6.5,
  wall: 1.0, floor: 0.8, divT: 1.2, divLower: 0, scoopR: 0, fillet: 2,
});

// The lip's rim is a round tangent to the outer wall and to the top 45° chamfer (which would
// reach the outer face at H + 4.4). It stops 15° short of its top, leaving a ~0.3 mm flat.
const RIM_PHI = (15 * Math.PI) / 180;
const rimCentre = (H) => H + 4.4 - G.rimR - G.rimR * Math.SQRT2;
const rimTop = (H) => rimCentre(H) + G.rimR * Math.cos(RIM_PHI);

// The thin lip's straight band ends at H + 2.5 and is 1.8 mm tall, as in the spec profile.
const THIN_BAND = 1.8;
const thinBandBottom = (H) => H + 2.5 - THIN_BAND;

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
  for (const k of ['lite', 'label', 'labelRows', 'scoop', 'gridTall', 'magnets', 'screws']) P[k] = !!P[k];
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
  const H = G.hu * P.uz;
  return {
    W: G.grid * P.ux - G.gap,
    L: G.grid * P.uy - G.gap,
    H,
    lipH: P.lipStyle === 'none' ? 0 : rimTop(H) - H,
  };
}

// Dividers and label tabs end at the nominal height H, level with where the lip starts
// (as in gridfinity-rebuilt); a stacked bin rests on them.
export function dividerTop(P) {
  return G.hu * P.uz - P.divLower;
}

export function compartmentSize(P) {
  const { W, L } = outerSize(P);
  const Wi = W - 2 * P.wall, Li = L - 2 * P.wall;
  return [(Wi - (P.cx - 1) * P.divT) / P.cx, (Li - (P.cy - 1) * P.divT) / P.cy];
}

// Where the dividers are and, with `gridTall`, which of them may rise above the divider top.
// A stacked bin's feet leave a groove over every grid line: 0.25 mm of clearance plus the foot
// inset on each side. A divider on a grid line can rise into that groove up to where the lip's
// top chamfer starts (H + 2.5; for the ultra-thin lip, where its chamfer leaves the wall),
// keeping at least 0.5 mm from the feet even if the stacked bin sinks onto the lip (0.35 mm
// below H). `top` is that height, or null for a divider that stays at dividerTop().
export function dividerLayout(P) {
  const { W, L, H } = outerSize(P);
  const Wi = W - 2 * P.wall, Li = L - 2 * P.wall;
  const [cw, cl] = compartmentSize(P);
  const zTop = dividerTop(P);
  const target = P.lipStyle === 'ultrathin' ? H + 4.4 - P.wall : H + 2.5;
  const raised = (pos, units) => {
    if (P.lipStyle === 'none' || !P.gridTall) return null;
    let off = Infinity;
    for (let k = 1; k < units; k++) off = Math.min(off, Math.abs(pos - (k - units / 2) * G.grid));
    const half = P.divT / 2 + off;
    if (half > 1.9) return null;
    const z = Math.min(target, H + 4.4 - half - 0.25) - P.divLower;
    return z > zTop + 0.5 ? z : null;
  };
  const xs = [], ys = [];
  for (let i = 1; i < P.cx; i++) {
    const x = -Wi / 2 + i * cw + (i - 0.5) * P.divT;
    xs.push({ pos: x, top: raised(x, P.ux) });
  }
  for (let j = 1; j < P.cy; j++) {
    const y = -Li / 2 + j * cl + (j - 0.5) * P.divT;
    ys.push({ pos: y, top: raised(y, P.uy) });
  }
  return { xs, ys, zTop };
}

// Inset of the foot outline from the 41.5 mm cell outline at height z (45° / vertical / 45°).
// Above 4.75 the same 45° line continues outward; the lite pockets use that to form tent-shaped ridges.
function footInset(z) {
  if (z <= 0.8) return 2.95 - z;
  if (z <= 2.6) return 2.15;
  return 4.75 - z;
}

// Inset of the bin's inner wall from the outer outline at height z, including the stacking lip.
// The profiles follow gridfinity-rebuilt: everything is either level or rounded.
//  standard:  1.9 chamfer, 1.8 band at 1.9, 0.7 chamfer to a ledge at 2.6 that starts at H and
//             runs 1.2 mm down, then a 45° support and a fillet into the wall
//  thin:      one level: 1.9 chamfer, a band at 1.9 of THIN_BAND height, then the same 45°
//             support and fillet into the wall (no ledge). Where a divider or the back-wall
//             label tab meets the wall, the band runs straight down to its top instead.
//  ultrathin: the wall goes straight up; only the top chamfer and the rim are kept
// All of them end in the rounded rim. Dividers and label tabs stop at H, level with where the
// lip starts.
function bodyProfile(P, H) {
  const w = P.wall;
  if (P.lipStyle === 'none') return { fn: () => w, breaks: [], top: H };

  const R = G.rimR, c = rimCentre(H), top = rimTop(H);
  const zt = c + R * Math.SQRT1_2;                          // chamfer meets the rim round
  const rim = (z) => {
    if (z <= zt) return H + 4.4 - z;                        // top 45° chamfer
    if (z >= top) return R + R * Math.sin(RIM_PHI);
    return R + Math.sqrt(Math.max(0, R * R - (z - c) ** 2));
  };
  const rimBreaks = [zt, ...[37.5, 30, 22.5].map((d) => c + R * Math.cos((d * Math.PI) / 180)), top];

  if (P.lipStyle === 'ultrathin') {
    const fn = (z) => Math.min(w, rim(z));
    const cross = w >= R + R * Math.SQRT1_2 ? H + 4.4 - w : c + Math.sqrt(Math.max(0, R * R - (w - R) ** 2));
    return { fn, breaks: [cross, ...rimBreaks], top };
  }

  // Support under the lip: from (eT, zT) down at 45°, then a fillet into the wall.
  const [eT, zT] = P.lipStyle === 'standard' ? [2.6, H - 1.2] : [1.9, thinBandBottom(H)];
  const rs = Math.max(0, Math.min(P.fillet, (eT - w) / (1 - Math.SQRT1_2) - 0.01));
  const eAE = w + rs * (1 - Math.SQRT1_2);                 // fillet meets the 45° line
  const zAE = zT - (eT - eAE);
  const zAS = zAE - rs * Math.SQRT1_2;                      // fillet leaves the wall
  const support = (z) => {
    if (z <= zAS) return w;
    if (z <= zAE) return w + rs - Math.sqrt(Math.max(0, rs * rs - (z - zAS) ** 2));
    return eAE + (z - zAE);
  };
  const filletBreaks = [0, 15, 30].map((d) => zAS + rs * Math.sin((d * Math.PI) / 180));

  const fn = (z) => {
    if (z <= zT) return support(z);
    if (P.lipStyle === 'standard') {
      if (z <= H) return 2.6;
      if (z <= H + 0.7) return 2.6 - (z - H);
    }
    if (z <= H + 2.5) return 1.9;
    return rim(z);
  };
  const breaks = [...filletBreaks, zAE, zT, H, H + 0.7, H + 2.5, ...rimBreaks];
  return { fn, breaks, top };
}

// Outer shell: straight up to the rim, then the rim round.
function shellProfile(P, H) {
  if (P.lipStyle === 'none') return [[G.baseTop, 0], [H, 0]];
  const R = G.rimR, c = rimCentre(H);
  const prof = [[G.baseTop, 0], [c, 0]];
  for (const d of [70, 50, 30, 15]) {
    const a = (d * Math.PI) / 180;
    prof.push([c + R * Math.cos(a), R - R * Math.sin(a)]);
  }
  return prof;
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
    const shell = loft(shellProfile(P, H), 0, 0, W, L);
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

    // ---- compartments and dividers
    // Below the divider top the cavity is limited to one rounded box per compartment; the gaps
    // between boxes are the dividers. The boxes' rounded vertical edges are the fillets in the
    // corners, their rounded bottom edges the fillets at the floor. The boxes go all the way up,
    // so near the walls they also meet the support under the lip with rounded corners.
    const Wi = W - 2 * P.wall, Li = L - 2 * P.wall;
    const zTop = dividerTop(P);
    const [cw, cl] = compartmentSize(P);
    const rowFront = (j) => -Li / 2 + j * (cl + P.divT);
    const colLeft = (i) => -Wi / 2 + i * (cw + P.divT);
    const r = Math.min(P.fillet, cw / 2 - 0.05, cl / 2 - 0.05, (zTop - zFloor) / 2);
    const rounded = r >= 0.2;

    // Label tabs, shaped as in gridfinity-rebuilt: flat top level with the divider top, a short
    // vertical front, an underside at 36° and a fillet where it meets the face it hangs on.
    // A tab is part of the compartment shape: above its underside the compartment is a shorter
    // rounded box, so the tab's front meets walls and dividers with the same rounded corners.
    const tan = Math.tan((G.tabAngle * Math.PI) / 180);
    const Lt = P.label ? Math.min(G.tabDepth, cl * 0.6, (zTop - G.tabFront - zFloor - 1.5) / tan) : 0;
    const tabRows = Lt >= 3 ? (P.labelRows ? [...Array(P.cy).keys()] : [P.cy - 1]) : [];
    // How far the lip reaches in past the wall face at the height of a tab's front face.
    const zF0 = zTop - G.tabFront;
    const lipIn = Math.max(0, (P.lipStyle === 'thin'
      ? 1.9
      : P.lipStyle === 'standard'
        ? Math.min(...[0, 0.25, 0.5, 0.75, 1].map((k) => body.fn(zF0 + k * G.tabFront)))
        : P.wall) - P.wall);

    if (zTop > zFloor + 0.5 && (P.cx > 1 || P.cy > 1 || rounded || tabRows.length)) {
      // Above the divider top everything is open, except that with the thin lip the band runs
      // straight down to the top of a divider or label tab where it meets the wall (no groove
      // under it).
      const open0 = P.lipStyle === 'thin'
        ? loft(sampleProfile((z) => (z <= H + 2.5 ? 1.9 : body.fn(z)), zTop, topZ + 2, body.breaks), 0, 0, W, L)
        : keep(keep(M.cube([W + 4, L + 4, topZ + 2 - zTop], false)).translate([-W / 2 - 2, -L / 2 - 2, zTop]));
      const boxes = [];
      const rr = rounded ? r : 0.01;
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
          pts.push(...ringPoints(x0, y0, cw, cl, 0, topZ + 1, rr, 0.01));
          let box = keep(M.hull(pts));
          if (tabRows.includes(j)) {
            const yB = rowFront(j) + cl;                 // back face of the row (wall or divider)
            const yF = yB - Lt;                          // tab front face
            const zF = zTop - G.tabFront;                // bottom of the front face
            const zK = zF - Lt * tan;                    // underside meets the back face
            const lF = yF - rowFront(j);
            // At the height of the tab's front face the compartment is a shorter rounded box,
            // which rounds the front face's vertical edges; below that it is the full box.
            // Next to an outer wall the rounding is taken from where the lip starts (the ledge of
            // the standard lip, the band of the thin lip), not from the wall face, so it is not
            // hidden in the lip. Just in front of the tab the box therefore steps in from the
            // wall to that line along a rounded S-curve.
            const prism = (cx, cy, w, l, rad) => keep(M.hull([
              ...ringPoints(cx, cy, w, l, 0, zF - 0.05, rad, 0.01),
              ...ringPoints(cx, cy, w, l, 0, topZ + 1, rad, 0.01),
            ]));
            const dl = i === 0 ? lipIn : 0, dr = i === P.cx - 1 ? lipIn : 0;
            let shorter;
            if (dl + dr > 0.05 && lF > 2 * rr + lipIn + 2) {
              const xL = colLeft(i), xR = xL + cw;
              const yA = rowFront(j) - 1, yS = yF - rr;  // full-width part ends one radius before the tab
              const full = prism((xL + xR) / 2, (yA + yS) / 2, cw, yS - yA, lipIn);
              const y2 = Math.max(yA, yF - rr - lipIn - 2 * rr - 2);
              const inner = prism((xL + dl + xR - dr) / 2, (y2 + yF) / 2, cw - dl - dr, yF - y2, rr);
              shorter = keep(full.add(inner));
            } else {
              shorter = prism(x0, rowFront(j) + lF / 2, cw, lF, rr);
            }
            const frontLow = keep(keep(M.cube([cw + 2, lF + 2, zF - zFloor + 2], false))
              .translate([x0 - cw / 2 - 1, rowFront(j) - 2, zFloor - 2]));
            // Space under the tab. It starts 0.05 mm in front of the tab so it overlaps the
            // parts in front instead of just touching them (no zero-thickness wall between).
            const under = [];
            for (const [y, z] of [[yF - 0.05, zFloor - 2], [yF - 0.05, zF], [yF, zF], [yB + 1, zK - tan], [yB + 1, zFloor - 2]]) {
              under.push([x0 - cw / 2 - 1, y, z], [x0 + cw / 2 + 1, y, z]);
            }
            // Above the tab top: the full box limited like the open region, so the corners there
            // stay rounded too.
            box = keep(box.intersect(unionAll([keep(M.hull(under)), frontLow, shorter, open0])));
          }
          boxes.push(box);
        }
      }

      let open = open0;

      // Raised dividers (on grid lines) stay solid up to their own top, and so do the corners
      // next to them (at the walls and where two raised dividers cross), so their fillets run
      // all the way up with them.
      const layout = dividerLayout(P);
      const t2 = P.divT / 2, pad = (rounded ? r : 0) + 0.3;
      const block = (x0, y0, x1, y1, z1) =>
        keep(keep(M.cube([x1 - x0, y1 - y0, z1 - zTop + 1], false)).translate([x0, y0, zTop - 1]));
      const zones = [];
      for (const d of layout.xs) {
        if (!d.top) continue;
        zones.push(block(d.pos - t2, -L / 2 - 1, d.pos + t2, L / 2 + 1, d.top));
        zones.push(block(d.pos - t2 - pad, -L / 2 - 1, d.pos + t2 + pad, -Li / 2 + pad, d.top));
        zones.push(block(d.pos - t2 - pad, Li / 2 - pad, d.pos + t2 + pad, L / 2 + 1, d.top));
      }
      for (const d of layout.ys) {
        if (!d.top) continue;
        zones.push(block(-W / 2 - 1, d.pos - t2, W / 2 + 1, d.pos + t2, d.top));
        zones.push(block(-W / 2 - 1, d.pos - t2 - pad, -Wi / 2 + pad, d.pos + t2 + pad, d.top));
        zones.push(block(Wi / 2 - pad, d.pos - t2 - pad, W / 2 + 1, d.pos + t2 + pad, d.top));
      }
      for (const a of layout.xs) {
        for (const b of layout.ys) {
          if (a.top && b.top) {
            zones.push(block(a.pos - t2 - pad, b.pos - t2 - pad, a.pos + t2 + pad, b.pos + t2 + pad, Math.min(a.top, b.top)));
          }
        }
      }
      if (zones.length) open = keep(open.subtract(unionAll(zones)));
      cavity = keep(cavity.intersect(unionAll([...boxes, open])));
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

    // Fillet where a label tab's underside meets the face it hangs on.
    if (tabRows.length) {
      const xa = -Wi / 2 - 0.5, xb = Wi / 2 + 0.5;
      const rf = Math.min(P.fillet, Lt * 0.4);
      for (const j of tabRows) {
        const y1 = rowFront(j) + cl;                 // back face of the row (wall or divider)
        const zK = zTop - G.tabFront - Lt * tan;     // underside meets the back face
        if (rf >= 0.2) {
          // fillet in the (90° + angle) corner between the underside and the back face
          const half = ((90 + G.tabAngle) / 2) * (Math.PI / 180);
          const t = rf / Math.tan(half), d = rf / Math.sin(half);
          const a = (G.tabAngle * Math.PI) / 180;
          const u1 = [-Math.cos(a), Math.sin(a)];    // along the underside, toward the tip
          const bl = Math.hypot(u1[0], u1[1] - 1);
          const bis = [u1[0] / bl, (u1[1] - 1) / bl];
          const T1 = [y1, zK - t], T2 = [y1 + t * u1[0], zK + t * u1[1]];
          const C = [y1 + d * bis[0], zK + d * bis[1]];
          const wpts = [];
          for (const [y, z] of [[y1 + 0.3, zK], T1, [y1 + 0.3, T1[1]], T2, [y1, zK]]) wpts.push([xa, y, z], [xb, y, z]);
          const web = keep(M.hull(wpts));
          const cyl = keep(keep(keep(M.cylinder(xb - xa + 2, rf, rf, 48, true)).rotate([0, 90, 0])).translate([0, C[0], C[1]]));
          adds.push(keep(web.subtract(cyl)));
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
