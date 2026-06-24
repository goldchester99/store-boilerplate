/**
 * Sanitasi objek dari luar (API response, localStorage) sebelum masuk ke state.
 *
 * Pendekatan: rebuild object secara rekursif dengan plain object,
 * skip key berbahaya (__proto__, constructor, prototype) di SETIAP level.
 *
 * Kenapa bukan JSON.parse(JSON.stringify)? Karena JSON round-trip TIDAK
 * menghapus own property "__proto__" yang dibuat via JSON.parse — payload
 * jahat tetap nyangkut di dalam object. Rebuild manual menjaminnya bersih.
 *
 * Catatan:
 * - Function & primitive dikembalikan by reference (tidak di-clone)
 * - Date dikembalikan apa adanya (tidak dikorupsi seperti di JSON round-trip)
 * - Object hasil selalu plain object dengan prototype normal
 */

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Batas kedalaman rekursi — cegah stack overflow dari payload nested ekstrem (DoS).
// State yang wajar jarang lebih dalam dari ini; cabang lebih dalam dibuang.
const MAX_DEPTH = 100;

export function sanitizeObject(obj) {
  return clean(obj, 0);
}

function clean(value, depth) {
  if (depth > MAX_DEPTH) return null; // truncate cabang yang terlalu dalam

  if (Array.isArray(value)) {
    return value.map((v) => clean(v, depth + 1));
  }

  if (value !== null && typeof value === 'object') {
    // Date / RegExp dsb — kembalikan apa adanya, jangan rebuild
    if (!isPlainObject(value)) return value;

    const out = {};
    for (const key of Object.keys(value)) {
      // Skip key berbahaya — assignment ke '__proto__' juga bisa trigger
      // setter, jadi kita lewati sepenuhnya
      if (DANGEROUS_KEYS.has(key)) continue;
      out[key] = clean(value[key], depth + 1);
    }
    return out;
  }

  // null, primitive, function — by reference
  return value;
}

function isPlainObject(value) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
