import { toNaturalCase } from './natural-case';

describe('toNaturalCase', () => {
  it('title-cases an all-caps name', () => {
    expect(toNaturalCase('TAMAS SZURMIK')).toBe('Tamas Szurmik');
  });

  it('title-cases accented Hungarian characters', () => {
    expect(toNaturalCase('JÁNOS KOVÁCS')).toBe('János Kovács');
  });

  it('title-cases a multi-word place name', () => {
    expect(toNaturalCase('BUDAPEST XI. KERULET')).toBe('Budapest Xi. Kerulet');
  });

  it('adds a space around parentheses and capitalizes the word inside', () => {
    expect(toNaturalCase('KECSKEMET(MAGYARORSZAG)')).toBe('Kecskemet (Magyarorszag)');
  });

  it('is idempotent on already-spaced parentheses', () => {
    expect(toNaturalCase('KECSKEMET (MAGYARORSZAG)')).toBe('Kecskemet (Magyarorszag)');
  });

  it('returns null/undefined unchanged', () => {
    expect(toNaturalCase(null)).toBe(null);
    expect(toNaturalCase(undefined)).toBe(null);
  });

  it('returns empty string unchanged', () => {
    expect(toNaturalCase('')).toBe('');
  });
});
