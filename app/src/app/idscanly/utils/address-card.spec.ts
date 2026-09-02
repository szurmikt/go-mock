import { isAddressCard } from './address-card';

describe('isAddressCard', () => {
  it('matches documentCode AC', () => {
    expect(isAddressCard({ documentCode: 'AC' })).toBe(true);
  });

  it('rejects a different documentCode', () => {
    expect(isAddressCard({ documentCode: 'ID' })).toBe(false);
  });

  it('rejects when documentCode is missing', () => {
    expect(isAddressCard({})).toBe(false);
  });

  it('tolerates surrounding whitespace and lower case', () => {
    expect(isAddressCard({ documentCode: ' ac\n' })).toBe(true);
  });
});
