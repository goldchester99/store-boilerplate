# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning menggunakan [SemVer](https://semver.org/).

---

## [1.0.1] — 2026-06-24

### Changed
- **`templates/auth.store.js` — implementasi nyata, tanpa placeholder.** Template diganti dari `createPersistentStore` ke `createStore` (zero persistence untuk auth state). `fetchToken()` placeholder dihapus, diganti fetch langsung ke `/api/auth/login`. `refreshToken` diubah dari sync setter ke async action yang fetch `/api/auth/refresh` via httpOnly cookie. `logout` kini memanggil `/api/auth/logout` di server sebelum `clearSensitiveData()`, dengan `try/finally` untuk memastikan state lokal selalu bersih meskipun API call gagal. Field `token` di-rename ke `accessToken`. `user` object dari API di-sanitasi via `sanitizeObject()` sebelum masuk state.

### Security
- **`templates/auth.store.js` — zero auth state di localStorage.** Tidak ada `user`, `accessToken`, maupun `isAuthenticated` yang tersimpan di storage. Attack surface di localStorage untuk auth = nol. Session di-restore eksklusif via httpOnly cookie (`/api/auth/refresh`).

### Security
- **Sisi-tulis persistence kini deep-scan field sensitif (B-11/B-11b).** `saveToStorage` men-strip 6 field sensitif (`token`, `accessToken`, `refreshToken`, `password`, `secret`, `otp`) di SEMUA level sebelum menulis ke storage — token/password bersarang (mis. `user.token`) tidak pernah menyentuh disk. Sebelumnya sisi-tulis hanya memblokir 3 jenis token di level atas.
- **Masking logger & devtools kini rekursif (B-12).** Field sensitif bersarang ditutup `[FILTERED]`/`[MASKED]`, bukan cuma level atas.
- **`sanitizeObject` di-export (B-13).** Developer bisa sanitasi data API response secara manual sebelum `set()`.
- Util sanitasi rekursif dikonsolidasikan di `src/security/deepSanitize.js` (`stripSensitiveDeep`, `maskSensitiveDeep`) — dipakai bersama storageValidator, createPersistentStore, logger, dan devtools agar sisi-baca dan sisi-tulis konsisten.

### Security
- **errorSanitizer diperketat (B-14).** Kini juga memblokir: path home dir (`~/`), path Windows forward-slash (`C:/`), UNC path (`\\server\share`), IPv6 bracketed (`[::1]:port`), dan connection string berkredensial (`scheme://user:pass@host`). Deteksi SQL dipersempit jadi pola query nyata (`SELECT * FROM`, `SELECT…FROM…WHERE`, `INSERT INTO`, `UPDATE…SET`, `DELETE FROM`) agar kalimat Inggris biasa ("SELECT an option from the list") tidak ikut diblokir.
- **Batas kedalaman rekursi (B-DoS).** Semua fungsi rekursif (`sanitizeObject`, `stripSensitiveDeep`, `maskSensitiveDeep`, immer `draftClone`) dibatasi 100 level — cegah stack overflow dari payload nested ekstrem (mis. localStorage/API yang sengaja dibuat ribuan level).

### Changed
- **`initCrossTabSync(options)` kini menerima `authStoreName`** (string atau array, default `'auth'`) — logout antar-tab bisa dipicu store auth dengan nama apa pun, bukan hardcode `'auth'`. Backward compatible: `initCrossTabSync()` tetap berfungsi seperti sebelumnya.
- **`combineSlices` memanggil action factory tiap slice tepat sekali.** Sebelumnya factory dipanggil dua kali (sekali untuk deteksi konflik dengan mock set/get, sekali asli) sehingga side-effect bisa berjalan ganda. Sekarang deteksi konflik memakai key asli dari satu kali pemanggilan. Ditambah suite test `combineSlices.test.js` (sebelumnya tidak ada test).

### Fixed
- **B-01** immer dynamic import memakai variable specifier + `/* @vite-ignore */` supaya bundler (Vite/Rollup) tidak gagal resolve saat immer tidak diinstall.
- **B-10** `createVanillaStore.setState` bentuk function kini selalu shallow-merge (sebelumnya me-replace state → action hilang).
- **B-09** persistent store menulis snapshot awal ke storage saat dibuat (sebelumnya hanya saat ada perubahan).
- errorSanitizer: blok path relatif (`./`, `../`) & IP internal; kurangi false-positive SQL (butuh verb + clause).
- prototypePollutionGuard: strip `__proto__` rekursif di semua level (JSON round-trip tidak cukup).

### Changed — Breaking
- Hapus Zustand sebagai dependency. Engine state management dibangun sendiri di atas `useSyncExternalStore` React 18.
- Middleware interface berubah dari Zustand creator pattern ke `(setState, getState, config) => wrappedSetState`.
- `devtools.js` tidak lagi wrap Zustand devtools — langsung integrate ke `window.__REDUX_DEVTOOLS_EXTENSION__`.
- `immer.js` tidak lagi wrap Zustand immer — langsung pakai `immer.produce`.

### Added
- `src/engine/createVanillaStore.js` — core state container (getState, setState, subscribe, destroy).
- `src/engine/useStore.js` — React hook via `useSyncExternalStore` + shallow equality.
- `src/engine/shallow.js` — shallow equality function untuk selector comparison.
- `__tests__/engine.test.js` — 20 test cases untuk custom engine.
- Public export untuk engine: `createVanillaStore`, `useStore`, `shallow` dari `src/index.js`.

### Removed
- `zustand` dari `peerDependencies` dan `devDependencies`.
- Import `{ create }` dari `zustand` di `createStore.js` dan `createPersistentStore.js`.
- Import `{ devtools }` dari `zustand/middleware` di `devtools.js`.
- Import `{ immer }` dari `zustand/middleware/immer` di `immer.js`.

---

## [1.0.0] — 2026-06-23

### Added

**Core**
- `createStore(name, options)` — factory utama dengan built-in `loading`, `error`, `setLoading`, `setError`, `reset`.
- `createAsyncAction(set, asyncFn)` — async wrapper dengan auto loading/error state dan race condition guard.
- `createSlice(name, definition)` — definisi domain state per slice.
- `combineSlices(name, slices)` — gabungkan beberapa slice jadi satu store dengan conflict detection.
- `createPersistentStore(name, options)` — store dengan localStorage/sessionStorage sync, `isHydrated` flag, validasi, dan migration strategy.

**Security**
- `clearSensitiveData()` — wipe semua store + localStorage key terkait.
- `resetAllStores()` — reset semua store terdaftar dalam satu panggilan.
- `errorSanitizer` — filter stack trace, path file, SQL dari error message sebelum masuk state.
- `prototypePollutionGuard` — sanitasi objek dari luar sebelum di-merge ke state.
- `storageValidator` — validasi + filter data dari localStorage sebelum hydration.
- `sensitiveFields` — daftar field sensitif default: `token`, `accessToken`, `refreshToken`, `password`, `secret`, `otp`.

**Middleware** (auto nonaktif di production)
- `devtoolsMiddleware` — Redux DevTools integration dengan sensitive field masking (`[MASKED]`).
- `loggerMiddleware` — log perubahan state dengan sensitive field filter (`[FILTERED]`).
- `immerMiddleware` — opsional, tidak aktif default.

**Sync**
- `initCrossTabSync()` — cross-tab logout sync via `storage` event listener.

**Templates**
- `auth.store.js` — token memory-only, user + isAuthenticated di-persist.
- `ui.store.js` — theme + sidebarOpen di-persist.
- `notification.store.js` — zero persistence, in-app notifications.

**Internal**
- `storeRegistry` — registry internal semua store untuk `resetAllStores` dan `clearSensitiveData`.

### Security notes
- Token JWT tidak pernah menyentuh localStorage — enforced via warning.
- Sensitive field masking aktif secara default di devtools dan logger.
- Prototype pollution guard pada semua data eksternal.
- Error sanitizer memblokir stack trace, path absolut, SQL query.
