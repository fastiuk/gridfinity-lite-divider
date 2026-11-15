// Binary STL from non-indexed triangle positions (9 floats per triangle, millimetres).
export function binarySTL(pos, name = 'gridfinity') {
  const n = pos.length / 9;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  const head = ('binary STL ' + name).slice(0, 80);
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i) & 0x7f);
  dv.setUint32(80, n, true);
  let o = 84;
  for (let i = 0; i < n; i++) {
    const b = i * 9;
    const ux = pos[b + 3] - pos[b], uy = pos[b + 4] - pos[b + 1], uz = pos[b + 5] - pos[b + 2];
    const vx = pos[b + 6] - pos[b], vy = pos[b + 7] - pos[b + 1], vz = pos[b + 8] - pos[b + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / len, true);
    dv.setFloat32(o + 4, ny / len, true);
    dv.setFloat32(o + 8, nz / len, true);
    o += 12;
    for (let k = 0; k < 9; k++) { dv.setFloat32(o, pos[b + k], true); o += 4; }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return new Uint8Array(buf);
}
