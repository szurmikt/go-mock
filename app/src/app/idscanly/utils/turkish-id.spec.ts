import { isTurkishIdentityCard } from './turkish-id';

describe('isTurkishIdentityCard', () => {
  it('matches an ID card issued by Turkey', () => {
    expect(isTurkishIdentityCard({ documentCode: 'ID', documentCountry: 'TUR' })).toBe(true);
  });

  it('rejects an ID card from another country', () => {
    expect(isTurkishIdentityCard({ documentCode: 'ID', documentCountry: 'HUN' })).toBe(false);
  });

  it('rejects a Turkish document that is not an ID card', () => {
    expect(isTurkishIdentityCard({ documentCode: 'P', documentCountry: 'TUR' })).toBe(false);
  });

  it('rejects when either field is missing', () => {
    expect(isTurkishIdentityCard({ documentCountry: 'TUR' })).toBe(false);
    expect(isTurkishIdentityCard({ documentCode: 'ID' })).toBe(false);
    expect(isTurkishIdentityCard({})).toBe(false);
  });

  it('tolerates surrounding whitespace and lower case', () => {
    expect(isTurkishIdentityCard({ documentCode: ' id\n', documentCountry: 'tur ' })).toBe(true);
  });

  it('does not accept issuingCountry in place of documentCountry', () => {
    expect(isTurkishIdentityCard({ documentCode: 'ID', issuingCountry: 'TUR' })).toBe(false);
  });
});
