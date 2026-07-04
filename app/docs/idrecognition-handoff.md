# idrecognition Edge Function — Handoff for ID Scan prototype

## What this is

A Supabase Edge Function (`idrecognition`) deployed in the SabeeApp GO Supabase project. It proxies document-recognition requests to IdScanly (`api.idscanly.com`) — creates a session, uploads the captured image(s), polls until done, and returns the extracted fields. The IdScanly API key lives only on this function; the app never sees it.

## Endpoint

- **URL:** `https://qiwhynwwgicpyeszecuj.supabase.co/functions/v1/idrecognition`
- **Auth:** same model as the rest of this app's Supabase usage (`app_config`, `feedback`) — gated by the project's publishable/anon key, not a personal login. **No SabeeApp PMS `Token` header is sent or checked here.** If an earlier auth module (login/MFA/token storage) was ported into this project for a previous integration plan, it is not needed for this call and can be removed.

## Call it with the Supabase JS client

```bash
npm install @supabase/supabase-js
```

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qiwhynwwgicpyeszecuj.supabase.co',
  'sb_publishable_rd0rgQytObIOQsYq26xMeg_WNpekL7h', // publishable/anon key — safe to ship client-side
);

const { data, error } = await supabase.functions.invoke('idrecognition', {
  body: {
    pid: 'HARDCODED_PID', // optional, see Request shape below
    images: [
      { side: 'front', base64: frontImageBase64, mimeType: 'image/jpeg' },
      { side: 'back', base64: backImageBase64, mimeType: 'image/jpeg' }, // omit for one-sided documents
    ],
  },
});
```

The Supabase client attaches the anon key automatically — nothing else to configure for auth.

## Request shape

```ts
{
  pid?: string;   // optional passthrough — not used by IdScanly or for auth; only useful if you
                  // want it echoed back to match a result to a record later. Safe to omit.
  images: {
    side?: string;       // e.g. 'front' | 'back', informational only
    base64: string;      // raw base64 image data — NOT a data URL (strip any "data:image/jpeg;base64," prefix)
    mimeType?: string;   // defaults to 'image/jpeg'
    filename?: string;
  }[];
  // 1 image for one-sided docs (passport, driving licence, address card)
  // 2 images for ID card (front + back)
}
```

## Response shape

On success (whether or not recognition finished within the time budget):

```ts
{
  sessionId: string;
  pid: string | null;
  isProcessing: boolean;   // false = finished; true = timed out waiting (see "Sync vs async" below)
  status: string;          // "processing" | "finished" | "error" | "waiting_for_images"
  summary: {
    isComplete: boolean;
    imageCount: number;
    successfulImageCount: number;
    failedImageCount: number;
    fields: {              // whatever IdScanly could extract — every field optional, may be partial
      documentType?: string;
      documentCountry?: string;
      documentNumber?: string;
      fullName?: string;
      dateOfBirth?: string;
      // ...full field list at https://idscanly.com/developers/
    };
    fieldConfidences: Record<string, number>; // 0–1 per field
  };
}
```

On failure (bad input, IdScanly error, missing secret, etc.):

```ts
{ error: string; detail?: string; sessionId?: string }
```
with an HTTP status of 400, 401, 500, or 502 depending on what went wrong.

## Sync vs async — what the app needs to handle

This is a single blocking call from the app's perspective: send the image(s), await the response, done. **No polling needed on the app side.** Internally, the function itself polls IdScanly (every 2s, up to 30s) before replying once.

One edge case to handle: if `isProcessing` comes back `true`, 30 seconds wasn't enough — uncommon, since IdScanly's docs suggest results typically land within a few seconds. Show a "still processing, try again" message rather than treating it as a failure. There is currently no way to resume/re-poll that same session from the app — a fresh call starts a new session. This is a known gap, not built out for the prototype; flag back if it shows up in testing.

## Wire it in

Same integration point as before: after the existing Review screen, call this function with the captured image(s) instead of just displaying them, show a loading state while waiting, then render the returned fields (or the error) on screen.

## What NOT to build

No login, no MFA, no token storage/refresh, no SabeeApp Token header. None of that applies to this call.
