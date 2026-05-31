/**
 * Returns true when `current` is strictly lower than `minimum`.
 * Compares dot-separated numeric versions part-by-part, padding the shorter
 * one with zeros (e.g. '1.0' is treated as '1.0.0' against '1.1.0').
 * Equal versions are NOT below.
 */
export function isVersionBelow(current: string, minimum: string): boolean {
  const c = current.split('.').map(n => parseInt(n, 10) || 0);
  const m = minimum.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(c.length, m.length);

  for (let i = 0; i < len; i++) {
    const cv = c[i] ?? 0;
    const mv = m[i] ?? 0;
    if (cv < mv) return true;
    if (cv > mv) return false;
  }
  return false; // equal
}
