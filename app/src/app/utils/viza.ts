import { GuestInterface, VizaStatus } from '../models/guest.interface';

/**
 * VIZA (Hungarian guest-registry) reporting rules — the single source shared by the
 * Report-to-VIZA sheet and the guest-edit page's VIZA mode, so the two can never disagree
 * on what counts as "complete".
 */

/** The mandatory VIZA fields, in display order. The ID number has no asterisk on the PMS
 *  desktop modal, but its validation enforces it, so it is treated as mandatory here too. */
export type VizaRequiredField =
  | 'first_name'
  | 'last_name'
  | 'birth_date'
  | 'citizenship'
  | 'gender'
  | 'document_type'
  | 'document_number';

export const VIZA_REQUIRED_FIELDS: readonly VizaRequiredField[] = [
  'first_name',
  'last_name',
  'birth_date',
  'citizenship',
  'gender',
  'document_type',
  'document_number',
];

/** Translation key for each mandatory field's label (reuses the guest-edit form labels). */
export const VIZA_FIELD_LABEL_KEYS: Record<VizaRequiredField, string> = {
  first_name: 'guestEdit.firstName',
  last_name: 'guestEdit.lastName',
  birth_date: 'guestEdit.birthDate',
  citizenship: 'guestEdit.citizenship',
  gender: 'guestEdit.gender',
  document_type: 'guestEdit.documentType',
  document_number: 'guestEdit.documentNumber',
};

/** Flat view of the mandatory values — matches both GuestInterface and guest-edit's form. */
export type VizaFieldValues = Partial<Record<VizaRequiredField, string | null | undefined>>;

export function vizaValuesFromGuest(g: GuestInterface): VizaFieldValues {
  return {
    first_name: g.first_name,
    last_name: g.last_name,
    birth_date: g.birth_date,
    citizenship: g.citizenship,
    gender: g.gender,
    document_type: g.document?.document_type,
    document_number: g.document?.document_number,
  };
}

/** Identity-document fields — only required from guests aged 14 or over. */
const DOCUMENT_FIELDS: readonly VizaRequiredField[] = ['document_type', 'document_number'];

/**
 * True when the guest is under 14 on `today` (a "YYYY-MM-DD" birth date; compared as plain
 * calendar parts so no timezone can shift the birthday). An empty or unparseable birth date
 * is NOT treated as under 14 — the document stays required until the age is actually known.
 */
export function isUnder14(birthDate: string | null | undefined, today: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((birthDate ?? '').trim());
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--;
  return age >= 0 && age < 14;
}

/**
 * Mandatory fields that are empty (blank/whitespace counts as empty), in display order.
 * VIZA only requires the identity document from guests aged 14+; under-14 data may be
 * recorded from the representative's statement, so the document fields are skipped there.
 */
export function missingVizaFields(values: VizaFieldValues, today: Date = new Date()): VizaRequiredField[] {
  const skipDocument = isUnder14(values.birth_date, today);
  return VIZA_REQUIRED_FIELDS.filter(f => {
    if (skipDocument && DOCUMENT_FIELDS.includes(f)) return false;
    return !(values[f] ?? '').toString().trim();
  });
}

/** Scanned or edited, not yet sent — the only states that can be ticked and sent. */
export function isVizaSendable(status: VizaStatus | null): boolean {
  return status === 'scanned' || status === 'modified';
}

/** Already sent (or being sent) — shown with a chip, never selectable or editable. */
export function isVizaLocked(status: VizaStatus | null): boolean {
  return status === 'in_progress' || status === 'completed';
}

/**
 * No data / not scanned yet — shown with a chip, never selectable. It IS editable: VIZA allows
 * manual entry when the scanner can't read a document or a child has none.
 */
export function isVizaNotScanned(status: VizaStatus | null): boolean {
  return status == null;
}
