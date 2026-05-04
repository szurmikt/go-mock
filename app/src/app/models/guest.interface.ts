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
  document: {
    document_type: string;
    document_number: string;
    date_of_issue_of_the_document: string;
  } | null;
  scanned_data: { doc_reader_scanned_document_id: string } | null;
  locked: boolean;
}
