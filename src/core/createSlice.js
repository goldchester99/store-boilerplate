/**
 * Definisikan potongan state per domain.
 * Hasil dari createSlice dipakai sebagai input combineSlices.
 *
 * @param {string} name - nama slice (dipakai untuk error message konflik)
 * @param {object} definition
 * @param {object} definition.state - initial state untuk domain ini
 * @param {function} definition.actions - (set, get) => object berisi action
 * @returns slice definition object
 *
 * @example
 * const authSlice = createSlice('auth', {
 *   state: { user: null, isAuthenticated: false },
 *   actions: (set) => ({
 *     setUser: (user) => set({ user, isAuthenticated: !!user }),
 *   }),
 * });
 *
 * const uiSlice = createSlice('ui', {
 *   state: { theme: 'light' },
 *   actions: (set) => ({
 *     setTheme: (theme) => set({ theme }),
 *   }),
 * });
 *
 * const useAppStore = combineSlices('app', [authSlice, uiSlice]);
 */
export function createSlice(name, definition = {}) {
  const { state = {}, actions = () => ({}) } = definition;

  return { name, state, actions };
}
