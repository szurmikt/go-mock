import { DocumentData } from './statistics-interface';

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
  } | null;
  scanned_data: ScannedDataInterface | null;
  locked: boolean;
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
  } | null;
  // Populated only when an address card (lakcímkártya) is scanned; nested by
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
   * IDScanly's own session id for the scan that produced this result. Set only by
   * IdscanlyDocuscanService.mapToScanResult() — Regula has no equivalent and leaves it
   * undefined. Carried to the two save sites (guest-detail's save-as-is and guest-edit's
   * save-after-edit) so the final, user-confirmed values can be posted back to IDScanly's
   * external-result endpoint; see ExternalResultService.
   */
  sessionId?: string;
}
