import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSlice } from '../src/core/createSlice.js';
import { combineSlices } from '../src/core/combineSlices.js';
import { clearRegistry } from '../src/core/storeRegistry.js';

beforeEach(() => {
  clearRegistry();
  vi.spyOn(console, 'group').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('combineSlices — gabungan state & actions', () => {
  it('store hasil punya semua state dari semua slice', () => {
    const a = createSlice('auth', { state: { user: null }, actions: () => ({}) });
    const b = createSlice('ui', { state: { theme: 'light' }, actions: () => ({}) });

    const useStore = combineSlices('app', [a, b]);
    const s = useStore.getState();

    expect(s.user).toBe(null);
    expect(s.theme).toBe('light');
  });

  it('store hasil punya semua action dari semua slice & action jalan', () => {
    const a = createSlice('auth', {
      state: { user: null },
      actions: (set) => ({ setUser: (u) => set({ user: u }) }),
    });
    const b = createSlice('ui', {
      state: { theme: 'light' },
      actions: (set) => ({ toggle: () => set((st) => ({ theme: st.theme === 'light' ? 'dark' : 'light' })) }),
    });

    const useStore = combineSlices('app', [a, b]);

    useStore.getState().setUser('alice');
    useStore.getState().toggle();

    expect(useStore.getState().user).toBe('alice');
    expect(useStore.getState().theme).toBe('dark');
  });
});

describe('combineSlices — factory dipanggil tepat sekali (regresi)', () => {
  it('setiap action factory slice hanya dieksekusi 1x saat store dibuat', () => {
    const spyA = vi.fn(() => ({ aAction: () => {} }));
    const spyB = vi.fn(() => ({ bAction: () => {} }));

    const a = createSlice('a', { state: { x: 1 }, actions: spyA });
    const b = createSlice('b', { state: { y: 2 }, actions: spyB });

    combineSlices('combo', [a, b]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
  });

  it('side-effect di dalam factory tidak terjadi dua kali', () => {
    let sideEffectCount = 0;
    const slice = createSlice('s', {
      state: {},
      actions: () => {
        sideEffectCount++;
        return { noop: () => {} };
      },
    });

    combineSlices('one', [slice]);
    expect(sideEffectCount).toBe(1);
  });
});

describe('combineSlices — deteksi konflik (dev)', () => {
  it('throw kalau dua slice punya state key yang sama', () => {
    const a = createSlice('a', { state: { shared: 1 }, actions: () => ({}) });
    const b = createSlice('b', { state: { shared: 2 }, actions: () => ({}) });

    expect(() => combineSlices('x', [a, b])).toThrow(/Konflik nama "shared"/);
  });

  it('throw kalau dua slice punya action name yang sama', () => {
    const a = createSlice('a', { state: {}, actions: (set) => ({ doThing: () => set({}) }) });
    const b = createSlice('b', { state: {}, actions: (set) => ({ doThing: () => set({}) }) });

    expect(() => combineSlices('x', [a, b])).toThrow(/Konflik nama "doThing"/);
  });

  it('throw kalau action satu slice bentrok dengan state slice lain', () => {
    const a = createSlice('a', { state: { count: 0 }, actions: () => ({}) });
    const b = createSlice('b', { state: {}, actions: (set) => ({ count: () => set({}) }) });

    expect(() => combineSlices('x', [a, b])).toThrow(/Konflik nama "count"/);
  });

  it('tidak throw kalau tidak ada konflik', () => {
    const a = createSlice('a', { state: { user: null }, actions: (set) => ({ setUser: () => set({}) }) });
    const b = createSlice('b', { state: { theme: 'light' }, actions: (set) => ({ toggle: () => set({}) }) });

    expect(() => combineSlices('x', [a, b])).not.toThrow();
  });
});
