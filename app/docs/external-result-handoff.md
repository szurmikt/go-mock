# external-result Edge Function — Handoff

## What this is

A Supabase Edge Function (`external-result`) that proxies the app's **scan feedback loop** to IdScanly. After a guest's scanned data is saved in SabeeApp Go, the app posts the final, user-confirmed field values back to the IdScanly session that produced them. IdScanly stores this alongside (never merged into) its own OCR result and uses it to measure and improve extraction accuracy.

**Status: deployed and live** — slug `external-result`, version 1, ACTIVE, `verify_jwt: true`, deployed 2026-08-18 via the Supabase Management API to project `qiwhynwwgicpyeszecuj`. The client half is [external-result.service.ts](../src/app/idscanly/services/external-result.service.ts).

The deployed source is not vendored in this repo (same convention as `idrecognition`, `config`, `feedback`) — retrieve it with the Supabase MCP's `get_edge_function` tool, slug `external-result`, or from the dashboard. **It needed no new secret:** it reads the same `IDSCANLY_API_KEY` env secret `idrecognition` already uses.

## Why a proxy at all

The IdScanly API key must never reach the client. A Capacitor build ships its JS bundle unencrypted — unzip the `.ipa`/`.apk` and any embedded key is extractable. Same reasoning, and same pattern, as the existing `idrecognition` function (see [idrecognition-handoff.md](idrecognition-handoff.md)): **the IdScanly API key lives only on this function; the app never sees it.**

## Upstream endpoint (function → IdScanly)

```http
POST https://bck.idscanly.com/api/v1/sessions/{sessionId}/external-result
x-api-key: <IdScanly API key — from a Supabase secret, never client-supplied>
Content-Type: application/json
```

Body: the `result` object received from the client, forwarded **unchanged**.

IdScanly's contract:
- The payload may be any valid JSON **object or array** — primitives (string/number/boolean/null) are rejected with `400 INVALID_EXTERNAL_RESULT`.
- There are **no required document fields**; the JSON is stored raw.
- Body size limit **1 MB** by default (`EXTERNAL_RESULT_MAX_BODY_BYTES`). Our payload is ~10 short fields, so this is never a practical concern.
- Re-posting for the same session **updates** the previous external result rather than creating a duplicate.
- Errors: `400` (malformed / not an object), `401` (bad or expired API key), `404` (session not found, or it belongs to a different API key).

## Client → function request shape

```ts
{
  pid: string | null;      // active property_id, for server-side validation
  sabeeToken: string | null; // caller's live SabeeApp access token
  deviceId: string;        // the device the token was issued to — required by /users/me
  isTest: boolean;         // which SabeeApp host to validate against (live vs test)
  sessionId: string;       // IdScanly session the result attaches to → goes in the URL
  result: Record<string, unknown>; // forwarded to IdScanly verbatim
}
```

Auth to the function itself is the Supabase anon/publishable key (`Authorization: Bearer <anon>`), same as `idrecognition`.

## Server-side hardening (as implemented)

Mirrors `idrecognition` exactly — the anon key alone is not sufficient, since it is extractable from any installed build. Before spending an IdScanly call, the function **fails closed** unless both hold:

1. **Live SabeeApp session** — call SabeeApp's own `/users/me` with the supplied `sabeeToken` **and** `Device-Id: deviceId` (the API ties token validation to the issuing device — this was a real bug on `idrecognition`'s first deploy, which used a placeholder device id and rejected every valid session). Pick the host from the function's own hardcoded live/test URLs based on `isTest`; **never** trust a client-supplied URL.
2. **Property actually has IdScanly enabled** — `property_config.scan_vendor = 'idscanly'` for the claimed `pid`.

Both run in parallel with their own timeouts (8s / 5s) and treat any error, timeout, or non-success response as failure. The function adds one guard `idrecognition` doesn't need: a non-object `result` is rejected with 400 locally, mirroring IdScanly's own `INVALID_EXTERNAL_RESULT` rule, so a malformed payload costs no upstream call.

### Verified against the live function

Direct curl, 2026-08-18 — every rejection occurs *before* the IdScanly call, so none incurred vendor usage:

| Case | Expected | Actual |
|---|---|---|
| Missing `sessionId` | 400 | `400 {"error":"Missing sessionId"}` |
| Primitive `result` | 400 | ``400 {"error":"`result` must be a JSON object or array"}`` |
| Bogus `sabeeToken` | 401 | `401 {"error":"Invalid or expired SabeeApp session"}` |
| `GET` instead of `POST` | 405 | `405 {"error":"Method not allowed"}` |
| No Supabase JWT | 401 | `401 UNAUTHORIZED_NO_AUTH_HEADER` (gateway) |

**Not yet verified: the happy path.** No real IdScanly session has reached the function. Testing is **browser-only, no TestFlight build needed** — IdScanly is browser-based (`getUserMedia`/OpenCV) unlike Regula: `ionic serve --ssl --external`, property 6250, scan → Save, then confirm `POST /functions/v1/external-result` returns 200 with `idscanly.imageCount >= 1`. **`imageCount: 0` is the failure mode to watch for** — IdScanly matched the session but no images, meaning the threaded `sessionId` is wrong; it would otherwise look like success.

## What the app sends as `result`

A flat object using **IdScanly's own field vocabulary** (the same names their `summary.fields` response uses), holding the values actually persisted to the SabeeApp API. Built by [to-idscanly-fields.ts](../src/app/idscanly/utils/to-idscanly-fields.ts).

Identity documents (passport / ID card / driving licence):

```json
{
  "givenNames": "János",
  "surname": "Kovács",
  "fullName": "János Kovács",
  "motherMaidenName": "Szabó Mária",
  "dateOfBirth": "1985-06-22",
  "placeOfBirth": "Budapest",
  "sex": "Male",
  "citizenship": "HUN",
  "documentType": "id",
  "documentNumber": "AB1234567",
  "dateOfIssue": "2018-03-15"
}
```

Address cards (lakcímkártya) — only the address is ever captured or saved for this type, so identity keys are omitted entirely rather than sent as nulls:

```json
{
  "documentCountry": "HUN",
  "postalCode": "6100",
  "city": "Kiskunfélegyháza",
  "streetAddress": "Kiskun utca 13"
}
```

Blank/whitespace-only values are normalised to `null` so IdScanly sees "not present" rather than `""`.

### Design notes (deliberate, not oversights)

- **Only final values are sent** — no original/corrected pairing, no "what changed" flags. IdScanly already stores its own OCR output for the session and its admin UI does the comparison itself, so echoing their data back would be redundant. Their docs confirm no fields are required.
- **The payload is identical whether the user accepted the scan as-is or corrected it first.** IdScanly needs the final accepted values; how the user arrived at them is not their concern.
- **IdScanly's key names are used, not this app's or the PMS web interface's.** Their admin UI does a *best-effort* comparison against the fields it extracted itself — sending their exact names makes that comparison exact rather than fuzzy.
- **No SabeeApp-internal identifiers are sent** (no guest id, reservation id, or property id in the `result` body) — they have no bearing on OCR accuracy.

> **Open question for IdScanly (non-blocking):** the SabeeApp PMS *web* interface posts a differently-shaped object (a `{"guest": {…}}` wrapper, PMS-internal key names, paired `X`/`X_formatted` values). If IdScanly has already tuned a parser to that shape, they may prefer it. This was weighed and rejected for the mobile app — see the design notes above — but it is worth confirming they parse both.

## When the app calls it

Only when the guest being saved was scanned **via IdScanly** in this session, and only **after** the SabeeApp guest save has already succeeded. Two call sites:

- [guest-detail.page.ts](../src/app/pages/guest-detail/guest-detail.page.ts) `processScanResult('save')` — user accepted the scan result as-is.
- [guest-edit.page.ts](../src/app/pages/guest-edit/guest-edit.page.ts) `save()` — user corrected the scan result first.

Both delegate to `ExternalResultService.submitInBackground()`, which no-ops when no `sessionId` is present. Regula scans never set one, so the Regula flow is unaffected with no vendor check needed.

## Failure behaviour

Fire-and-forget. The guest save has already completed before this fires; the call **never** blocks, delays, retries, or surfaces an error to the user. Failures are reported to Sentry (tag `context: idscanly_external_result`) so a broken function doesn't mean IdScanly silently receives nothing forever.

## Response

The function's response body is not consumed by the app — only the HTTP status matters (non-2xx is logged to Sentry). Passing IdScanly's response through unchanged is fine and useful for debugging.

IdScanly's own success shape:

```json
{ "success": true, "sessionId": "…", "imageCount": 2, "message": "External result saved for 2 images" }
```
