import { SENSITIVE_FIELDS } from '../security/sensitiveFields.js';
import { maskSensitiveDeep } from '../security/deepSanitize.js';

const isDev = () =>
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : true;

/**
 * Logger middleware — log setiap perubahan state di dev.
 * Field sensitif ditampilkan sebagai '[FILTERED]', tidak pernah ter-log.
 * Auto nonaktif di production.
 *
 * Interface baru: (setState, getState, config) => wrappedSetState
 *
 * @param {function} setState - setState dari vanilla store (atau wrapper sebelumnya)
 * @param {function} getState - getState dari vanilla store
 * @param {object} config
 * @param {string} config.name - nama store untuk label log
 * @param {string[]} [config.filterFields=[]] - field tambahan yang di-filter
 * @returns {function} wrappedSetState
 */
export function loggerMiddleware(setState, getState, { name, filterFields = [] }) {
  if (!isDev()) return setState;

  const allFiltered = new Set([...SENSITIVE_FIELDS, ...filterFields]);

  return function wrappedSetState(partial) {
    // Masking rekursif — field sensitif bersarang (mis. user.token) juga
    // tertutup '[FILTERED]', bukan cuma level atas.
    const prevState = maskSensitiveDeep(getState(), allFiltered, '[FILTERED]');

    setState(partial);

    const nextState = maskSensitiveDeep(getState(), allFiltered, '[FILTERED]');

    console.group(`[store-boilerplate] ${name}`);
    console.log('prev ', prevState);
    console.log('next ', nextState);
    console.groupEnd();
  };
}
