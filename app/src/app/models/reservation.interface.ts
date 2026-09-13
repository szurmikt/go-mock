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
}

export interface BookerInterface {
  booker_id: string;
  first_name: string;
  last_name: string;
  email: string;
}
