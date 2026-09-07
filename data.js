/* global React, I, StatusBar, Pill, Toast */

// Relative-to-today ISO date helper, so the calendar prototype always shows
// a populated view around "today" no matter which day it's opened.
// Builds the string from local date parts — NOT toISOString(), which
// converts to UTC first and silently shifts the date by a day in any
// timezone ahead of UTC (e.g. CEST).
function relDate(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const RESERVATIONS = [
  { id: "34MRK211", name: "Emma Williams", email: "e.williams@email.com", room: "Junior Suit", roomNo: "201", date: "Dec 18, 2025", guests: 2, nights: 2, status: "onboard", source: "Booking.com", checkIn: "26/04/2025  15:30", checkOut: "28/04/2025  11:30", partner: "Booking.com", composition: "2 (2/0/0)", roomId: "106", startDate: relDate(-2), endDate: relDate(2) },
  { id: "34MXK25",  name: "Michael Antonio Franklin Correro", email: "m.antonio@email.com", room: "Luxury Suit", roomNo: "412", date: "Dec 18, 2025", guests: 2, nights: 2, status: "check-in", source: "Direct", checkIn: "26/04/2025  15:30", checkOut: "28/04/2025  11:30", partner: "Direct", composition: "2 (2/0/0)", roomId: "107", startDate: relDate(0), endDate: relDate(2) },
  { id: "68CXK25",  name: "Emma Williams", email: "e.williams@email.com", room: "Junior Suit", roomNo: "203", date: "Dec 18, 2025", guests: 4, nights: 2, status: "onboard", source: "Booking.com", checkIn: "26/04/2025  15:30", checkOut: "28/04/2025  11:30", partner: "Booking.com", composition: "4 (2/1/1)", roomId: "201", startDate: relDate(-4), endDate: relDate(1) },
  { id: "47XK911",  name: "Rose Shepard", email: "r.shepard@email.com", room: "Junior Suit", roomNo: "115", date: "Dec 18, 2025", guests: 1, nights: 3, status: "check-out", source: "Expedia", checkIn: "25/04/2025  14:00", checkOut: "28/04/2025  10:00", partner: "Expedia", composition: "1 (1/0/0)", roomId: "108", startDate: relDate(-3), endDate: relDate(0) },
  { id: "82PLK48",  name: "Franklin Williams Jr", email: "f.williams@email.com", room: "Junior Suit", roomNo: "302", date: "Dec 18, 2025", guests: 3, nights: 2, status: "confirmed", source: "Direct", checkIn: "26/04/2025  16:00", checkOut: "28/04/2025  11:00", partner: "Direct", composition: "3 (2/0/1)", roomId: "115", startDate: relDate(3), endDate: relDate(5) },
  { id: "13QXC76",  name: "Olivia Schmidt", email: "o.schmidt@email.com", room: "Junior Suit", roomNo: "108", date: "Dec 18, 2025", guests: 2, nights: 4, status: "check-in", source: "Booking.com", checkIn: "26/04/2025  15:00", checkOut: "30/04/2025  11:00", partner: "Booking.com", composition: "2 (2/0/0)", roomId: "116", startDate: relDate(0), endDate: relDate(4) },
  { id: "55ABK29",  name: "Lukas Hofer", email: "l.hofer@email.com", room: "Standard Double", roomNo: "210", date: "Dec 18, 2025", guests: 2, nights: 1, status: "open", source: "Direct", checkIn: "26/04/2025  17:30", checkOut: "27/04/2025  10:30", partner: "Direct", composition: "2 (2/0/0)", roomId: "117", startDate: relDate(1), endDate: relDate(2) },
];

// Flat room list, mirroring what the real API is expected to return:
// room_id, room_type (the calendar's group header), room_name, max_occupancy.
// `housekeeping`: clean | dirty | progress | supervision
const ROOMS = [
  { id: "la1", type: "Luxury Apartment", name: "Garden View Apartment — West Wing", maxOccupancy: 8, housekeeping: "clean" },
  { id: "la2", type: "Luxury Apartment", name: "Rooftop Apartment", maxOccupancy: 8, housekeeping: "dirty" },
  { id: "106", type: "Standard Twin Room", name: "106", maxOccupancy: 3, housekeeping: "supervision" },
  { id: "107", type: "Standard Twin Room", name: "107", maxOccupancy: 3, housekeeping: "clean" },
  { id: "108", type: "Standard Twin Room", name: "108", maxOccupancy: 3, housekeeping: "dirty" },
  { id: "115", type: "Standard Twin Room", name: "115", maxOccupancy: 3, housekeeping: "clean" },
  { id: "116", type: "Standard Twin Room", name: "116", maxOccupancy: 3, housekeeping: "progress" },
  { id: "117", type: "Standard Twin Room", name: "117", maxOccupancy: 3, housekeeping: "dirty" },
  { id: "101", type: "Honeymoon Suite", name: "Serenity Suite", maxOccupancy: 3, housekeeping: "clean" },
  { id: "103", type: "Honeymoon Suite", name: "Tranquility Suite", maxOccupancy: 3, housekeeping: "clean" },
  { id: "201", type: "Honeymoon Suite", name: "Sunset Suite", maxOccupancy: 3, housekeeping: "supervision" },
  { id: "10",  type: "Honeymoon Suite", name: "Moonlight Suite", maxOccupancy: 3, housekeeping: "dirty" },
  // Parking spaces are service rooms — no cleaning, so no housekeeping status.
  { id: "p1",  type: "Parking", name: "Underground Parking Space 1", maxOccupancy: 1 },
  { id: "p2",  type: "Parking", name: "Underground Parking Space 2", maxOccupancy: 1 },
  { id: "p3",  type: "Parking", name: "Underground Parking Space 3", maxOccupancy: 1 },
  { id: "p4",  type: "Parking", name: "Underground Parking Space 4", maxOccupancy: 1 },
  { id: "p5",  type: "Parking", name: "Outdoor Parking Space 1", maxOccupancy: 1 },
];

// Blocked date ranges per room (owner-created maintenance/closure blocks).
const BLOCKS = [
  { id: "blk1", roomId: "la2", startDate: relDate(5), endDate: relDate(9) },
  { id: "blk2", roomId: "10",  startDate: relDate(1), endDate: relDate(3) },
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

// The 4 "needs attention" items surfaced on the Tasks tab's briefing card.
// `icon` is a string key into the `I` icon set (data.js stays framework-agnostic).
const BRIEFING_ITEMS = [
  { id: "b1", icon: "IDCard", title: "3 guests haven't completed ID scan", detail: "Required before check-in completes for today's arrivals." },
  { id: "b2", icon: "Door", title: "Room 117 checkout — key not returned", detail: "Guest checked out this morning; front desk should follow up." },
  { id: "b3", icon: "Briefcase", title: "Invoice overdue — reservation 82PLK48", detail: "Franklin Williams Jr, balance €280.00 outstanding." },
  { id: "b4", icon: "Grid", title: "Low stock: breakfast supplies", detail: "Kitchen flagged low pastry & juice stock for tomorrow." },
];

// Seed to-do list for the Tasks tab. `assignee` is "you" or "team";
// `who` is only shown for team tasks. `fromBriefingId` links a task back
// to the briefing item it was created from, so it can't be added twice.
const TASKS = [
  { id: "t1", title: "Call Olivia Schmidt about early check-in", assignee: "you", done: false },
  { id: "t2", title: "Prep welcome basket for the Sunset Suite", assignee: "team", who: "Housekeeping", done: false },
  { id: "t3", title: "Follow up on overdue invoice — 82PLK48", assignee: "you", done: false, fromBriefingId: "b3" },
  { id: "t4", title: "Restock minibar — Room 106", assignee: "team", who: "Housekeeping", done: true },
  { id: "t5", title: "Confirm airport transfer for Michael Correro", assignee: "you", done: true },
];

window.RESERVATIONS = RESERVATIONS;
window.ROOMS = ROOMS;
window.BLOCKS = BLOCKS;
window.BRIEFING_ITEMS = BRIEFING_ITEMS;
window.TASKS = TASKS;
window.GUESTS = GUESTS;
window.SERVICES = SERVICES;
window.FINANCES = FINANCES;
window.PROPERTIES = PROPERTIES;
