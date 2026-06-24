import { SENSITIVE_FIELDS } from '../security/sensitiveFields.js';
import { maskSensitiveDeep } from '../security/deepSanitize.js';

const isDev = () =>
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : true;

/**
 * Devtools middleware — integrasikan Redux DevTools Extension langsung.
 * Field sensitif di-mask sebelum dikirim.
 * Auto nonaktif di production.
 *
 * Interface baru: (setState, getState, config) => wrappedSetState
 *
 * @param {function} setState - setState dari vanilla store (atau wrapper sebelumnya)
 * @param {function} getState - getState dari vanilla store
 * @param {object} config
 * @param {string} config.name - nama store yang muncul di DevTools
 * @param {string[]} [config.maskFields=[]] - field tambahan yang di-mask
 * @returns {function} wrappedSetState
 */
export function devtoolsMiddleware(setState, getState, { name, maskFields = [] }) {
  if (!isDev()) return setState;

  const allMasked = new Set([...SENSITIVE_FIELDS, ...maskFields]);

  // Connect ke Redux DevTools Extension browser
  let devtools = null;
  if (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__) {
    try {
      devtools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({ name });
      devtools.init(maskSensitiveDeep(getState(), allMasked, '[MASKED]'));
    } catch {
      devtools = null; // DevTools tidak tersedia — lanjut tanpa crash
    }
  }

  return function wrappedSetState(partial) {
    setState(partial);

    if (!devtools) return;

    try {
      // Derive action name dari keys partial untuk readability di DevTools panel
      const actionName =
        typeof partial === 'object' && partial !== null
          ? `set(${Object.keys(partial).join(', ')})`
          : 'updater';

      // Masking rekursif — field sensitif bersarang juga jadi '[MASKED]'
      devtools.send(actionName, maskSensitiveDeep(getState(), allMasked, '[MASKED]'));
    } catch {
      // DevTools error tidak boleh crash app
    }
  };
}
