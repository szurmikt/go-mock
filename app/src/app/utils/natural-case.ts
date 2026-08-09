/** Converts ALL-CAPS OCR text like "TAMAS SZURMIK" into "Tamas Szurmik" (simple Title Case). */
export function toNaturalCase(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  return value
    .replace(/\s*\(\s*/g, ' (') // normalize to exactly one space before "("
    .replace(/\s*\)\s*/g, ') ') // normalize to exactly one space after ")"
    .trim()
    .toLowerCase()
    .replace(/(^|[\s(])\p{L}/gu, m => m.toUpperCase());
}
