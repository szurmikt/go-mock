/* global React, I, StatusBar, Pill, Toast */

const RESERVATIONS = [
  { id: "34MRK211", name: "Emma Williams", email: "e.williams@email.com", room: "Junior Suit", roomNo: "201", date: "Dec 18, 2025", guests: 2, nights: 2, status: "onboard", source: "Booking.com", checkIn: "26/04/2025  15:30", checkOut: "28/04/2025  11:30", partner: "Booking.com", composition: "2 (2/0/0)" },
  { id: "34MXK25",  name: "Michael Antonio Franklin Correro", email: "m.antonio@email.com", room: "Luxury Suit", roomNo: "412", date: "Dec 18, 2025", guests: 2, nights: 2, status: "check-in", source: "Direct", checkIn: "26/04/2025  15:30", checkOut: "28/04/2025  11:30", partner: "Direct", composition: "2 (2/0/0)" },
  { id: "68CXK25",  name: "Emma Williams", email: "e.williams@email.com", room: "Junior Suit", roomNo: "203", date: "Dec 18, 2025", guests: 4, nights: 2, status: "onboard", source: "Booking.com", checkIn: "26/04/2025  15:30", checkOut: "28/04/2025  11:30", partner: "Booking.com", composition: "4 (2/1/1)" },
  { id: "47XK911",  name: "Rose Shepard", email: "r.shepard@email.com", room: "Junior Suit", roomNo: "115", date: "Dec 18, 2025", guests: 1, nights: 3, status: "check-out", source: "Expedia", checkIn: "25/04/2025  14:00", checkOut: "28/04/2025  10:00", partner: "Expedia", composition: "1 (1/0/0)" },
  { id: "82PLK48",  name: "Franklin Williams Jr", email: "f.williams@email.com", room: "Junior Suit", roomNo: "302", date: "Dec 18, 2025", guests: 3, nights: 2, status: "confirmed", source: "Direct", checkIn: "26/04/2025  16:00", checkOut: "28/04/2025  11:00", partner: "Direct", composition: "3 (2/0/1)" },
  { id: "13QXC76",  name: "Olivia Schmidt", email: "o.schmidt@email.com", room: "Junior Suit", roomNo: "108", date: "Dec 18, 2025", guests: 2, nights: 4, status: "check-in", source: "Booking.com", checkIn: "26/04/2025  15:00", checkOut: "30/04/2025  11:00", partner: "Booking.com", composition: "2 (2/0/0)" },
  { id: "55ABK29",  name: "Lukas Hofer", email: "l.hofer@email.com", room: "Standard Double", roomNo: "210", date: "Dec 18, 2025", guests: 2, nights: 1, status: "open", source: "Direct", checkIn: "26/04/2025  17:30", checkOut: "27/04/2025  10:30", partner: "Direct", composition: "2 (2/0/0)" },
];

const GUESTS = {
  "34MRK211": [
    { id: "324323", name: "Emma Williams", maiden: "Emma Smith", mother: "Brigitte Goldsmidth", birth: "28/11/1980", birthPlace: "London", nationality: "German", citizenship: "German", age: "Adult", gender: "Female", reporting: "VIZA / NTAK", booker: true, phone: "+49 176 463 66888", email: "e.williams@email.com", docType: "Passport", docNo: "GH7383923", scanned: false }
  ],
  "34MXK25": [
    { id: "654001", name: "Michael Antonio Franklin Correro", maiden: "—", mother: "Maria Correro", birth: "12/03/1976", birthPlace: "Rome", nationality: "Italian", citizenship: "Italian", age: "Adult", gender: "Male", reporting: "VIZA / NTAK", booker: true, phone: "+39 320 123 4567", email: "m.antonio@email.com", docType: "Passport", docNo: "IT4421099", scanned: true },
    { id: "654002", name: "Lucia Correro", maiden: "Lucia Bianchi", mother: "Anna Bianchi", birth: "04/07/1982", birthPlace: "Milan", nationality: "Italian", citizenship: "Italian", age: "Adult", gender: "Female", reporting: "VIZA / NTAK", booker: false, phone: "+39 320 765 1122", email: "l.correro@email.com", docType: "Passport", docNo: "IT8810321", scanned: false },
  ],
  "68CXK25": [
    { id: "324323", name: "Emma Williams", maiden: "Emma Smith", mother: "Brigitte Goldsmidth", birth: "28/11/1980", birthPlace: "London", nationality: "German", citizenship: "German", age: "Adult", gender: "Female", reporting: "VIZA / NTAK", booker: true, phone: "+49 176 463 66888", email: "e.williams@email.com", docType: "Passport", docNo: "GH7383923", scanned: false },
    { id: "5653443", name: "Rose Shepard", mother: "Sophie Shepard", birth: "11/02/1979", birthPlace: "Vienna", nationality: "Austrian", citizenship: "Austrian", age: "Adult", gender: "Female", reporting: "VIZA / NTAK", booker: false, phone: "+43 660 998 2200", email: "r.shepard@email.com", docType: "ID Card", docNo: "AT1928340", scanned: true },
    { id: "654323", name: "Franklin Williams Jr", mother: "Brigitte Goldsmidth", birth: "06/05/2018", birthPlace: "London", nationality: "German", citizenship: "German", age: "Child", gender: "Male", reporting: "VIZA / NTAK", booker: false, phone: "—", email: "—", docType: "Passport", docNo: "GH7383928", scanned: false },
    { id: "654324", name: "Lily Williams", mother: "Brigitte Goldsmidth", birth: "21/08/2020", birthPlace: "London", nationality: "German", citizenship: "German", age: "Child", gender: "Female", reporting: "VIZA / NTAK", booker: false, phone: "—", email: "—", docType: "Passport", docNo: "GH7383929", scanned: false },
  ],
  "47XK911": [{ id: "5653443", name: "Rose Shepard", mother: "Sophie Shepard", birth: "11/02/1979", birthPlace: "Vienna", nationality: "Austrian", citizenship: "Austrian", age: "Adult", gender: "Female", reporting: "VIZA / NTAK", booker: true, phone: "+43 660 998 2200", email: "r.shepard@email.com", docType: "ID Card", docNo: "AT1928340", scanned: true }],
  "82PLK48": [{ id: "654323", name: "Franklin Williams Jr", mother: "—", birth: "20/01/1985", birthPlace: "Berlin", nationality: "German", citizenship: "German", age: "Adult", gender: "Male", reporting: "VIZA / NTAK", booker: true, phone: "+49 30 1122 3344", email: "f.williams@email.com", docType: "Passport", docNo: "GH7383987", scanned: false }],
  "13QXC76": [{ id: "771234", name: "Olivia Schmidt", mother: "—", birth: "08/09/1990", birthPlace: "Munich", nationality: "German", citizenship: "German", age: "Adult", gender: "Female", reporting: "VIZA / NTAK", booker: true, phone: "+49 89 4455 7788", email: "o.schmidt@email.com", docType: "ID Card", docNo: "DE9921334", scanned: true }],
  "55ABK29": [{ id: "881122", name: "Lukas Hofer", mother: "—", birth: "14/06/1992", birthPlace: "Vienna", nationality: "Austrian", citizenship: "Austrian", age: "Adult", gender: "Male", reporting: "VIZA / NTAK", booker: true, phone: "+43 660 222 1188", email: "l.hofer@email.com", docType: "Passport", docNo: "AT2233901", scanned: false }],
};

const SERVICES = {
  "34MRK211": [{ name: "Breakfast (×2)", qty: 2, price: "€36.00" }, { name: "Spa Access", qty: 1, price: "€45.00" }],
  "34MXK25": [{ name: "Airport Transfer", qty: 1, price: "€80.00" }, { name: "Late Check-out", qty: 1, price: "€25.00" }],
  "68CXK25": [{ name: "Breakfast (×4)", qty: 4, price: "€72.00" }, { name: "Crib Rental", qty: 1, price: "€10.00" }, { name: "Babysitter (3h)", qty: 1, price: "€60.00" }],
  "47XK911": [{ name: "Spa Access", qty: 1, price: "€45.00" }],
  "82PLK48": [],
  "13QXC76": [{ name: "Breakfast (×2)", qty: 2, price: "€36.00" }],
  "55ABK29": [],
};

const FINANCES = {
  "34MRK211": { room: "€220.00", services: "€81.00", total: "€301.00", paid: "€150.00", balance: "€151.00" },
  "34MXK25":  { room: "€480.00", services: "€105.00", total: "€585.00", paid: "€585.00", balance: "€0.00" },
  "68CXK25":  { room: "€340.00", services: "€142.00", total: "€482.00", paid: "€200.00", balance: "€282.00" },
  "47XK911":  { room: "€420.00", services: "€45.00", total: "€465.00", paid: "€465.00", balance: "€0.00" },
  "82PLK48":  { room: "€280.00", services: "€0.00", total: "€280.00", paid: "€0.00", balance: "€280.00" },
  "13QXC76":  { room: "€520.00", services: "€36.00", total: "€556.00", paid: "€556.00", balance: "€0.00" },
  "55ABK29":  { room: "€140.00", services: "€0.00", total: "€140.00", paid: "€0.00", balance: "€140.00" },
};

const PROPERTIES = [
  { id: "sunshine", name: "Sunshine Hotel & Apartments", type: "Hotel & Apartments" },
  { id: "cozy",     name: "Cozy Corner Apartments",      type: "Apartments" },
  { id: "lake",     name: "Lake Salt Hotel",              type: "Hotel" },
];

window.RESERVATIONS = RESERVATIONS;
window.GUESTS = GUESTS;
window.SERVICES = SERVICES;
window.FINANCES = FINANCES;
window.PROPERTIES = PROPERTIES;
