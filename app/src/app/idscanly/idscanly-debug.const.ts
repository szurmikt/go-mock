// DEBUG-ONLY GATE — flags the IDScanly "Show debug" dev/QA tooling (capture-tuning readouts,
// live detection log) as visible only on the internal test property. Not a real feature flag;
// slated for removal (or a proper role/flag check) once tuning stabilizes. Compared as a string
// since PropertyInterface.property_id is a plain number post encryption-removal.
export const IDSCANLY_DEBUG_PROPERTY_ID = '6250';
