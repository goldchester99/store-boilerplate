# store-boilerplate

Custom state management library untuk ekosistem goldchester99. Dibangun di atas `useSyncExternalStore` React 18 — **zero external dependency**. Setup store baru dalam hitungan menit: loading state, error handling, persist, security, dan cross-tab sync sudah built-in.

---

## Daftar Isi

1. [Overview](#overview)
2. [Install](#install)
3. [Quick Start](#quick-start)
4. [Custom Engine](#custom-engine)
5. [API Reference](#api-reference)
   - [createStore](#createstore)
   - [createAsyncAction](#createasyncaction)
   - [createSlice & combineSlices](#createslice--combineslices)
   - [createPersistentStore](#createpersistentstore)
6. [Security](#security)
7. [Templates](#templates)
8. [Middleware](#middleware)
9. [Cross-tab Sync](#cross-tab-sync)
10. [Selector Convention](#selector-convention)
11. [Contributing](#contributing)
12. [Changelog](#changelog)

---

## Overview

Tanpa store-boilerplate, tiap project nulis ulang hal yang sama: loading state, error handling, persist pattern, token security. store-boilerplate hadir sebagai satu tempat — update sekali, berlaku di semua project.

```
goldchester99/store-boilerplate  ← kamu di sini
goldchester99/falcon-cms         ← pakai ini
goldchester99/owl-erp            ← pakai ini
goldchester99/eagle-trade        ← pakai ini
goldchester99/leopard-ea         ← pakai ini
```

**Peer dependencies:** React >= 18 only
**Optional:** immer >= 10
**Zero external state management dependency** — tidak butuh Zustand, Redux, atau library lain

---

## Install

```bash
# Di project kamu (falcon-cms, owl-erp, dll):
npm install github:goldchester99/store-boilerplate
npm install react
```

Lalu setup di entry point app:

```js
// src/main.jsx
import { initCrossTabSync } from 'store-boilerplate';

initCrossTabSync(); // jalankan sekali saat app boot
```

---

## Quick Start

```js
import { createStore, createAsyncAction } from 'store-boilerplate';

const usePostStore = createStore('posts', {
  state: {
    posts: [],
    selectedPost: null,
  },
  actions: (set) => ({
    fetchPosts: createAsyncAction(set, async () => {
      const res = await fetch('/api/posts');
      const data = await res.json();
      set({ posts: data });
    }),
    selectPost: (post) => set({ selectedPost: post }),
  }),
});

export default usePostStore;
```

```jsx
// Di komponen — selalu pakai selector
const posts = usePostStore((state) => state.posts);
const loading = usePostStore((state) => state.loading);
const fetchPosts = usePostStore((state) => state.fetchPosts);
```

---

## Custom Engine

store-boilerplate tidak bergantung pada library state management eksternal. Engine-nya dibangun sendiri di atas tiga primitif:

### createVanillaStore

Core state container — framework-agnostic.

```js
import { createVanillaStore } from 'store-boilerplate';

const store = createVanillaStore({ count: 0 });

// Baca state
store.getState(); // { count: 0 }

// Update state — object (merge) atau function
store.setState({ count: 1 });
store.setState((prev) => ({ count: prev.count + 1 }));

// Subscribe ke perubahan
const unsubscribe = store.subscribe(() => {
  console.log('state changed:', store.getState());
});
unsubscribe(); // lepas listener

// Hapus semua listener
store.destroy();
```

> `setState` dengan value yang sama persis (reference equality) tidak akan notify subscriber — tidak ada re-render sia-sia.

### useStore

React hook untuk subscribe ke vanilla store. Menggunakan `useSyncExternalStore` built-in React 18.

```js
import { useStore, createVanillaStore } from 'store-boilerplate';

const myStore = createVanillaStore({ user: null, theme: 'light' });

// Di komponen:
const theme = useStore(myStore, (s) => s.theme);       // selector
const state = useStore(myStore);                        // seluruh state
```

Shallow equality aktif secara default — kalau selector return object baru tapi nilainya sama, component **tidak** re-render.

### shallow

Shallow equality function yang dipakai `useStore` secara internal.

```js
import { shallow } from 'store-boilerplate';

shallow({ a: 1, b: 2 }, { a: 1, b: 2 }); // true
shallow({ a: 1 }, { a: 1, b: 2 });        // false — jumlah key beda
shallow({ a: { x: 1 } }, { a: { x: 1 } }); // false — beda reference (shallow, bukan deep)
```

---

## API Reference

### createStore

Factory utama. Setiap store otomatis punya `loading`, `error`, `setLoading`, `setError`, `reset`.

```js
createStore(name, options)
```

| Option | Type | Default | Keterangan |
|--------|------|---------|------------|
| `state` | `object` | `{}` | Initial state |
| `actions` | `(set, get) => object` | `() => ({})` | Action definitions |
| `persist` | `boolean` | `false` | Aktifkan localStorage sync |
| `persistFields` | `string[]` | `[]` | Field yang boleh disimpan (wajib kalau `persist: true`) |
| `devtools` | `boolean` | `true` | Redux DevTools (dev only) |
| `maskFields` | `string[]` | `[]` | Field tambahan yang di-mask di DevTools |
| `useImmer` | `boolean` | `false` | Aktifkan immer middleware |

**Built-in state & actions:**

```js
store.loading          // boolean — default false
store.error            // string | null — default null
store.setLoading(bool)
store.setError(msg)
store.reset()          // kembali ke initial state saat createStore dipanggil
```

**Hook API:**

```js
const useMyStore = createStore('name', { ... });

useMyStore((s) => s.count)  // selector — re-render hanya kalau count berubah
useMyStore.getState()       // baca state di luar komponen
useMyStore.subscribe(fn)    // manual subscribe
```

---

### createAsyncAction

Wrapper untuk async operation. Auto handle `loading`/`error` state + race condition guard.

```js
createAsyncAction(set, asyncFn)
```

```js
actions: (set) => ({
  fetchUser: createAsyncAction(set, async (id) => {
    const user = await api.getUser(id);
    set({ user });
  }),
}),
```

**Race condition guard:** kalau `fetchUser` dipanggil dua kali sebelum yang pertama selesai, hasil call pertama diabaikan. State hanya diupdate oleh call terakhir.

**Error sanitasi:** error dari asyncFn otomatis disanitasi — stack trace, path file, SQL query tidak akan muncul di state.

---

### createSlice & combineSlices

Pecah store besar jadi domain-domain kecil.

```js
import { createSlice, combineSlices } from 'store-boilerplate';

const authSlice = createSlice('auth', {
  state: { user: null, isAuthenticated: false },
  actions: (set) => ({
    setUser: (user) => set({ user, isAuthenticated: !!user }),
  }),
});

const uiSlice = createSlice('ui', {
  state: { theme: 'light', sidebarOpen: true },
  actions: (set) => ({
    toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  }),
});

const useAppStore = combineSlices('app', [authSlice, uiSlice]);
```

> Kalau ada konflik nama antar slice, `combineSlices` throw error saat development dengan pesan yang jelas.

---

### createPersistentStore

Store dengan sync ke localStorage (atau sessionStorage). Punya `isHydrated` flag untuk cegah UI flicker.

```js
createPersistentStore(name, options)
```

Semua option dari `createStore`, ditambah:

| Option | Type | Default | Keterangan |
|--------|------|---------|------------|
| `persistFields` | `string[]` | `[]` | Field yang boleh disimpan (wajib) |
| `storage` | `'localStorage' \| 'sessionStorage'` | `'localStorage'` | Storage engine |
| `version` | `number` | `1` | Versi schema untuk migration |
| `migrate` | `(oldState, oldVersion) => newState` | `null` | Konversi data lama saat version berubah |

```js
const useSettingsStore = createPersistentStore('settings', {
  state: { theme: 'light', language: 'id' },
  actions: (set) => ({
    setTheme: (theme) => set({ theme }),
  }),
  persistFields: ['theme', 'language'],
  version: 2,
  migrate: (oldState, oldVersion) => {
    if (oldVersion === 1) {
      return { ...oldState, language: oldState.lang ?? 'id' };
    }
    return oldState;
  },
});
```

**`isHydrated` flag:**

```jsx
const isHydrated = useSettingsStore((state) => state.isHydrated);

if (!isHydrated) return <Skeleton />;
return <App />;
```

---

## Security

### Token memory-only pattern

Token JWT **tidak boleh masuk localStorage**. Simpan di memory saja, jangan masukkan ke `persistFields`.

```js
// ✅ Benar
createPersistentStore('auth', {
  state: { user: null, token: null },
  persistFields: ['user'],  // token tidak ada di sini
});

// ❌ Salah — store-boilerplate akan throw warning
createPersistentStore('auth', {
  state: { token: null },
  persistFields: ['token'], // ← warning otomatis muncul
});
```

### clearSensitiveData()

Wipe semua data saat logout — reset semua store + hapus semua localStorage key.

```js
import { clearSensitiveData } from 'store-boilerplate';

logout: () => {
  clearSensitiveData();
  // redirect ke login page
},
```

### resetAllStores()

Reset semua store terdaftar ke initial state dalam satu panggilan.

```js
import { resetAllStores } from 'store-boilerplate';
resetAllStores();
```

> `clearSensitiveData()` sudah memanggil `resetAllStores()` secara internal.

### Prototype pollution guard

Data dari **localStorage** otomatis disanitasi saat hydration — field `__proto__`, `constructor`, `prototype` di-strip rekursif sebelum masuk ke state.

Untuk data dari **API response**, sanitasi tidak otomatis (supaya tidak mengorbankan Date/function di state). Sanitasi manual sebelum `set()` kalau sumbernya tidak tepercaya:

```js
import { sanitizeObject } from 'store-boilerplate';

fetchData: createAsyncAction(set, async () => {
  const res = await fetch('/api/data');
  const data = await res.json();
  set({ data: sanitizeObject(data) }); // strip __proto__/constructor/prototype rekursif
}),
```

### Error sanitizer

Error dari async action otomatis disanitasi — stack trace, path file, SQL query diblokir. Hanya pesan yang aman yang masuk ke `error` state.

---

## Templates

Copy file template ke project kamu, jangan diimport langsung — supaya bisa dikustomisasi per project.

```bash
# Lokasi template setelah install:
node_modules/store-boilerplate/templates/auth.store.js
node_modules/store-boilerplate/templates/ui.store.js
node_modules/store-boilerplate/templates/notification.store.js
```

### auth.store.js

State: `user` (persist), `token` (memory only, **tidak** di persistFields), `isAuthenticated` (persist)
Actions: `login`, `logout`, `setUser`, `refreshToken`

### ui.store.js

State: `theme`, `sidebarOpen` (persist) — `activeModal`, `pageTitle` (tidak persist)
Actions: `toggleTheme`, `toggleSidebar`, `openModal`, `closeModal`, `setPageTitle`

### notification.store.js

State: `notifications`, `unreadCount` (tidak persist)
Actions: `addNotification`, `removeNotification`, `clearAll`, `markAllRead`

---

## Middleware

Semua middleware **auto nonaktif di production**. Tidak perlu konfigurasi manual.

Middleware interface: `(setState, getState, config) => wrappedSetState`

### devtools

Integrasi langsung ke Redux DevTools browser extension. Field sensitif tampil sebagai `[MASKED]`. Action name di-derive otomatis dari keys yang diupdate.

```js
createStore('auth', {
  maskFields: ['sessionKey'], // tambahan di luar default
});
```

Default masked: `token`, `accessToken`, `refreshToken`, `password`, `secret`, `otp`

### logger

Log setiap perubahan state di console. Field sensitif tampil sebagai `[FILTERED]`.

```
[store-boilerplate] auth
  prev  { user: null, token: [FILTERED], loading: false }
  next  { user: { name: 'Alice' }, token: [FILTERED], loading: false }
```

### immer (opsional)

Aktifkan per store dengan `useImmer: true`. Butuh `npm install immer` terlebih dahulu.

```js
createStore('cart', {
  useImmer: true,
  actions: (set) => ({
    addItem: (item) => set((draft) => { draft.items.push(item); }),
    removeItem: (id) => set((draft) => {
      draft.items = draft.items.filter((i) => i.id !== id);
    }),
  }),
});
```

> ⚠️ Pastikan validasi data dari user input atau API sebelum di-set dengan immer.

---

## Cross-tab Sync

Kalau user logout di satu tab, semua tab lain ikut logout otomatis — tanpa konfigurasi tambahan.

```js
// src/main.jsx — jalankan sekali saat app boot
import { initCrossTabSync } from 'store-boilerplate';
initCrossTabSync();
```

Secara default, logout antar-tab dipicu saat store bernama **`auth`** dihapus. Kalau project kamu menamai store auth berbeda, atur lewat `authStoreName`:

```js
initCrossTabSync({ authStoreName: 'session' });   // satu nama
initCrossTabSync({ authStoreName: ['auth', 'session'] }); // beberapa nama
```

`initCrossTabSync()` mengembalikan cleanup function — berguna di tests:

```js
const cleanup = initCrossTabSync();
cleanup(); // lepas listener
```

---

## Selector Convention

Selalu pakai selector untuk cegah re-render berlebihan:

```jsx
// ✅ Benar — re-render hanya kalau posts berubah
const posts = usePostStore((state) => state.posts);
const fetchPosts = usePostStore((state) => state.fetchPosts);

// ❌ Hindari — re-render setiap ada perubahan apapun di store
const store = usePostStore();
```

Shallow equality aktif secara default di `useStore` — kalau selector mengembalikan object baru tapi nilainya sama, React tidak re-render.

---

## Contributing

1. Fork repo
2. Buat branch: `git checkout -b feat/nama-fitur`
3. Pastikan tests passing: `npm test`
4. Update CHANGELOG.md
5. Submit PR ke `main`

**Sebelum push:**
- [ ] Semua tests passing (`npm test`)
- [ ] Tidak ada sensitive data di code atau test fixtures
- [ ] CHANGELOG.md diupdate
- [ ] `package.json` version di-bump (SemVer)
- [ ] devtools dan logger sudah dipastikan mati di production

---

## Changelog

Lihat [CHANGELOG.md](./CHANGELOG.md)
