/**
 * Sanitasi error sebelum disimpan ke state.
 * Memblokir stack trace, path (absolut & relatif), IP internal,
 * SQL query, dan node internals.
 */

const BLOCKED_PATTERNS = [
  // Path absolut Unix (/...), relatif (./ ../), atau home dir (~/) —
  // didahului awal string atau spasi
  /(^|\s)(~|\.{0,2})\/[^\s]*/,
  // Path Windows (backslash maupun forward-slash): C:\... atau C:/...
  /[A-Za-z]:[\\/]/,
  // UNC path: \\server\share
  /\\\\[^\s\\]+/,
  // Stack trace: "at fn (...)" atau "...:line:col"
  /\bat\s+.+\s+\(/,
  /:\d+:\d+/,
  // Alamat IPv4 (opsional dengan port) — kebocoran info infrastruktur
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  // IPv6 dalam bentuk host: [::1], [fe80::1] (harus ada ':' di dalam kurung)
  /\[[0-9a-fA-F:]*:[0-9a-fA-F:]*\]/,
  // Connection string dengan kredensial: scheme://user:pass@host
  /[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/i,
  // SQL: pola spesifik query nyata supaya tidak false-positive pada kalimat
  // Inggris biasa ("SELECT an option from the list", "Please UPDATE your
  // profile", "DELETE this item?" tidak diblok).
  /\bSELECT\b[\s\S]*\*[\s\S]*\bFROM\b/i,        // SELECT * FROM
  /\bSELECT\b[\s\S]*\bFROM\b[\s\S]*\bWHERE\b/i,  // SELECT ... FROM ... WHERE
  /\bINSERT\s+INTO\b/i,                          // INSERT INTO
  /\bUPDATE\b[\s\S]*\bSET\b/i,                   // UPDATE ... SET
  /\bDELETE\s+FROM\b/i,                          // DELETE FROM
  // Node internals
  /node_modules|node:internal/,
];

const MAX_LENGTH = 200;

export function sanitizeError(err) {
  if (!err) return 'An unexpected error occurred';

  if (typeof err === 'string') {
    return sanitizeMessage(err);
  }

  if (err instanceof Error && typeof err.message === 'string') {
    return sanitizeMessage(err.message);
  }

  return 'An unexpected error occurred';
}

function sanitizeMessage(message) {
  const trimmed = message.slice(0, MAX_LENGTH);

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'An error occurred';
    }
  }

  return trimmed;
}
