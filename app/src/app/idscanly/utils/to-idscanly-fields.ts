import { GuestInterface } from '../../models/guest.interface';

/**
 * Builds the payload posted back to IDScanly's external-result endpoint: the FINAL,
 * user-confirmed values as they were actually saved to the SabeeApp API.
 *
 * Keys are IDScanly's own field vocabulary (see IdRecognitionFields in
 * idrecognition.service.ts), not this app's — IDScanly's admin UI does a best-effort
 * comparison against the fields it extracted itself, so sending their names makes that
 * comparison exact instead of fuzzy. This is the mirror image of
 * IdscanlyDocuscanService.mapToScanResult(): if the mapping there changes, change it here too.
 *
 * Deliberately carries ONLY the final values — no original/corrected pairing and no
 * "what changed" flags. IDScanly already stores its own OCR output for the session, so
 * echoing it back would be redundant; the endpoint requires no particular fields.
 */
export function toIdscanlyFields(
  guest: GuestInterface,
  isIdentityDocument: boolean,
): Record<string, unknown> {
  return isIdentityDocument ? identityFields(guest) : addressFields(guest);
}

/** '' / whitespace-only → null, so IDScanly sees "not present" rather than an empty string. */
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function identityFields(g: GuestInterface): Record<string, unknown> {
  const givenNames = clean(g.first_name);
  const surname = clean(g.last_name);
  return {
    givenNames,
    surname,
    fullName: [givenNames, surname].filter(Boolean).join(' ') || null,
    motherMaidenName: clean(g.mother_name),
    dateOfBirth: clean(g.birth_date),
    placeOfBirth: clean(g.birth_place),
    sex: clean(g.gender),
    citizenship: clean(g.citizenship),
    documentType: clean(g.document?.document_type),
    documentNumber: clean(g.document?.document_number),
    dateOfIssue: clean(g.document?.date_of_issue_of_the_document),
  };
}

/**
 * Address card (lakcímkártya): only the address is ever captured or saved for this type
 * (see IdscanlyDocuscanService.mapAddressCard), so the identity fields are omitted entirely
 * rather than sent as nulls. Keys mirror that mapper's inputs.
 */
function addressFields(g: GuestInterface): Record<string, unknown> {
  return {
    documentCountry: clean(g.address?.country_code),
    postalCode: clean(g.address?.zip),
    city: clean(g.address?.city),
    streetAddress: clean(g.address?.address_line),
  };
}
