/**
 * Utilitas sanitasi rekursif yang dipakai bersama oleh:
 * - storageValidator (sisi-baca localStorage)
 * - createPersistentStore.saveToStorage (sisi-tulis localStorage)
 * - logger & devtools middleware (masking di dev)
 *
 * Tujuannya menyamakan perilaku sisi-baca dan sisi-tulis supaya tidak ada
 * asimetri yang bikin field sensitif lolos di salah satu jalur.
 */

// Batas kedalaman rekursi — cegah stack overflow dari payload nested ekstrem (DoS).
const MAX_DEPTH = 100;

function isPlainObject(value) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Buang field sensitif di SEMUA level kedalaman.
 *
 * @param {*} value - data yang mau dibersihkan
 * @param {Set<string>} sensitiveSet - nama field yang harus dibuang
 * @param {{ hit: boolean }} [found] - opsional, di-set true kalau ada yang dibuang
 * @returns data bersih (object hasil selalu plain object baru)
 */
export function stripSensitiveDeep(value, sensitiveSet, found, depth = 0) {
  if (depth > MAX_DEPTH) return null; // truncate cabang terlalu dalam

  if (Array.isArray(value)) {
    return value.map((v) => stripSensitiveDeep(v, sensitiveSet, found, depth + 1));
  }

  if (value !== null && typeof value === 'object') {
    if (!isPlainObject(value)) return value; // Date/RegExp dsb — biarkan
    const out = {};
    for (const key of Object.keys(value)) {
      if (sensitiveSet.has(key)) {
        if (found) found.hit = true;
        continue;
      }
      out[key] = stripSensitiveDeep(value[key], sensitiveSet, found, depth + 1);
    }
    return out;
  }

  return value;
}

/**
 * Mask nilai field sensitif di SEMUA level menjadi placeholder.
 * Function di-skip (noise/tidak bisa diserialisasi).
 *
 * @param {*} value - data yang mau di-mask
 * @param {Set<string>} maskedSet - nama field yang harus di-mask
 * @param {string} placeholder - mis. '[MASKED]' atau '[FILTERED]'
 * @returns salinan data dengan field sensitif tergantikan placeholder
 */
export function maskSensitiveDeep(value, maskedSet, placeholder, depth = 0) {
  if (depth > MAX_DEPTH) return '[DEPTH LIMIT]'; // truncate cabang terlalu dalam

  if (Array.isArray(value)) {
    return value.map((v) => maskSensitiveDeep(v, maskedSet, placeholder, depth + 1));
  }

  if (value !== null && typeof value === 'object') {
    if (!isPlainObject(value)) return value; // Date/RegExp dsb — tampilkan apa adanya
    const out = {};
    for (const key of Object.keys(value)) {
      if (typeof value[key] === 'function') continue; // skip action functions
      out[key] = maskedSet.has(key)
        ? placeholder
        : maskSensitiveDeep(value[key], maskedSet, placeholder, depth + 1);
    }
    return out;
  }

  return value;
}
