import { createVanillaStore } from '../engine/createVanillaStore.js';
import { useStore as useVanillaStore } from '../engine/useStore.js';
import { registerStore } from './storeRegistry.js';
import { validateStorageData } from '../security/storageValidator.js';
import { PERSIST_BLOCKED_FIELDS, SENSITIVE_FIELDS } from '../security/sensitiveFields.js';
import { stripSensitiveDeep } from '../security/deepSanitize.js';
import { devtoolsMiddleware } from '../middleware/devtools.js';
import { loggerMiddleware } from '../middleware/logger.js';
import { immerMiddleware } from '../middleware/immer.js';

const SENSITIVE_SET = new Set(SENSITIVE_FIELDS);

export const STORAGE_PREFIX = 'store-boilerplate:';

const isDev = () =>
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : true;

/**
 * Store yang otomatis sync ke localStorage (atau sessionStorage).
 * Fitur: field whitelist, isHydrated flag, validasi storage, migration.
 *
 * Dibangun di atas custom engine (useSyncExternalStore) — zero external dependency.
 *
 * @param {string} name - nama store + storage key prefix
 * @param {object} options
 * @param {object} options.state - initial state
 * @param {function} options.actions - (set, get) => object berisi action
 * @param {string[]} options.persistFields - field yang boleh disimpan (wajib diisi)
 * @param {'localStorage'|'sessionStorage'} [options.storage='localStorage']
 * @param {number} [options.version=1] - versi schema untuk migration
 * @param {function} [options.migrate] - (oldState, oldVersion) => newState
 * @param {boolean} [options.devtools=true]
 * @param {string[]} [options.maskFields=[]]
 * @param {boolean} [options.useImmer=false]
 * @returns store hook — (selector?) => state, plus .getState() .setState() .subscribe()
 *
 * @example
 * const useSettingsStore = createPersistentStore('settings', {
 *   state: { theme: 'light', language: 'id' },
 *   actions: (set) => ({ setTheme: (t) => set({ theme: t }) }),
 *   persistFields: ['theme', 'language'],
 *   version: 1,
 * });
 */
export function createPersistentStore(name, options = {}) {
  const {
    state: initialState = {},
    actions: actionsFn = () => ({}),
    persistFields = [],
    storage: storageType = 'localStorage',
    version: currentVersion = 1,
    migrate = null,
    devtools: enableDevtools = true,
    maskFields = [],
    useImmer = false,
  } = options;

  // Guard: peringatkan developer kalau coba persist field sensitif (SR-SEC-01).
  // Token JWT dapat pesan lebih tegas; field sensitif lain (password/secret/otp)
  // tetap diperingatkan. Apapun warningnya, saveToStorage akan men-strip field
  // ini sebelum menulis ke disk (lihat saveToStorage).
  for (const field of persistFields) {
    if (PERSIST_BLOCKED_FIELDS.includes(field)) {
      console.warn(
        `[store-boilerplate] ⚠️ Field "${field}" tidak boleh di-persist! ` +
          'Token JWT harus disimpan di memory only — XSS risk. Field ini diabaikan.'
      );
    } else if (SENSITIVE_SET.has(field)) {
      console.warn(
        `[store-boilerplate] ⚠️ Field sensitif "${field}" tidak akan di-persist ` +
          'ke storage. Field ini diabaikan demi keamanan.'
      );
    }
  }

  const storage = getStorage(storageType);
  const storageKey = `${STORAGE_PREFIX}${name}`;

  // Baca & validasi data dari storage (SR-F-16, SR-F-17)
  let hydratedState = {};
  if (storage) {
    hydratedState = readFromStorage(storage, storageKey, persistFields, currentVersion, migrate);
  }

  // State awal: isHydrated false dulu, di-flip setelah store siap
  const initialSnapshot = { loading: false, error: null, isHydrated: false, ...initialState };

  // Buat vanilla store
  const store = createVanillaStore(initialSnapshot);

  // Middleware chain: immer → logger → devtools
  let setState = store.setState;
  if (useImmer) setState = immerMiddleware(setState, store.getState);
  if (isDev()) setState = loggerMiddleware(setState, store.getState, { name });
  if (isDev() && enableDevtools) setState = devtoolsMiddleware(setState, store.getState, { name, maskFields });

  // Buat actions
  const userActions = actionsFn(setState, store.getState);

  const builtinActions = {
    setLoading: (bool) => setState({ loading: bool }),
    setError: (msg) => setState({ error: msg }),
    reset: () => setState({ loading: false, error: null, isHydrated: true, ...initialState }),
  };

  // Merge actions ke state (bypass middleware — init only)
  store.setState({ ...userActions, ...builtinActions });

  // Hydration: apply data dari storage + flip isHydrated = true
  // isHydrated harus selalu jadi true meski hydration gagal (SR-NF-05)
  try {
    store.setState({ ...hydratedState, isHydrated: true });
  } catch {
    store.setState({ isHydrated: true });
  }

  // Subscribe: persist ke storage setiap kali state berubah
  if (storage) {
    // Tulis snapshot awal sekali — supaya localStorage langsung konsisten
    // dengan state, tanpa menunggu perubahan pertama.
    saveToStorage(storage, storageKey, store.getState(), persistFields, currentVersion);

    store.subscribe(() => {
      saveToStorage(storage, storageKey, store.getState(), persistFields, currentVersion);
    });
  }

  // Daftar ke registry
  registerStore(name, {
    reset: () => setState({ loading: false, error: null, isHydrated: true, ...initialState }),
    clearStorage: () => {
      try { storage?.removeItem(storageKey); } catch {}
    },
  });

  // Buat hook
  const hook = (selector) => useVanillaStore(store, selector);
  hook.getState = store.getState;
  hook.setState = setState;
  hook.subscribe = store.subscribe;
  hook.destroy = store.destroy;

  return hook;
}

// --- helpers ---

function getStorage(storageType) {
  try {
    const engine =
      storageType === 'sessionStorage' ? sessionStorage : localStorage;
    const testKey = `${STORAGE_PREFIX}__test__`;
    engine.setItem(testKey, '1');
    engine.removeItem(testKey);
    return engine;
  } catch {
    return null; // Private browsing, storage penuh — graceful degrade (SR-NF-04)
  }
}

function readFromStorage(storage, storageKey, persistFields, currentVersion, migrate) {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return {};

    let wrapper;
    try { wrapper = JSON.parse(raw); } catch { return {}; }

    if (typeof wrapper !== 'object' || wrapper === null) return {};

    const storedVersion = wrapper.version ?? 0;
    let stateData = wrapper.state;

    if (typeof stateData !== 'object' || stateData === null) return {};

    // Jalankan migration kalau version berbeda (SR-F-17)
    if (storedVersion !== currentVersion) {
      if (typeof migrate === 'function') {
        try { stateData = migrate(stateData, storedVersion); } catch { return {}; }
      } else {
        return {}; // Tidak ada migrate fn — buang data lama
      }
    }

    const validated = validateStorageData(JSON.stringify(stateData), persistFields);
    return validated ?? {};
  } catch {
    return {};
  }
}

function saveToStorage(storage, storageKey, state, persistFields, currentVersion) {
  try {
    const toPersist = {};
    for (const field of persistFields) {
      if (PERSIST_BLOCKED_FIELDS.includes(field)) continue;
      if (Object.prototype.hasOwnProperty.call(state, field)) {
        toPersist[field] = state[field];
      }
    }
    // Deep-strip SEMUA field sensitif (6 field) di SEMUA level sebelum tulis.
    // Menjamin token/password/secret bersarang (mis. user.token) tidak pernah
    // menyentuh disk — menyamakan sisi-tulis dengan sisi-baca (storageValidator).
    const safe = stripSensitiveDeep(toPersist, SENSITIVE_SET);
    storage.setItem(
      storageKey,
      JSON.stringify({ version: currentVersion, state: safe })
    );
  } catch {
    // Storage penuh atau unavailable — silent fail
  }
}
