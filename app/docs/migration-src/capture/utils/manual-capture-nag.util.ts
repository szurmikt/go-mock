const NAG_STORAGE_KEY = 'idscanner.manualCaptureNag.lastShownAt';
const NAG_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** True once a week has elapsed since the manual-capture nag was last shown (or it never has been). */
export function isManualCaptureNagDue(): boolean {
  const raw = localStorage.getItem(NAG_STORAGE_KEY);
  if (!raw) {
    return true;
  }
  const last = Number(raw);
  return !Number.isFinite(last) || Date.now() - last >= NAG_INTERVAL_MS;
}

/** Record "now" as the last time the nag was shown — restarts the one-week suppression window. */
export function markManualCaptureNagShown(): void {
  localStorage.setItem(NAG_STORAGE_KEY, String(Date.now()));
}
