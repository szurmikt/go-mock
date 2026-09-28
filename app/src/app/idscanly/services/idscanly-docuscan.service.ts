import { inject, Injectable } from '@angular/core';
import {
  ScannedGuestDataInterface,
  ScanResultInterface,
} from '../../models/guest.interface';
import { DocumentData } from '../../models/statistics-interface';
import { DocumentTypeConfig, DocumentTypeId } from '../models/document-type';
import { IdRecognitionFields, IdRecognitionResponse } from './idrecognition.service';
import { LanguageService } from '../../services/language.service';
import { toNaturalCase } from '../../utils/natural-case';
import { isAddressCard } from '../utils/address-card';
import { isTurkishIdentityCard } from '../utils/turkish-id';

/**
 * Maps the app's own DocumentTypeId (the type the user explicitly picked before scanning)
 * to the SabeeApp API's document_type enum — the same vocabulary `GET /options` populates
 * the guest-edit Document Type <select> from. The OCR's own freeform classification string
 * (e.g. "identity_card") does NOT belong in this vocabulary — using it left the edit-page
 * select unmatched (blank) and would have saved an invalid enum value to the API.
 * address-card is intentionally omitted: it isn't an identity document.
 */
const CANONICAL_DOCUMENT_TYPE: Partial<Record<DocumentTypeId, string>> = {
  'id-card': 'id',
  passport: 'passport',
  'driving-licence': 'driving_license',
};

/**
 * Maps an IdRecognitionResponse → ScanResultInterface, the shared type the guest-detail
 * result sheet and processScanResult() render/consume.
 *
 * Field names are best-effort and MUST be validated against a real live API response.
 * Update FIELD_MAP if the IDScanly endpoint returns different key names.
 */

function box(value: string | null | undefined): ScannedGuestDataInterface[string] {
  return { value: value ?? null, formatted_value: value ?? null, modified: false };
}

function normGender(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === 'M' || u === 'MALE') return 'Male';
  if (u === 'F' || u === 'FEMALE') return 'Female';
  return raw;
}

/** Whole years from an ISO birth date (YYYY-MM-DD) to today; null if unparseable. */
function computeAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 && age < 150 ? String(age) : null;
}

@Injectable({ providedIn: 'root' })
export class IdscanlyDocuscanService {
  private readonly lang = inject(LanguageService);

  mapToScanResult(
    response: IdRecognitionResponse,
    documentType: DocumentTypeConfig,
  ): ScanResultInterface {
    const f: IdRecognitionFields = response.summary?.fields ?? {};

    // Classification comes from IDScanly's own response (documentCode === 'AC'), not the
    // user's pre-scan pick — since the Card/Passport toggle always captures "Card" via the
    // id-card config, documentType.id can no longer distinguish an address card from an ID/
    // driving-licence/etc. at all. An address card is not an identity document — capture ONLY
    // the address and stop here: no identity box (name/DOB/etc.) is ever produced for this
    // type, so the shared fillGuestDataFromScannedData() merge has nothing identity-shaped to
    // write onto the guest.
    if (isAddressCard(f)) {
      return this.mapAddressCard(f, documentType, response.sessionId);
    }

    // The live response splits the name as `givenNames`/`surname`; keep the
    // `firstName`/`lastName` variants as fallbacks in case the API changes.
    // IDScanly's OCR returns names/places in ALL CAPS — toNaturalCase() title-cases
    // them for display, since this source has no casing cleanup at all.
    const firstName = toNaturalCase((f.givenNames ?? f.firstName ?? '') as string) ?? '';
    const lastName = toNaturalCase((f.surname ?? f.lastName ?? '') as string) ?? '';
    const fullName =
      toNaturalCase(f.fullName as string | undefined) ??
      ([firstName, lastName].filter(Boolean).join(' ') || null);

    // No dedicated issue-date field; the live response surfaces it in visibleDates[0].
    const issueDate = f.dateOfIssue ?? f.visibleDates?.[0] ?? null;

    // A Turkish ID card carries two separate numbers: document_number (the card's own serial,
    // reissued with every replacement card) and turkish_republic_identity_number (the TC
    // Kimlik No, a dedicated GuestInterface.document field — see guest.interface.ts, added
    // 2026-09-28 following scan_fields' property-settings response). document_number always
    // reads from f.documentNumber regardless of card type; turkish_republic_identity_number is
    // populated separately, only for a Turkish ID with a non-empty identityNumber. Neither
    // field falls back to the other's source value.
    const isTurkishId = isTurkishIdentityCard(f);

    const scannedData: ScannedGuestDataInterface = {
      first_name: box(firstName || null),
      last_name: box(lastName || null),
      full_name: box(fullName || null),
      mother_name: box(toNaturalCase(f.motherMaidenName ?? f.motherName)),
      maiden_name: box(null),
      birth_date: box(f.dateOfBirth),
      birth_place: box(toNaturalCase(f.placeOfBirth)),
      gender: box(normGender(f.sex ?? f.gender)),
      citizenship: box(f.citizenship ?? f.nationality),
      age: box(computeAge(f.dateOfBirth)),
      // Document sub-fields. document_type must be the API's canonical enum (not the OCR's
      // freeform string) — it feeds guest-edit's <select> and the save payload; see
      // CANONICAL_DOCUMENT_TYPE above. null for address-card — never populated for a
      // non-identity document.
      document_type: box(CANONICAL_DOCUMENT_TYPE[documentType.id] ?? null),
      document_number: box(f.documentNumber || null),
      turkish_republic_identity_number: box(
        isTurkishId && f.identityNumber ? f.identityNumber : null,
      ),
      date_of_issue_of_the_document: box(issueDate),
      // Send null, exactly like a first scan on a never-scanned guest. The API validates
      // this field as an integer, so the previous 'idscanly' marker string made POST /guests
      // reject EVERY save (ret_code 1003); the backend assigns the real id server-side.
      doc_reader_scanned_document_id: box(null),
    };

    // Some national ID cards/passports embed a residence address alongside the identity
    // fields (distinct from the dedicated address-card/lakcímkártya document type, which
    // captures ONLY an address via mapAddressCard() above and never reaches this branch).
    // Only add these boxes when the OCR actually returned one, so an address-less scan
    // (the common case) produces no address_* keys at all — the result sheet's address
    // section is gated on those keys being present, so it stays hidden rather than
    // showing an empty section. is_identity_document stays true either way: this is
    // still a genuine ID scan, not an address-card scan.
    if (f.address?.trim()) {
      scannedData['address_line'] = box(toNaturalCase(f.address));
      // Same fallback chain mapAddressCard() uses for its own country_code — the
      // document's issuing country is the address's country in the overwhelming case.
      // zip/city are deliberately left unset: f.city/f.postalCode are documented as
      // address-card-only fields, not a general-purpose address breakdown.
      scannedData['address_country_code'] = box(f.documentCountry ?? f.issuingCountry);
    }

    const documentData: DocumentData = {
      scan_type: 'idscanly',
      // documentType.label is a translation KEY (see document-type.ts) — resolve it before use,
      // this is a display-only fallback for docTypeName(), not the API's document_type enum.
      document_type: f.documentType ?? this.lang.t(documentType.label),
      date_of_issue: issueDate,
      message: '',
      // Always true here — address-card returns early via mapAddressCard() above,
      // so every documentType reaching this point is an identity document.
      is_identity_document: true,
    };

    return {
      documentData,
      scannedData,
      sessionId: response.sessionId,
    };
  }

  /**
   * Address card (lakcímkártya): capture ONLY the residence address. `streetAddress` is the
   * vendor's pre-combined "<street> <type> <house number>" string (already includes the house
   * number); streetName/streetType/houseNumber are a fallback if streetAddress is missing.
   * country_code stays whatever code the vendor returns (e.g. "HUN") — a 3-letter code against
   * CountryOption's 2-letter values is a known, accepted best-effort limitation.
   */
  private mapAddressCard(
    f: IdRecognitionFields,
    documentType: DocumentTypeConfig,
    sessionId: string,
  ): ScanResultInterface {
    const addressLine =
      f.streetAddress ??
      ([f.streetName, f.streetType, f.houseNumber].filter(Boolean).join(' ') || undefined);

    const scannedData: ScannedGuestDataInterface = {
      address_country_code: box(f.documentCountry ?? f.issuingCountry),
      address_zip: box(f.postalCode),
      address_city: box(toNaturalCase(f.city)),
      address_line: box(toNaturalCase(addressLine)),
    };

    const documentData: DocumentData = {
      scan_type: 'idscanly',
      document_type: f.documentType ?? this.lang.t(documentType.label),
      date_of_issue: null,
      message: '',
      is_identity_document: false,
    };

    return { documentData, scannedData, sessionId };
  }
}
