/**
 * Core state container — tidak bergantung pada library eksternal manapun.
 * Semua fungsi di store-boilerplate dibangun di atas ini.
 *
 * @param {object} initialState - initial state
 * @returns {{ getState, setState, subscribe, destroy }}
 *
 * @example
 * const store = createVanillaStore({ count: 0 });
 *
 * store.subscribe(() => console.log(store.getState()));
 * store.setState({ count: 1 }); // notify semua subscriber
 * store.getState(); // { count: 1 }
 */
export function createVanillaStore(initialState = {}) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(partial) {
    // Bentuk function: jalankan dengan state sekarang untuk dapat partial-nya.
    // Bentuk object: pakai langsung sebagai partial.
    const partialNext = typeof partial === 'function' ? partial(state) : partial;

    // (prev) => prev — tidak ada perubahan, skip notify (cegah re-render sia-sia)
    if (partialNext === state) return;

    // Guard: updater yang return null/undefined (mis. salah pakai gaya mutate
    // tanpa useImmer) tidak boleh menimpa state jadi kosong.
    if (partialNext === null || partialNext === undefined) return;

    // SHALLOW MERGE — baik bentuk function maupun object selalu di-merge ke
    // state lama (semantik Zustand). Tanpa ini, action yang pakai set(fn)
    // akan menghapus action & key lain dari state.
    const nextState = { ...state, ...partialNext };

    state = nextState;

    for (const listener of listeners) {
      listener();
    }
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function destroy() {
    listeners.clear();
  }

  return { getState, setState, subscribe, destroy };
}
