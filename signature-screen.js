/* global React, I, SignaturePad, HOTEL_TERMS, PROPERTIES */

const { useState, useRef, useEffect } = React;

// The capture canvas is full-screen, but a signature only ever fills a small
// part of it — saving the whole canvas as-is gives a tall, mostly-empty PNG
// that then renders tiny once its full-screen aspect ratio gets squeezed
// into the check-in page's short, wide signature field. Crop to the actual
// ink's bounding box (from signature_pad's own point data, padded a bit for
// stroke width/antialiasing) so the saved image is just the signature.
function cropSignature(canvas, strokeData) {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const margin = 24; // CSS px
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  strokeData.forEach(group => group.points.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }));
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(canvas.width / ratio, maxX + margin);
  maxY = Math.min(canvas.height / ratio, maxY + margin);

  const sx = minX * ratio, sy = minY * ratio;
  const sw = Math.max(1, (maxX - minX) * ratio), sh = Math.max(1, (maxY - minY) * ratio);
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  out.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL("image/png");
}

// Check-in & Accepting T&C — a full-screen take-over (not a bottom sheet)
// pushed from the Reservation Status sheet's "Sign" action. Modeled on a
// paper hotel registration card: guest/property/date header, the full T&C
// text, then a signature field at the bottom. Rendered as an overlay from
// within ReservationDetailScreen rather than through app.js's screen stack,
// so its state (the in-progress signature) survives opening/closing the
// nested capture view without being reset by the stack's unmount-on-back
// behavior (see CLAUDE.md's CalendarScreen "Known Issues" for the same
// single-active-screen caveat elsewhere in this app).
function CheckinSignScreen({ guestName, guestEmail, onClose, onConfirm }) {
  const [signature, setSignature] = useState(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const today = new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const property = PROPERTIES[0];

  return (
    <div className="checkin-sign-backdrop">
      <div className="page">
        <div className="sub-header">
          <button className="back" onClick={onClose}><I.ChevronBack /></button>
          <span className="title">Check-in &amp; Accepting T&amp;C</span>
        </div>

        <div className="app-scroll" style={{ padding: "0 16px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
          <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-4)" }}>Guest</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "var(--ink)", marginTop: 2 }}>{guestName}</div>
            <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-4)" }}>Property</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{property.name}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-4)" }}>Date</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{today}</div>
              </div>
            </div>
          </div>

          <h3 className="group-title" style={{ marginTop: 8 }}>Terms &amp; Conditions</h3>
          <div className="card checkin-terms" style={{ marginBottom: 16 }}>{HOTEL_TERMS}</div>

          <div className="checkin-consent-note">
            By signing below, <strong>{guestName}</strong> confirms they have read and accept the Terms &amp; Conditions and house policies above. A copy will be emailed to {guestEmail}.
          </div>

          <h3 className="group-title">Signature</h3>
          {!signature ? (
            <button className="sig-field" onClick={() => setCaptureOpen(true)}>
              <I.Edit style={{ width: 22, height: 22 }} />
              Tap to sign
            </button>
          ) : (
            <button className="sig-field filled" onClick={() => setCaptureOpen(true)}>
              <img src={signature.dataUrl} alt="Guest signature" />
            </button>
          )}
        </div>

        <div style={{ padding: "12px 16px calc(16px + env(safe-area-inset-bottom, 0px))", background: "var(--bg)", borderTop: "1px solid var(--line)", flexShrink: 0 }}>
          <button className="btn" disabled={!signature} style={{ opacity: signature ? 1 : 0.5 }} onClick={() => onConfirm(signature.dataUrl)}>
            Confirm &amp; Save
          </button>
        </div>
      </div>

      {captureOpen && (
        <SignatureCaptureScreen
          initialData={signature ? signature.raw : null}
          onCancel={() => setCaptureOpen(false)}
          onDone={(sig) => { setSignature(sig); setCaptureOpen(false); }}
        />
      )}
    </div>
  );
}

// Full-screen signature_pad canvas. Always full-screen regardless of the
// check-in page's own length or the device's orientation — this is what
// gives the signature the most room in either portrait or landscape without
// a separate "expand" step: rotating the phone while this is open just gives
// a wider canvas for free via the resize handler below.
//
// `initialData` (when re-opening to redo an existing signature) is the raw
// signature_pad point data, not the cropped display image — loading the
// cropped image back in would mean stretching a small, tightly-cropped PNG
// across the full-screen canvas via fromDataURL's width/height scaling,
// which distorts it. Point data reloads via fromData() at 1:1 scale instead.
function SignatureCaptureScreen({ initialData, onCancel, onDone }) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(!initialData);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = canvas.parentElement;
    const pad = new SignaturePad(canvas, { penColor: "#142333", backgroundColor: "rgba(0,0,0,0)" });
    padRef.current = pad;
    pad.addEventListener("beginStroke", () => setIsEmpty(false));

    // Resizing a <canvas> element clears it, so on every resize (including a
    // device rotation) we snapshot whatever's currently drawn as vector point
    // data — not a bitmap — and redraw it after resizing, instead of just
    // wiping the signature the moment the phone turns.
    const resize = () => {
      const savedData = !pad.isEmpty() ? pad.toData() : null;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const { width, height } = wrap.getBoundingClientRect();
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.getContext("2d").scale(ratio, ratio);
      if (savedData) pad.fromData(savedData);
    };
    resize();
    if (initialData) pad.fromData(initialData);

    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      pad.off();
    };
  }, []);

  const clear = () => { padRef.current.clear(); setIsEmpty(true); };
  const done = () => {
    if (padRef.current.isEmpty()) return;
    const raw = padRef.current.toData();
    onDone({ dataUrl: cropSignature(canvasRef.current, raw), raw });
  };

  return (
    <div className="sig-capture-backdrop">
      <div className="page">
        <div className="sig-capture-bar">
          <button className="icon-btn" onClick={onCancel}><I.X /></button>
          <span className="sig-capture-title">Sign here</span>
          <button className="sig-clear-btn" onClick={clear} disabled={isEmpty}>Clear</button>
        </div>
        <div className="sig-canvas-wrap">
          <canvas ref={canvasRef} />
          <div className="sig-baseline" />
        </div>
        <div className="sig-capture-footer">
          <button className="btn" disabled={isEmpty} style={{ opacity: isEmpty ? 0.5 : 1 }} onClick={done}>Done</button>
        </div>
      </div>
    </div>
  );
}

window.CheckinSignScreen = CheckinSignScreen;
