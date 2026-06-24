import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sanitizeError } from '../src/security/errorSanitizer.js';
import { sanitizeObject } from '../src/security/prototypePollutionGuard.js';
import { validateStorageData } from '../src/security/storageValidator.js';
import { clearSensitiveData } from '../src/security/clearSensitiveData.js';
import { resetAllStores } from '../src/security/resetAllStores.js';
import { createStore } from '../src/core/createStore.js';
import { createPersistentStore, STORAGE_PREFIX } from '../src/core/createPersistentStore.js';
import { clearRegistry, registerStore } from '../src/core/storeRegistry.js';
import * as publicApi from '../src/index.js';

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

// ---------------------------------------------------------------------------
// errorSanitizer
// ---------------------------------------------------------------------------
describe('errorSanitizer', () => {
  it('loloskan pesan error biasa', () => {
    expect(sanitizeError(new Error('Username tidak valid'))).toBe('Username tidak valid');
  });

  it('blokir stack trace', () => {
    const err = new Error('at Object.<anonymous> (/app/index.js:10:5)');
    expect(sanitizeError(err)).toBe('An error occurred');
  });

  it('blokir path absolut Unix', () => {
    expect(sanitizeError(new Error('/etc/passwd exposed'))).toBe('An error occurred');
  });

  it('blokir path absolut Windows', () => {
    expect(sanitizeError(new Error('C:\\Users\\admin\\secret'))).toBe('An error occurred');
  });

  it('blokir SQL', () => {
    expect(sanitizeError(new Error('SELECT * FROM users WHERE id=1'))).toBe('An error occurred');
  });

  it('blokir node internals', () => {
    expect(sanitizeError(new Error('node:internal/modules error'))).toBe('An error occurred');
  });

  // --- B-14: format kebocoran tambahan ---
  it('blokir home dir (~/)', () => {
    expect(sanitizeError(new Error('ENOENT: ~/.ssh/id_rsa missing'))).toBe('An error occurred');
  });

  it('blokir path Windows forward-slash (C:/)', () => {
    expect(sanitizeError(new Error('cannot open C:/Users/admin/secret.key'))).toBe('An error occurred');
  });

  it('blokir UNC path (\\\\server\\share)', () => {
    expect(sanitizeError(new Error('cannot access \\\\server\\share\\file'))).toBe('An error occurred');
  });

  it('blokir IPv6 bracketed ([::1]:port)', () => {
    expect(sanitizeError(new Error('connect failed [::1]:6379'))).toBe('An error occurred');
  });

  it('blokir connection string berkredensial', () => {
    expect(sanitizeError(new Error('postgres://user:p4ss@db.internal/prod failed'))).toBe('An error occurred');
  });

  it('TIDAK blokir kata Inggris umum (UPDATE/DELETE) tanpa konteks SQL', () => {
    expect(sanitizeError(new Error('Please UPDATE your profile'))).toBe('Please UPDATE your profile');
    expect(sanitizeError(new Error('DELETE this item?'))).toBe('DELETE this item?');
  });

  it('TIDAK blokir kalimat "SELECT ... from ..." natural (bukan SQL)', () => {
    const msg = 'SELECT an option from the list';
    expect(sanitizeError(new Error(msg))).toBe(msg);
  });

  it('kembalikan fallback kalau bukan Error object', () => {
    expect(sanitizeError(null)).toBe('An unexpected error occurred');
    expect(sanitizeError(undefined)).toBe('An unexpected error occurred');
    expect(sanitizeError(42)).toBe('An unexpected error occurred');
  });

  it('potong pesan yang terlalu panjang (max 200 char)', () => {
    const longMsg = 'a'.repeat(300);
    expect(sanitizeError(new Error(longMsg)).length).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// prototypePollutionGuard
// ---------------------------------------------------------------------------
describe('prototypePollutionGuard', () => {
  it('sanitizeObject ter-export di public API (B-13)', () => {
    expect(typeof publicApi.sanitizeObject).toBe('function');
  });

  it('hapus __proto__ dari object', () => {
    const malicious = JSON.parse('{"__proto__":{"isAdmin":true},"name":"test"}');
    const clean = sanitizeObject(malicious);
    // Tidak ada own property "__proto__" yang nyangkut + data jahat hilang
    expect(Object.prototype.hasOwnProperty.call(clean, '__proto__')).toBe(false);
    expect(clean.name).toBe('test');
    expect({}.isAdmin).toBeUndefined(); // global tidak terpolusi
  });

  it('hapus __proto__ bersarang (nested)', () => {
    const malicious = JSON.parse('{"a":{"__proto__":{"x":1},"b":2}}');
    const clean = sanitizeObject(malicious);
    expect(Object.prototype.hasOwnProperty.call(clean.a, '__proto__')).toBe(false);
    expect(clean.a.b).toBe(2);
  });

  it('object bersih tetap utuh', () => {
    const obj = { user: 'alice', role: 'admin', count: 5 };
    expect(sanitizeObject(obj)).toEqual(obj);
  });

  it('handle null dan primitive', () => {
    expect(sanitizeObject(null)).toBeNull();
    expect(sanitizeObject('string')).toBe('string');
    expect(sanitizeObject(42)).toBe(42);
  });

  // --- B-DoS: batas kedalaman rekursi ---
  it('tidak stack overflow pada object nested ekstrem (20k level)', () => {
    let deep = {};
    let cur = deep;
    for (let i = 0; i < 20000; i++) { cur.n = {}; cur = cur.n; }
    expect(() => sanitizeObject(deep)).not.toThrow();
  });

  it('object dengan kedalaman wajar tetap utuh', () => {
    const obj = { a: { b: { c: { d: 'deep-but-ok' } } } };
    expect(sanitizeObject(obj)).toEqual(obj);
  });
});

// ---------------------------------------------------------------------------
// storageValidator
// ---------------------------------------------------------------------------
describe('storageValidator', () => {
  it('ambil hanya field yang ada di allowedFields', () => {
    const raw = JSON.stringify({ theme: 'dark', secret: 'hidden', extra: 1 });
    const result = validateStorageData(raw, ['theme']);
    expect(result).toEqual({ theme: 'dark' });
    expect(result.secret).toBeUndefined();
  });

  it('return null kalau JSON tidak valid', () => {
    expect(validateStorageData('BUKAN_JSON', ['theme'])).toBeNull();
  });

  it('return null kalau bukan object', () => {
    expect(validateStorageData('"string"', ['theme'])).toBeNull();
    expect(validateStorageData('123', ['theme'])).toBeNull();
  });

  it('hapus field sensitif yang nyasar + log warning', () => {
    const raw = JSON.stringify({ theme: 'dark', token: 'abc123' });
    const result = validateStorageData(raw, ['theme', 'token']);
    expect(result.token).toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it('hapus token yang bersarang di dalam allowed field (deep-scan)', () => {
    const raw = JSON.stringify({ user: { name: 'Alice', token: 'leak' } });
    const result = validateStorageData(raw, ['user']);
    expect(result.user.token).toBeUndefined();
    expect(result.user.name).toBe('Alice');
    expect(console.warn).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearSensitiveData & resetAllStores
// ---------------------------------------------------------------------------
describe('clearSensitiveData', () => {
  it('reset semua store yang terdaftar', () => {
    const useStore = createStore('sec1', {
      state: { data: 'initial' },
      actions: (set) => ({ setData: (v) => set({ data: v }) }),
    });

    useStore.getState().setData('changed');
    expect(useStore.getState().data).toBe('changed');

    clearSensitiveData();

    expect(useStore.getState().data).toBe('initial');
  });

  it('hapus semua localStorage key dengan prefix store-boilerplate', () => {
    localStorage.setItem(`${STORAGE_PREFIX}auth`, '{"version":1,"state":{}}');
    localStorage.setItem(`${STORAGE_PREFIX}ui`, '{"version":1,"state":{}}');
    localStorage.setItem('other-key', 'tidak dihapus');

    clearSensitiveData();

    expect(localStorage.getItem(`${STORAGE_PREFIX}auth`)).toBeNull();
    expect(localStorage.getItem(`${STORAGE_PREFIX}ui`)).toBeNull();
    expect(localStorage.getItem('other-key')).toBe('tidak dihapus');
  });

  it('tidak crash kalau localStorage tidak tersedia', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      get: () => { throw new Error('no storage'); },
      configurable: true,
    });

    expect(() => clearSensitiveData()).not.toThrow();

    Object.defineProperty(window, 'localStorage', original);
  });
});

describe('resetAllStores', () => {
  it('reset semua store yang terdaftar', () => {
    const useA = createStore('reset-a', {
      state: { x: 1 },
      actions: (set) => ({ setX: (v) => set({ x: v }) }),
    });
    const useB = createStore('reset-b', {
      state: { y: 2 },
      actions: (set) => ({ setY: (v) => set({ y: v }) }),
    });

    useA.getState().setX(100);
    useB.getState().setY(200);

    resetAllStores();

    expect(useA.getState().x).toBe(1);
    expect(useB.getState().y).toBe(2);
  });

  it('tetap reset store lain meski satu store error', () => {
    const useGood = createStore('reset-good', {
      state: { v: 'ok' },
      actions: () => ({}),
    });

    // Inject store yang reset-nya throw
    registerStore('reset-bad', {
      reset: () => { throw new Error('reset gagal'); },
      clearStorage: () => {},
    });

    useGood.getState().setLoading(true);

    expect(() => resetAllStores()).not.toThrow();
    expect(useGood.getState().loading).toBe(false);
  });

  it('token di persistent store tidak masuk localStorage', () => {
    createPersistentStore('sec-auth', {
      state: { user: { name: 'Alice' }, token: 'secret-jwt' },
      actions: () => ({}),
      persistFields: ['user'], // token tidak di sini
    });

    const stored = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}sec-auth`));
    expect(stored?.state?.token).toBeUndefined();
    expect(stored?.state?.user?.name).toBe('Alice');
  });

  // --- B-11: sisi-tulis deep-scan ---
  it('token BERSARANG di dalam field yang di-persist tidak masuk localStorage', () => {
    createPersistentStore('sec-nested', {
      state: { user: { name: 'Alice', token: 'NESTED-JWT' } },
      actions: () => ({}),
      persistFields: ['user'],
    });

    const raw = localStorage.getItem(`${STORAGE_PREFIX}sec-nested`);
    expect(raw).not.toContain('NESTED-JWT'); // token bersarang tidak tertulis
    const stored = JSON.parse(raw);
    expect(stored.state.user.token).toBeUndefined();
    expect(stored.state.user.name).toBe('Alice');
  });

  // --- B-11b: password/secret top-level juga di-strip saat tulis ---
  it('password & secret top-level tidak ditulis ke localStorage', () => {
    createPersistentStore('sec-pw', {
      state: { theme: 'dark', password: 'PLAINTEXT', secret: 'MYSECRET' },
      actions: () => ({}),
      persistFields: ['theme', 'password', 'secret'],
    });

    const raw = localStorage.getItem(`${STORAGE_PREFIX}sec-pw`);
    expect(raw).not.toContain('PLAINTEXT');
    expect(raw).not.toContain('MYSECRET');
    const stored = JSON.parse(raw);
    expect(stored.state.theme).toBe('dark');
    expect(stored.state.password).toBeUndefined();
    expect(stored.state.secret).toBeUndefined();
  });
});
