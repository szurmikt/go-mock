// DEBUG-ONLY GATE — shows a "Lock Now" button in Settings, above Logout, only on the internal
// test property. Lets QA trigger BiometricService.lockSession() immediately instead of waiting
// out the real 10-minute inactivity/background threshold to test the lock overlay on a real
// device. Not a real feature flag — compared as a string since PropertyInterface.property_id is
// a plain number. Other debug gates in the app (IDScanly's "Show debug", the Scan Tour /
// Tip Cards resets) key off PropertyConfigService.liveUpdateChannel() === 'dev' instead of a
// hardcoded property ID; this one wasn't migrated to that pattern.
export const LOCK_DEBUG_PROPERTY_ID = '6250';
