const STR = {
  uk: {
    lede: 'Контейнери Gridfinity, де легка порожниста основа поєднана з перегородками на відсіки. Модель рахується прямо в браузері, нічого не відправляється на сервер.',
    size: 'Розмір', width: 'Ширина (X)', length: 'Довжина (Y)', height: 'Висота',
    unitW: '{u} × 42 мм → {mm} мм', unitH: '{u} × 7 мм = {mm} мм', unitHLip: '{u} × 7 мм = {mm} мм + кромка {lip} мм',
    base: 'Основа', lite: 'Легка', liteShort: 'порожниста, тонкі стінки', std: 'Стандартна', stdShort: 'суцільна, 7 мм',
    liteHint: 'Ніжки порожні зсередини, стінки однакової товщини по всьому профілю. Менше пластику й глибші відсіки. Магніти та гвинти тут не передбачені.',
    stdHint: 'Класична суцільна основа: дно на висоті 7 мм, можна додати отвори під магніти 6×2 мм і гвинти M3.',
    magnets: 'Отвори під магніти (4 на клітинку)', screws: 'Отвори під гвинти M3', magD: 'Діаметр отвору під магніт, мм',
    comp: 'Відсіки', compX: 'По ширині', compY: 'По довжині',
    compHint: 'Відсік ≈ {w} × {l} мм. Максимум: {mx} × {my}.',
    features: 'Деталі', lip: 'Кромка для штабелювання', label: 'Полиця для етикетки', labelRows: 'Етикетка в кожному ряду відсіків',
    scoop: 'Ківш: пологий спуск біля передньої стінки кожного ряду',
    scoopNote: 'У легкій основі ківш суцільний і заповнює частину порожнини під собою, тож економія пластику менша.',
    advanced: 'Тонке налаштування', wall: 'Товщина стінок, мм', floor: 'Товщина дна легкої основи, мм', divT: 'Товщина перегородок, мм',
    divLower: 'Опустити перегородки, мм', scoopR: 'Радіус ковша, мм (0 = авто)',
    advHint: 'Товщина стінок рахується по горизонталі, як її бачить слайсер. Для сопла 0,4 мм 0,8–1,0 мм дає дві лінії периметра.',
    resetParams: 'Скинути всі параметри',
    spec1: 'Профіль ніжки: 0,8 / 1,8 / 2,15 мм під 45°. Кромка: 0,7 / 1,8 / 1,9 мм.',
    spec2: 'Сітка 42 × 42 мм, зазор 0,5 мм, крок висоти 7 мм.',
    credit: 'Ідея й параметри за зразком',
    source: 'Код на GitHub',
    download: 'Завантажити STL',
    gen: 'Генерую модель…', ready: 'Готово за {ms} мс', err: 'Помилка генерації: {msg}',
    loading: 'Завантажую геометричне ядро…', kernelFail: 'Не вдалося запустити геометричне ядро (WebAssembly): {msg}',
    webglFail: 'Цей браузер не підтримує WebGL, тож 3D-перегляд недоступний. Експорт STL працює.',
    dims: 'Габарити, мм', vol: 'Об’єм', mass: 'PLA, суцільно', tris: 'Трикутників',
    section: 'Розріз', secOff: 'вимкнено', secX: 'поперек X', secY: 'поперек Y', reset: 'Скинути вигляд',
    cm3: 'см³', g: 'г',
  },
  en: {
    lede: 'Gridfinity bins that combine the lightweight hollow base with compartment dividers. The model is computed in your browser; nothing is sent to a server.',
    size: 'Size', width: 'Width (X)', length: 'Length (Y)', height: 'Height',
    unitW: '{u} × 42 mm → {mm} mm', unitH: '{u} × 7 mm = {mm} mm', unitHLip: '{u} × 7 mm = {mm} mm + {lip} mm lip',
    base: 'Base', lite: 'Lite', liteShort: 'hollow, thin walls', std: 'Standard', stdShort: 'solid, 7 mm',
    liteHint: 'The feet are hollow inside and the walls keep one thickness along the whole profile. Less plastic and deeper compartments. No magnet or screw holes.',
    stdHint: 'Classic solid base: the floor sits at 7 mm, with optional holes for 6×2 mm magnets and M3 screws.',
    magnets: 'Magnet holes (4 per cell)', screws: 'M3 screw holes', magD: 'Magnet hole diameter, mm',
    comp: 'Compartments', compX: 'Across width', compY: 'Across length',
    compHint: 'Compartment ≈ {w} × {l} mm. Maximum: {mx} × {my}.',
    features: 'Features', lip: 'Stacking lip', label: 'Label shelf', labelRows: 'Label shelf on every row',
    scoop: 'Scoop: a ramp at the front wall of each row',
    scoopNote: 'With the lite base the scoop is solid and fills part of the hollow under it, so the plastic saving is smaller.',
    advanced: 'Fine tuning', wall: 'Wall thickness, mm', floor: 'Lite base floor thickness, mm', divT: 'Divider thickness, mm',
    divLower: 'Lower dividers by, mm', scoopR: 'Scoop radius, mm (0 = auto)',
    advHint: 'Wall thickness is measured horizontally, the way a slicer sees it. With a 0.4 mm nozzle, 0.8–1.0 mm gives two perimeter lines.',
    resetParams: 'Reset all parameters',
    spec1: 'Foot profile: 0.8 / 1.8 / 2.15 mm at 45°. Lip: 0.7 / 1.8 / 1.9 mm.',
    spec2: 'Grid 42 × 42 mm, 0.5 mm clearance, 7 mm height unit.',
    credit: 'Idea and parameters modelled on',
    source: 'Source on GitHub',
    download: 'Download STL',
    gen: 'Generating model…', ready: 'Done in {ms} ms', err: 'Generation failed: {msg}',
    loading: 'Loading the geometry kernel…', kernelFail: 'Could not start the geometry kernel (WebAssembly): {msg}',
    webglFail: 'This browser has no WebGL, so the 3D preview is unavailable. STL export still works.',
    dims: 'Size, mm', vol: 'Volume', mass: 'PLA, solid', tris: 'Triangles',
    section: 'Section', secOff: 'off', secX: 'across X', secY: 'across Y', reset: 'Reset view',
    cm3: 'cm³', g: 'g',
  },
};

let lang = 'uk';

export const getLang = () => lang;
export const setLang = (l) => { lang = l === 'en' ? 'en' : 'uk'; };

export function t(key, vars) {
  let s = STR[lang][key] ?? STR.en[key] ?? key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}

export function fmt(n, digits = 1) {
  const s = Number(n).toFixed(digits);
  return lang === 'uk' ? s.replace('.', ',') : s;
}
