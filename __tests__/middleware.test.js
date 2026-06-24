import { describe, it, expect, afterEach, vi } from 'vitest';
import { loggerMiddleware } from '../src/middleware/logger.js';
import { devtoolsMiddleware } from '../src/middleware/devtools.js';
import { immerMiddleware } from '../src/middleware/immer.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete window.__REDUX_DEVTOOLS_EXTENSION__;
});

// ---------------------------------------------------------------------------
// loggerMiddleware — interface baru: (setState, getState, config) => wrappedSetState
// ---------------------------------------------------------------------------
describe('loggerMiddleware', () => {
  it('no-op di production — kembalikan setState apa adanya', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const setState = vi.fn();
    const result = loggerMiddleware(setState, () => ({}), { name: 'test' });
    expect(result).toBe(setState);
  });

  it('aktif di development — kembalikan fungsi baru (wrapped)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const setState = vi.fn();
    const result = loggerMiddleware(setState, () => ({}), { name: 'test' });
    expect(result).not.toBe(setState);
  });

  it('tetap memanggil setState yang dibungkus', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const setState = vi.fn();
    const wrapped = loggerMiddleware(setState, () => ({ a: 1 }), { name: 'test' });
    wrapped({ a: 2 });

    expect(setState).toHaveBeenCalledWith({ a: 2 });
  });

  it('field sensitif tampil [FILTERED], nilai asli tidak ter-log', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const logged = [];
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation((...args) => logged.push(args));
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const state = { user: 'alice', token: 'SUPER-SECRET-JWT', loading: false };
    const wrapped = loggerMiddleware(() => {}, () => state, { name: 'auth' });
    wrapped({ user: 'bob' });

    const dump = JSON.stringify(logged);
    expect(dump).not.toContain('SUPER-SECRET-JWT'); // token tidak bocor
    expect(dump).toContain('[FILTERED]');
  });

  it('token BERSARANG tidak bocor ke log (masking rekursif — B-12)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const logged = [];
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation((...args) => logged.push(args));
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const state = { user: { name: 'Alice', token: 'NESTED-SECRET-IN-LOG' }, loading: false };
    const wrapped = loggerMiddleware(() => {}, () => state, { name: 'auth' });
    wrapped({ loading: true });

    const dump = JSON.stringify(logged);
    expect(dump).not.toContain('NESTED-SECRET-IN-LOG');
    expect(dump).toContain('[FILTERED]');
  });

  it('action functions tidak ikut di-log (noise)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const logged = [];
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation((...args) => logged.push(args));
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const state = { count: 0, increment: () => {} };
    const wrapped = loggerMiddleware(() => {}, () => state, { name: 'x' });
    wrapped({ count: 1 });

    // Cari object state yang di-log, pastikan 'increment' tidak ada
    const hasFnKey = logged.some((args) =>
      args.some((a) => a && typeof a === 'object' && 'increment' in a)
    );
    expect(hasFnKey).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// devtoolsMiddleware
// ---------------------------------------------------------------------------
describe('devtoolsMiddleware', () => {
  it('no-op di production — kembalikan setState apa adanya', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const setState = vi.fn();
    const result = devtoolsMiddleware(setState, () => ({}), { name: 'test' });
    expect(result).toBe(setState);
  });

  it('aktif di development — kembalikan fungsi baru', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const setState = vi.fn();
    const result = devtoolsMiddleware(setState, () => ({}), { name: 'test' });
    expect(result).not.toBe(setState);
  });

  it('tetap memanggil setState meski DevTools extension tidak ada', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const setState = vi.fn();
    const wrapped = devtoolsMiddleware(setState, () => ({ a: 1 }), { name: 'test' });
    expect(() => wrapped({ a: 2 })).not.toThrow();
    expect(setState).toHaveBeenCalledWith({ a: 2 });
  });

  it('field sensitif dikirim ke DevTools sebagai [MASKED]', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const sent = [];
    const mockConnection = {
      init: (s) => sent.push(s),
      send: (_action, s) => sent.push(s),
    };
    window.__REDUX_DEVTOOLS_EXTENSION__ = {
      connect: () => mockConnection,
    };

    const state = { user: 'alice', token: 'JWT-SECRET', password: 'p@ss' };
    const wrapped = devtoolsMiddleware(() => {}, () => state, { name: 'auth' });
    wrapped({ user: 'bob' });

    const dump = JSON.stringify(sent);
    expect(dump).not.toContain('JWT-SECRET');
    expect(dump).not.toContain('p@ss');
    expect(dump).toContain('[MASKED]');
  });

  it('maskFields tambahan ikut di-mask', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const sent = [];
    window.__REDUX_DEVTOOLS_EXTENSION__ = {
      connect: () => ({ init: (s) => sent.push(s), send: (_a, s) => sent.push(s) }),
    };

    const state = { sessionKey: 'CUSTOM-SECRET', name: 'x' };
    const wrapped = devtoolsMiddleware(() => {}, () => state, {
      name: 'auth',
      maskFields: ['sessionKey'],
    });
    wrapped({ name: 'y' });

    expect(JSON.stringify(sent)).not.toContain('CUSTOM-SECRET');
  });

  it('token BERSARANG di-mask sebelum dikirim ke DevTools (B-12)', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const sent = [];
    window.__REDUX_DEVTOOLS_EXTENSION__ = {
      connect: () => ({ init: (s) => sent.push(s), send: (_a, s) => sent.push(s) }),
    };

    const state = { user: { name: 'Bob', accessToken: 'NESTED-DEVTOOLS-LEAK' } };
    const wrapped = devtoolsMiddleware(() => {}, () => state, { name: 'auth' });
    wrapped({ user: { name: 'Bob2' } });

    const dump = JSON.stringify(sent);
    expect(dump).not.toContain('NESTED-DEVTOOLS-LEAK');
    expect(dump).toContain('[MASKED]');
  });
});

// ---------------------------------------------------------------------------
// immerMiddleware — fallback dependency-free (immer tidak diinstall di test)
// ---------------------------------------------------------------------------
describe('immerMiddleware (fallback tanpa immer)', () => {
  it('update object biasa diteruskan langsung', () => {
    const setState = vi.fn();
    const wrapped = immerMiddleware(setState, () => ({ a: 1 }));
    wrapped({ a: 2 });
    expect(setState).toHaveBeenCalledWith({ a: 2 });
  });

  it('functional update (mutate draft) tidak merusak state — pakai fallback clone', () => {
    let current = { items: [1, 2] };
    const setState = vi.fn((next) => { current = next; });
    const wrapped = immerMiddleware(setState, () => current);

    wrapped((draft) => { draft.items.push(3); });

    expect(setState).toHaveBeenCalledOnce();
    const next = setState.mock.calls[0][0];
    expect(next.items).toEqual([1, 2, 3]);
    expect(next).not.toBeUndefined(); // tidak nuke state
  });

  it('mutasi draft tidak mengubah state lama (immutability)', () => {
    const original = { items: [1, 2] };
    const setState = vi.fn();
    const wrapped = immerMiddleware(setState, () => original);

    wrapped((draft) => { draft.items.push(99); });

    expect(original.items).toEqual([1, 2]); // original utuh
  });
});
