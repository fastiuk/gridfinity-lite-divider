// STEP (ISO 10303-21, AP214) writer for a closed triangle mesh.
//
// The solid is written as a B-rep with planar faces: neighbouring triangles that lie in one plane
// are merged into a single face (with holes where needed), so walls, floors and chamfers become
// whole faces. Curved surfaces (fillets, scoops, holes) stay as strips of narrow planar faces.

const PLANE_DOT = 1 - 1e-6;   // normals this close count as parallel
const PLANE_DIST = 1e-4;      // mm: max distance of a vertex from the face plane

const fmt = (x, digits = 6) => {
  if (Math.abs(x) < 0.5 * 10 ** -digits) return '0.';
  const s = x.toFixed(digits).replace(/0+$/, '');
  return s;
};

export function meshToStep(mesh, name = 'gridfinity') {
  const np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
  const nT = tv.length / 3, nV = vp.length / np;
  const X = (i) => vp[i * np], Y = (i) => vp[i * np + 1], Z = (i) => vp[i * np + 2];

  // ---- triangle planes
  const nx = new Float64Array(nT), ny = new Float64Array(nT), nz = new Float64Array(nT), nd = new Float64Array(nT);
  for (let t = 0; t < nT; t++) {
    const a = tv[3 * t], b = tv[3 * t + 1], c = tv[3 * t + 2];
    const ux = X(b) - X(a), uy = Y(b) - Y(a), uz = Z(b) - Z(a);
    const vx = X(c) - X(a), vy = Y(c) - Y(a), vz = Z(c) - Z(a);
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    const len = Math.hypot(x, y, z) || 1;
    x /= len; y /= len; z /= len;
    nx[t] = x; ny[t] = y; nz[t] = z; nd[t] = x * X(a) + y * Y(a) + z * Z(a);
  }

  // ---- directed edge u->v  ->  triangle
  const edgeKey = (u, v) => u * nV + v;
  const edgeTri = new Map();
  for (let t = 0; t < nT; t++) {
    for (let k = 0; k < 3; k++) edgeTri.set(edgeKey(tv[3 * t + k], tv[3 * t + (k + 1) % 3]), t);
  }

  // ---- group coplanar, edge-connected triangles into faces
  const group = new Int32Array(nT).fill(-1);
  const groups = [];
  for (let seed = 0; seed < nT; seed++) {
    if (group[seed] !== -1) continue;
    const g = groups.length;
    const members = [seed];
    group[seed] = g;
    for (let q = 0; q < members.length; q++) {
      const t = members[q];
      for (let k = 0; k < 3; k++) {
        const s = edgeTri.get(edgeKey(tv[3 * t + (k + 1) % 3], tv[3 * t + k]));
        if (s === undefined || group[s] !== -1) continue;
        if (nx[s] * nx[seed] + ny[s] * ny[seed] + nz[s] * nz[seed] < PLANE_DOT) continue;
        let flat = true;
        for (let j = 0; j < 3 && flat; j++) {
          const p = tv[3 * s + j];
          flat = Math.abs(nx[seed] * X(p) + ny[seed] * Y(p) + nz[seed] * Z(p) - nd[seed]) < PLANE_DIST;
        }
        if (!flat) continue;
        group[s] = g;
        members.push(s);
      }
    }
    groups.push(members);
  }

  // ---- STEP entities
  const lines = [];
  let id = 0;
  const add = (text) => { id += 1; lines.push(`#${id}=${text};`); return id; };
  const point = (x, y, z) => add(`CARTESIAN_POINT('',(${fmt(x)},${fmt(y)},${fmt(z)}))`);
  const dir = (x, y, z) => add(`DIRECTION('',(${fmt(x, 9)},${fmt(y, 9)},${fmt(z, 9)}))`);

  const vertexId = new Map();
  const vertex = (i) => {
    let v = vertexId.get(i);
    if (v === undefined) {
      v = add(`VERTEX_POINT('',#${point(X(i), Y(i), Z(i))})`);
      vertexId.set(i, v);
    }
    return v;
  };
  const edgeCurve = new Map();   // undirected key -> { id, from }
  const orientedEdge = (u, v) => {
    const key = u < v ? edgeKey(u, v) : edgeKey(v, u);
    let e = edgeCurve.get(key);
    if (!e) {
      const dx = X(v) - X(u), dy = Y(v) - Y(u), dz = Z(v) - Z(u);
      const len = Math.hypot(dx, dy, dz) || 1;
      const vec = add(`VECTOR('',#${dir(dx / len, dy / len, dz / len)},${fmt(len)})`);
      const line = add(`LINE('',#${point(X(u), Y(u), Z(u))},#${vec})`);
      e = { id: add(`EDGE_CURVE('',#${vertex(u)},#${vertex(v)},#${line},.T.)`), from: u };
      edgeCurve.set(key, e);
    }
    return add(`ORIENTED_EDGE('',*,*,#${e.id},${e.from === u ? '.T.' : '.F.'})`);
  };

  const faceIds = [];
  let innerLoops = 0;

  // Planar face with the given loops (vertex index arrays, first one is the outer boundary).
  const emitFace = (loops, n) => {
    // reference direction: any unit vector perpendicular to the normal
    const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let rx = ax[1] * n[2] - ax[2] * n[1], ry = ax[2] * n[0] - ax[0] * n[2], rz = ax[0] * n[1] - ax[1] * n[0];
    const rl = Math.hypot(rx, ry, rz);
    rx /= rl; ry /= rl; rz /= rl;
    const o = loops[0][0];
    const place = add(`AXIS2_PLACEMENT_3D('',#${point(X(o), Y(o), Z(o))},#${dir(n[0], n[1], n[2])},#${dir(rx, ry, rz)})`);
    const plane = add(`PLANE('',#${place})`);
    const bounds = loops.map((loop, li) => {
      const oes = loop.map((u, k) => orientedEdge(u, loop[(k + 1) % loop.length]));
      const el = add(`EDGE_LOOP('',(${oes.map((x) => '#' + x).join(',')}))`);
      return add(`${li === 0 ? 'FACE_OUTER_BOUND' : 'FACE_BOUND'}('',#${el},.T.)`);
    });
    innerLoops += loops.length - 1;
    faceIds.push(add(`ADVANCED_FACE('',(${bounds.map((x) => '#' + x).join(',')}),#${plane},.T.)`));
  };

  for (const members of groups) {
    const seed = members[0];
    const n = [nx[seed], ny[seed], nz[seed]];
    if (members.length === 1) {
      emitFace([[tv[3 * seed], tv[3 * seed + 1], tv[3 * seed + 2]]], n);
      continue;
    }
    // boundary edges (in triangle winding order: outer loop CCW around n, holes CW)
    const g = group[seed];
    const out = new Map();
    let count = 0;
    for (const t of members) {
      for (let k = 0; k < 3; k++) {
        const u = tv[3 * t + k], v = tv[3 * t + (k + 1) % 3];
        if (group[edgeTri.get(edgeKey(v, u))] === g) continue;
        if (!out.has(u)) out.set(u, []);
        out.get(u).push(v);
        count++;
      }
    }
    // A face that touches itself at a vertex has no simple boundary loops: write its triangles
    // as separate faces, which is always valid.
    let pinched = false;
    for (const list of out.values()) if (list.length > 1) { pinched = true; break; }
    if (pinched) {
      for (const t of members) emitFace([[tv[3 * t], tv[3 * t + 1], tv[3 * t + 2]]], [nx[t], ny[t], nz[t]]);
      continue;
    }
    // 2D frame in the face plane, used to pick edges at pinch vertices and to tell holes apart
    const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let ex = [ax[1] * n[2] - ax[2] * n[1], ax[2] * n[0] - ax[0] * n[2], ax[0] * n[1] - ax[1] * n[0]];
    const el = Math.hypot(...ex);
    ex = ex.map((c) => c / el);
    const ey = [n[1] * ex[2] - n[2] * ex[1], n[2] * ex[0] - n[0] * ex[2], n[0] * ex[1] - n[1] * ex[0]];
    const p2 = (i) => [X(i) * ex[0] + Y(i) * ex[1] + Z(i) * ex[2], X(i) * ey[0] + Y(i) * ey[1] + Z(i) * ey[2]];

    const loops = [];
    let used = 0, broken = false;
    for (const [start, list] of out) {
      while (list.length) {
        const loop = [start];
        let prev = start, cur = list.pop();
        used++;
        while (cur !== start) {
          loop.push(cur);
          const cand = out.get(cur);
          if (!cand || !cand.length) { broken = true; break; }
          let pick = 0;
          if (cand.length > 1) {
            // keep the face on the left: take the smallest clockwise turn from the way back
            const [cx, cy] = p2(cur), [px, py] = p2(prev);
            const back = Math.atan2(py - cy, px - cx);
            let best = -1;
            cand.forEach((w, i) => {
              const [wx, wy] = p2(w);
              let a = Math.atan2(wy - cy, wx - cx) - back;
              while (a <= 0) a += 2 * Math.PI;
              if (a > best) { best = a; pick = i; }
            });
          }
          prev = cur;
          cur = cand.splice(pick, 1)[0];
          used++;
        }
        loops.push(loop);
      }
    }
    // signed area in the face plane: positive = outer boundary
    const area = (loop) => {
      let s = 0;
      for (let k = 0; k < loop.length; k++) {
        const [x1, y1] = p2(loop[k]), [x2, y2] = p2(loop[(k + 1) % loop.length]);
        s += x1 * y2 - x2 * y1;
      }
      return s / 2;
    };
    const outer = loops.filter((l) => area(l) > 0);
    const holes = loops.filter((l) => area(l) <= 0);
    if (broken || used !== count || outer.length !== 1) {
      // unusual topology: fall back to one face per triangle, which is always valid
      for (const t of members) emitFace([[tv[3 * t], tv[3 * t + 1], tv[3 * t + 2]]], [nx[t], ny[t], nz[t]]);
      continue;
    }
    emitFace([outer[0], ...holes], n);
  }

  const shell = add(`CLOSED_SHELL('',(${faceIds.map((x) => '#' + x).join(',')}))`);
  const brep = add(`MANIFOLD_SOLID_BREP('${name}',#${shell})`);

  // ---- product structure, units (mm) and context
  const appCtx = add(`APPLICATION_CONTEXT('core data for automotive mechanical design processes')`);
  add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${appCtx})`);
  const prodCtx = add(`PRODUCT_CONTEXT('',#${appCtx},'mechanical')`);
  const pdCtx = add(`PRODUCT_DEFINITION_CONTEXT('part definition',#${appCtx},'design')`);
  const product = add(`PRODUCT('${name}','${name}','',(#${prodCtx}))`);
  add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(#${product}))`);
  const formation = add(`PRODUCT_DEFINITION_FORMATION('','',#${product})`);
  const pd = add(`PRODUCT_DEFINITION('design','',#${formation},#${pdCtx})`);
  const pds = add(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);
  const mm = add(`( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )`);
  const rad = add(`( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )`);
  const sr = add(`( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )`);
  const unc = add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-04),#${mm},'distance_accuracy_value','confusion accuracy')`);
  const ctx = add(`( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${unc})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${mm},#${rad},#${sr})) REPRESENTATION_CONTEXT('Context','3D Context with UNIT and UNCERTAINTY') )`);
  const origin = add(`AXIS2_PLACEMENT_3D('',#${point(0, 0, 0)},#${dir(0, 0, 1)},#${dir(1, 0, 0)})`);
  const rep = add(`ADVANCED_BREP_SHAPE_REPRESENTATION('${name}',(#${origin},#${brep}),#${ctx})`);
  add(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${rep})`);

  const stamp = new Date().toISOString().slice(0, 19);
  const text = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('Gridfinity bin'),'2;1');",
    `FILE_NAME('${name}.step','${stamp}',(''),(''),'gridfinity-lite-divider','','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    'ENDSEC;',
    'DATA;',
    ...lines,
    'ENDSEC;',
    'END-ISO-10303-21;',
    '',
  ].join('\n');

  return {
    text,
    stats: { faces: faceIds.length, edges: edgeCurve.size, vertices: vertexId.size, innerLoops },
  };
}
