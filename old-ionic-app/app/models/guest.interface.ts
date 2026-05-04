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
  address: AddressInterface | null;
  email: string;
  phone_number: string;
  document: {
    document_type: string;
    document_number: string;
    date_of_issue_of_the_document: string;
  } | null;
  scanned_data: ScannedDataInterface | null;
  locked: boolean;
  rfid_tag?: number;
  age?: number;
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

export interface AddressInterface {
  country_code: string;
  zip: string;
  city: string;
  address_line: string;
}

export interface ScannedGuestDataInterface {
  [key: string]: {
    value: any;
    formatted_value: any;
    modified: boolean;
    error?: boolean;
    label?: string;
  };
}

export interface GuestPostInterface {
  reservation_code: string;
  guest: ScannedGuestDataInterface;
  // address: ScannedGuestDataInterface;
}

// export interface GuestsInterface {
//   client_data: {
//     client_first_name: string;
//     client_last_name: string;
//     age: string;
//     city_tax_liable: string;
//     citizenship: string;
//     country_code: string;
//     gender: string;
//     rfid_tag?: number;
//   };
//   scanned_data?: any | null;
//   locked?: boolean;
//   address_data: {
//     name: string;
//     type: string;
//     vale: any;
//     label: string;
//   }[];
//   client_id: string;
//   reservation_client_id: string;
//   doc_reader_scanned_document_id?: string;
// }
