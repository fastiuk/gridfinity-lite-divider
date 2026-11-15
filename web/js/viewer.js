import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const css = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// 3D preview: Z up, grid of 42 mm cells under the bin, optional section plane.
// Returns null when WebGL is not available.
export function createViewer(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.addEventListener('change', () => render());

  const hemi = new THREE.HemisphereLight(0xffffff, 0x3c4650, 1.5);
  hemi.position.set(0, 0, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(140, -220, 300);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  rim.position.set(-180, 160, 90);
  scene.add(rim);

  // Faces seen from inside are drawn flat and darker, so a section reads as a solid cut.
  const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const front = new THREE.MeshStandardMaterial({
    roughness: 0.62, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const back = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
  const edgeMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.32 });
  const gridMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 });
  const plateMat = new THREE.MeshBasicMaterial();

  let modelGroup = null;
  let gridGroup = null;
  let dims = [83.5, 83.5, 46];
  let section = { mode: 'off', pos: 0 };

  const dispose = (group) => {
    if (!group) return;
    scene.remove(group);
    group.traverse((o) => o.geometry && o.geometry.dispose());
  };

  function applyTheme() {
    renderer.setClearColor(new THREE.Color(css('--stage', '#dde3e8')));
    front.color.set(css('--model', '#ee7a33'));
    back.color.set(css('--model-back', '#8a3a12'));
    edgeMat.color.set(css('--edge', '#6b2c0b'));
    gridMat.color.set(css('--grid', '#aab6c0'));
    plateMat.color.set(css('--plate', '#d3dae0'));
    render();
  }

  function buildGrid(ux, uy) {
    dispose(gridGroup);
    gridGroup = new THREE.Group();
    const x0 = -(ux / 2 + 1) * 42, x1 = (ux / 2 + 1) * 42;
    const y0 = -(uy / 2 + 1) * 42, y1 = (uy / 2 + 1) * 42;
    const pts = [];
    for (let k = 0; k <= ux + 2; k++) { const x = x0 + k * 42; pts.push(x, y0, 0, x, y1, 0); }
    for (let k = 0; k <= uy + 2; k++) { const y = y0 + k * 42; pts.push(x0, y, 0, x1, y, 0); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(g, gridMat);
    lines.position.z = -0.4;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), plateMat);
    plate.position.z = -0.6;
    gridGroup.add(plate, lines);
    scene.add(gridGroup);
  }

  function setModel(pos, newDims, ux, uy) {
    dispose(modelGroup);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    modelGroup = new THREE.Group();
    modelGroup.add(new THREE.Mesh(g, front), new THREE.Mesh(g, back));
    modelGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 28), edgeMat));
    scene.add(modelGroup);
    dims = newDims;
    buildGrid(ux, uy);
    applySection();
  }

  function fit() {
    const [W, L, H] = dims;
    const radius = Math.hypot(W, L, H) / 2;
    const dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.08;
    controls.target.set(0, 0, H * 0.38);
    const dir = new THREE.Vector3(0.85, -1.4, 1.1).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, dist);
    camera.near = Math.max(0.5, dist / 200);
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    controls.update();
    render();
  }

  function applySection() {
    const planes = section.mode === 'off' ? [] : [clipPlane];
    if (section.mode === 'x') {
      clipPlane.normal.set(-1, 0, 0);
      clipPlane.constant = (section.pos / 100) * (dims[0] / 2 + 0.01);
    } else if (section.mode === 'y') {
      clipPlane.normal.set(0, 1, 0);
      clipPlane.constant = -(section.pos / 100) * (dims[1] / 2 + 0.01);
    }
    for (const m of [front, back, edgeMat]) { m.clippingPlanes = planes; m.needsUpdate = true; }
    render();
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  }

  let raf = 0;
  function render() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; renderer.render(scene, camera); });
  }

  new ResizeObserver(resize).observe(canvas);
  applyTheme();
  resize();

  return {
    setModel,
    fit,
    applyTheme,
    setSection(mode, pos) { section = { mode, pos }; applySection(); },
  };
}
