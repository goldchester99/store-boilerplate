/**
 * Internal registry untuk semua store yang dibuat via createStore / createPersistentStore.
 * Tidak di-export ke developer — hanya dipakai oleh resetAllStores & clearSensitiveData.
 *
 * Struktur per entry: { reset: Function, clearStorage: Function }
 */

const registry = new Map();

export function registerStore(name, { reset, clearStorage }) {
  registry.set(name, { reset, clearStorage });
}

export function getAllStores() {
  return registry;
}

export function getStore(name) {
  return registry.get(name);
}

// Untuk test isolation — jangan dipakai di production code
export function clearRegistry() {
  registry.clear();
}
