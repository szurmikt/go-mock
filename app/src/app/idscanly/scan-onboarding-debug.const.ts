// DEBUG-ONLY GATE — shows a "Reset Scan Tour" button on the Help & Tips page (moved there from
// Settings — see app/docs/feature-education-cards-handoff.md), only on the internal test
// property. Lets QA re-trigger the first-run Scan-screen walkthrough on demand instead of
// needing a fresh install/cleared storage to see it again. Not a real feature flag; mirrors the
// IDSCANLY_DEBUG_PROPERTY_ID / LOCK_DEBUG_PROPERTY_ID convention (a dedicated const per
// debug gate, even though the value is currently the same property for all of them).
export const SCAN_ONBOARDING_DEBUG_PROPERTY_ID = '6250';
