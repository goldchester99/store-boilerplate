/**
 * Shallow equality — bandingkan dua object di level pertama.
 * Dipakai useStore sebagai default equality check untuk cegah re-render tidak perlu.
 *
 * @param {*} objA
 * @param {*} objB
 * @returns {boolean}
 *
 * @example
 * shallow({ a: 1, b: 2 }, { a: 1, b: 2 }) // true
 * shallow({ a: 1 }, { a: 1, b: 2 })        // false — jumlah key beda
 * shallow({ a: { x: 1 } }, { a: { x: 1 } }) // false — nested object beda reference
 */
export function shallow(objA, objB) {
  if (objA === objB) return true;

  if (
    typeof objA !== 'object' || objA === null ||
    typeof objB !== 'object' || objB === null
  ) {
    return objA === objB;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (objA[key] !== objB[key]) return false;
  }

  return true;
}
