/**
 * Template: UI Store
 *
 * State untuk kebutuhan UI global: theme, sidebar, modal, page title.
 * theme dan sidebarOpen di-persist ke localStorage agar ingat preferensi user.
 *
 * Cara pakai:
 * 1. Copy file ini ke src/stores/ui.store.js di project kamu
 * 2. Tambah state/action sesuai kebutuhan
 *
 * @example
 * const theme = useUIStore((state) => state.theme);
 * const toggleTheme = useUIStore((state) => state.toggleTheme);
 */

import { createPersistentStore } from 'store-boilerplate';

const useUIStore = createPersistentStore('ui', {
  state: {
    theme: 'light',         // 'light' | 'dark' — persist
    sidebarOpen: true,      // boolean — persist
    activeModal: null,      // string | null — TIDAK persist
    pageTitle: '',          // string — TIDAK persist
  },

  persistFields: ['theme', 'sidebarOpen'],

  version: 1,

  actions: (set) => ({
    toggleTheme: () =>
      set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

    toggleSidebar: () =>
      set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    openModal: (name) => set({ activeModal: name }),

    closeModal: () => set({ activeModal: null }),

    setPageTitle: (title) => set({ pageTitle: title }),
  }),
});

export default useUIStore;
