/**
 * Daftar nama field yang dianggap sensitif.
 * Dipakai oleh devtools masking, logger filter, storageValidator, dan persist guard.
 */
export const SENSITIVE_FIELDS = [
  'token',
  'accessToken',
  'refreshToken',
  'password',
  'secret',
  'otp',
];

/**
 * Field yang tidak boleh disimpan ke localStorage sama sekali.
 * Subset dari SENSITIVE_FIELDS yang spesifik untuk token auth.
 */
export const PERSIST_BLOCKED_FIELDS = [
  'token',
  'accessToken',
  'refreshToken',
];
