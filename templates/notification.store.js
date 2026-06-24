/**
 * Template: Notification Store
 *
 * In-app notification state — tidak di-persist (notifikasi reset tiap page load).
 *
 * Cara pakai:
 * 1. Copy file ini ke src/stores/notification.store.js di project kamu
 * 2. Panggil addNotification() dari mana saja di app
 *
 * @example
 * const notifications = useNotificationStore((state) => state.notifications);
 * const add = useNotificationStore((state) => state.addNotification);
 *
 * add({ id: '1', type: 'success', message: 'Berhasil disimpan!', duration: 3000 });
 */

import { createStore } from 'store-boilerplate';

const useNotificationStore = createStore('notification', {
  state: {
    notifications: [],  // { id, type, message, duration }[] — TIDAK persist
    unreadCount: 0,     // number — TIDAK persist
  },

  actions: (set, get) => ({
    addNotification: ({ id, type = 'info', message, duration = 5000 }) => {
      set((state) => ({
        notifications: [...state.notifications, { id, type, message, duration }],
        unreadCount: state.unreadCount + 1,
      }));
    },

    removeNotification: (id) => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    },

    clearAll: () => set({ notifications: [], unreadCount: 0 }),

    markAllRead: () => set({ unreadCount: 0 }),
  }),
});

export default useNotificationStore;
