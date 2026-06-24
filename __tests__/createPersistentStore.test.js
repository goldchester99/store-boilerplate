import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPersistentStore, STORAGE_PREFIX } from '../src/core/createPersistentStore.js';
import { clearRegistry } from '../src/core/storeRegistry.js';

const key = (name) => `${STORAGE_PREFIX}${name}`;

beforeEach(() => {
  clearRegistry();
  localStorage.clear();
  vi.spyOn(console, 'group').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createPersistentStore — persistFields', () => {
  it('hanya field di persistFields yang masuk localStorage', () => {
    const useStore = createPersistentStore('ps1', {
      state: { theme: 'light', secret: 'hidden', count: 0 },
      actions: (set) => ({ setTheme: (t) => set({ theme: t }) }),
      persistFields: ['theme'],
    });

    useStore.getState().setTheme('dark');

    const stored = JSON.parse(localStorage.getItem(key('ps1')));
    expect(stored.state.theme).toBe('dark');
    expect(stored.state.secret).toBeUndefined();
    expect(stored.state.count).toBeUndefined();
  });

  it('field di luar persistFields tidak tersimpan meski berubah', () => {
    const useStore = createPersistentStore('ps2', {
      state: { saved: 'yes', notSaved: 'initial' },
      actions: (set) => ({ update: () => set({ notSaved: 'changed' }) }),
      persistFields: ['saved'],
    });

    useStore.getState().update();

    const stored = JSON.parse(localStorage.getItem(key('ps2')));
    expect(stored.state.notSaved).toBeUndefined();
  });
});

describe('createPersistentStore — isHydrated', () => {
  it('isHydrated true setelah store dibuat', () => {
    const useStore = createPersistentStore('ps3', {
      state: { theme: 'light' },
      actions: () => ({}),
      persistFields: ['theme'],
    });

    expect(useStore.getState().isHydrated).toBe(true);
  });

  it('isHydrated true meski localStorage kosong', () => {
    const useStore = createPersistentStore('ps4', {
      state: {},
      actions: () => ({}),
      persistFields: [],
    });

    expect(useStore.getState().isHydrated).toBe(true);
  });

  it('isHydrated true meski data localStorage corrupt', () => {
    localStorage.setItem(key('ps5'), 'BUKAN_JSON_VALID{{{');

    const useStore = createPersistentStore('ps5', {
      state: { x: 1 },
      actions: () => ({}),
      persistFields: ['x'],
    });

    expect(useStore.getState().isHydrated).toBe(true);
    expect(useStore.getState().x).toBe(1); // fallback ke initial
  });
});

describe('createPersistentStore — hydration dari storage', () => {
  it('data dari localStorage di-load ke state', () => {
    localStorage.setItem(
      key('ps6'),
      JSON.stringify({ version: 1, state: { theme: 'dark' } })
    );

    const useStore = createPersistentStore('ps6', {
      state: { theme: 'light' },
      actions: () => ({}),
      persistFields: ['theme'],
    });

    expect(useStore.getState().theme).toBe('dark');
  });

  it('field tidak di-persistFields diabaikan saat hydration', () => {
    localStorage.setItem(
      key('ps7'),
      JSON.stringify({ version: 1, state: { theme: 'dark', extra: 'hack' } })
    );

    const useStore = createPersistentStore('ps7', {
      state: { theme: 'light' },
      actions: () => ({}),
      persistFields: ['theme'],
    });

    expect(useStore.getState().extra).toBeUndefined();
  });
});

describe('createPersistentStore — migration', () => {
  it('migrate() dipanggil kalau version berbeda', () => {
    const migrate = vi.fn((oldState) => ({ theme: oldState.colour ?? 'light' }));

    localStorage.setItem(
      key('ps8'),
      JSON.stringify({ version: 1, state: { colour: 'dark' } }) // versi lama
    );

    const useStore = createPersistentStore('ps8', {
      state: { theme: 'light' },
      actions: () => ({}),
      persistFields: ['theme'],
      version: 2,
      migrate,
    });

    expect(migrate).toHaveBeenCalledOnce();
    expect(useStore.getState().theme).toBe('dark');
  });

  it('data lama dibuang kalau version berbeda dan tidak ada migrate fn', () => {
    localStorage.setItem(
      key('ps9'),
      JSON.stringify({ version: 1, state: { theme: 'dark' } })
    );

    const useStore = createPersistentStore('ps9', {
      state: { theme: 'light' },
      actions: () => ({}),
      persistFields: ['theme'],
      version: 2,
      // tidak ada migrate
    });

    expect(useStore.getState().theme).toBe('light'); // fallback ke initial
  });
});

describe('createPersistentStore — graceful degrade', () => {
  it('tetap berfungsi tanpa crash kalau localStorage tidak tersedia', () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('storage unavailable');
    };

    expect(() => {
      createPersistentStore('ps10', {
        state: { x: 1 },
        actions: () => ({}),
        persistFields: ['x'],
      });
    }).not.toThrow();

    Storage.prototype.setItem = originalSetItem;
  });
});
