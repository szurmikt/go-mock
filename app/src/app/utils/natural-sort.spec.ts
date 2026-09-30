import { naturalCompare } from './natural-sort';

describe('naturalCompare', () => {
  it('sorts numeric room numbers naturally, not lexicographically', () => {
    expect(['10', '2', '1'].sort(naturalCompare)).toEqual(['1', '2', '10']);
  });

  it('sorts mixed text+number room names naturally', () => {
    expect(['Room 12', 'Room 2', 'Room 9'].sort(naturalCompare)).toEqual([
      'Room 2',
      'Room 9',
      'Room 12',
    ]);
  });

  it('falls back to plain alphabetic ordering for non-numeric text', () => {
    expect(['City Panorama', 'Attic Suite', 'Bay View'].sort(naturalCompare)).toEqual([
      'Attic Suite',
      'Bay View',
      'City Panorama',
    ]);
  });

  it('is case-insensitive', () => {
    expect(naturalCompare('abc', 'ABC')).toBe(0);
  });

  it('treats equal strings as equal', () => {
    expect(naturalCompare('Room 9', 'Room 9')).toBe(0);
  });
});
