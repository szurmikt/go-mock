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
  city_tax_liable: string;
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
}
