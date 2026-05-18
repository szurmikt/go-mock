# Store Publishing

## iOS — TestFlight / App Store

### One-command publish

```bash
npm run publish:ios
```

This script (`scripts/publish-ios.sh`) does in sequence:
1. Bumps the build number (`CURRENT_PROJECT_VERSION` in `project.pbxproj`)
2. Production web build (`ng build --configuration production`)
3. Syncs web assets to iOS + patches `Package.swift` (`cap sync ios`)
4. Archives the Xcode project (uses Xcode's stored signing identity — no credentials needed)
5. Exports and uploads directly to App Store Connect / TestFlight

### Prerequisites (one-time setup, already done)

| What | Where |
|---|---|
| Apple ID signed into Xcode | Xcode → Settings → Accounts |
| App Store distribution certificate | Xcode auto-managed (`CODE_SIGN_STYLE=Automatic`) |
| `ios/App/ExportOptions.plist` | Committed — `method: app-store-connect`, `destination: upload` |
| Xcode scheme `SabeeAppGo` | `ios/App/App.xcworkspace` |

### Key config values

| Setting | Value |
|---|---|
| Bundle ID | `com.sabeeapp.goapp` |
| Team ID | `N67VJ6XQV4` |
| Scheme | `SabeeAppGo` |
| Build number | Auto-incremented by publish script |
| App version | Set manually in `project.pbxproj` → `MARKETING_VERSION` |

### Changing the app version (e.g. 1.0 → 1.1)

Edit `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` before publishing.

---

## Android — Debug APK / Google Play

### One-command build

```bash
npm run publish:android
```

This script (`scripts/publish-android.sh`) does in sequence:
1. Bumps the version code (`versionCode` in `android/app/build.gradle`)
2. Production web build (`ng build --configuration production`)
3. Syncs web assets to Android (`cap sync android`)
4. Builds a debug APK via Gradle

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Prerequisites (one-time setup, already done)

| What | Where |
|---|---|
| Android Studio | `/Applications/Android Studio.app` — provides the JDK |
| Android SDK | `~/Library/Android/sdk` |
| `android/local.properties` | Created — points Gradle to the SDK |

### Key config values

| Setting | Value |
|---|---|
| Application ID | `com.sabeeapp.goapp` |
| Version code | Auto-incremented by publish script |
| Version name | Set manually in `android/app/build.gradle` → `versionName` |

### Changing the app version (e.g. 1.0 → 1.1)

Edit `versionName` in `android/app/build.gradle` before publishing.

### Google Play Store (not yet set up)

To publish to Play Store you need a release keystore (one-time):

```bash
keytool -genkey -v -keystore sabeeapp-release.keystore \
  -alias sabeeapp -keyalg RSA -keysize 2048 -validity 10000
```

Store the `.keystore` file outside the repo. Once created, the publish script can be updated to build a signed release AAB (`bundleRelease`) instead of a debug APK.

---

## npm scripts

```bash
npm run publish:ios      # build + upload to TestFlight
npm run publish:android  # build debug APK
```
