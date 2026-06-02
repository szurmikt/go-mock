import { parseHungarianAddress } from './hungarian-address';

describe('parseHungarianAddress', () => {
  it('splits the canonical ZIP + city + street form', () => {
    expect(parseHungarianAddress('6100 KISKUNFÉLEGYHÁZA KISKUN UTCA 13')).toEqual({
      zip: '6100',
      city: 'KISKUNFÉLEGYHÁZA',
      address_line: 'KISKUN UTCA 13',
    });
  });

  it('normalizes newlines and extra whitespace (Regula multi-line OCR)', () => {
    expect(
      parseHungarianAddress('6100 KISKUNFÉLEGYHÁZA\nKISKUN UTCA 13 .'),
    ).toEqual({
      zip: '6100',
      city: 'KISKUNFÉLEGYHÁZA',
      address_line: 'KISKUN UTCA 13 .',
    });
  });

  it('recognizes "út" as a street type', () => {
    expect(parseHungarianAddress('1011 BUDAPEST FŐ ÚT 5')).toEqual({
      zip: '1011',
      city: 'BUDAPEST',
      address_line: 'FŐ ÚT 5',
    });
  });

  it('falls back to first-token-city when no street type is present', () => {
    expect(parseHungarianAddress('1051 BUDAPEST 12')).toEqual({
      zip: '1051',
      city: 'BUDAPEST',
      address_line: '12',
    });
  });

  it('handles a missing ZIP (zip null, rest split)', () => {
    expect(parseHungarianAddress('SZEGED KOSSUTH UTCA 1')).toEqual({
      zip: null,
      city: 'SZEGED',
      address_line: 'KOSSUTH UTCA 1',
    });
  });

  it('returns all-null for empty / nullish input', () => {
    expect(parseHungarianAddress('')).toEqual({
      zip: null,
      city: null,
      address_line: null,
    });
    expect(parseHungarianAddress(null)).toEqual({
      zip: null,
      city: null,
      address_line: null,
    });
    expect(parseHungarianAddress(undefined)).toEqual({
      zip: null,
      city: null,
      address_line: null,
    });
  });

  it('handles ZIP-only input', () => {
    expect(parseHungarianAddress('6100')).toEqual({
      zip: '6100',
      city: null,
      address_line: null,
    });
  });
});
