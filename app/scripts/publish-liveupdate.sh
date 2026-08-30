#!/bin/bash
set -euo pipefail

# Publish a live-update (OTA) bundle to Capawesome Cloud.
#
#   npm run publish:liveupdate            # -> prod
#   npm run publish:liveupdate early      # -> early
#
# Channels: dev = internal testing, early = early adopters, prod = everyone else (renamed
# 2026-08-31 from dev/beta/production — see the CLAUDE.md changelog for the full list of touched
# files, including the Capawesome Cloud channels themselves and the Supabase property_config data).
#
# Unlike publish-ios.sh / publish-android.sh this bumps no version number: OTA bundles are
# identified by the Capawesome-assigned bundle id, and the native version only matters as the
# compatibility floor set via --android-min / --ios-min below.

APP_ID="65afcebf-188f-4000-a966-a07d671bd66f"
CHANNEL="${1:-prod}"

# Compatibility floor — the FIRST native build that shipped the live-update plugin. A bundle must
# never reach a binary that cannot run it, and older binaries have no plugin at all.
# Set both to the real values before the first upload; the guard below refuses to run until then.
# Set them when that build actually uploads, not in advance — if it is rejected or re-cut, the
# number moves.
#
# ⚠️ This is a FLOOR, not a version stamp — do NOT bump it each release. Raise it only when a
# native change genuinely breaks older binaries. Bumping it every time silently stops bundles
# reaching everyone who hasn't taken the newest binary, which rebuilds the slow-adoption problem
# live updates exist to solve, inside the fix itself.
ANDROID_MIN="32"     # android versionCode  — first build with the plugin (31 = last without)
IOS_MIN="103"        # ios CFBundleVersion  — build 103, uploaded to TestFlight 2026-08-30 at v1.0.6

# Private signing key. Held outside the repo and never committed or echoed; only the matching
# public key is in capacitor.config.ts.
KEY_PATH="${LIVEUPDATE_PRIVATE_KEY_PATH:-$HOME/.capawesome-keys/sabeeapp-go-live-update.pem}"

# CLI auth token. Prefer the env var; otherwise fall back to a file kept alongside the signing key
# (same directory, same trust model, also outside the repo). The file matters because an `export`
# only lives in the shell that ran it — a fresh shell (a new terminal, or a tool-driven one) sees
# nothing, which makes the env-var-only form awkward to automate. Read into the environment
# without ever being printed.
TOKEN_FILE="${CAPAWESOME_CLOUD_TOKEN_FILE:-$HOME/.capawesome-keys/token}"
if [ -z "${CAPAWESOME_CLOUD_TOKEN:-}" ] && [ -f "$TOKEN_FILE" ]; then
  CAPAWESOME_CLOUD_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
  export CAPAWESOME_CLOUD_TOKEN
fi

# --- preflight (all before any build, so a misconfiguration costs nothing) ---

if [ -z "${CAPAWESOME_CLOUD_TOKEN:-}" ]; then
  echo "✗ No Capawesome CLI token found."
  echo "  Either export CAPAWESOME_CLOUD_TOKEN, or write it to: $TOKEN_FILE"
  echo "  From a shell that already has it exported, without retyping the secret:"
  echo "    printf '%s' \"\$CAPAWESOME_CLOUD_TOKEN\" > $TOKEN_FILE && chmod 600 $TOKEN_FILE"
  exit 1
fi

if [ "$ANDROID_MIN" = "TODO" ] || [ "$IOS_MIN" = "TODO" ]; then
  echo "✗ Native version floor is unset (ANDROID_MIN / IOS_MIN still 'TODO')."
  echo "  Set both in $0 to the first native build that shipped the live-update plugin."
  echo "  Publishing without a floor can deliver this bundle to binaries that cannot run it."
  exit 1
fi

if [ ! -f "$KEY_PATH" ]; then
  echo "✗ Signing key not found at: $KEY_PATH"
  echo "  Set LIVEUPDATE_PRIVATE_KEY_PATH, or place the key there."
  echo "  Refusing to upload an unsigned bundle — devices verify the signature and would reject it."
  exit 1
fi

case "$CHANNEL" in
  prod|early|dev) ;;
  *) echo "✗ Unknown channel '$CHANNEL' (expected: prod, early, dev)"; exit 1 ;;
esac

echo "▸ Channel:      $CHANNEL"
echo "▸ Native floor: android >= $ANDROID_MIN, ios >= $IOS_MIN"

# --- build ---

echo "▸ Building web..."
npx ng build --configuration production --progress false 2>&1 | tail -3

# --- upload (isolated: swap this block alone to move to self-hosted bundles) ---

GIT_REF=$(git rev-parse --short HEAD)

# --git-ref is validated against a linked repo in the Capawesome Cloud console (Settings > Git),
# which this app doesn't have configured — it rejects the upload with "App does not have a git
# repository configured" rather than just skipping validation. --custom-property is free-form
# metadata with no such dependency, so it carries the same traceability without needing that
# console setup. Switch back to --git-ref if a repo is ever linked there.
# --artifact-type manifest makes downloads differential: the plugin diffs the new manifest against
# the running bundle's by per-file checksum and only fetches what changed. Without it every publish
# is a full zip — www is ~17MB on disk, so roughly 5-8MB on the wire, EVERY time, which is what
# made the app's short pre-login update budget unreachable for devices already on a bundle.
#
# It saves network, not disk: unchanged files are physically copied into the new bundle's own
# directory, so each bundle stays self-contained (which is also why deleting an old bundle can
# never break a newer one — the app prunes on that basis). A device on the native bundle has
# nothing to diff against and still takes a full download.
#
# ⚠️ Publish to `dev` and confirm a second sync transfers materially less before using this on
# `prod` — it changes the download path for every device.
echo "▸ Uploading bundle..."
npx @capawesome/cli apps:liveupdates:upload \
  --path www \
  --artifact-type manifest \
  --channel "$CHANNEL" \
  --app-id "$APP_ID" \
  --android-min "$ANDROID_MIN" \
  --ios-min "$IOS_MIN" \
  --private-key "$KEY_PATH" \
  --custom-property "git_ref=$GIT_REF" \
  --yes

echo ""
echo "✓ Published to '$CHANNEL' (git $GIT_REF)."
echo "  Devices apply it on their next resume, unless a scan or unsaved edit is in progress."
