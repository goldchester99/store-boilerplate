import { createStore } from './createStore.js';

const isDev = () =>
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : true;

/**
 * Gabungkan beberapa slice menjadi satu store.
 * Throw error kalau ada konflik nama antar slice (dev only).
 *
 * Catatan: setiap action factory slice dipanggil TEPAT SEKALI (saat store dibuat).
 * Deteksi konflik nama dilakukan dari key asli hasil pemanggilan itu — tidak ada
 * pemanggilan ganda yang bisa menyebabkan side-effect berjalan dua kali.
 *
 * @param {string} name - nama store hasil gabungan
 * @param {object[]} slices - array slice dari createSlice
 * @param {object} [storeOptions={}] - opsi tambahan diteruskan ke createStore
 * @returns store hook
 *
 * @example
 * const useAppStore = combineSlices('app', [authSlice, uiSlice]);
 */
export function combineSlices(name, slices, storeOptions = {}) {
  // owner: key → nama slice pemilik. Dipakai untuk deteksi konflik lintas
  // state maupun actions. Diisi bertahap: state dulu (di sini), lalu actions
  // (saat combinedActions dijalankan createStore — tetap sinkron, sekali jalan).
  const owner = new Map();

  // Gabungkan semua initial state + cek konflik antar state keys
  const combinedState = {};
  for (const slice of slices) {
    for (const key of Object.keys(slice.state ?? {})) {
      assertNoConflict(owner, key, slice.name);
      combinedState[key] = slice.state[key];
    }
  }

  // Gabungkan actions — factory tiap slice dipanggil SEKALI di sini.
  const combinedActions = (set, get) => {
    const allActions = {};
    for (const slice of slices) {
      const factory = slice.actions ?? (() => ({}));
      const sliceActions = factory(set, get) ?? {};
      for (const key of Object.keys(sliceActions)) {
        assertNoConflict(owner, key, slice.name);
        allActions[key] = sliceActions[key];
      }
    }
    return allActions;
  };

  return createStore(name, {
    ...storeOptions,
    state: combinedState,
    actions: combinedActions,
  });
}

/**
 * Throw kalau key sudah dimiliki slice lain (konflik nama). Hanya aktif di dev.
 * Pencatatan owner tetap jalan di production (murah, tanpa throw).
 */
function assertNoConflict(owner, key, sliceName) {
  if (owner.has(key)) {
    if (isDev()) {
      throw new Error(
        `[store-boilerplate] Konflik nama "${key}" antara slice "${owner.get(key)}" dan "${sliceName}". ` +
          'Ganti salah satu agar tidak bentrok.'
      );
    }
    return;
  }
  owner.set(key, sliceName);
}
