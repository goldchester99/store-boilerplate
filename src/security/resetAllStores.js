import { getAllStores } from '../core/storeRegistry.js';

/**
 * Reset semua store yang terdaftar dalam satu panggilan.
 * Tetap menyelesaikan semua reset meski salah satu store throw error (SR-NF-06).
 */
export function resetAllStores() {
  const stores = getAllStores();
  for (const [, { reset }] of stores) {
    try {
      reset();
    } catch {
      // Lanjut ke store berikutnya
    }
  }
}
