import { DocumentData } from './statistics-interface';

/**
 * Per-guest VIZA (Hungarian guest-registry) reporting state, from `reporting.viza_status`.
 * null = no data / not scanned yet — shown as "Not scanned", never reportable.
 */
export type VizaStatus = 'scanned' | 'modified' | 'in_progress' | 'completed';

export interface GuestInterface {
  reservation_guest_id: string;
  guest_id: string;
  first_name: string;
  last_name: string;
  mother_name: string;
  maiden_name: string;
  birth_date: string;
  birth_place: string;
  guest_age: string;
  gender: string;
  city_tax_liable: boolean;
  citizenship: string;
  email: string;
  phone_number: string;
  address: {
    country_code: string | null;
    zip: string | null;
    city: string | null;
    address_line: string | null;
  } | null;
  document: {
    document_type: string;
    document_number: string;
    date_of_issue_of_the_document: string;
    // Added 2026-09-28: the TC Kimlik No., distinct from document_number (the card serial) —
    // see idscanly-docuscan.service.ts's mapToScanResult for the extraction rule. Only
    // meaningful for a Turkish ID card; null otherwise.
    turkish_republic_identity_number: string | null;
  } | null;
  scanned_data: ScannedDataInterface | null;
  locked: boolean;
  // Read-only, server-owned. Stripped from the POST /guests payload in updateGuest().
  viza_status: VizaStatus | null;
}

export interface ScannedDataInterface {
  doc_reader_scanned_document_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  mother_name: string;
  maiden_name: string;
  birth_date: string;
  birth_place: string;
  gender: string;
  citizenship: string;
  age: number;
  document: {
    document_type: string;
    document_number: string;
    date_of_issue_of_the_document: string;
    turkish_republic_identity_number: string | null;
  } | null;
  // Populated when an address card (lakcímkártya) is scanned, or when an identity
  // document (ID card/passport) happens to embed an address; nested by
  // DocuscanService.scannedDataToGuestScannedData from the scan's address_* keys.
  address?: {
    country_code: string | null;
    zip: string | null;
    city: string | null;
    address_line: string | null;
  } | null;
}

export interface ScannedGuestDataInterface {
  [key: string]: {
    value: any;
    formatted_value: any;
    modified: boolean;
    error?: boolean;
  };
}

export interface GuestPostInterface {
  reservation_code: string;
  guest: ScannedGuestDataInterface;
  // address: ScannedGuestDataInterface;
}

export interface ScanResultInterface {
  documentData: DocumentData | null;
  scannedData: ScannedGuestDataInterface | null;
  /**
   * IDScanly's own session id for the scan that produced this result. Set by
   * IdscanlyDocuscanService.mapToScanResult(); left undefined otherwise. Carried to the two
   * save sites (guest-detail's save-as-is and guest-edit's save-after-edit) so the final,
   * user-confirmed values can be posted back to IDScanly's external-result endpoint; see
   * ExternalResultService.
   */
  sessionId?: string;
}
