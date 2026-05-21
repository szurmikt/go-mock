#!/bin/bash
set -euo pipefail

PROJ="ios/App/App.xcodeproj/project.pbxproj"
WORKSPACE="ios/App/App.xcworkspace"
SCHEME="App"
EXPORT_OPTS="ios/App/ExportOptions.plist"
ARCHIVE="/tmp/SabeeAppGo.xcarchive"
EXPORT_DIR="/tmp/SabeeAppGo-export"

# Bump build number
CURRENT=$(grep -m1 "CURRENT_PROJECT_VERSION" "$PROJ" | grep -o '[0-9]*')
NEXT=$((CURRENT + 1))
sed -i '' "s/CURRENT_PROJECT_VERSION = $CURRENT;/CURRENT_PROJECT_VERSION = $NEXT;/g" "$PROJ"
echo "▸ Build number: $CURRENT → $NEXT"

# Web build
echo "▸ Building web..."
npx ng build --configuration production --progress false 2>&1 | tail -3

# Sync to iOS
echo "▸ Syncing iOS..."
npm run sync:ios 2>&1 | grep -E "✔|error" || true

# Archive
echo "▸ Archiving..."
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=N67VJ6XQV4 \
  -quiet

echo "▸ Uploading to TestFlight..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_OPTS" \
  2>&1 | grep -E "Progress|Upload succeeded|error:|EXPORT"

echo "✓ Done — build $NEXT is processing in TestFlight."
