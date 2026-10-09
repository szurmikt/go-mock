export interface ReservationInterface {
  id: string;
  reservation_code: string;
  partner: { partner_id: string; partner_name: string } | undefined;
  booker: BookerInterface;
  arrival_date: string;
  departure_date: string;
  created_datetime: string;
  checked_in_time: string;
  onboard_time: string;
  checked_out_time: string;
  status: string;
  room_type_id: string;
  room_type_name: string;
  room_id: string;
  room_name: string;
  guest_count: { adults: number; children: number; infants: number };
  number_of_guests: number;
  nights: number;
  open_in_pms: boolean;
  // NTAK/VIZA integration enabled for this reservation's property — gates the
  // "Report to VIZA" FAB action. Missing from the API ⇒ false.
  ntak_connected: boolean;
  notes: ReservationNoteInterface[];
}

export interface BookerInterface {
  booker_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface ReservationNoteInterface {
  comment_id: number;
  type: 'reservation' | 'room';
  comment: string;
  comment_date: string | null;
  // Only meaningful for type 'room' — the date(s) within the stay the note applies to.
  comment_dates: string[] | null;
  created_datetime: string;
  user: string;
  show_for_housekeeper: boolean;
}
