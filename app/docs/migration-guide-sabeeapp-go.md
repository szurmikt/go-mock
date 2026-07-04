# ID Scan Technology — Migration Guide for SabeeApp GO

Everything a SabeeApp GO developer needs to port the scan-and-recognise flow into the real app.
The prototype lives in this repo. All source files that need to be ported are collected verbatim
under [`docs/migration-src/`](migration-src/) — copy those into the target app rather than
working from in-place source.

---

## 1. What this system does (executive summary)

The user picks a document type, holds it in front of the camera, and the app:

1. **Detects** the document's outline using OpenCV.js + jscanify (pure-browser, no native plugin).
2. **Captures** a perspective-corrected or cropped image once the document is aligned, steady, and
   well-lit — auto-capture with a stability dwell, or a manual shutter as fallback.
3. **Reviews** each captured side with a quality verdict (sharp / well-lit / glare-free).
4. **Submits** the image(s) to a Supabase Edge Function (`idrecognition`), which proxies the request
   to the IdScanly OCR API and returns extracted document fields.

---

## 2. Third-party libraries

| Library | Version | Role | Where it lives |
|---------|---------|------|----------------|
| **jscanify** | 1.4.2 | Contour-corner detection + perspective warp (`extractPaper`) | `node_modules/jscanify` |
| **OpenCV.js** | vendored from jscanify package | Canny edge detection, image analysis (blurs, thresholds, histograms, Laplacian) | `src/assets/opencv/opencv.js` (~8.6 MB) |
| **@supabase/supabase-js** | latest | Calling the `idrecognition` Edge Function | `node_modules/@supabase/supabase-js` |
| **@ionic/angular** | 8.8.12 | UI framework — `IonContent`, `IonicRouteStrategy` | (already in SabeeApp GO) |
| **@capacitor/core + android** | 8.4.1 | Native layer — camera is still accessed via `getUserMedia` in the WebView | (already in SabeeApp GO) |

**No native camera plugin is used.** The camera is accessed through the standard browser
`getUserMedia` API inside the Ionic WebView. If `getUserMedia` proves unreliable on iOS
WKWebView, the fallback option is `@capacitor-community/camera-preview` — not built out yet.

**OpenCV.js is not installed as a package.** It is loaded lazily from `src/assets/opencv/opencv.js`
(served by the app itself — no CDN). To refresh it after a jscanify upgrade:
```bash
cp node_modules/jscanify/src/opencv.js src/assets/opencv/opencv.js
```

---

## 3. Source files to copy

All files are under [`docs/migration-src/`](migration-src/). Copy the whole tree into your app,
adapting import paths to match wherever you place it.

### Capture module (everything camera-related)

| File | Role |
|------|------|
| [`capture/capture-tuning.ts`](migration-src/capture/capture-tuning.ts) | All detection/quality knobs in one place — tune here, not inside the service |
| [`capture/models/document-type.ts`](migration-src/capture/models/document-type.ts) | `DocumentTypeConfig` + `DOCUMENT_TYPES` — sides, ratios, icons, per-type overrides |
| [`capture/models/capture-quality.ts`](migration-src/capture/models/capture-quality.ts) | `CaptureQuality` interface — per-side verdict |
| [`capture/utils/canvas.util.ts`](migration-src/capture/utils/canvas.util.ts) | `toDataUrl()`, `makeThumbnail()` |
| [`capture/utils/manual-capture-nag.util.ts`](migration-src/capture/utils/manual-capture-nag.util.ts) | Weekly nag suppression flag (`localStorage`) |
| [`capture/services/opencv-loader.service.ts`](migration-src/capture/services/opencv-loader.service.ts) | Lazy OpenCV.js + jscanify initialiser (idempotent, loads once) |
| [`capture/services/capture-session.service.ts`](migration-src/capture/services/capture-session.service.ts) | In-memory session holding captures across Scan → Review navigation |
| [`capture/services/document-detection.service.ts`](migration-src/capture/services/document-detection.service.ts) | Camera feed, detection loop, state machine, capture logic — the core |
| [`capture/pages/home/home.page.ts`](migration-src/capture/pages/home/home.page.ts) | Document-type picker: sets session type, navigates to Scan |
| [`capture/pages/home/home.page.html`](migration-src/capture/pages/home/home.page.html) | Home template |
| [`capture/pages/home/home.page.scss`](migration-src/capture/pages/home/home.page.scss) | Home styles |
| [`capture/pages/scan/scan.page.ts`](migration-src/capture/pages/scan/scan.page.ts) | Scan page: starts detection, handles capture callbacks, drives flip/flash/loader |
| [`capture/pages/scan/scan.page.html`](migration-src/capture/pages/scan/scan.page.html) | Scan template: viewfinder, brackets, control bar, overlays, debug panel |
| [`capture/pages/scan/scan.page.scss`](migration-src/capture/pages/scan/scan.page.scss) | Scan styles: all bracket/flash/flip-prompt/loader/control-bar layout |
| [`capture/pages/review/review.page.ts`](migration-src/capture/pages/review/review.page.ts) | Review page: quality cards, retake, submit |
| [`capture/pages/review/review.page.html`](migration-src/capture/pages/review/review.page.html) | Review template: quality pills, lightbox, submit toast |
| [`capture/pages/review/review.page.scss`](migration-src/capture/pages/review/review.page.scss) | Review styles |

### Recognition module (Edge Function call + result screen)

| File | Role |
|------|------|
| [`idrecognition/services/idrecognition.service.ts`](migration-src/idrecognition/services/idrecognition.service.ts) | Supabase client + `submit()` — converts captures to base64, calls the function |
| [`idrecognition/pages/result/result.page.ts`](migration-src/idrecognition/pages/result/result.page.ts) | Result page: loading/success/processing/error states, field rows, retry, done |
| [`idrecognition/pages/result/result.page.html`](migration-src/idrecognition/pages/result/result.page.html) | Result template: state switch, field list, raw JSON + copy button |
| [`idrecognition/pages/result/result.page.scss`](migration-src/idrecognition/pages/result/result.page.scss) | Result styles |

### Routing and config

| File | Role |
|------|------|
| [`app.routes.ts`](migration-src/app.routes.ts) | The four routes to register in the target app |
| [`environments/environment.ts`](migration-src/environments/environment.ts) | `supabaseUrl` + `supabaseAnonKey` to add to the existing environment file |

### Asset file (not under `migration-src/` — binary)

Copy `src/assets/opencv/opencv.js` (~8.6 MB) into the target app's assets:
```
src/assets/opencv/opencv.js
```
The loader hard-codes the path `assets/opencv/opencv.js` in
[`opencv-loader.service.ts`](migration-src/capture/services/opencv-loader.service.ts) line 12.
If you move it, update that constant.

---

## 4. Angular routes to register

See [`app.routes.ts`](migration-src/app.routes.ts) for the complete set. Add these four to the
target app's route table:

```ts
{ path: 'capture/home',       loadComponent: () => import('./capture/pages/home/home.page').then(m => m.HomePage) },
{ path: 'capture/scan',       loadComponent: () => import('./capture/pages/scan/scan.page').then(m => m.ScanPage) },
{ path: 'capture/review',     loadComponent: () => import('./capture/pages/review/review.page').then(m => m.ReviewPage) },
{ path: 'idrecognition/result', loadComponent: () => import('./idrecognition/pages/result/result.page').then(m => m.ResultPage) },
```

Entry point: navigate to `/capture/home`. The router carries the user through
`scan` → `review` → `idrecognition/result` automatically.

---

## 5. Environment config to wire in

See [`environments/environment.ts`](migration-src/environments/environment.ts). Add these two
fields to the target app's existing `environment.ts` (and `environment.prod.ts`):

```ts
supabaseUrl: 'https://qiwhynwwgicpyeszecuj.supabase.co',
supabaseAnonKey: 'sb_publishable_rd0rgQytObIOQsYq26xMeg_WNpekL7h',
```

The anon key is safe to ship in client-side code — the Edge Function is gated by it,
not a personal user credential. The IdScanly API key never leaves the server.

---

## 6. Screen designs and layout

### 6.1 Home — document type picker

**Source:** [`capture/pages/home/`](migration-src/capture/pages/home/)

**Purpose:** Entry screen. Four large tap-targets, one per document type. No loading, no
instructions — tap a type, go straight to scanning.

```
┌─────────────────────────────────┐
│  🔍 Document capture            │ ← brand mark
│  SabeeApp GO — capture prototype│
│                                 │
│  ┌──────────┐  ┌──────────┐    │
│  │  💳       │  │  🛂       │    │ ← large icon + label per type
│  │  ID card  │  │ Passport  │   │
│  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐    │
│  │  🚗       │  │  🏠       │    │
│  │ Driving   │  │ Address   │   │
│  │ licence   │  │ card      │   │
│  └──────────┘  └──────────┘    │
└─────────────────────────────────┘
```

**Key behaviour:** `chooseType()` calls `CaptureSessionService.start(type)`, then navigates
to `/capture/scan`. The session type is set before navigation so Scan can read it immediately
in `ionViewWillEnter`.

**Icons (Tabler Icons, `ti-` prefix):** `credit-card`, `e-passport`, `car`, `home`.
These come from [`document-type.ts`](migration-src/capture/models/document-type.ts) `DocumentTypeConfig.icon`.

---

### 6.2 Scan — live viewfinder

**Source:** [`capture/pages/scan/`](migration-src/capture/pages/scan/)

**Purpose:** The camera reader. One screen reused for every document side. Shows the camera feed
with corner brackets that change colour based on detection state.

```
┌─────────────────────────────────┐
│ ← ID card: 1st Page             │ ← header: back button + type/side title
│                                 │
│ Scanning the 1st page           │ ← dynamic message (changes per state)
│                                 │
│ ┌─────────────────────────────┐ │
│ │  ┌──                   ──┐  │ │ ← viewfinder box (3:2 aspect ratio)
│ │  │                       │  │ │   corner brackets (gray / green / amber)
│ │  │    [camera feed]      │  │ │
│ │  │                       │  │ │
│ │  └──                   ──┘  │ │
│ └─────────────────────────────┘ │
│                                 │
│  🐛 Show debug                  │ ← debug toggle (hides in production)
│                                 │
│ ┌─────────────────────────────┐ │
│ │  [⚡]    [○  ]    [AUTO]   │ │ ← fixed bottom control bar
│ │ torch   shutter  auto-cap  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Detection states and bracket colours:**

| Status | Bracket colour | Instruction message |
|--------|---------------|---------------------|
| `idle` | — | Full-screen loader with spinner ("Starting scanner…") |
| `searching` | Gray | "Scanning the Nth page" (or type's `scanningMessage`) |
| `aligned` | Green | Same scanning message |
| `bad-light` (dark) | Amber | "Too dark — move to better light" |
| `bad-light` (glare) | Amber | "Glare detected — tilt the card" |
| `captured` | Green | (flash fires; page advances to next side or Review) |

**Capture flash:** On every successful capture a full-viewfinder white flash (500ms) confirms the
photo was taken. Implemented in
[`scan.page.ts`](migration-src/capture/pages/scan/scan.page.ts) `commitCapture()` via a local
`captureFlash` signal + `setTimeout(500)` — decoupled from detection status because the loop can
advance status again in the same call stack before Angular paints.

**"Flip the card" overlay (ID card only):**
After the front side captures, a dimmed/blurred overlay shows the document type's icon animating
with a Y-axis flip plus "Flip the ID card." text.
- Stays up for at least 3 seconds (`FLIP_PROMPT_MIN_MS = 3000`, `scan.page.ts` line 24)
- Also held while `awaitingExit` signal is true (the previous document hasn't left frame yet)
- Prevents the front side from being re-captured as the back

```
┌─────────────────────────────────┐
│ (blurred camera, dimmed scrim)  │
│                                 │
│         💳 (flipping)           │ ← rotateY 0→180→0 animation
│    Flip the ID card.            │
│                                 │
└─────────────────────────────────┘
```

Defined in [`scan.page.scss`](migration-src/capture/pages/scan/scan.page.scss) `.turn-card` /
`@keyframes turn-card-flip`.

**Scanner startup overlay:** Same dimmed/blurred treatment as the flip prompt. Covers the
viewfinder during `status === 'idle'` (~1 second while camera + OpenCV load).
`.scanner-loader` in [`scan.page.scss`](migration-src/capture/pages/scan/scan.page.scss).

**Control bar (fixed bottom, [`scan.page.html`](migration-src/capture/pages/scan/scan.page.html)
lines 96–123):**
- **Flashlight button** — toggles torch on the live camera track; disabled if `torchSupported`
  is false
- **Shutter button** — always available; triggers `captureManual()` regardless of alignment state
- **AUTO button** — pill toggle; when off, only the shutter can capture

**Weekly nag dialog:** When the user taps manual capture while AUTO is on, once per week a modal
prompts them to let auto-capture finish. "Retake with auto" discards the photo and re-arms
detection; "Use taken photo" commits it as-is.
Logic in [`scan.page.ts`](migration-src/capture/pages/scan/scan.page.ts) `onCaptured()`;
suppression in [`manual-capture-nag.util.ts`](migration-src/capture/utils/manual-capture-nag.util.ts).

---

### 6.3 Review — quality verdict

**Source:** [`capture/pages/review/`](migration-src/capture/pages/review/)

**Purpose:** Shows each captured side with a quality verdict. The user can retake any side or
submit all.

```
┌─────────────────────────────────┐
│ ← Review                        │
│   ID card · 2 sides captured…   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [captured image, fullwidth] │ │ ← tap → fullscreen lightbox
│ │ ● Front side                │ │
│ │ ✓ Good quality              │ │ ← green pill
│ │   Sharp, well-lit, glare-   │ │
│ │   free                      │ │
│ │               [↻ Retake]    │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [back side image]           │ │
│ │ ● Back side                 │ │
│ │ ⚠ Recheck                  │ │ ← amber pill — one or more checks failed
│ │   Could be sharper · glare  │ │
│ │   detected                  │ │
│ │               [↻ Retake]    │ │
│ └─────────────────────────────┘ │
│                                 │
│ ⚠ One side could be clearer… │ ← footer note (flips when all good)
│                                 │
│ [➤ Submit both sides]           │
└─────────────────────────────────┘
```

**Quality verdict (per side, three checks):**

| Check | Metric | Threshold (tunable) |
|-------|--------|---------------------|
| Sharp | Variance of Laplacian | `minSharpnessVar: 120` |
| Well-lit | Mean grayscale luminance | `minMeanLuminance: 60` |
| Glare-free | Fraction of near-white pixels | `maxClippedFraction: 0.10` |

All three pass → `verdict: 'good'` (green, "Sharp, well-lit, glare-free").
Any fail → `verdict: 'recheck'` (amber, comma-joined issue list).

This is the **only quality control on the manual-shutter path** — auto-capture never fires on a
blurry/dark frame, but a manual tap can. The Review verdict is where that path gets caught.
See [`document-detection.service.ts`](migration-src/capture/services/document-detection.service.ts)
`analyzeCaptureQuality()` / `buildQuality()`.

**Retake:** `session.clearSide(side)` → navigate to `/capture/scan`. Scan resumes on the first
side still missing a capture.

**Lightbox:** Tap the image to open fullscreen; tap image to toggle 2.5× zoom; tap backdrop or ×
to close. Implemented in [`review.page.ts`](migration-src/capture/pages/review/review.page.ts)
`openLightbox()` / `toggleZoom()`.

---

### 6.4 Result — OCR output

**Source:** [`idrecognition/pages/result/`](migration-src/idrecognition/pages/result/)

**Purpose:** Calls the Supabase Edge Function, shows a loading spinner, then displays the
extracted fields (or an error / retry state).

```
Loading:              Recognition:
┌─────────────┐       ┌─────────────────────────┐
│ ◌ Scanning… │       │ ✓ Recognition complete   │
└─────────────┘       │                          │
                      │ Full Name     98% John D  │ ← key/value + confidence badge
                      │ Date Of Birth 95% 1985-04 │ ← fields iterated generically
                      │ Doc Number    91% AB12345 │
                      │ ...                       │
                      │ { raw JSON } [📋 Copy]    │ ← raw JSON + clipboard button
                      │                           │
                      │ [🏠 Back to Home]         │
                      └─────────────────────────────┘
```

**Four UI states** (`ResultPage.state` signal):

| State | When | UI |
|-------|------|----|
| `loading` | Function call in flight | Spinner |
| `success` | `isProcessing: false` in response | Field rows |
| `processing` | `isProcessing: true` (30s ran out) | "Still processing" + Try Again button |
| `error` | Function returned an error | Error message + Try Again button |

Fields are rendered generically by iterating `summary.fields` at runtime — no hardcoded field
list. The field key is humanised (`dateOfBirth` → "Date Of Birth") by `humanizeKey()` in
[`result.page.ts`](migration-src/idrecognition/pages/result/result.page.ts).

---

## 7. The detection service — how it works

[`capture/services/document-detection.service.ts`](migration-src/capture/services/document-detection.service.ts)
owns everything camera-related. Key design points for porting:

### 7.1 Start / stop lifecycle

```ts
// Start detection for a new side
await detection.start({
  video: videoElement,              // <video> in the DOM
  targetRatio: type.guideRatio,     // expected width/height ratio
  extractWidth: type.extractWidth,
  extractHeight: type.extractHeight,
  tuning: { ...DETECTION_TUNING, ...(type.tuning ?? {}) },
  captureMode: type.captureMode,    // 'warp' | 'frame'
  getGuideEl: () => guideElement,   // lazy ref to the bracket overlay element
  onCapture: (canvas, quality, source) => { ... },
  onError: (error) => { ... },
});

detection.stop();          // tear down camera + loop
detection.arm(requireExit); // re-arm for next side without restarting camera
detection.captureManual(); // fire the manual shutter
detection.setAutoCapture(false); // disable dwell-based auto-capture
detection.setTorch(true);  // toggle flashlight
```

**iOS camera ordering is critical:** `getUserMedia` must be called before any long `await`
(like loading OpenCV.js). iOS Safari only grants camera access when the call is within the
original user-gesture context. The service requests the camera first, then loads OpenCV.
Do not reorder these steps.

### 7.2 Detection state machine

```
'idle'       ← after stop() or before start() resolves
    ↓ arm() called + first tick fires
'searching'  ← no valid document detected (gray brackets)
    ↓ ratio + area + centre geometry all pass
'aligned'    ← right shape and centred (green brackets)
    ↓ if lighting check fails (dark or glare)
'bad-light'  ← amber brackets + specific instruction
    ↓ lighting clears + stable for dwellMs
'captured'   ← capture fires (auto), then arm() resets to 'searching'
```

The loop runs **outside the Angular zone** via `setInterval`. Only signal mutations re-enter
the zone via `zone.run()`, so change detection isn't triggered on every frame tick.

### 7.3 Capture modes

| Mode | When | Output |
|------|------|--------|
| `'warp'` + auto | Card types (ID, licence, address) | Perspective-flattened via jscanify `extractPaper`, bounded to the guide region first. Falls back to guide-box crop if no clean quad found. |
| `'frame'` + auto | Passport | Plain crop of the guide-box region — no warp. |
| Any type + **manual** tap | Always | Guide-box crop (WYSIWYG). Never tries edge detection on a single ungated frame. |

The crop-vs-warp branch is in `capture()` at [`document-detection.service.ts`](migration-src/capture/services/document-detection.service.ts)
line 872: `const cropOnly = source === 'manual' || this.opts.captureMode === 'frame'`.

### 7.4 Lighting gate (live, pre-capture)

Runs on the same downscaled frame as contour detection — no extra overhead. The document must
pass both geometry AND lighting before the brackets go green and auto-capture can fire.
- `mean luminance ≥ minMeanLuminance (60)` — not too dark
- `near-white pixel fraction ≤ maxClippedFraction (0.10)` — not glary

The same two measurements are reused for the post-capture Review verdict via shared
`measureExposure()` so the live gate and the Review check can never drift apart.

### 7.5 Quality verdict (post-capture)

`analyzeCaptureQuality()` runs on the final captured canvas and produces a `CaptureQuality`
(see [`capture-quality.ts`](migration-src/capture/models/capture-quality.ts)). Called on every
capture — auto and manual — so the manual path always gets a verdict even though it bypasses
every live gate.

---

## 8. The Supabase Edge Function call

**Service:** [`idrecognition/services/idrecognition.service.ts`](migration-src/idrecognition/services/idrecognition.service.ts)

### 8.1 What it does

```ts
async submit(captures: CapturedSide[]): Promise<IdRecognitionResponse> {
  const { data, error } = await this.supabase.functions.invoke<IdRecognitionResponse>('idrecognition', {
    body: {
      images: captures.map(c => ({
        side: c.side,                          // 'front' | 'back'
        base64: toBase64(c.fullDataUrl),       // raw base64 — strips "data:image/jpeg;base64,"
        mimeType: 'image/jpeg',
      })),
    },
  });
  // throws on error; returns IdRecognitionResponse on success
}
```

### 8.2 Edge Function endpoint

- **URL:** `https://qiwhynwwgicpyeszecuj.supabase.co/functions/v1/idrecognition`
- **Auth:** Supabase anon/publishable key only — same pattern as `app_config`, `feedback` in the
  real GO app. The Supabase client attaches it automatically.
- **No SabeeApp PMS auth required.** No `Token` header, no user login, no property selection.
- **IdScanly API key** never leaves the server (lives in the function's secrets only).

### 8.3 Request shape

```ts
{
  images: Array<{
    side?: string;       // 'front' | 'back' — informational only
    base64: string;      // raw base64 payload — no data-URL prefix
    mimeType?: string;   // defaults to 'image/jpeg'
  }>;
  // 1 image for single-sided docs (passport, driving licence, address card)
  // 2 images for ID card (front + back)
}
```

### 8.4 Response shape (success)

```ts
{
  sessionId: string;
  pid: string | null;
  isProcessing: boolean;     // false = done; true = 30s budget ran out (show retry)
  status: string;            // "finished" | "processing" | "error" | "waiting_for_images"
  summary: {
    isComplete: boolean;
    imageCount: number;
    successfulImageCount: number;
    failedImageCount: number;
    fields: {
      documentType?: string;
      documentCountry?: string;
      documentNumber?: string;
      fullName?: string;
      dateOfBirth?: string;
      [key: string]: unknown;  // any field IdScanly returns
    };
    fieldConfidences: Record<string, number>;  // 0–1 per field
  };
}
```

### 8.5 Response shape (error)

```ts
{ error: string; detail?: string; sessionId?: string }
```
HTTP 400 / 401 / 500 / 502.

### 8.6 Handling `isProcessing: true`

Not a failure — IdScanly polled for 30s internally but didn't finish. Show a "still processing —
try again" state. A retry starts a new IdScanly session (no way to resume the previous one from
the client).

---

## 9. Per-document-type configuration

Defined in [`capture/models/document-type.ts`](migration-src/capture/models/document-type.ts).
Each `DocumentTypeConfig` object contains:

```ts
interface DocumentTypeConfig {
  id: DocumentTypeId;        // 'id-card' | 'passport' | 'driving-licence' | 'address-card'
  label: string;
  icon: string;              // Tabler icon name (without ti- prefix)
  sides: Side[];             // ['front'] or ['front', 'back']
  guideRatio: number;        // expected width/height — aspect ratio shown on guide box
  extractWidth: number;      // warp output canvas width (px)
  extractHeight: number;
  captureMode: 'warp' | 'frame';
  tuning?: Partial<DetectionTuning>;  // per-type detection overrides
  scanningMessage?: string;  // replaces "Scanning the Nth page" for this type
}
```

**Current configs:**

| Type | Sides | Ratio | Capture | Notes |
|------|-------|-------|---------|-------|
| ID card | front + back | 1.586 (ID-1) | warp | Only two-sided type; shows flip prompt |
| Passport | front only | 1.42 (TD3) | frame | Relaxed detection; manual shutter always shown |
| Driving licence | front only | 1.586 (ID-1) | warp | Contrast-normalise + lower Canny for pink card |
| Address card | front only | 1.586 (ID-1) | warp | Same profile as ID card |

**Per-type detection overrides:**
- `PASSPORT_TUNING` — wider ratio tolerance (0.8), lower min area (0.10), more centre/stability
  slack, longer dwell (700ms). For a hand-held booklet.
- `DRIVING_LICENCE_TUNING` — `contrastNormalize: true`, `cannyLow: 30`, `cannyHigh: 120`. For the
  Hungarian pink licence whose border barely contrasts with a light desk.

---

## 10. All tuning knobs

All in [`capture/capture-tuning.ts`](migration-src/capture/capture-tuning.ts). Change behaviour
here — not inside the service.

| Knob | Default | What it controls |
|------|---------|-----------------|
| `loopIntervalMs` | 200ms | Detection loop interval |
| `dwellMs` | 500ms | Time document must stay aligned before auto-capture fires |
| `analysisWidth` | 480px | Downscale width for OpenCV analysis |
| `cameraIdealWidth/Height` | 1920×1080 | Camera resolution hint (`ideal`, not `min`) |
| `cannyLow / cannyHigh` | 50 / 200 | Canny edge thresholds |
| `contrastNormalize` | false | Pre-process with CLAHE before Canny |
| `minAreaFraction` | 0.15 | Detected quad ≥ this fraction of frame area |
| `maxAreaFraction` | 0.98 | Detected quad ≤ this fraction (not clipped off edges) |
| `ratioTolerance` | 0.30 | ±30% tolerance on expected aspect ratio |
| `stabilityThresholdFraction` | 0.04 | Max per-corner movement between ticks (fraction of width) |
| `centerToleranceFraction` | 0.25 | Max centre offset from frame centre (fraction of frame) |
| `guideRegionMarginFraction` | 0.06 | Extra margin around guide box for warp-mode detection |
| `minMeanLuminance` | 60 | Below this → "too dark" (0–255 scale) |
| `glareClipLevel` | 245 | Pixel value that counts as near-white |
| `maxClippedFraction` | 0.10 | Above this fraction of near-white pixels → "glare" |
| `minSharpnessVar` | 120 | Laplacian variance below this → blurry (Review verdict only) |
| `exitConfirmTicks` | 2 | Consecutive not-aligned ticks to confirm previous doc left frame |
| `jpegQuality` | 0.92 | JPEG quality for captured data URLs |
| `thumbnailMaxEdge` | 280px | Longest edge of Review-screen thumbnail |

All thresholds are **starting guesses, not validated on real devices**. Expect to tune them.

---

## 11. Signals exposed by the detection service

The Scan page binds to these Angular signals from `DocumentDetectionService`:

| Signal | Type | Drives |
|--------|------|--------|
| `status` | `DetectionStatus` | Bracket colour class, message text, loader visibility |
| `lightingIssue` | `'dark' \| 'glare' \| null` | Which bad-light instruction to show |
| `awaitingExit` | `boolean` | Flip-prompt hold (previous doc must leave frame) |
| `debug` | `DetectionDebug \| null` | Live metrics in the debug overlay |
| `logs` | `string[]` | Append-only event log (on-device debugging) |
| `torchSupported` | `boolean` | Whether the flashlight button is enabled |
| `torchOn` | `boolean` | Flashlight current state |

The loop runs outside the Angular zone. All signal mutations go through `zone.run()` so change
detection is only triggered on actual state changes, not every 200ms tick.

---

## 12. Session flow and navigation

```
CaptureSessionService (singleton, in-memory)
  .documentType   ← set by Home.chooseType()
  .captures       ← Map<Side, CapturedSide>, populated by Scan

Navigation:
  Home  →  session.start(type)  →  /capture/scan
  Scan  →  detection fires      →  session.setSide(captured)
        →  all sides done       →  /capture/review
  Review → submit()             →  /idrecognition/result
  Result → done()               →  session.reset() → /capture/home

  Review → retake(side)         →  session.clearSide(side) → /capture/scan
           Scan resumes on first missing side (findIndex)
```

`CaptureSessionService` holds `HTMLCanvasElement` references in memory — no disk writes.
If disk saving is added later, hook it into `setSide()` in
[`capture-session.service.ts`](migration-src/capture/services/capture-session.service.ts).

---

## 13. Android permission

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

No Capacitor plugin call is needed — the permission request fires automatically when
`getUserMedia` runs for the first time inside the WebView.

---

## 14. What is NOT needed from this prototype for SabeeApp GO

- **No SabeeApp PMS auth** — the Edge Function uses the Supabase anon key only. No `Token`
  header, no login/MFA/refresh flow for this call.
- **No Supabase user login** — the anon key is enough.
- **No property selection** — not needed for the idrecognition call.
- The archived SabeeApp auth flow (login/MFA/token storage/interceptor) is parked on the
  `archive/sabeeapp-auth-flow` branch in this repo in case it's needed for a different
  integration later.

---

## 15. Known risks and open questions for production

1. **jscanify picks the single largest contour** — clean, contrasting backgrounds matter. Small ID
   cards lose to background clutter more than full-page paper.
2. **Lamination glare** can break Canny edge detection on real cards — the amber gate helps but
   results will vary by card and lighting.
3. **All thresholds are starting guesses** — `minMeanLuminance`, `glareClipLevel`,
   `maxClippedFraction`, `minSharpnessVar`, `exitConfirmTicks`, `dwellMs` all need tuning against
   real device footage.
4. **Passport bio-page ratio** — currently 1.42 (TD3). Confirm against real passports on hardware.
5. **iOS WKWebView and `getUserMedia`** — deferred. If it proves unreliable, fall back to
   `@capacitor-community/camera-preview`.
6. **Output resolution** — `extractWidth/Height` in
   [`document-type.ts`](migration-src/capture/models/document-type.ts) are placeholders (~300 dpi
   approximations). The real requirement comes from the server-side OCR step.
7. **Back-navigation robustness** — flagged but not fully diagnosed at prototype handoff. The
   in-app `←` back button and device back need verification that the camera/detection loop releases
   and re-acquires cleanly on every path (Home ↔ Scan ↔ Review).
8. **`isProcessing: true` retry** — the current result screen starts a new IdScanly session on
   retry. If timeouts are frequent, a true resume path (polling the same `sessionId`) may be needed.
