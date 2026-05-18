#!/bin/bash
set -euo pipefail

JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export JAVA_HOME

GRADLE="android/gradlew"
BUILD_GRADLE="android/app/build.gradle"
OUTPUT="android/app/build/outputs/apk/debug/app-debug.apk"

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

# Build APK
echo "▸ Building APK..."
$GRADLE -p android assembleDebug 2>&1 | grep -E "BUILD|error:" | tail -5

echo "✓ Done — APK at: $OUTPUT"
