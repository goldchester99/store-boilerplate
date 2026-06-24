import { sanitizeObject } from './prototypePollutionGuard.js';
import { SENSITIVE_FIELDS } from './sensitiveFields.js';
import { stripSensitiveDeep } from './deepSanitize.js';

/**
 * Validasi dan sanitasi data dari localStorage sebelum masuk ke state.
 *
 * @param {string} rawString - string JSON dari localStorage
 * @param {string[]} allowedFields - field yang boleh diambil (persistFields)
 * @returns {object|null} object bersih, atau null kalau tidak valid
 */
export function validateStorageData(rawString, allowedFields) {
  // 1. Coba parse JSON
  let parsed;
  try {
    parsed = JSON.parse(rawString);
  } catch {
    return null;
  }

  // 2. Harus object, bukan null atau array
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  // 3. Sanitasi prototype pollution (rekursif)
  const sanitized = sanitizeObject(parsed);

  // 4. Ambil hanya field yang ada di allowedFields
  const result = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(sanitized, field)) {
      result[field] = sanitized[field];
    }
  }

  // 5. Deep-scan: buang field sensitif di SEMUA level (bukan cuma top-level).
  //    Mencegah token bersarang (mis. user.token) lolos ke state/storage.
  const sensitiveSet = new Set(SENSITIVE_FIELDS);
  const found = { hit: false };
  const cleaned = stripSensitiveDeep(result, sensitiveSet, found);

  if (found.hit) {
    console.warn(
      '[store-boilerplate] Field sensitif (token/password/dll) ditemukan di ' +
        'localStorage — dihapus otomatis sebelum masuk ke state.'
    );
  }

  return cleaned;
}
