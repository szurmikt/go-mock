# IDScanly — Developer Manual

How SabeeApp Go implements browser-based ID document scanning (camera capture, live document detection, auto/manual capture, quality checks, review/retake) without any native SDK. This document describes the **capture pipeline only** — get pixels of a well-framed, good-quality document image into your hands. What you do with those images afterwards (OCR backend, upload protocol, auth) is out of scope by design; wire your own backend call where noted.

Written for a developer implementing the same flow in a different app (any framework). The concrete code is Angular/TypeScript, but nothing here depends on Angular except the reactive-state plumbing (Signals) — the algorithm and architecture port directly to React/Vue/vanilla.

---

## 1. What this is / isn't

**Is:**
- A live camera preview with real-time document-edge detection drawn as on-screen guide feedback (search → align → auto-capture).
- A manual shutter fallback, always available.
- Per-document-type configuration (aspect ratio, one- vs two-sided, warp vs frame capture).
- A post-capture quality gate (sharp / well-lit / glare-free / complete) shown on a review screen with per-side retake.
- 100% client-side, browser APIs only (`getUserMedia`, `<canvas>`, OpenCV.js compiled to WASM/asm.js). No native plugin, no Cordova/Capacitor requirement — the same code runs in a plain browser tab.

**Isn't:**
- Not an OCR engine. It produces a cropped/flattened JPEG per side; text extraction happens server-side, out of scope here.
- Not a document classifier — the user explicitly picks the document type before scanning (ID card / passport / driving licence / …); the app doesn't guess it from the image.
- Not encoding/uploading logic — that's a single fetch call you write against your own backend.

---

## 2. Libraries

| Library | Version used | Role |
|---|---|---|
| [`opencv.js`](https://docs.opencv.org/) | vendored build (Emscripten/WASM, ~8 MB) | Edge detection (Canny), contour finding, perspective warp, grayscale/exposure/blur math. Loaded lazily as a `<script>` tag, not an npm import. |
| [`jscanify`](https://www.npmjs.com/package/jscanify) `^1.4.2` | npm package | Thin geometry wrapper over the global `cv` object: finds the largest rectangular contour and perspective-warps ("flattens") it into an output canvas. Ships no TypeScript types — hand-roll a minimal `.d.ts` for the two methods you use (`getCornerPoints`, `extractPaper`). |
| Browser `MediaDevices.getUserMedia` | native API | Live rear-camera video stream. No wrapper library needed. |
| Browser `<canvas>` 2D context | native API | Every frame grab, downscale, crop, and JPEG serialization goes through `drawImage` + `toDataURL`/`toBlob`. |

No native SDK (Regula, ML Kit, etc.), no build-time WASM bundling — `opencv.js` is fetched at runtime on first use, exactly once, and cached in memory for the session. This is *the* structural difference from a native scanner: everything here is DOM + Canvas + a vendored JS/WASM blob.

### 2.1 Vendoring opencv.js

Copy the full `opencv.js` build (the one bundled inside the `jscanify` npm package's own dependency tree, or Emscripten's official build) into your app's static assets folder — do **not** pull it from a CDN. Two reasons: it works identically offline / in a packaged mobile shell (Capacitor/Cordova/Electron all serve local assets from disk with no network dependency), and self-hosting avoids CORS/CSP friction and CDN outages breaking scanning entirely.

### 2.2 Loading strategy — lazy, idempotent, tolerant of every module shape

`opencv.js`'s Emscripten build ships in several possible shapes depending on the exact build flags (a ready module, a `MODULARIZE` factory function you must invoke, or a promise). Write your loader to **feature-detect the shape at runtime** rather than assume one:

1. Inject the `<script>` tag once (guard with a DOM id check — idempotent across repeated calls).
2. After `onload`, inspect `window.cv`:
   - If it already has `.Mat` as a function → it's ready, use it directly.
   - If it's a function → it's the `MODULARIZE` factory. Call it with a `Module` object containing `onRuntimeInitialized` (your ready callback) and `onAbort` (reject the loading promise).
   - If it has `.then` → it's a promise-returning build; chain onto it.
   - Otherwise → assign `onRuntimeInitialized` onto it directly.
3. Always run a backstop poll (e.g. every 100ms, with a ~30s timeout) that resolves the instant `window.cv.Mat` becomes a function, regardless of which path above actually fired — this protects you against build variants you didn't anticipate.
4. Cache the resulting promise (`cvReady`) so every caller after the first gets the same resolved instance — never re-inject the script.
5. Only construct your `Jscanify` instance (or equivalent geometry wrapper) after `cv` is confirmed ready; it touches globals that don't exist yet otherwise.

**Load order matters relative to camera permission.** Request `getUserMedia` **first**, before awaiting the OpenCV load. On iOS Safari in particular, `getUserMedia` only succeeds when called synchronously-ish within the original user-gesture context (the button tap that started the scan); awaiting an ~8 MB script load first can lose that gesture context and cause the permission prompt to silently fail. Sequence: (1) request camera → (2) attach stream to `<video>` and start playback → (3) *then* load OpenCV.js in the background while the camera preview is already visible to the user.

---

## 3. Per-document-type configuration

Before scanning starts, the user explicitly picks what they're holding (ID card, passport, driving licence, …) from a simple type picker. The app never tries to auto-classify the document from the image — sidedness, aspect ratio, and capture strategy are all looked up from a static config keyed by that choice, not detected.

Model each type as a config object:

```ts
interface DocumentTypeConfig {
  id: string;                      // e.g. 'id-card' | 'passport' | 'driving-licence'
  sides: ('front' | 'back')[];     // length 2 => two-sided; length 1 => one-sided
  guideRatio: number;              // expected document aspect ratio, width / height
  extractWidth: number;            // output pixel dimensions (≈300dpi of the physical doc)
  extractHeight: number;
  captureMode: 'warp' | 'frame';   // see §6
  tuning?: Partial<DetectionTuning>; // per-type overrides, merged over the global defaults — see §4
}
```

Two concrete geometries recur:
- **ID-1 card format** (85.6 × 54 mm) → ratio ≈ **1.586**. Covers ID cards, driving licences, address cards.
- **ID-3 / TD3 passport bio page** (125 × 88 mm) → ratio ≈ **1.42**.

**Sidedness is a fixed rule per type**, not detected: e.g. "ID card = two-sided (front + back), everything else = one-sided." A production rollout might want this to vary by country/jurisdiction — treat that as a deliberate future extension, not something to build speculatively now.

Two capture-mode / tuning decisions worth calling out up front, expanded on in later sections:
- A **passport** is a held-open booklet, not a flat card — it can't be reliably corner-detected and perspective-warped (the page curves, and "largest rectangular contour" is ambiguous against the rest of the open booklet). Passports use `captureMode: 'frame'` (crop to the on-screen guide box, no warp) and relaxed alignment tuning (see §4.1).
- A document whose border has **low contrast against typical backgrounds** (e.g. a pale/pink card on a light desk) needs a contrast-normalization pre-step before edge detection, or the Canny step never closes the rectangle. Make this a per-type tuning override, not a global default — most cards detect fine without it, and always-on contrast normalization is unnecessary CPU cost for those.

---

## 4. Live detection loop — architecture

This is the core of the system: a loop that runs several times a second while the camera is live, continuously answering "is a document currently well-aligned in frame, and if so, has it been stable long enough to auto-capture?"

### 4.1 Tuning knobs — keep them in one place

Collect every numeric threshold into a single tuning object, with per-document-type partial overrides merged on top. Do not hardcode thresholds inline in the detection code — you *will* need to retune against real device footage, and hunting through the algorithm for magic numbers is how tuning sessions turn into multi-hour archaeology. Suggested shape and starting values (**treat every value below as an untuned starting guess for your own footage, not a validated constant**):

```ts
const DETECTION_TUNING = {
  loopIntervalMs: 200,          // detection tick cadence — not every frame, saves CPU/battery
  dwellMs: 500,                 // how long alignment must hold before auto-capture fires
  analysisWidth: 480,           // downscale width for the OpenCV analysis frame (speed vs precision)
  cameraIdealWidth: 1920,       // getUserMedia ideal (NOT min — min forces a mode that can break autofocus)
  cameraIdealHeight: 1080,

  cannyLow: 50, cannyHigh: 200, // Canny edge-detection hysteresis thresholds
  contrastNormalize: false,     // CLAHE/equalizeHist pre-step for low-contrast borders — per-type override

  minAreaFraction: 0.15,        // detected quad must cover at least this fraction of the frame
  maxAreaFraction: 0.98,        // …and at most this much (not clipped/too close)
  ratioTolerance: 0.3,          // allowed relative deviation from the type's guideRatio
  stabilityThresholdFraction: 0.04, // max per-corner movement between ticks to count as "stable"
  centerToleranceFraction: 0.25,    // max centre offset from frame centre

  minMeanLuminance: 60,         // below this = "too dark"
  glareClipLevel: 245,          // grayscale value counted as "clipped"/near-white
  maxClippedFraction: 0.1,      // fraction of clipped pixels above which = "glare"

  minSharpnessVar: 120,         // variance-of-Laplacian floor for "sharp"

  minCaptureCoverageFraction: 0.72,      // completeness check, AUTO captures
  manualMinCaptureCoverageFraction: 0.45, // …looser for MANUAL captures — see §7.3
  completenessRatioTolerance: 0.45,
  manualCompletenessRatioTolerance: 0.75,

  exitConfirmTicks: 2,          // consecutive not-aligned ticks before treating the prior doc as "gone"
  guideRegionMarginFraction: 0.06,     // capture-time crop margin around the guide box
  liveDetectionMarginFraction: 0.5,    // live-loop contour search bias margin (looser — user still adjusting)
  completenessMarginFraction: 0.2,
};
```

Passport-specific overrides (booklet, not a flat card — looser everything, longer dwell):
```ts
const PASSPORT_TUNING = {
  ratioTolerance: 0.8,
  minAreaFraction: 0.1,
  centerToleranceFraction: 0.35,
  stabilityThresholdFraction: 0.07,
  dwellMs: 700,
};
```

Low-contrast-border document override:
```ts
const LOW_CONTRAST_DOCUMENT_TUNING = {
  contrastNormalize: true,
  cannyLow: 30,
  cannyHigh: 120,
};
```

### 4.2 Per-tick pipeline

Run this on a plain `setInterval` (or `requestVideoFrameCallback` if available) at `loopIntervalMs`, **outside** your framework's reactivity/change-detection zone if it has one — this loop fires several times a second and re-entering framework change detection on every tick is wasted work. Only re-enter it for the handful of state transitions the UI actually needs to react to (status changes, the final capture callback).

Each tick:

1. **Grab a frame.** Draw the current `<video>` frame into a small offscreen `<canvas>` downscaled to `analysisWidth` (preserve aspect ratio). This is the frame every detection step in this tick operates on — never run OpenCV on the full-resolution video frame, it's needlessly slow.
2. **Read it into an OpenCV `Mat`** (`cv.imread(canvas)`).
3. **Find the document's corner points** (see §4.3).
4. **Evaluate geometry** against the active tuning: aspect ratio within tolerance of `guideRatio`, area fraction within `[minAreaFraction, maxAreaFraction]`, quad centre within `centerToleranceFraction` of frame centre. All three must pass → `aligned`.
5. **Evaluate stability**: compare this tick's corners to the *previous* tick's corners (before overwriting them) — every corner must have moved less than `stabilityThresholdFraction × frameWidth`. This is what turns "briefly aligned by chance" into "the user actually stopped moving the document."
6. **Evaluate lighting** (only once aligned — skip the cost otherwise): mean grayscale luminance and the fraction of near-white ("clipped") pixels, from the same downscaled Mat. Below `minMeanLuminance` → `dark`; above `maxClippedFraction` clipped → `glare`. Dark takes priority over glare when both would apply.
7. **Drive the state machine** (see §4.4) off (aligned, stable, lighting) and, if the dwell timer has elapsed and auto-capture is enabled, fire capture.
8. **Free every OpenCV `Mat`/`MatVector` you allocated this tick** (`.delete()`) in a `finally` block — WASM heap objects are not garbage-collected by the JS engine. Leaking these degrades performance over a session and can eventually crash the tab.

Always run this inside a `try/catch` per tick and degrade to "no issue detected / skip this check" on any thrown error rather than crashing the loop — the vendored WASM build's exact symbol set can vary, and a single bad frame must never kill the whole scanning session.

### 4.3 Corner detection

A parameterised re-implementation of jscanify's own contour-finding (rather than calling its method directly), because you need per-type-tunable thresholds and a search-region bias that jscanify doesn't expose:

1. (Optional, tuning-gated) Convert to grayscale and apply CLAHE (contrast-limited adaptive histogram equalization) or, if unavailable, `equalizeHist` — only for document types whose border has weak contrast against typical backgrounds. Guard every OpenCV call for the function's existence and degrade to the raw frame if the op is missing — the vendored build is trimmed and doesn't guarantee every symbol exists.
2. `cv.Canny(src, edges, cannyLow, cannyHigh)`.
3. `cv.GaussianBlur` the edge map lightly, then `cv.threshold(..., cv.THRESH_OTSU)` to binarize.
4. `cv.findContours` with `RETR_CCOMP` / `CHAIN_APPROX_SIMPLE`.
5. Pick the **largest-area contour**, with one important refinement: **bias the search toward the on-screen guide box.** If you have a live guide rectangle (see §5), ignore any contour whose centre falls outside guide-box-plus-margin, even if it's larger than everything else in frame. Without this bias, "largest contour in the whole frame" will happily latch onto an unrelated object elsewhere in a cluttered scene (a second card, a wallet edge) and the geometry will never stabilize because the winning contour keeps changing tick to tick. Use a *generous* margin for this live-search bias (the user is often still positioning the document) — separately from the *much tighter* margin you'll use at actual capture time (§6.1).
6. Extract the four corner points from the winning contour. Reject the result if any corner is missing/non-finite — treat that tick as "no document found."

### 4.4 Status state machine

Expose a small discrete status for the UI to react to — don't leak raw per-tick metrics into every consumer:

```
idle → searching → aligned → captured
                 ↘ bad-light ↗
```

- **`idle`**: camera not yet started, or between sides.
- **`searching`**: armed, no aligned+stable document currently in frame. Render as neutral/grey guide brackets.
- **`bad-light`**: geometry is aligned but the lighting check failed (dark or glare). Render as amber brackets with a specific instruction ("move to better light" / "reduce glare") — deliberately distinct from `searching` so the user isn't left guessing why nothing is happening.
- **`aligned`**: geometry + stability + lighting all pass. Render as green brackets. Once dwell time elapses (and auto-capture is enabled), this transitions to a capture.
- **`captured`**: a capture just fired; the loop is paused (disarmed) until the caller re-arms it for the next side or a retake.

Track an `alignedSince` timestamp, reset to `0` on any tick that isn't `aligned` (or on start of a fresh `searching`/`bad-light` state). Only once `performance.now() - alignedSince >= dwellMs` does the auto-capture branch fire — this is the "hold still" dwell gate, distinct from and layered on top of the per-tick stability check.

### 4.5 Handling the transition between sides ("turn the card over")

For a two-sided document, after side 1 captures, the *same physical card* is very likely still sitting in exactly the same spot in frame when the loop re-arms for side 2 — a naive re-arm would immediately re-detect it as aligned and instantly (mis-)capture the front again as the back.

Fix with an **"awaiting exit" gate**: when re-arming after a capture (not on the very first arm), require the loop to observe **no aligned document for N consecutive ticks** (`exitConfirmTicks`, debounced — not just one flickered frame, so a single motion-blur tick mid-flip can't prematurely clear it) before alignment is allowed to lead to a new capture. Surface this as its own boolean (e.g. `awaitingExit`) independent of the `status` state machine, since geometry can look "aligned" (the old card hasn't moved yet) while you still want to show "turn the card over" instructional copy rather than "hold still."

---

## 5. Mapping the on-screen guide box to video pixel coordinates

Your UI renders a guide rectangle (the dashed bracket overlay) as a plain HTML/CSS element sized to the type's aspect ratio, sitting on top of a `<video>` element. Several pieces of logic (capture-time crop, the live-detection search bias, the completeness check) need to know **which pixels of the underlying video frame** that on-screen rectangle currently corresponds to.

The video is almost always displayed with `object-fit: cover` — the source is uniformly scaled to fully cover the element's box, then centred, with overflow clipped. To invert this mapping:

```ts
const scale = Math.max(elementRect.width / video.videoWidth, elementRect.height / video.videoHeight);
const offsetX = (elementRect.width - video.videoWidth * scale) / 2;
const offsetY = (elementRect.height - video.videoHeight * scale) / 2;

const toSourceX = (cssX) => clamp((cssX - elementRect.left - offsetX) / scale, 0, video.videoWidth);
const toSourceY = (cssY) => clamp((cssY - elementRect.top  - offsetY) / scale, 0, video.videoHeight);
```

Apply `toSourceX`/`toSourceY` to the guide rectangle's `getBoundingClientRect()` corners to get its rectangle in **source-video pixel space**. From there, derive:
- The same rectangle in **analysis-frame pixel space** (scale by `analysisWidth / video.videoWidth`) — used to bias the live detection search (§4.3 step 5).
- The same rectangle **expanded by a margin** in full-resolution pixel space — used both for the tight capture-time crop (§6.1) and the looser completeness-check crop (§7.2), each with its own margin fraction.

Recompute this on demand (don't cache it) — orientation changes and window resizes shift the mapping.

---

## 6. Capture

### 6.1 `warp` mode — flatten a detected card

Used once the live loop's dwell/stability gate has already confirmed a real, well-aligned document — worth perspective-flattening because you trust the corners.

1. Crop the full-resolution frame to the guide-box region **plus a small margin** (`guideRegionMarginFraction`) *before* re-running corner detection on just that crop. This step matters: running detection on the *full* frame lets an oversized unrelated object outside the guide brackets (the desk edge, an open booklet, a keyboard) win as "largest contour" and get warped to fill the entire output — a real failure mode if skipped. Cropping first removes those objects from consideration entirely.
2. Re-detect corners **inside this crop**, then check the detected quad fills at least ~50% of the crop's area (shoelace formula). If it doesn't, the detector likely locked onto an internal feature (a hologram, the printed photo) rather than the card edge — discard it and fall back to a plain guide-box crop (step 4) instead of warping something wrong.
3. If it passes, offset the corners back into full-frame coordinates and call the perspective-warp primitive (`extractPaper(fullFrameCanvas, outputWidth, outputHeight, corners)` in jscanify) to produce the deskewed output canvas.
4. If no trustworthy quad was found in the crop, fall back to an exact guide-box crop — literally the pixels the user saw inside the brackets, no warp. This WYSIWYG fallback beats an unconstrained "just detect and warp against the whole frame" fallback, which can produce a wildly wrong crop.

### 6.2 `frame` mode — crop only, no warp

Used for documents that can't be reliably corner-detected and flattened (a passport is an open, curved booklet — there's no clean isolated rectangle, and "largest contour" is ambiguous against the surrounding pages/hands). Simply crop the full-resolution frame to whatever the on-screen guide box currently covers (§5), with no warp step at all. Simpler and more predictable than a bad warp for the geometries where warp doesn't apply cleanly.

### 6.3 Manual capture always crops-only (WYSIWYG), regardless of type

A manual shutter tap **always** does the guide-box crop (§6.2's logic), even for a type whose auto-capture uses `warp` mode. Rationale: the user is looking at the live preview and framing the shot themselves — they expect the saved image to match exactly what they saw inside the brackets. A single ungated frame from a manual tap also can't be trusted the way an auto-capture's multi-tick-confirmed geometry can, so attempting a corner-detect-and-warp on it risks a confidently-wrong crop with no live gate to have caught it.

### 6.4 Auto vs. manual, unified through one code path

Structure capture as a single internal function taking a `source: 'auto' | 'manual'` parameter, called from exactly two places: the dwell-elapsed branch of the tick loop, and the manual shutter button handler. Both **must** converge on the same post-capture quality-scoring step (§7) before handing the result to the caller — this is what prevents the manual shutter (which bypasses every live alignment/lighting gate) from ever producing an unvalidated image. Manual capture is always available regardless of whether auto-capture is currently toggled on; the auto-capture toggle only gates the dwell-timer branch.

On every capture (auto or manual): disarm the loop immediately (stop ticking until the caller explicitly re-arms for the next side), grab the current full-resolution `<video>` frame into a canvas, run the completeness check (§7.2) **on this raw pre-crop frame**, produce the cropped/warped output per §6.1–6.3, then run the rest of the quality scoring (§7) on that output. Only after all of this does the capture callback fire back to the UI layer with `(capturedCanvas, qualityResult, source)`.

---

## 7. Post-capture quality gate

This is the single quality backstop for **every** capture, most critically the manual path — auto-capture already had to pass live alignment + lighting to get here, but manual bypassed all of that, so this is the only check standing between a bad manual tap and a garbage image reaching review/submission.

Compute four independent boolean checks, each contributing to a `verdict: 'good' | 'recheck'` (good only if **all four** pass):

### 7.1 Sharpness, exposure, glare — on the captured (cropped/warped) output

- **Sharp**: variance of the Laplacian of the grayscale image (a standard focus/blur metric — higher variance = sharper edges = more in focus), compared against `minSharpnessVar`. Downscale to `analysisWidth` first for consistent thresholds and speed.
- **Well-lit**: mean grayscale luminance ≥ `minMeanLuminance` — same primitive as the live lighting check (§4.2 step 6), reused here so the two can never drift out of sync with each other.
- **Glare-free**: fraction of near-white (clipped) pixels ≤ `maxClippedFraction` — same shared primitive.

Guard every OpenCV call here too, and degrade to a **passing** result (`Infinity` sharpness, full luminance, zero clipped fraction) rather than blocking submission on a check that couldn't actually run.

### 7.2 Completeness — on the PRE-crop frame, never the saved output

This check answers "was the whole document actually inside the frame, or is part of it cut off / covered by a finger?" It **must** run on the raw frame captured *before* cropping/warping — not on the final saved image. This is worth over-emphasizing because it's an easy trap: `warp` mode maps the detected card's corners exactly onto the output canvas boundary, so a warped output has **no card edges left inside it** for a contour detector to find — every well-warped image looks "no document detected" if you run this check on the output instead of the source. (A guide-box crop is nearly as tight, for the same reason.) Only the pre-crop full frame still shows the document boundary against surrounding background.

Steps:
1. Crop the pre-crop full frame to the guide-box region plus a **generous** margin (`completenessMarginFraction` — deliberately larger than the capture-time crop margin in §6.1, since here you need the card's edges *plus* enough surrounding background for Canny to close the contour, even when the card sits right at the guide line).
2. Run corner detection within that crop.
3. No quad found at all → incomplete, reason `not-found` (ambiguous between real occlusion and the detector simply failing — use softer, less alarming copy for this reason in the UI).
4. Quad found but its aspect ratio deviates from the type's `guideRatio` beyond tolerance, OR its area relative to the (unpadded) guide box falls below the coverage floor → incomplete, reason `geometry`.
5. Quad found but touches/crosses the crop boundary → incomplete, reason `clipped` (the document runs outside where it should be — likely cut off by the frame edge).
6. Otherwise → complete.

**Use looser tolerances for manual captures than auto.** An auto-capture only ever fires after the live loop confirmed several consecutive well-aligned, stable frames — its geometry is trustworthy at tight thresholds. A manual shutter tap hands this check one arbitrary, often hand-held-at-an-angle frame; a tilted card is *genuinely* foreshortened in a 2D image (real perspective distortion, not detector noise), so a tight ratio/coverage tolerance will falsely flag good manual captures constantly. Maintain separate `manualCompletenessRatioTolerance` / `manualMinCaptureCoverageFraction` constants, looser than their auto counterparts, and branch on capture `source`. Likewise, the "clipped" boundary check should compare against the *actual saved crop* for manual (no padding — that's genuinely what gets saved) vs. the padded analysis region for auto.

### 7.3 Building the verdict + human-readable summary

`verdict = 'good'` iff sharp && wellLit && glareFree && complete; otherwise `'recheck'`. Build a short human-readable summary line by joining whichever checks failed (e.g. "Could be sharper · Glare detected"), with completeness reported first when it's the failing check — an occluded/cut-off document is a more actionable, more severe problem than borderline blur or exposure, and deserves top billing in the message. Keep the raw metrics (Laplacian variance, mean luminance, clipped fraction, coverage fraction, detected ratio, completeness reason) attached to the result object even though the UI mostly shows the summary — they're invaluable for a developer-facing debug overlay when retuning thresholds against real device footage later (see §9).

---

## 8. Review screen — retake, submit, session handoff

After all required sides are captured, hand off to a review step:

- Show each captured side (full-resolution image) with its quality verdict and summary line.
- **Retake** per side: clear that side's stored capture and re-enter the live camera flow armed for that specific side — don't force the user to redo every side.
- A non-blocking warning banner when any side's verdict is `recheck` ("could be clearer — you can still submit") rather than a hard block; quality is a heuristic, not a guarantee, and false negatives should not trap the user.
- **Submit** hands the set of captured canvases (JPEG-encoded, e.g. `canvas.toDataURL('image/jpeg', 0.92)`) to your own backend call. This is the deliberate boundary of this document: build a single async function that takes the captured sides and does whatever your app's upload/OCR-submission contract requires. Everything above this line — camera, detection, capture, quality — is complete and reusable regardless of what that backend call looks like.
- Keep a small in-memory session object (document type, per-side captures + thumbnails + quality, navigation context) that survives the scan → review → retake → submit round trip, and is explicitly reset (`documentType = null`, captures cleared) both on successful submit and on user-initiated cancel. Don't let a half-finished scan session leak into the next one.
- If your capture flow spans multiple screens/routes, make sure "back" from review re-enters the same single logical flow rather than accumulating history entries on every retake — a user tapping back after three retakes should land where they started, not step back through each intermediate retake.

Thumbnails: generate a small (e.g. ≤280px longest edge) downscaled JPEG copy of each full-resolution capture for any list/tray UI — never re-render the full-resolution canvas at thumbnail size on every re-render.

---

## 9. Debug tooling (recommended, not required)

Building this against real device footage without visibility into *why* a given frame did or didn't align is extremely slow. Build a lightweight, togglable debug overlay early:

- A small picture-in-picture `<canvas>` showing exactly the downscaled analysis frame the detector is looking at, with the detected quad drawn on top (color-coded: red = found but not aligned, amber = aligned but not yet stable, green = aligned + stable).
- A live numeric readout of the current tick's metrics: ratio, area fraction, centre-offset OK/not, stability OK/not, mean luminance, clipped fraction.
- A small rolling append-only log (last ~10–15 lines) of key lifecycle events (camera acquired at WxH, OpenCV load steps, per-second metric snapshots, errors) — invaluable when a real bug report has to be diagnosed remotely rather than live on the device in front of you.
- Gate this whole panel behind a dev-only flag (a hidden gesture, a build flag, an allowlisted test account/property) — it's calibration tooling, not end-user UI, and the raw numbers are meaningless to a front-desk user.

Once you have this, the actual tuning workflow is: capture real footage across your target document types and a range of lighting/backgrounds, watch the live metrics, and adjust `DETECTION_TUNING` (and per-type overrides) until false rejects and false accepts both drop to an acceptable rate. Every threshold in §4.1 should be treated as a starting guess to be replaced by numbers backed by your own test footage — don't ship the values in this document as final.

---

## 10. Common pitfalls (all previously hit — avoid repeating them)

1. **Requesting camera permission after an async delay loses the iOS gesture context.** Always call `getUserMedia` as the very first `await` in your start sequence, before loading OpenCV or doing anything else async (§2.2).
2. **Running the completeness check on the cropped/warped output instead of the pre-crop frame.** Warp mode leaves no detectable card edges in the output — this check will silently fail on every good capture if you get this backwards (§7.2).
3. **One fixed completeness/ratio tolerance for both auto and manual captures.** Manual is a single, often-tilted, ungated frame — it needs meaningfully looser geometry tolerance than a multi-tick-confirmed auto capture, or you'll false-flag good manual shots constantly (§7.2).
4. **Detecting the largest contour in the whole frame instead of biasing toward the guide box.** In a cluttered scene this flip-flops between candidate objects tick to tick and geometry never stabilizes (§4.3).
5. **Re-arming detection for side 2 immediately after capturing side 1.** The same physical document is usually still sitting in the same spot — without an "awaiting exit" debounce, it gets captured again instantly as the wrong side (§4.5).
6. **Leaking OpenCV `Mat`/`MatVector` allocations.** They live on the WASM heap, not the JS-GC'd heap — every one you `new` needs an explicit `.delete()` in a `finally` block, every tick, indefinitely, for the life of the session.
7. **Using `min` instead of `ideal` for the requested camera resolution.** A hard `min` constraint can force the camera into a mode that breaks autofocus entirely on some devices, producing a permanently blurry stream that no capture-time check can fix.
8. **Assuming a single fixed shape for the loaded `opencv.js` module.** Different builds hand back a ready module, a factory function, or a promise — feature-detect all three plus a polling backstop rather than assuming one (§2.2).
9. **Not degrading gracefully when an OpenCV function is missing.** The vendored/trimmed WASM build's exact symbol set isn't something you can rely on introspecting ahead of time — guard every call and fall back to "couldn't run this check, don't block on it," never a hard throw.
