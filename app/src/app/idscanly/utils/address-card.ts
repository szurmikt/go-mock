import { IdRecognitionFields } from '../services/idrecognition.service';

/**
 * True when IDScanly's own response classifies the scanned document as a Hungarian address
 * card (lakcímkártya) — `documentCode === 'AC'`, a reliable, controlled-vocabulary field
 * confirmed against a real captured payload.
 *
 * `IdscanlyDocuscanService.mapToScanResult()` uses this to route a scan to the address-only
 * mapper instead of the user's pre-scan Card/Passport pick — a safety-relevant classification
 * that used to come from the user's guess (which document-type sheet entry they tapped) and now
 * comes from IDScanly's response instead.
 *
 * Positive-confirmation only: a missing or unrecognized `documentCode` falls through to the
 * normal identity path, since under-populating identity fields on a real ID/passport (a
 * visible, self-correcting failure) is safer than the reverse — silently writing identity
 * fields onto what should be an address-only record, which is exactly the failure mode
 * `mapAddressCard()` exists to guard against. The same real payload that confirmed
 * `documentCode: "AC"` also showed identity fields still populated on a genuine address card,
 * which is why a plain field-presence heuristic was ruled out.
 *
 * Values are trimmed and upper-cased before comparison — see the note in turkish-id.ts about
 * vendor/config strings arriving with stray whitespace in this codebase.
 */
export function isAddressCard(fields: IdRecognitionFields): boolean {
  return norm(fields.documentCode) === 'AC';
}

function norm(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}
