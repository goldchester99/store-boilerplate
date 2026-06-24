import { useSyncExternalStore, useRef } from 'react';
import { shallow } from './shallow.js';

/**
 * React hook untuk subscribe ke vanilla store.
 * Menggunakan useSyncExternalStore (built-in React 18) — zero external dependency.
 *
 * Shallow equality dipakai secara default:
 * kalau selector mengembalikan object baru tapi nilainya sama,
 * component tidak re-render.
 *
 * @param {object} store - vanilla store dari createVanillaStore
 * @param {function} [selector] - pilih sebagian state, default ambil semua
 * @returns selected state yang reactive
 *
 * @example
 * // Ambil seluruh state
 * const state = useStore(myStore);
 *
 * // Ambil sebagian state — re-render hanya kalau user berubah
 * const user = useStore(myStore, (s) => s.user);
 */
export function useStore(store, selector = (state) => state) {
  const prevRef = useRef(undefined);

  const getSnapshot = () => {
    const next = selector(store.getState());

    // Kalau shallow equal dengan sebelumnya, kembalikan reference lama
    // agar React tidak trigger re-render
    if (shallow(prevRef.current, next)) {
      return prevRef.current;
    }

    prevRef.current = next;
    return next;
  };

  return useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    getSnapshot // server snapshot — untuk SSR compatibility
  );
}
