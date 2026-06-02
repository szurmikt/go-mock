/**
 * Parses the single combined address string that Regula returns for a Hungarian
 * address card (lakcímkártya) — field type PLACE_OF_REGISTRATION (69), e.g.
 * "6100 KISKUNFÉLEGYHÁZA KISKUN UTCA 13" — into the guest address parts.
 *
 * Hungarian addresses are regular: <4-digit ZIP> <city> <street...>. We split on
 * that shape. To survive multi-word city names (e.g. "Hódmezővásárhely" is one word
 * but some are not), the street boundary is detected at the first Hungarian
 * street-type keyword (utca/út/tér/körút/…); everything before it is the city, from
 * it onward is the street. If no keyword is found we fall back to "first token =
 * city, rest = street". The result is a best-effort prefill the user can correct.
 *
 * All parts are nullable: a blank/missing input yields all-null, matching the
 * nullable `guest.address` model.
 */
export interface ParsedAddress {
  zip: string | null;
  city: string | null;
  address_line: string | null;
}

// Common Hungarian "közterület jelleg" (street-type) words + abbreviations.
const STREET_TYPES = [
  'utca',
  'u',
  'út',
  'útja',
  'tér',
  'tere',
  'körút',
  'krt',
  'köz',
  'sor',
  'sétány',
  'rakpart',
  'liget',
  'park',
  'dűlő',
  'fasor',
  'sugárút',
  'sgt',
  'udvar',
  'lépcső',
  'árok',
  'lakótelep',
  'ltp',
];

export function parseHungarianAddress(raw: string | null | undefined): ParsedAddress {
  const empty: ParsedAddress = { zip: null, city: null, address_line: null };
  if (!raw) return empty;

  // Normalize: newlines → spaces, strip trailing dot-padding, collapse whitespace.
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return empty;

  // Leading 4-digit ZIP.
  const zipMatch = text.match(/^(\d{4})\b\s*/);
  const zip = zipMatch ? zipMatch[1] : null;
  const rest = zipMatch ? text.slice(zipMatch[0].length).trim() : text;

  if (!rest) return { zip, city: null, address_line: null };

  const tokens = rest.split(' ');

  // Find the first street-type keyword (case-insensitive, trailing '.' tolerated).
  const streetIdx = tokens.findIndex(t => {
    const word = t.replace(/\.$/, '').toLowerCase();
    return STREET_TYPES.includes(word);
  });

  let city: string | null;
  let addressLine: string | null;

  if (streetIdx > 0) {
    // The street name token usually sits one before the type word
    // (e.g. "KISKUN UTCA 13" → street starts at "KISKUN"). City is everything
    // before that name token; street is from the name token onward.
    const streetStart = streetIdx - 1;
    city = tokens.slice(0, streetStart).join(' ') || null;
    addressLine = tokens.slice(streetStart).join(' ') || null;
  } else {
    // No recognizable street type: assume first token is the city, rest the street.
    city = tokens[0] || null;
    addressLine = tokens.slice(1).join(' ') || null;
  }

  return { zip, city, address_line: addressLine };
}
