import { isVersionBelow } from './version';

describe('isVersionBelow', () => {
  it('is true when current is a lower minor (1.0 < 1.5)', () => {
    expect(isVersionBelow('1.0', '1.5')).toBe(true);
  });

  it('compares numerically, not as strings (1.9 < 1.10)', () => {
    expect(isVersionBelow('1.9', '1.10')).toBe(true);
  });

  it('is false when current is higher (2.0 vs 1.5)', () => {
    expect(isVersionBelow('2.0', '1.5')).toBe(false);
  });

  it('is false when versions are equal (1.0 vs 1.0)', () => {
    expect(isVersionBelow('1.0', '1.0')).toBe(false);
  });

  it('pads the shorter side with zeros (1.1.0 vs 1.0 → false)', () => {
    expect(isVersionBelow('1.1.0', '1.0')).toBe(false);
  });

  it('pads the shorter side with zeros (1.0 vs 1.1.0 → true)', () => {
    expect(isVersionBelow('1.0', '1.1.0')).toBe(true);
  });
});
