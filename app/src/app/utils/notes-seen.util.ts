// Per-user, per-reservation, per-device "last seen" watermark for reservation
// notes — deliberately local-only (no server-side read tracking), so a
// staff member switching devices sees previously-seen notes as new again.
// Scoped by userId (not just device) since a front-desk device is often
// shared by multiple staff logging in and out.
function storageKey(userId: string, reservationCode: string): string {
  return `notes.lastSeen.${userId}.${reservationCode}`;
}

/** Epoch ms of the last time this user marked this reservation's notes as seen on this device, or null if never. */
export function getNotesLastSeen(userId: string, reservationCode: string): number | null {
  const raw = localStorage.getItem(storageKey(userId, reservationCode));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Records "now" as the last-seen watermark for this user + reservation, on this device. */
export function markNotesSeen(userId: string, reservationCode: string): void {
  localStorage.setItem(storageKey(userId, reservationCode), String(Date.now()));
}
