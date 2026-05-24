#!/bin/bash
set -euo pipefail

JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export JAVA_HOME

GRADLE="android/gradlew"
BUILD_GRADLE="android/app/build.gradle"
AAB_SRC="android/app/build/outputs/bundle/release/app-release.aab"
AAB_OUT_DIR="android/app/build/outputs/bundle/release"

# Bump version code
CURRENT=$(grep -m1 "versionCode" "$BUILD_GRADLE" | grep -o '[0-9]*')
NEXT=$((CURRENT + 1))
sed -i '' "s/versionCode $CURRENT/versionCode $NEXT/" "$BUILD_GRADLE"
echo "▸ Version code: $CURRENT → $NEXT"

# Web build
echo "▸ Building web..."
npx ng build --configuration production --progress false 2>&1 | tail -3

# Sync to Android
echo "▸ Syncing Android..."
npm run sync:android 2>&1 | grep -E "✔|error" || true

# Build signed release AAB
echo "▸ Building signed release AAB..."
$GRADLE -p android bundleRelease 2>&1 | grep -E "BUILD|error:|FAILURE" | tail -5

# Rename AAB to include version code so it's identifiable in the Play Console drag-drop
AAB_TAGGED="$AAB_OUT_DIR/sabeeapp-go-v$NEXT.aab"
cp "$AAB_SRC" "$AAB_TAGGED"

echo "✓ Done — signed AAB ready at:"
echo "  $AAB_TAGGED"

# Reveal in Finder so you can drag the AAB into Play Console
open -R "$AAB_TAGGED"

echo ""
echo "Next: in Play Console → SabeeApp Go → Testing → Internal testing → Create new release"
echo "      drag sabeeapp-go-v$NEXT.aab into the upload area."
