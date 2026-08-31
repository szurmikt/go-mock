#!/bin/bash
set -euo pipefail

# Promote an already-uploaded live-update bundle to another channel, by bundle ID,
# with NO rebuild and NO re-upload.
#
#   npm run promote:liveupdate 1317c33c-1a29-4145-86c1-3ef2070d4212 early
#   npm run promote:liveupdate 1317c33c-1a29-4145-86c1-3ef2070d4212 prod
#
# The bundle ID is the one printed by publish-liveupdate.sh and logged in
# ReleaseNotes.md for every dev push. Promoting by that exact ID (rather than
# "whatever's currently on dev") means a later push to dev — testing something
# else — can never get carried forward by accident.
#
# Why this exists: publish-liveupdate.sh rebuilds `www` from the current working
# tree on every run, so publishing to dev, testing, then publishing again to
# early/prod would ship whatever the tree looks like BY THEN, not what was tested.
# This script instead finds the build record for the named bundle and attaches
# that same build to the target channel — the bytes are guaranteed identical to
# what was tested, however much local code has moved on since.

APP_ID="65afcebf-188f-4000-a966-a07d671bd66f"
BUNDLE_ID="${1:-}"
TO="${2:-}"

TOKEN_FILE="${CAPAWESOME_CLOUD_TOKEN_FILE:-$HOME/.capawesome-keys/token}"
if [ -z "${CAPAWESOME_CLOUD_TOKEN:-}" ] && [ -f "$TOKEN_FILE" ]; then
  CAPAWESOME_CLOUD_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
  export CAPAWESOME_CLOUD_TOKEN
fi

if [ -z "${CAPAWESOME_CLOUD_TOKEN:-}" ]; then
  echo "✗ No Capawesome CLI token found."
  echo "  Either export CAPAWESOME_CLOUD_TOKEN, or write it to: $TOKEN_FILE"
  exit 1
fi

if [ -z "$BUNDLE_ID" ] || [ -z "$TO" ]; then
  echo "✗ Usage: npm run promote:liveupdate <bundle-id> <to-channel>"
  echo "  Example: npm run promote:liveupdate 1317c33c-1a29-4145-86c1-3ef2070d4212 early"
  exit 1
fi

case "$TO" in prod|early|dev) ;; *) echo "✗ Unknown target channel '$TO' (expected: prod, early, dev)"; exit 1 ;; esac

if ! command -v jq >/dev/null 2>&1; then
  echo "✗ This script needs 'jq' (brew install jq)."
  exit 1
fi

echo "▸ Looking up build for bundle $BUNDLE_ID..."
# Bundle IDs (appBuildArtifactId) aren't directly filterable server-side, so pull
# recent builds and match client-side. 200 covers many months at this project's
# publish cadence; raise --limit if an older bundle isn't found.
BUILD=$(npx @capawesome/cli apps:builds:list --app-id "$APP_ID" --platform web --limit 200 --json \
  | jq -r --arg bid "$BUNDLE_ID" '[.[] | select(.appBuildArtifactId == $bid)][0]')

if [ "$BUILD" = "null" ] || [ -z "$BUILD" ]; then
  echo "✗ No build found with bundle ID '$BUNDLE_ID' in the last 200 web builds."
  echo "  Double-check the ID (from ReleaseNotes.md or the original publish output)."
  exit 1
fi

BUILD_ID=$(echo "$BUILD" | jq -r '.id')
BUILD_NUMBER=$(echo "$BUILD" | jq -r '.numberAsString')
GIT_REF=$(echo "$BUILD" | jq -r '.customProperties.git_ref // "unknown"')
SOURCE_CHANNEL_ID=$(echo "$BUILD" | jq -r '.appChannelId // "unknown"')

echo "▸ Found build #$BUILD_NUMBER (git $GIT_REF), originally uploaded to channel id $SOURCE_CHANNEL_ID."
echo "▸ Attaching that exact same build to '$TO' — no rebuild, no re-upload."
read -r -p "  Proceed? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 1
fi

npx @capawesome/cli apps:deployments:create \
  --app-id "$APP_ID" \
  --build-id "$BUILD_ID" \
  --channel "$TO"

echo ""
echo "✓ Bundle $BUNDLE_ID (build #$BUILD_NUMBER) promoted to '$TO'."
