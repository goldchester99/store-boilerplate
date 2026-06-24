/**
 * Template: Auth Store
 *
 * ⚠️ TOKEN DISIMPAN DI MEMORY ONLY — tidak boleh masuk persistFields.
 * Ini disengaja untuk mencegah token exposure via localStorage (XSS risk).
 *
 * Cara pakai:
 * 1. Copy file ini ke src/stores/auth.store.js di project kamu
 * 2. Ganti implementasi login() dengan API call yang sebenarnya
 * 3. Import dan pakai dengan selector
 *
 * @example
 * const user = useAuthStore((state) => state.user);
 * const login = useAuthStore((state) => state.login);
 */

import { createPersistentStore } from 'store-boilerplate';
import { createAsyncAction } from 'store-boilerplate';
import { clearSensitiveData, resetAllStores } from 'store-boilerplate';

const useAuthStore = createPersistentStore('auth', {
  state: {
    user: null,           // object | null — boleh persist (nama, email, role)
    token: null,          // string | null — MEMORY ONLY, tidak masuk persistFields
    isAuthenticated: false,
  },

  // ✅ token sengaja tidak ada di sini
  persistFields: ['user', 'isAuthenticated'],

  version: 1,

  actions: (set) => ({
    /**
     * Login — ganti body fetchToken() dengan API call project kamu.
     * createAsyncAction otomatis handle loading/error state.
     */
    login: createAsyncAction(set, async (email, password) => {
      // Ganti ini dengan API call yang sebenarnya:
      // const { user, token } = await api.login(email, password);
      const { user, token } = await fetchToken(email, password);

      set({ user, token, isAuthenticated: true });
    }),

    logout: () => {
      // Hapus semua sensitive data + reset semua store sekaligus
      clearSensitiveData();
      resetAllStores();
    },

    setUser: (user) => set({ user }),

    // Update token di memory saja — tidak akan sampai ke localStorage
    refreshToken: (newToken) => set({ token: newToken }),
  }),
});

export default useAuthStore;

// ---------------------------------------------------------------------------
// Placeholder — hapus dan ganti dengan HTTP client project kamu
// ---------------------------------------------------------------------------
async function fetchToken(email, password) {
  throw new Error(
    'Ganti fetchToken() di auth.store.js dengan API call yang sebenarnya.'
  );
}
