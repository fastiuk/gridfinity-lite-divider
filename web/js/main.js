import { DEFAULTS, G, buildBin, compartmentSize, fileBase, maxComp, meshPositions, outerSize, sanitize } from './geometry.js';
import { binarySTL } from './stl.js';
import { loadKernel } from './kernel.js';
import { createViewer } from './viewer.js';
import { fmt, getLang, setLang, t } from './i18n.js';

const $ = (id) => document.getElementById(id);
const INTS = ['ux', 'uy', 'uz', 'cx', 'cy'];
const FLOATS = ['magD', 'wall', 'floor', 'divT', 'divLower', 'scoopR', 'fillet'];
const BOOLS = ['label', 'labelRows', 'scoop', 'magnets', 'screws'];

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('gfld:' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('gfld:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

let kernel = null;
let viewer = null;
let current = null;          // last generated model: { pos, P, dims, volume, tris }
let lastSizeKey = '';
let timer = 0;
let genSeq = 0;

/* ---------- form <-> parameters ---------- */
// Missing controls are skipped, so the form never breaks the page if the markup and the
// script come from different releases.
function setField(id, prop, value) {
  const el = $(id);
  if (el) el[prop] = value;
}

function writeForm(P) {
  for (const k of [...INTS, ...FLOATS]) setField(k, 'value', P[k]);
  for (const k of BOOLS) setField(k, 'checked', !!P[k]);
  setField('base-lite', 'checked', P.lite);
  setField('base-std', 'checked', !P.lite);
  setField('lip-' + P.lipStyle, 'checked', true);
}

function readForm() {
  const raw = {};
  for (const k of [...INTS, ...FLOATS]) {
    const el = $(k);
    if (el) raw[k] = parseFloat(String(el.value).replace(',', '.'));
  }
  for (const k of BOOLS) {
    const el = $(k);
    if (el) raw[k] = el.checked;
  }
  raw.lite = $('base-lite').checked;
  const lip = document.querySelector('input[name="lip"]:checked');
  raw.lipStyle = lip ? lip.value : DEFAULTS.lipStyle;
  return sanitize(raw);
}

/* ---------- labels ---------- */
function setStatus(kind, text) {
  const el = $('status');
  el.classList.toggle('busy', kind === 'busy');
  el.classList.toggle('err', kind === 'err');
  $('status-text').textContent = text;
}

function refreshLabels() {
  const P = readForm();
  const { W, L, H, lipH } = outerSize(P);
  $('ux-sub').textContent = t('unitW', { u: P.ux, mm: fmt(W) });
  $('uy-sub').textContent = t('unitW', { u: P.uy, mm: fmt(L) });
  $('uz-sub').textContent = lipH
    ? t('unitHLip', { u: P.uz, mm: fmt(H, 0), lip: fmt(lipH) })
    : t('unitH', { u: P.uz, mm: fmt(H, 0) });
  setField('lip-hint', 'textContent', t({ standard: 'lipStdHint', thin: 'lipThinHint', none: 'lipNoneHint' }[P.lipStyle]));
  $('base-hint').textContent = P.lite ? t('liteHint') : t('stdHint');
  $('std-only').hidden = P.lite;
  $('floor-wrap').hidden = !P.lite;
  $('scoop-note').hidden = !(P.lite && P.scoop);
  const mx = maxComp(P.ux, P.wall), my = maxComp(P.uy, P.wall);
  $('cx').max = mx;
  $('cy').max = my;
  if ((parseInt($('cx').value, 10) || 1) > mx) $('cx').value = mx;
  if ((parseInt($('cy').value, 10) || 1) > my) $('cy').value = my;
  const [cw, cl] = compartmentSize(P);
  $('comp-hint').textContent = t('compHint', { w: fmt(cw), l: fmt(cl), mx, my });
  const rowsOk = P.label && P.cy > 1;
  $('labelRows').disabled = !rowsOk;
  $('labelRows-wrap').classList.toggle('disabled', !rowsOk);
  $('fname').textContent = fileBase(P) + '.stl';
}

function updateHud(c) {
  const [W, L, H] = c.dims;
  $('hud-dims').textContent = `${fmt(W)} × ${fmt(L)} × ${fmt(H)}`;
  $('hud-vol').textContent = `${fmt(c.volume / 1000)} ${t('cm3')}`;
  $('hud-mass').textContent = `≈ ${fmt((c.volume / 1000) * 1.24, 0)} ${t('g')}`;
  $('hud-tris').textContent = c.tris.toLocaleString(getLang() === 'uk' ? 'uk-UA' : 'en-US');
}

function applyI18n() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('lang-uk').setAttribute('aria-pressed', String(lang === 'uk'));
  $('lang-en').setAttribute('aria-pressed', String(lang === 'en'));
  refreshLabels();
  if (current) updateHud(current);
}

/* ---------- generation ---------- */
function schedule(delay = 180) {
  clearTimeout(timer);
  timer = setTimeout(generate, delay);
}

async function generate() {
  if (!kernel) return;
  const P = readForm();
  store.set('params', P);
  const seq = ++genSeq;
  setStatus('busy', t('gen'));
  $('download').disabled = true;
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));   // let the status paint
  if (seq !== genSeq) return;
  const t0 = performance.now();
  try {
    const out = buildBin(kernel.Manifold, P);
    const pos = meshPositions(out.mesh);
    current = { pos, P, dims: out.dims, volume: out.volume, tris: out.tris };
    if (viewer) {
      viewer.setModel(pos.slice(), out.dims, P.ux, P.uy);
      const sizeKey = `${P.ux}x${P.uy}x${P.uz}`;
      if (sizeKey !== lastSizeKey) { lastSizeKey = sizeKey; viewer.fit(); }
    }
    updateHud(current);
    if (viewer) setStatus('ok', t('ready', { ms: Math.round(performance.now() - t0) }));
    else setStatus('err', t('webglFail'));
    $('download').disabled = false;
  } catch (e) {
    console.error(e);
    setStatus('err', t('err', { msg: e && e.message ? e.message : String(e) }));
  }
}

function download() {
  if (!current) return;
  const base = fileBase(current.P);
  const url = URL.createObjectURL(new Blob([binarySTL(current.pos, base)], { type: 'model/stl' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = base + '.stl';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- wiring ---------- */
function wire() {
  document.querySelectorAll('[data-step]').forEach((b) => {
    b.addEventListener('click', () => {
      const input = $(b.dataset.for);
      const v = (parseInt(input.value, 10) || 0) + parseInt(b.dataset.step, 10);
      input.value = Math.min(parseInt(input.max, 10), Math.max(parseInt(input.min, 10), v));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  const onChange = (e) => {
    if (e.type === 'change') writeForm(readForm());    // normalise what was typed
    refreshLabels();
    schedule(e.type === 'input' && e.target.type === 'number' ? 450 : 120);
  };
  document.querySelectorAll('.rail input').forEach((el) => {
    el.addEventListener('change', onChange);
    if (el.type === 'number') el.addEventListener('input', onChange);
  });

  $('download').addEventListener('click', download);
  $('reset-params').addEventListener('click', () => {
    writeForm(DEFAULTS);
    refreshLabels();
    schedule(0);
  });

  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    setLang(b.dataset.lang);
    store.set('lang', getLang());
    applyI18n();
  }));

  const secMode = $('sec-mode'), secPos = $('sec-pos');
  const onSection = () => {
    secPos.disabled = secMode.value === 'off';
    if (viewer) viewer.setSection(secMode.value, parseInt(secPos.value, 10));
  };
  secMode.addEventListener('change', onSection);
  secPos.addEventListener('input', onSection);
  $('reset-view').addEventListener('click', () => viewer && viewer.fit());

  const retheme = () => viewer && viewer.applyTheme();
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (store.get('adv')) $('adv').open = true;
  $('adv').addEventListener('toggle', () => store.set('adv', $('adv').open));
}

async function main() {
  const savedLang = store.get('lang');
  setLang(savedLang || ((navigator.language || '').toLowerCase().startsWith('uk') ? 'uk' : 'en'));
  const saved = store.get('params');
  writeForm(sanitize(saved && typeof saved === 'object' ? saved : DEFAULTS));
  viewer = createViewer($('view'));
  wire();
  applyI18n();
  setStatus('busy', t('loading'));
  try {
    kernel = await loadKernel();
  } catch (e) {
    console.error(e);
    setStatus('err', t('kernelFail', { msg: e && e.message ? e.message : String(e) }));
    return;
  }
  await generate();
}

// Exposed for the browser test page and for debugging from the console.
window.gridfinity = { G, buildBin, sanitize, get kernel() { return kernel; } };

main();
