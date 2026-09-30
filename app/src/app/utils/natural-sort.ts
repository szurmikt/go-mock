/**
 * Natural-order string comparison — "2" < "10", "Room 9" < "Room 12", plain text sorts
 * alphabetically. Same `localeCompare` options tuple already used (privately) by
 * `sortPropertiesByCompany` in auth.ts; extracted here as a shared, testable utility per
 * this codebase's `utils/*.ts` convention.
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}
