import { normalizeText } from './text';

describe('normalizeText', () => {
  it('strips diacritics from accented characters', () => {
    expect(normalizeText('Tamás')).toBe('tamas');
  });

  it('handles multiple accented characters', () => {
    expect(normalizeText('Öö')).toBe('oo');
    expect(normalizeText('Zürich')).toBe('zurich');
    expect(normalizeText('Gáspár')).toBe('gaspar');
  });

  it('lowercases mixed case', () => {
    expect(normalizeText('HeLLo')).toBe('hello');
  });

  it('leaves plain ASCII unchanged (apart from case)', () => {
    expect(normalizeText('booking.com')).toBe('booking.com');
    expect(normalizeText('68CXK25')).toBe('68cxk25');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText('')).toBe('');
  });
});
