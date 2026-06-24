import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStore } from '../src/core/createStore.js';
import { getAllStores, clearRegistry } from '../src/core/storeRegistry.js';

beforeEach(() => {
  clearRegistry();
  vi.spyOn(console, 'group').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createStore — built-in state', () => {
  it('setiap store punya loading, error, setLoading, setError, reset', () => {
    const useStore = createStore('s1', {
      state: { count: 0 },
      actions: () => ({}),
    });

    const state = useStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
    expect(typeof state.setLoading).toBe('function');
    expect(typeof state.setError).toBe('function');
    expect(typeof state.reset).toBe('function');
  });

  it('setLoading mengubah loading state', () => {
    const useStore = createStore('s2', { state: {}, actions: () => ({}) });

    useStore.getState().setLoading(true);
    expect(useStore.getState().loading).toBe(true);

    useStore.getState().setLoading(false);
    expect(useStore.getState().loading).toBe(false);
  });

  it('setError mengubah error state', () => {
    const useStore = createStore('s3', { state: {}, actions: () => ({}) });

    useStore.getState().setError('terjadi error');
    expect(useStore.getState().error).toBe('terjadi error');

    useStore.getState().setError(null);
    expect(useStore.getState().error).toBe(null);
  });

  it('action pakai set(fn) tidak menghapus action lain (regresi B-10)', () => {
    const useStore = createStore('s-fn', {
      state: { count: 0 },
      actions: (set) => ({
        inc: () => set((s) => ({ count: s.count + 1 })),
        dec: () => set((s) => ({ count: s.count - 1 })),
      }),
    });

    // Panggil berkali-kali — semua action harus tetap ada
    useStore.getState().inc();
    useStore.getState().inc();
    useStore.getState().dec();

    const state = useStore.getState();
    expect(state.count).toBe(1);
    expect(typeof state.inc).toBe('function');
    expect(typeof state.dec).toBe('function');
    expect(typeof state.reset).toBe('function');
  });
});

describe('createStore — reset()', () => {
  it('reset() mengembalikan ke initial state, bukan state kosong', () => {
    const useStore = createStore('s4', {
      state: { count: 5, name: 'initial' },
      actions: (set) => ({
        setCount: (n) => set({ count: n }),
      }),
    });

    useStore.getState().setCount(999);
    expect(useStore.getState().count).toBe(999);

    useStore.getState().reset();
    expect(useStore.getState().count).toBe(5);
    expect(useStore.getState().name).toBe('initial');
  });

  it('reset() juga mereset loading dan error', () => {
    const useStore = createStore('s5', { state: {}, actions: () => ({}) });

    useStore.getState().setLoading(true);
    useStore.getState().setError('gagal');

    useStore.getState().reset();

    expect(useStore.getState().loading).toBe(false);
    expect(useStore.getState().error).toBe(null);
  });

  it('reset() tidak menghapus actions', () => {
    const useStore = createStore('s6', {
      state: { x: 1 },
      actions: (set) => ({ setX: (v) => set({ x: v }) }),
    });

    useStore.getState().reset();
    expect(typeof useStore.getState().setX).toBe('function');
  });
});

describe('createStore — registry', () => {
  it('store terdaftar di registry setelah dibuat', () => {
    createStore('s7', { state: {}, actions: () => ({}) });
    expect(getAllStores().has('s7')).toBe(true);
  });

  it('registry entry punya reset dan clearStorage', () => {
    createStore('s8', { state: {}, actions: () => ({}) });
    const entry = getAllStores().get('s8');
    expect(typeof entry.reset).toBe('function');
    expect(typeof entry.clearStorage).toBe('function');
  });
});
