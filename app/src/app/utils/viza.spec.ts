import {
  isUnder14,
  isVizaLocked,
  isVizaNotScanned,
  isVizaSendable,
  missingVizaFields,
  vizaValuesFromGuest,
} from './viza';
import { GuestInterface } from '../models/guest.interface';

function guest(overrides: Partial<GuestInterface> = {}): GuestInterface {
  return {
    reservation_guest_id: '1',
    guest_id: '2',
    first_name: 'Elek',
    last_name: 'Teszt',
    mother_name: '',
    maiden_name: '',
    birth_date: '2004-07-14',
    birth_place: '',
    guest_age: 'adult',
    gender: 'male',
    city_tax_liable: false,
    citizenship: 'HUN',
    email: '',
    phone_number: '',
    address: null,
    document: {
      document_type: 'passport',
      document_number: 'AB123',
      date_of_issue_of_the_document: '',
      turkish_republic_identity_number: null,
    },
    scanned_data: null,
    locked: false,
    viza_status: 'scanned',
    ...overrides,
  };
}

describe('viza utils', () => {
  it('reports no missing fields for a complete guest', () => {
    expect(missingVizaFields(vizaValuesFromGuest(guest()))).toEqual([]);
  });

  it('lists missing fields in display order, treating whitespace as empty', () => {
    const g = guest({ birth_date: '', citizenship: '  ', document: null });
    expect(missingVizaFields(vizaValuesFromGuest(g))).toEqual([
      'birth_date',
      'citizenship',
      'document_type',
      'document_number',
    ]);
  });

  it('ignores optional fields', () => {
    const g = guest({ maiden_name: '', mother_name: '', birth_place: '', address: null });
    expect(missingVizaFields(vizaValuesFromGuest(g))).toEqual([]);
  });

  it('only scanned/modified are sendable', () => {
    expect(isVizaSendable('scanned')).toBeTrue();
    expect(isVizaSendable('modified')).toBeTrue();
    expect(isVizaSendable('in_progress')).toBeFalse();
    expect(isVizaSendable('completed')).toBeFalse();
    expect(isVizaSendable(null)).toBeFalse();
  });

  it('in_progress/completed are locked', () => {
    expect(isVizaLocked('in_progress')).toBeTrue();
    expect(isVizaLocked('completed')).toBeTrue();
    expect(isVizaLocked('scanned')).toBeFalse();
    expect(isVizaLocked(null)).toBeFalse();
  });

  it('null status is not scanned', () => {
    expect(isVizaNotScanned(null)).toBeTrue();
    expect(isVizaNotScanned('scanned')).toBeFalse();
  });

  describe('under-14 guests', () => {
    const today = new Date(2026, 9, 9); // 9 Oct 2026

    it('isUnder14 is exact on the birthday', () => {
      expect(isUnder14('2012-10-09', today)).toBeFalse(); // turns 14 today
      expect(isUnder14('2012-10-10', today)).toBeTrue(); // turns 14 tomorrow
      expect(isUnder14('2026-01-01', today)).toBeTrue();
      expect(isUnder14('1977-11-28', today)).toBeFalse();
    });

    it('unknown or invalid birth date is not under 14', () => {
      expect(isUnder14('', today)).toBeFalse();
      expect(isUnder14(null, today)).toBeFalse();
      expect(isUnder14('garbage', today)).toBeFalse();
    });

    it('does not require the document for a child', () => {
      const g = guest({ birth_date: '2018-05-01', document: null });
      expect(missingVizaFields(vizaValuesFromGuest(g), today)).toEqual([]);
    });

    it('still requires the other fields for a child', () => {
      const g = guest({ birth_date: '2018-05-01', document: null, citizenship: '' });
      expect(missingVizaFields(vizaValuesFromGuest(g), today)).toEqual(['citizenship']);
    });

    it('requires the document from a 14-year-old', () => {
      const g = guest({ birth_date: '2012-10-09', document: null });
      expect(missingVizaFields(vizaValuesFromGuest(g), today)).toEqual(['document_type', 'document_number']);
    });
  });
});
