import { describe, it, expect, vi } from 'vitest';
import { createAsyncAction } from '../src/core/createAsyncAction.js';

describe('createAsyncAction — loading/error state', () => {
  it('set loading: true saat mulai, false saat selesai', async () => {
    const set = vi.fn();
    const action = createAsyncAction(set, async () => 'result');

    await action();

    expect(set).toHaveBeenNthCalledWith(1, { loading: true, error: null });
    expect(set).toHaveBeenNthCalledWith(2, { loading: false });
  });

  it('set error dan loading: false saat async fn throw', async () => {
    const set = vi.fn();
    const action = createAsyncAction(set, async () => {
      throw new Error('network error');
    });

    await expect(action()).rejects.toThrow('network error');

    const calls = set.mock.calls;
    expect(calls[0][0]).toEqual({ loading: true, error: null });
    expect(calls[1][0].loading).toBe(false);
    expect(typeof calls[1][0].error).toBe('string');
    expect(calls[1][0].error).not.toContain('at '); // bukan stack trace
  });

  it('error dari fn di-sanitasi sebelum masuk ke state', async () => {
    const set = vi.fn();
    const action = createAsyncAction(set, async () => {
      const err = new Error('at Object.<anonymous> (/home/user/app.js:10:5)');
      throw err;
    });

    await expect(action()).rejects.toThrow();

    // Cari call yang men-set error berupa string (bukan call awal error:null)
    const errorCall = set.mock.calls.find((c) => typeof c[0]?.error === 'string');
    expect(errorCall[0].error).toBe('An error occurred'); // disanitasi
  });

  it('re-throw error supaya caller bisa handle', async () => {
    const set = vi.fn();
    const action = createAsyncAction(set, async () => {
      throw new Error('boom');
    });

    await expect(action()).rejects.toThrow('boom');
  });

  it('clear error sebelumnya saat action dimulai', async () => {
    const set = vi.fn();
    const action = createAsyncAction(set, async () => {});

    await action();

    expect(set.mock.calls[0][0]).toEqual({ loading: true, error: null });
  });
});

describe('createAsyncAction — race condition guard', () => {
  it('call lama diabaikan kalau ada call lebih baru', async () => {
    const set = vi.fn();
    let resolveCall1, resolveCall2;

    const action = createAsyncAction(set, (id) =>
      new Promise((resolve) => {
        if (id === 1) resolveCall1 = resolve;
        else resolveCall2 = resolve;
      })
    );

    // Mulai dua call — call2 lebih baru
    const p1 = action(1).catch(() => {});
    const p2 = action(2).catch(() => {});

    // Resolve call1 (stale)
    resolveCall1('data1');
    await p1;

    // Setelah call1 selesai, loading:false dari call1 tidak di-set
    const loadingFalseAfterCall1 = set.mock.calls.filter(
      (c) => c[0]?.loading === false
    ).length;
    expect(loadingFalseAfterCall1).toBe(0);

    // Resolve call2 (latest)
    resolveCall2('data2');
    await p2;

    // Sekarang baru ada 1x loading:false (dari call2)
    const loadingFalseTotal = set.mock.calls.filter(
      (c) => c[0]?.loading === false
    ).length;
    expect(loadingFalseTotal).toBe(1);
  });

  it('state tidak di-update oleh call lama meski sukses', async () => {
    const set = vi.fn();
    let resolveCall1, resolveCall2;

    const action = createAsyncAction(set, (id) =>
      new Promise((resolve) => {
        if (id === 1) resolveCall1 = resolve;
        else resolveCall2 = resolve;
      })
    );

    const p1 = action(1).catch(() => {});
    const p2 = action(2).catch(() => {});

    resolveCall1();
    await p1;

    // Total set calls: 2x loading:true, 0x loading:false (call1 diabaikan)
    expect(set).toHaveBeenCalledTimes(2);

    resolveCall2();
    await p2;

    // Sekarang 3 calls total: 2x loading:true + 1x loading:false
    expect(set).toHaveBeenCalledTimes(3);
  });
});
