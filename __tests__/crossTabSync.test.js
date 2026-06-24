import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initCrossTabSync } from '../src/sync/crossTabSync.js';
import { createStore } from '../src/core/createStore.js';
import { clearRegistry } from '../src/core/storeRegistry.js';
import { STORAGE_PREFIX } from '../src/core/createPersistentStore.js';

const AUTH_KEY = `${STORAGE_PREFIX}auth`;

function fireStorageEvent(key, newValue) {
  const event = new StorageEvent('storage', { key, newValue });
  window.dispatchEvent(event);
}

beforeEach(() => {
  clearRegistry();
  localStorage.clear();
  vi.spyOn(console, 'group').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('initCrossTabSync', () => {
  it('mengembalikan cleanup function', () => {
    const cleanup = initCrossTabSync();
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('auth key dihapus di tab lain → reset semua store', () => {
    const useStore = createStore('ct1', {
      state: { data: 'ada' },
      actions: (set) => ({ setData: (v) => set({ data: v }) }),
    });

    useStore.getState().setData('changed');
    const cleanup = initCrossTabSync();

    // Simulasi: tab lain hapus auth key (logout)
    fireStorageEvent(AUTH_KEY, null);

    expect(useStore.getState().data).toBe('ada'); // sudah di-reset
    cleanup();
  });

  it('key non-auth yang dihapus tidak trigger reset', () => {
    const useStore = createStore('ct2', {
      state: { v: 'original' },
      actions: (set) => ({ setV: (x) => set({ v: x }) }),
    });

    useStore.getState().setV('changed');
    const cleanup = initCrossTabSync();

    // Hapus key lain yang bukan auth
    fireStorageEvent(`${STORAGE_PREFIX}ui`, null);

    expect(useStore.getState().v).toBe('changed'); // tidak di-reset
    cleanup();
  });

  it('key di luar prefix store-boilerplate tidak trigger reset', () => {
    const useStore = createStore('ct3', {
      state: { v: 'original' },
      actions: (set) => ({ setV: (x) => set({ v: x }) }),
    });

    useStore.getState().setV('changed');
    const cleanup = initCrossTabSync();

    fireStorageEvent('some-other-app-key', null);

    expect(useStore.getState().v).toBe('changed'); // tidak di-reset
    cleanup();
  });

  it('update biasa di auth key (bukan null) tidak trigger reset', () => {
    const useStore = createStore('ct4', {
      state: { v: 'original' },
      actions: (set) => ({ setV: (x) => set({ v: x }) }),
    });

    useStore.getState().setV('changed');
    const cleanup = initCrossTabSync();

    // newValue bukan null = update biasa, bukan logout
    fireStorageEvent(AUTH_KEY, JSON.stringify({ version: 1, state: { user: 'alice' } }));

    expect(useStore.getState().v).toBe('changed'); // tidak di-reset
    cleanup();
  });

  it('cleanup melepas listener — tidak ada efek setelah di-cleanup', () => {
    const useStore = createStore('ct5', {
      state: { v: 'original' },
      actions: (set) => ({ setV: (x) => set({ v: x }) }),
    });

    useStore.getState().setV('changed');
    const cleanup = initCrossTabSync();
    cleanup(); // lepas listener

    fireStorageEvent(AUTH_KEY, null);

    expect(useStore.getState().v).toBe('changed'); // tidak di-reset karena sudah cleanup
  });

  // --- authStoreName konfigurabel ---
  it('authStoreName custom: penghapusan store bernama lain memicu reset', () => {
    const useStore = createStore('ct6', {
      state: { v: 'ada' },
      actions: (set) => ({ setV: (x) => set({ v: x }) }),
    });

    useStore.getState().setV('changed');
    const cleanup = initCrossTabSync({ authStoreName: 'session' });

    // Hapus key 'session' (bukan 'auth') → harus tetap trigger reset
    fireStorageEvent(`${STORAGE_PREFIX}session`, null);

    expect(useStore.getState().v).toBe('ada');
    cleanup();
  });

  it('authStoreName custom: store default "auth" TIDAK lagi memicu reset', () => {
    const useStore = createStore('ct7', {
      state: { v: 'original' },
      actions: (set) => ({ setV: (x) => set({ v: x }) }),
    });

    useStore.getState().setV('changed');
    const cleanup = initCrossTabSync({ authStoreName: 'session' });

    // 'auth' dihapus, tapi kita konfigurasi 'session' → tidak trigger
    fireStorageEvent(AUTH_KEY, null);

    expect(useStore.getState().v).toBe('changed');
    cleanup();
  });

  it('authStoreName array: salah satu dari beberapa nama memicu reset', () => {
    const useStore = createStore('ct8', {
      state: { v: 'ada' },
      actions: (set) => ({ setV: (x) => set({ v: x }) }),
    });

    useStore.getState().setV('changed');
    const cleanup = initCrossTabSync({ authStoreName: ['auth', 'session'] });

    fireStorageEvent(`${STORAGE_PREFIX}session`, null);

    expect(useStore.getState().v).toBe('ada');
    cleanup();
  });
});
