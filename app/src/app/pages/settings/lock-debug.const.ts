// DEBUG-ONLY GATE — shows a "Lock Now" button in Settings, above Logout, only on the internal
// test property. Lets QA trigger BiometricService.lockSession() immediately instead of waiting
// out the real 10-minute inactivity/background threshold to test the lock overlay on a real
// device. Not a real feature flag; mirrors the IDSCANLY_DEBUG_PROPERTY_ID convention
// (idscanly-debug.const.ts) — compared as a string since PropertyInterface.property_id is a
// plain number.
export const LOCK_DEBUG_PROPERTY_ID = '6250';
