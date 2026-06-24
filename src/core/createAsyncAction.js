import { sanitizeError } from '../security/errorSanitizer.js';

/**
 * Wrapper untuk async action dengan auto loading/error state
 * dan race condition guard — hanya call terakhir yang update state.
 *
 * @param {function} set - Zustand set function dari store
 * @param {function} asyncFn - async function yang akan dieksekusi
 * @returns {function} wrapped async function
 *
 * @example
 * actions: (set) => ({
 *   fetchPosts: createAsyncAction(set, async () => {
 *     const data = await api.getPosts();
 *     set({ posts: data });
 *   }),
 * }),
 */
export function createAsyncAction(set, asyncFn) {
  let callId = 0;

  return async function (...args) {
    callId += 1;
    const currentCallId = callId;

    set({ loading: true, error: null });

    try {
      const result = await asyncFn(...args);

      // Abaikan kalau sudah ada call lebih baru
      if (callId === currentCallId) {
        set({ loading: false });
      }

      return result;
    } catch (err) {
      if (callId === currentCallId) {
        set({ loading: false, error: sanitizeError(err) });
      }
      // Re-throw supaya caller bisa handle kalau perlu
      throw err;
    }
  };
}
