// Engine (advanced use — untuk custom store di luar createStore)
export { createVanillaStore } from './engine/createVanillaStore.js';
export { useStore } from './engine/useStore.js';
export { shallow } from './engine/shallow.js';

// Core
export { createStore } from './core/createStore.js';
export { createAsyncAction } from './core/createAsyncAction.js';
export { createSlice } from './core/createSlice.js';
export { combineSlices } from './core/combineSlices.js';
export { createPersistentStore } from './core/createPersistentStore.js';

// Security
export { clearSensitiveData } from './security/clearSensitiveData.js';
export { resetAllStores } from './security/resetAllStores.js';
// sanitizeObject di-export agar developer bisa sanitasi data eksternal
// (API response) secara manual sebelum di-set ke state — guard prototype pollution.
export { sanitizeObject } from './security/prototypePollutionGuard.js';

// Middleware (di-export untuk advanced use)
export { devtoolsMiddleware } from './middleware/devtools.js';
export { loggerMiddleware } from './middleware/logger.js';
export { immerMiddleware } from './middleware/immer.js';

// Sync
export { initCrossTabSync } from './sync/crossTabSync.js';
