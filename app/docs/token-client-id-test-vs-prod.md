# `/token` login — `client_id` format differs by environment

> Finding date: 2026-05-31. Affects the `POST /token` password-grant login.
> Brief for the SabeeApp API team.

## Summary

The `POST /token` password-grant login validates the **`client_id`** field differently in TEST vs
PROD. The same request with the same valid credentials succeeds in one environment and fails in the
other purely because of the **format** of `client_id`.

| | Endpoint | Expects `client_id` as | Example value | Rejection if wrong format |
|---|---|---|---|---|
| **PROD** | `api.sabeeapp.com/go` | An **encrypted string** — the client id in its encrypted/hashed form (16-char hex) | `366f7aff6d185668` | Plain integer → `ret_code 1005` — *"The client_id field encrypted wrong."* |
| **TEST** | `smart.sabeeapp.com/api2/go` | A **plain integer** — the raw, un-encrypted client id | `1000` | Encrypted hex → `ret_code 1003` — *"The client_id field must contain an integer."* |

## What this implies (inferred from the error messages)

- There is a single underlying **numeric** client id.
- **PROD** requires it **encrypted** — it decrypts/verifies the value, and `366f7aff6d185668` is that
  encrypted form. A plain integer fails decryption → `1005` "encrypted wrong".
- **TEST** requires the **raw integer** and explicitly rejects anything non-integer → `1003` "must
  contain an integer". It does **not** accept the encrypted hex.
- So the *same logical client* must be sent in **two different representations** depending on
  environment — encrypted (PROD) vs plain integer (TEST). One value cannot satisfy both.

## Other facts

- Same request body, same valid credentials — only the `client_id` representation differs.
- The format check runs **before** credential validation, so a wrong-format `client_id` fails login
  regardless of username/password (it presents as "incorrect credentials" but isn't).
- `client_id` is sent **only** on this first `/token` (password) call — **not** on `/mfa/verify` or on
  token refresh (`grant_type: 'refresh_token'`).
- Rest of the payload is identical across environments: `username`, `password`, `device_id`,
  `grant_type: 'password'`.

## Request shape (for reference)

```
POST {apiUrl}/token
{
  "username":   "<email>",
  "password":   "<password>",
  "device_id":  "<device id>",
  "grant_type": "password",
  "client_id":  <encrypted hex on PROD | plain integer on TEST>
}
```

Returns `{ success, data: { mfa_token, expires_in, required, methods } }` on success; the app then
calls `POST /mfa/verify` to exchange the `mfa_token` for access/refresh tokens.

### Observed responses

PROD, `client_id: 1000`:
```json
{ "success": false, "errors": [ { "ret_code": 1005, "ret_msg": "The client_id field encrypted wrong." } ] }
```

TEST, `client_id: "366f7aff6d185668"`:
```json
{ "success": false, "errors": [ { "ret_code": 1003, "ret_msg": "The client_id field must contain an integer." } ] }
```

TEST, `client_id: 1000` (success):
```json
{ "success": true, "errors": [], "data": { "mfa_token": "…", "expires_in": 120, "required": true, "methods": ["totp"] } }
```

## How the app handles it

`client_id` is selected by API mode (mirrors the existing `apiUrl` / `testApiUrl` split):

- `Config.CLIENT_ID = '366f7aff6d185668'` (encrypted hex) → used in **live** mode.
- `Config.TEST_CLIENT_ID = 1000` (plain integer) → used in **test** mode.
- Selected in `AuthService.login()` via `this.env.isTest() ? Config.TEST_CLIENT_ID : Config.CLIENT_ID`.

> Note: `1000` is simply the value the TEST server accepted; if there is an *official* TEST client id,
> swap `Config.TEST_CLIENT_ID`.

## Question for the API team

Is the encrypted-vs-plain-integer difference intentional? Either TEST should accept the same
**encrypted** `client_id` as PROD (or vice-versa), or please provide the correct **encrypted**
`client_id` for the TEST environment so a single value/flow works against both.
