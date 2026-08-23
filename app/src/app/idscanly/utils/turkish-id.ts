import { IdRecognitionFields } from '../services/idrecognition.service';

/**
 * True when the scanned document is a Turkish national ID card.
 *
 * Such a card carries two distinct numbers — the card serial (`documentNumber`) and the
 * holder's permanent TC Kimlik No (`identityNumber`) — and SabeeApp stores the latter.
 * `IdscanlyDocuscanService.mapToScanResult()` uses this to pick the right one.
 *
 * The rule is deliberately narrow: MRZ document code `ID` **and** country `TUR`, nothing
 * else. `issuingCountry` is NOT accepted as a stand-in for a missing `documentCountry` —
 * if a real Turkish scan turns out to omit the latter, widen it here and nowhere else.
 *
 * Values are trimmed and upper-cased before comparison: vendor/config strings in this
 * codebase have arrived with stray whitespace before (see the `scan_vendor: "idscanly\n"`
 * note in CLAUDE.md), and a silent miss here would save the wrong number.
 */
export function isTurkishIdentityCard(fields: IdRecognitionFields): boolean {
  return norm(fields.documentCode) === 'ID' && norm(fields.documentCountry) === 'TUR';
}

function norm(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}
