---
description: Build a signed AAB and reveal it in Finder for drag-drop into Play Console
---

Run `npm run publish:android` from `/Users/tamas/SabeeAppGO/app/`. Stream the output so the user sees the version bump, web build, Capacitor sync, and AAB build progress. When it finishes, the script will reveal the AAB file in Finder; remind the user to drag `sabeeapp-go-v{N}.aab` into Play Console → SabeeApp Go → Testing → Internal testing → Create new release.
