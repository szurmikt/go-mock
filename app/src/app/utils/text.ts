/** Lowercases and strips diacritics so "Tamás" and "Tamas" compare equal. */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')                    // split base char + combining accent
    .replace(/[̀-ͯ]/g, '')     // drop combining marks
    .toLowerCase();
}
