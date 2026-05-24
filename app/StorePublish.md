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

## Android — Google Play

### One-command build

```bash
npm run publish:android
```

This script (`scripts/publish-android.sh`) does in sequence:
1. Bumps the version code (`versionCode` in `android/app/build.gradle`)
2. Production web build (`ng build --configuration production`)
3. Syncs web assets to Android (`cap sync android`)
4. Builds a signed release AAB (`bundleRelease`), copies it to `sabeeapp-go-v{N}.aab`, and reveals it in Finder

**Manual step:** drag the revealed AAB into **Play Console → SabeeApp Go → Testing → Internal testing → Create new release**.

> The repo is **wired** for fully-automated API upload via the [gradle-play-publisher](https://github.com/Triple-T/gradle-play-publisher) plugin (see the `play { }` block in `android/app/build.gradle` and the `classpath` line in `android/build.gradle`). To activate it: drop a Google Play service account JSON at `~/.google-play-keys/sabeeapp-play-publisher.json`, link the service account to the SabeeApp Go app in Play Console → Setup → API access with Release manager permission, then change the gradle task in `scripts/publish-android.sh` from `bundleRelease` to `publishReleaseBundle`. Until then, the drag-drop flow above is the path.

### Prerequisites (one-time setup)

| What | Where |
|---|---|
| Android Studio (provides JDK) | `/Applications/Android Studio.app` |
| Android SDK | `~/Library/Android/sdk` (referenced from `android/local.properties`) |
| Release keystore | `~/.android-keystores/sabeeapp-release.keystore` (kept outside repo) |
| `android/key.properties` | Local-only, gitignored — keystore path + passwords |
| Play Console app entry | `com.sabeeapp.goapp` created in Play Console |

#### Generate the release keystore (one-time)

```bash
mkdir -p ~/.android-keystores
keytool -genkey -v \
  -keystore ~/.android-keystores/sabeeapp-release.keystore \
  -alias sabeeapp \
  -keyalg RSA -keysize 2048 -validity 10000
```

Back the `.keystore` file up. Losing it permanently locks you out of updating the app on Play Store.

#### Create `android/key.properties` (one-time)

```properties
storeFile=/Users/tamas/.android-keystores/sabeeapp-release.keystore
storePassword=<keystore password>
keyAlias=sabeeapp
keyPassword=<key password>
```

This file is gitignored.

### Key config values

| Setting | Value |
|---|---|
| Application ID | `com.sabeeapp.goapp` |
| Default upload track | Internal testing (manual via Play Console UI) |
| Version code | Auto-incremented by publish script |
| Version name | Set manually in `android/app/build.gradle` → `versionName` |

### Changing the app version (e.g. 1.0 → 1.1)

Edit `versionName` in `android/app/build.gradle` before publishing.

---

## npm scripts

```bash
npm run publish:ios      # build + upload to TestFlight
npm run publish:android  # build + upload signed AAB to Google Play (internal track)
```

## Slash commands (Claude Code)

```
/push-to-tf   # alias for npm run publish:ios
/push-to-gp   # alias for npm run publish:android
```
