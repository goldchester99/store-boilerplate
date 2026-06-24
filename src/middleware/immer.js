/**
 * Immer middleware — opsional, tidak aktif secara default.
 * Aktifkan per store dengan useImmer: true.
 *
 * Karena immer adalah optional peer dependency, middleware ini:
 * 1. Lazy-load immer via dynamic import dengan /* @vite-ignore *​/ supaya
 *    bundler (Vite/Rollup) TIDAK mencoba resolve saat build — library tetap
 *    bisa dimuat meski immer belum diinstall.
 * 2. Punya fallback dependency-free (draftClone) yang BENAR — kalau immer
 *    belum/tidak tersedia, mutable draft pattern tetap jalan tanpa merusak state.
 *
 * Interface: (setState, getState) => wrappedSetState
 *
 * @param {function} setState - setState dari vanilla store
 * @param {function} getState - getState dari vanilla store
 * @returns {function} wrappedSetState
 *
 * @example
 * createStore('cart', {
 *   useImmer: true,
 *   actions: (set) => ({
 *     addItem: (item) => set((draft) => { draft.items.push(item); }),
 *   }),
 * });
 */

let produce = null;
let immerPromise = null;

function loadImmer() {
  if (produce || immerPromise) return immerPromise;
  // Specifier disimpan di variable (bukan string literal) supaya bundler
  // TIDAK bisa menganalisis & resolve 'immer' secara statis saat build.
  // Dikombinasi /* @vite-ignore */ agar Vite tidak warn. Ini cara kanonik
  // untuk optional dynamic import yang tidak memecah build saat dep absen.
  const specifier = 'immer';
  immerPromise = import(/* @vite-ignore */ specifier)
    .then((mod) => {
      produce = mod.produce ?? mod.default?.produce ?? null;
    })
    .catch(() => {
      produce = null; // immer belum diinstall — pakai fallback draftClone
    });
  return immerPromise;
}

export function immerMiddleware(setState, getState) {
  loadImmer(); // mulai load di background

  return function wrappedSetState(partial) {
    // Update biasa (object) — teruskan langsung
    if (typeof partial !== 'function') {
      return setState(partial);
    }

    // Functional update gaya immer (mutate draft)
    if (produce) {
      setState(produce(getState(), partial));
      return;
    }

    // Fallback dependency-free: deep clone state jadi draft, jalankan updater,
    // lalu set hasilnya. Kalau updater mutate draft (gaya immer) dan tidak
    // return apa-apa, kita pakai draft yang sudah dimutate.
    const draft = draftClone(getState());
    const result = partial(draft);
    setState(result === undefined ? draft : result);
  };
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Batas kedalaman rekursi — cegah stack overflow pada state nested ekstrem (DoS).
const MAX_DEPTH = 100;

/**
 * Deep clone yang aman: salin data, pertahankan function by reference
 * (action functions tidak bisa di-clone), dan strip key berbahaya.
 */
function draftClone(value, depth = 0) {
  // Di batas kedalaman, kembalikan by reference (jangan korup data jadi null)
  if (depth > MAX_DEPTH) return value;

  if (Array.isArray(value)) {
    return value.map((v) => draftClone(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      out[key] = draftClone(value[key], depth + 1);
    }
    return out;
  }
  // primitive & function — by reference
  return value;
}
