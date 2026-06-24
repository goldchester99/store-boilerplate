/**
 * Template: Auth Store
 *
 * Tidak ada auth state yang di-persist ke localStorage.
 * Session di-restore via refresh token (httpOnly cookie) setiap kali app load.
 *
 * ⚠️ accessToken disimpan di MEMORY ONLY — hilang saat tab/browser ditutup.
 *    Ini disengaja: localStorage tidak aman untuk token (XSS risk).
 *    Server yang menyimpan refresh token di httpOnly cookie — tidak bisa dibaca JS.
 *
 * Cara pakai:
 * 1. Copy file ini ke src/stores/auth.store.js di project kamu
 * 2. Sesuaikan endpoint URL kalau berbeda dari /api/auth/*
 * 3. Panggil refreshToken() di root component saat app pertama kali mount
 *
 * @example
 * // Di root component — restore session saat app load:
 * const refreshToken = useAuthStore((state) => state.refreshToken);
 * useEffect(() => { refreshToken(); }, []);
 *
 * // Di komponen lain:
 * const user = useAuthStore((state) => state.user);
 * const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
 * const login = useAuthStore((state) => state.login);
 */

import { createStore, createAsyncAction, clearSensitiveData, sanitizeObject } from 'store-boilerplate';

const useAuthStore = createStore('auth', {
  state: {
    user: null,            // object | null — data user (nama, email, role) — memory only
    accessToken: null,     // string | null — MEMORY ONLY, hilang saat tab/browser ditutup
    isAuthenticated: false,
  },

  actions: (set) => ({
    /**
     * Login dengan email dan password.
     * accessToken disimpan di memory. refreshToken disimpan di httpOnly cookie oleh server.
     */
    login: createAsyncAction(set, async (email, password) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // kirim & terima httpOnly cookie
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Login failed');
      }

      const { data } = await res.json();
      set({
        user: sanitizeObject(data.user), // strip __proto__ sebelum masuk state
        accessToken: data.accessToken,
        isAuthenticated: true,
      });
    }),

    /**
     * Restore session saat app load / page refresh.
     * Server membaca refresh token dari httpOnly cookie — tidak ada yang dikirim eksplisit.
     * Jika cookie expired atau tidak ada → paksa logout (isAuthenticated: false).
     *
     * Catatan: endpoint ini hanya mengembalikan accessToken baru.
     * Kalau kamu butuh data user (nama, role), fetch /api/auth/me setelah ini.
     */
    refreshToken: createAsyncAction(set, async () => {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // kirim httpOnly cookie otomatis
      });

      if (!res.ok) {
        // Cookie expired atau tidak valid → bersihkan state lokal
        set({ user: null, accessToken: null, isAuthenticated: false });
        return;
      }

      const { data } = await res.json();
      set({ accessToken: data.accessToken, isAuthenticated: true });
    }),

    /**
     * Logout — invalidasi session di server, lalu bersihkan semua state lokal.
     * clearSensitiveData() dipanggil di finally → state selalu bersih
     * meskipun API call gagal (network error, server down).
     */
    logout: createAsyncAction(set, async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } finally {
        // Selalu bersihkan state lokal — bahkan kalau server tidak merespons
        clearSensitiveData();
        set({ user: null, accessToken: null, isAuthenticated: false });
      }
    }),

    /**
     * Update data user di memory (mis. setelah edit profil).
     * Tidak ada yang ditulis ke storage.
     */
    setUser: (user) => set({ user: sanitizeObject(user) }),
  }),
});

export default useAuthStore;
