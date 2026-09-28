import { toIdscanlyFields } from './to-idscanly-fields';
import { GuestInterface } from '../../models/guest.interface';

/** Minimal GuestInterface — only the fields this mapper reads need to be meaningful. */
function guest(overrides: Partial<GuestInterface> = {}): GuestInterface {
  return {
    reservation_guest_id: '1',
    guest_id: '2',
    first_name: 'János',
    last_name: 'Kovács',
    mother_name: 'Szabó Mária',
    maiden_name: '',
    birth_date: '1985-06-22',
    birth_place: 'Budapest',
    guest_age: '39',
    gender: 'Male',
    city_tax_liable: false,
    citizenship: 'HUN',
    email: '',
    phone_number: '',
    address: null,
    document: {
      document_type: 'id',
      document_number: 'AB1234567',
      date_of_issue_of_the_document: '2018-03-15',
      turkish_republic_identity_number: null,
    },
    scanned_data: null,
    locked: false,
    ...overrides,
  } as GuestInterface;
}

describe('toIdscanlyFields', () => {
  it('maps an identity document to IDScanly field names', () => {
    expect(toIdscanlyFields(guest(), true)).toEqual({
      givenNames: 'János',
      surname: 'Kovács',
      fullName: 'János Kovács',
      motherMaidenName: 'Szabó Mária',
      dateOfBirth: '1985-06-22',
      placeOfBirth: 'Budapest',
      sex: 'Male',
      citizenship: 'HUN',
      documentType: 'id',
      documentNumber: 'AB1234567',
      identityNumber: null,
      dateOfIssue: '2018-03-15',
    });
  });

  it('normalises blank and whitespace-only values to null', () => {
    const result = toIdscanlyFields(
      guest({ mother_name: '   ', birth_place: '', gender: '' }),
      true,
    );
    expect(result['motherMaidenName']).toBeNull();
    expect(result['placeOfBirth']).toBeNull();
    expect(result['sex']).toBeNull();
  });

  it('derives fullName from whichever name parts are present', () => {
    expect(toIdscanlyFields(guest({ last_name: '' }), true)['fullName']).toBe('János');
    expect(
      toIdscanlyFields(guest({ first_name: '', last_name: '' }), true)['fullName'],
    ).toBeNull();
  });

  it('handles a missing document object', () => {
    const result = toIdscanlyFields(guest({ document: null }), true);
    expect(result['documentType']).toBeNull();
    expect(result['documentNumber']).toBeNull();
    expect(result['dateOfIssue']).toBeNull();
  });

  it('maps an address card to address fields only, omitting identity fields', () => {
    const result = toIdscanlyFields(
      guest({
        address: {
          country_code: 'HUN',
          zip: '6100',
          city: 'Kiskunfélegyháza',
          address_line: 'Kiskun utca 13',
        },
      }),
      false,
    );
    expect(result).toEqual({
      documentCountry: 'HUN',
      postalCode: '6100',
      city: 'Kiskunfélegyháza',
      streetAddress: 'Kiskun utca 13',
    });
    expect(result['givenNames']).toBeUndefined();
    expect(result['documentNumber']).toBeUndefined();
  });

  it('reports document_number and turkish_republic_identity_number under their own separate IDScanly keys', () => {
    const result = toIdscanlyFields(
      guest({
        document: {
          document_type: 'id',
          document_number: 'A1B2C3D4',
          date_of_issue_of_the_document: '2018-03-15',
          turkish_republic_identity_number: '82345678902',
        },
      }),
      true,
    );
    expect(result['documentNumber']).toBe('A1B2C3D4');
    expect(result['identityNumber']).toBe('82345678902');
  });

  it('merges in address fields for an identity document that embeds an address', () => {
    const result = toIdscanlyFields(
      guest({
        address: {
          country_code: 'DEU',
          zip: null,
          city: null,
          address_line: 'Musterstrasse 1',
        },
      }),
      true,
    );
    expect(result['givenNames']).toBe('János');
    expect(result['documentNumber']).toBe('AB1234567');
    expect(result['documentCountry']).toBe('DEU');
    expect(result['postalCode']).toBeNull();
    expect(result['city']).toBeNull();
    expect(result['streetAddress']).toBe('Musterstrasse 1');
  });

  it('handles a missing address object on an address card', () => {
    expect(toIdscanlyFields(guest({ address: null }), false)).toEqual({
      documentCountry: null,
      postalCode: null,
      city: null,
      streetAddress: null,
    });
  });
});
