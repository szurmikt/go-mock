import { GuestInterface } from 'src/app/models/guest.interface';

export interface ReservationInterface {
  id: string;
  reservation_code: string;
  partner:
    | {
        partner_id: string;
        partner_name: string;
      }
    | undefined;
  booker: BookerInterface;
  arrival_date: string;
  departure_date: string;
  checked_in_time: string;
  checked_out_time: string;
  status: string;
  room_type_id: string;
  room_type_name: string;
  room_id: string;
  room_name: string;
  guest_count: {
    adults: number;
    children: number;
    infants: number;
  };
  number_of_guests: number;
  nights: number | undefined;
  guests: GuestInterface[] | undefined;
  services: ServiceInterface[] | undefined;
  finances: FinanceInterface[] | undefined;
}

export interface BookerInterface {
  first_name: string;
  last_name: string;
  email: string;
  booker_id: string;
}

export interface ServiceInterface {
  service_id: string;
  name: string;
  price: number;
}
export interface FinanceInterface {
  finance_id: string;
  name: string;
  price: number;
}
