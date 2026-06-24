import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createVanillaStore } from '../src/engine/createVanillaStore.js';
import { useStore } from '../src/engine/useStore.js';
import { shallow } from '../src/engine/shallow.js';

// ---------------------------------------------------------------------------
// createVanillaStore
// ---------------------------------------------------------------------------
describe('createVanillaStore — getState & setState', () => {
  it('getState() mengembalikan initial state', () => {
    const store = createVanillaStore({ count: 0, name: 'test' });
    expect(store.getState()).toEqual({ count: 0, name: 'test' });
  });

  it('setState(object) merge ke state yang ada', () => {
    const store = createVanillaStore({ a: 1, b: 2 });
    store.setState({ a: 99 });
    expect(store.getState()).toEqual({ a: 99, b: 2 });
  });

  it('setState(function) menerima state sebelumnya sebagai argument', () => {
    const store = createVanillaStore({ count: 5 });
    store.setState((prev) => ({ count: prev.count + 1 }));
    expect(store.getState().count).toBe(6);
  });

  it('setState(function) MERGE — key lain (mis. actions) tidak hilang', () => {
    const fn = () => {};
    const store = createVanillaStore({ count: 0, other: 'keep', action: fn });
    store.setState((s) => ({ count: s.count + 1 }));
    const state = store.getState();
    expect(state.count).toBe(1);
    expect(state.other).toBe('keep');   // tidak terhapus
    expect(state.action).toBe(fn);      // action tetap ada
  });

  it('setState(function) yang return null/undefined tidak mengosongkan state', () => {
    const store = createVanillaStore({ a: 1, b: 2 });
    store.setState(() => undefined);
    expect(store.getState()).toEqual({ a: 1, b: 2 });
  });

  it('setState tidak deep merge — hanya shallow', () => {
    const store = createVanillaStore({ user: { name: 'Alice', age: 30 } });
    store.setState({ user: { name: 'Bob' } }); // replace, bukan merge nested
    expect(store.getState().user).toEqual({ name: 'Bob' }); // age hilang
  });

  it('setState dengan reference yang sama tidak notify listener', () => {
    const store = createVanillaStore({ x: 1 });
    const listener = vi.fn();
    store.subscribe(listener);

    // setState dengan function yang return state yang sama (reference sama)
    store.setState((prev) => prev);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createVanillaStore — subscribe & unsubscribe', () => {
  it('listener dipanggil setiap setState', () => {
    const store = createVanillaStore({ v: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState({ v: 1 });
    store.setState({ v: 2 });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('subscribe() mengembalikan unsubscribe function', () => {
    const store = createVanillaStore({ v: 0 });
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.setState({ v: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    store.setState({ v: 2 });
    expect(listener).toHaveBeenCalledTimes(1); // tidak dipanggil lagi
  });

  it('listener tidak duplikat kalau subscribe dua kali', () => {
    const store = createVanillaStore({ v: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.subscribe(listener); // subscribe lagi dengan listener sama

    store.setState({ v: 1 });
    expect(listener).toHaveBeenCalledTimes(1); // Set deduplicate otomatis
  });

  it('listener dipanggil tanpa argument — pakai getState() sendiri', () => {
    const store = createVanillaStore({ v: 0 });
    let capturedState;
    store.subscribe(() => {
      capturedState = store.getState();
    });

    store.setState({ v: 42 });
    expect(capturedState).toEqual({ v: 42 });
  });
});

describe('createVanillaStore — destroy', () => {
  it('destroy() menghapus semua listener', () => {
    const store = createVanillaStore({ v: 0 });
    const l1 = vi.fn();
    const l2 = vi.fn();
    store.subscribe(l1);
    store.subscribe(l2);

    store.destroy();
    store.setState({ v: 1 });

    expect(l1).not.toHaveBeenCalled();
    expect(l2).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useStore
// ---------------------------------------------------------------------------
describe('useStore — selector', () => {
  it('mengembalikan seluruh state kalau tidak ada selector', () => {
    const store = createVanillaStore({ a: 1, b: 2 });
    const { result } = renderHook(() => useStore(store));
    expect(result.current).toEqual({ a: 1, b: 2 });
  });

  it('mengembalikan hasil selector kalau selector diberikan', () => {
    const store = createVanillaStore({ user: 'Alice', theme: 'dark' });
    const { result } = renderHook(() => useStore(store, (s) => s.user));
    expect(result.current).toBe('Alice');
  });

  it('state reactive — update store → hook ikut update', () => {
    const store = createVanillaStore({ count: 0 });
    const { result } = renderHook(() => useStore(store, (s) => s.count));

    act(() => {
      store.setState({ count: 5 });
    });

    expect(result.current).toBe(5);
  });
});

describe('useStore — selector isolation (no unnecessary re-render)', () => {
  it('tidak re-render kalau state yang di-select tidak berubah', () => {
    const store = createVanillaStore({ a: 1, b: 2 });
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      return useStore(store, (s) => s.a);
    });

    const countAfterMount = renderCount;

    act(() => {
      store.setState({ b: 99 }); // ubah b, bukan a
    });

    expect(result.current).toBe(1); // a tidak berubah
    expect(renderCount).toBe(countAfterMount); // tidak re-render
  });

  it('re-render kalau state yang di-select berubah', () => {
    const store = createVanillaStore({ a: 1, b: 2 });
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      return useStore(store, (s) => s.a);
    });

    const countAfterMount = renderCount;

    act(() => {
      store.setState({ a: 99 });
    });

    expect(result.current).toBe(99);
    expect(renderCount).toBeGreaterThan(countAfterMount);
  });

  it('tidak re-render kalau selector return object baru tapi nilai sama (shallow equal)', () => {
    const store = createVanillaStore({ user: 'Alice', role: 'admin', theme: 'dark' });
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      // Selector ini return object baru setiap kali dipanggil
      return useStore(store, (s) => ({ user: s.user, role: s.role }));
    });

    const countAfterMount = renderCount;

    act(() => {
      store.setState({ theme: 'light' }); // ubah theme, bukan user/role
    });

    expect(result.current.user).toBe('Alice');
    expect(renderCount).toBe(countAfterMount); // shallow equal → tidak re-render
  });
});

// ---------------------------------------------------------------------------
// shallow
// ---------------------------------------------------------------------------
describe('shallow', () => {
  it('true kalau reference sama', () => {
    const obj = { a: 1 };
    expect(shallow(obj, obj)).toBe(true);
  });

  it('true kalau semua key level pertama sama nilai', () => {
    expect(shallow({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
  });

  it('false kalau ada key dengan nilai berbeda', () => {
    expect(shallow({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('false kalau jumlah key berbeda', () => {
    expect(shallow({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('false untuk nested object meski isinya sama (shallow, bukan deep)', () => {
    expect(shallow({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false); // beda reference
  });

  it('true untuk primitive yang sama', () => {
    expect(shallow(1, 1)).toBe(true);
    expect(shallow('abc', 'abc')).toBe(true);
  });

  it('false untuk primitive yang berbeda', () => {
    expect(shallow(1, 2)).toBe(false);
  });

  it('tidak crash kalau input null atau undefined', () => {
    expect(() => shallow(null, null)).not.toThrow();
    expect(shallow(null, null)).toBe(true);
    expect(shallow(null, {})).toBe(false);
    expect(shallow(undefined, undefined)).toBe(true);
  });
});
