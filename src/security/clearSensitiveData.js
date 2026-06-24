import { getAllStores } from '../core/storeRegistry.js';

const STORAGE_PREFIX = 'store-boilerplate:';

/**
 * Wipe semua data sensitif — reset semua store + hapus semua key
 * di localStorage yang terkait store-boilerplate.
 *
 * Aman dipanggil saat localStorage tidak tersedia (graceful degrade).
 */
export function clearSensitiveData() {
  // Reset semua store yang terdaftar
  const stores = getAllStores();
  for (const [, { reset }] of stores) {
    try {
      reset();
    } catch {
      // Lanjut meski satu store gagal
    }
  }

  // Hapus semua key localStorage yang punya prefix store-boilerplate
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage tidak tersedia — lanjut tanpa crash
  }
}
