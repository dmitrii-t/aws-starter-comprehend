/**
 * Splits array to array of chunks limited by provided max param
 *
 * @param array
 * @param max
 */
export function batch<T>(array: T[], max: number): T[][] {
  return Array.from(batchGenerator(array, max))
}

/**
 * Creates batch iterator
 *
 * @param array
 * @param max
 */
function* batchGenerator<T>(array: T[], max: number) {
  // Alters the copy of the original array
  let copy = new Array<T>();
  copy = copy.concat(array);
  while (copy.length > 0) {
    const limit = Math.min(copy.length, max);
    yield copy.splice(0, limit);
  }
}
