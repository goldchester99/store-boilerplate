import { createVanillaStore } from '../engine/createVanillaStore.js';
import { useStore as useVanillaStore } from '../engine/useStore.js';
import { registerStore } from './storeRegistry.js';
import { devtoolsMiddleware } from '../middleware/devtools.js';
import { loggerMiddleware } from '../middleware/logger.js';
import { immerMiddleware } from '../middleware/immer.js';
import { createPersistentStore } from './createPersistentStore.js';

const isDev = () =>
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : true;

/**
 * Factory utama untuk membuat store.
 * Setiap store otomatis punya: loading, error, setLoading, setError, reset.
 *
 * Dibangun di atas custom engine (useSyncExternalStore) — tidak bergantung Zustand.
 *
 * @param {string} name - nama store (dipakai devtools + registry)
 * @param {object} options
 * @param {object} options.state - initial state yang didefinisikan developer
 * @param {function} options.actions - (set, get) => object berisi action
 * @param {boolean} [options.persist=false] - aktifkan sync ke localStorage
 * @param {string[]} [options.persistFields=[]] - field yang boleh disimpan
 * @param {boolean} [options.devtools=true] - aktifkan Redux DevTools (dev only)
 * @param {string[]} [options.maskFields=[]] - field tambahan yang di-mask di devtools
 * @param {boolean} [options.useImmer=false] - aktifkan immer middleware
 * @returns store hook — (selector?) => state, plus .getState() .setState() .subscribe()
 *
 * @example
 * const usePostStore = createStore('posts', {
 *   state: { posts: [], selected: null },
 *   actions: (set) => ({
 *     setPosts: (posts) => set({ posts }),
 *     select: (post) => set({ selected: post }),
 *   }),
 * });
 *
 * // Di komponen — gunakan selector
 * const posts = usePostStore((state) => state.posts);
 */
export function createStore(name, options = {}) {
  const {
    state: initialState = {},
    actions: actionsFn = () => ({}),
    persist = false,
    persistFields = [],
    devtools: enableDevtools = true,
    maskFields = [],
    useImmer = false,
  } = options;

  // Kalau persist aktif, delegasi ke createPersistentStore
  if (persist) {
    return createPersistentStore(name, {
      state: initialState,
      actions: actionsFn,
      persistFields,
      devtools: enableDevtools,
      maskFields,
      useImmer,
    });
  }

  // State awal — snapshot ini dipakai reset()
  const initialSnapshot = { loading: false, error: null, ...initialState };

  // Buat vanilla store
  const store = createVanillaStore(initialSnapshot);

  // Middleware chain (dari dalam ke luar): immer → logger → devtools
  // Setiap middleware menerima (setState, getState, config) → wrappedSetState
  let setState = store.setState;
  if (useImmer) setState = immerMiddleware(setState, store.getState);
  if (isDev()) setState = loggerMiddleware(setState, store.getState, { name });
  if (isDev() && enableDevtools) setState = devtoolsMiddleware(setState, store.getState, { name, maskFields });

  // Buat actions dari developer
  const userActions = actionsFn(setState, store.getState);

  // Built-in actions
  const builtinActions = {
    setLoading: (bool) => setState({ loading: bool }),
    setError: (msg) => setState({ error: msg }),
    // reset() merge initialSnapshot ke state — actions tetap karena spread
    reset: () => setState(initialSnapshot),
  };

  // Merge semua actions ke dalam state (bypass middleware — ini setup awal)
  store.setState({ ...userActions, ...builtinActions });

  // Daftar ke registry
  registerStore(name, {
    reset: () => setState(initialSnapshot),
    clearStorage: () => {},
  });

  // Buat hook — mirip Zustand API: useStore() atau useStore(selector)
  const hook = (selector) => useVanillaStore(store, selector);
  hook.getState = store.getState;
  hook.setState = setState;
  hook.subscribe = store.subscribe;
  hook.destroy = store.destroy;

  return hook;
}
