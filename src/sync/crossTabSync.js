import { clearSensitiveData } from '../security/clearSensitiveData.js';
import { STORAGE_PREFIX } from '../core/createPersistentStore.js';

/**
 * Aktifkan cross-tab sync — kalau user logout di satu tab,
 * semua tab lain ikut logout otomatis.
 *
 * Jalankan SEKALI saat app boot di entry point (main.jsx / index.jsx).
 * Mengembalikan cleanup function untuk melepas listener (berguna di tests).
 *
 * Note: storage event hanya fired di tab LAIN, bukan tab yang mengubah.
 *
 * @param {object} [options]
 * @param {string|string[]} [options.authStoreName='auth'] - nama store auth yang
 *   penghapusannya memicu logout antar-tab. Default 'auth'. Isi sesuai nama store
 *   yang dipakai project (boleh array kalau ada lebih dari satu).
 * @returns {function} cleanup — panggil untuk melepas listener
 *
 * @example
 * // src/main.jsx — default (store bernama 'auth')
 * import { initCrossTabSync } from 'store-boilerplate';
 * initCrossTabSync();
 *
 * @example
 * // Kalau store auth dinamai lain, mis. 'session'
 * initCrossTabSync({ authStoreName: 'session' });
 */
export function initCrossTabSync(options = {}) {
  const { authStoreName = 'auth' } = options;

  // Dukung satu nama (string) atau beberapa (array)
  const names = Array.isArray(authStoreName) ? authStoreName : [authStoreName];
  const authKeys = new Set(names.map((n) => `${STORAGE_PREFIX}${n}`));

  if (typeof window === 'undefined') {
    // SSR / non-browser environment — no-op
    return () => {};
  }

  const handler = (event) => {
    // event.key null = localStorage.clear() dari tab lain — diabaikan di sini
    // supaya tidak ada efek logout tak terduga dari kode pihak ketiga.
    if (!event.key) return;

    // Hanya proses key yang terkait store-boilerplate
    if (!event.key.startsWith(STORAGE_PREFIX)) return;

    // newValue === null artinya key dihapus = logout di tab lain (SR-F-23)
    if (event.newValue === null && authKeys.has(event.key)) {
      clearSensitiveData(); // internally calls resetAllStores()
    }
  };

  window.addEventListener('storage', handler);

  return () => window.removeEventListener('storage', handler);
}
