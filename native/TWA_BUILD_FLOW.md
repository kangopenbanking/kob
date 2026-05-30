# Trusted Web Activity (TWA) & Capacitor Secure Wrapper — Build Flow

This document describes how to build, sign, and ship the **Consumer** and **Banking** PWAs as native shells so the screenshot guard becomes a **hard OS-level block** instead of a web deterrent.

| Platform | Wrapper            | Hard screenshot block      |
|----------|--------------------|----------------------------|
| Android  | TWA (Bubblewrap) **or** Capacitor + `FLAG_SECURE` | Yes — `WindowManager.LayoutParams.FLAG_SECURE` |
| iOS      | Capacitor + secure overlay (no native TWA equivalent) | Yes — blur view on `applicationWillResignActive` |

Both shells load the same web bundle and call the `SecureView` JS bridge (`src/lib/security/secureView.ts`). The bridge no-ops in the browser, so the same code runs everywhere.

---

## 1. Prerequisites

| Tool                | Version | Notes |
|---------------------|---------|-------|
| Node.js             | ≥ 20    | matches CI |
| Java JDK            | 17      | Android Gradle Plugin 8.x |
| Android Studio      | ≥ Iguana| SDK 34, build-tools 34.0.0 |
| Xcode               | ≥ 15    | iOS 15+ deployment target |
| Bubblewrap CLI      | latest  | `npm i -g @bubblewrap/cli` |
| Capacitor CLI       | already in repo | `npx cap …` |

Web prerequisites (already configured in this repo):

- `manifest.webmanifest` with `name`, `short_name`, `theme_color`, `background_color`, `icons` (192 + 512), `start_url`, `display: "standalone"`.
- HTTPS deployment with a verified domain.
- `.well-known/assetlinks.json` published at the **same origin** as the PWA (required for TWA fullscreen + URL-bar removal).

---

## 2. Android — Path A: Trusted Web Activity (recommended for Consumer PWA)

TWA is the lightest wrapper. The whole app is the live web bundle; we only need native code for screenshot blocking.

### 2.1 Initialise

```bash
mkdir -p twa/consumer && cd twa/consumer
bubblewrap init --manifest=https://kob.lovable.app/manifest.webmanifest
```

Answer the prompts. Use these values:

| Prompt                     | Consumer                            | Banking                          |
|----------------------------|-------------------------------------|----------------------------------|
| Application ID             | `app.kang.consumer`                 | `app.kang.banking`               |
| Host                       | `kob.lovable.app`                   | `bank.kang.lovable.app`          |
| Start URL                  | `/app/home`                         | `/bank/home`                     |
| Display mode               | `standalone`                        | `standalone`                     |
| Status-bar colour          | `#0F172A`                           | `#0F172A`                        |
| Splash colour              | `#0F172A`                           | `#0F172A`                        |
| Signing key                | generate new                        | generate new                     |

### 2.2 Add `FLAG_SECURE` to the launcher activity

Bubblewrap generates `app/src/main/java/.../LauncherActivity.kt`. Replace its `onCreate` with:

```kotlin
import android.view.WindowManager
import android.os.Bundle

class LauncherActivity : com.google.androidbrowserhelper.trusted.LauncherActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // PERMANENT — finance/banking screens must be non-capturable.
    window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE,
    )
    super.onCreate(savedInstanceState)
  }
}
```

That single flag blocks screenshots, screen-recording, and removes the app from the recent-apps thumbnail across the **entire** TWA — appropriate because the Consumer/Banking shells only host financial screens.

### 2.3 Digital Asset Links

```bash
bubblewrap fingerprint  # prints SHA-256
```

Publish the printed object at `https://<host>/.well-known/assetlinks.json` (already wired into our deploy pipeline — just append the new fingerprint to the existing array). Verify with:

```bash
curl -s https://kob.lovable.app/.well-known/assetlinks.json | jq .
```

### 2.4 Build & sign

```bash
bubblewrap build               # produces app-release-bundle.aab + app-release-signed.apk
bubblewrap install             # sideload to a connected device for QA
```

### 2.5 Upload to Play Console

- Track: **Internal testing** → **Closed testing** → **Production**.
- Data safety form: declare “Financial info — Payment info, User payment info” and tick **encrypted in transit / at rest**.
- Content rating: **Finance**.
- Confirm **screenshot blocking** in the app on a test device: open the app, try Power+Volume-Down → expect "Can't take screenshot due to security policy".

---

## 3. Android — Path B: Capacitor (use when we need plugins beyond TWA)

Use this path for the Banking shell if we ever need biometric prompts, file pickers, or background sync that exceeds what a TWA exposes.

```bash
npm run build
npx cap add android
npx cap sync android
```

Then copy our pre-written native plugin into the generated project:

```bash
cp native/android/SecureViewPlugin.java \
   android/app/src/main/java/app/lovable/<id>/SecureViewPlugin.java
```

Register the plugin in `MainActivity.java`:

```java
registerPlugin(SecureViewPlugin.class);
```

The plugin honours `SecureView.enable()` / `disable()` JS calls. Because the JS bridge is already invoked from `ScreenshotGuard`, every protected route automatically toggles `FLAG_SECURE` on/off — public marketing pages stay capturable, finance pages do not.

Build:

```bash
cd android && ./gradlew bundleRelease
```

Sign with the upload key and submit to Play as above.

---

## 4. iOS — Capacitor + Secure Overlay

iOS has no TWA equivalent. We ship a Capacitor wrapper plus a small Swift plugin that draws a blur view when the app resigns active (covers the app-switcher snapshot) and intercepts `UIScreen.capturedDidChangeNotification` to mask the UI during screen recordings.

```bash
npx cap add ios
npx cap sync ios
cp native/ios/SecureViewPlugin.swift ios/App/App/SecureViewPlugin.swift
```

Register in `ios/App/App/AppDelegate.swift`:

```swift
import Capacitor
// inside application(_:didFinishLaunchingWithOptions:)
CAPBridgeViewController.registerPlugin(SecureViewPlugin.self)
```

Open in Xcode, sign with the **Kang Fintech Solutions** team, set deployment target to **iOS 15.0**, and archive. Submit through App Store Connect with the same financial data-safety declarations.

> **Note.** iOS cannot block screenshots taken with the hardware buttons — Apple does not expose an API. The blur-on-resign + screen-recording mask is the maximum protection allowed. Document this in the security memory.

---

## 5. Release-channel matrix

| Channel             | Android                                     | iOS                                  | Audience                |
|---------------------|---------------------------------------------|--------------------------------------|-------------------------|
| `dev`               | Bubblewrap `install` to local device        | Xcode → Simulator                    | Engineers               |
| `internal`          | Play Console — Internal testing track       | TestFlight — Internal testers        | QA + Compliance         |
| `beta`              | Play Console — Closed testing               | TestFlight — External testers        | Selected customers      |
| `production`        | Play Console — Production                   | App Store — Production               | All customers           |

All channels load the **same** web bundle from `https://kob.lovable.app` (or the staging host for `dev`/`internal`). Native version codes are bumped per release via:

```bash
node scripts/bump-native-version.mjs   # increments versionCode + CFBundleVersion in lockstep
```

---

## 6. CI build (GitHub Actions, abbreviated)

```yaml
name: native-build
on:
  workflow_dispatch:
  push:
    tags: ['v*']

jobs:
  android-twa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17' }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm i -g @bubblewrap/cli
      - run: cd twa/consumer && bubblewrap build --skipPwaValidation
      - uses: actions/upload-artifact@v4
        with:
          name: consumer-aab
          path: twa/consumer/app-release-bundle.aab

  ios-capacitor:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build && npx cap sync ios
      - run: |
          cd ios/App
          xcodebuild -workspace App.xcworkspace -scheme App \
            -configuration Release -archivePath build/App.xcarchive archive
      - uses: actions/upload-artifact@v4
        with:
          name: banking-xcarchive
          path: ios/App/build/App.xcarchive
```

Secrets required:

- `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
- `IOS_DISTRIBUTION_CERT_B64`, `IOS_PROVISIONING_PROFILE_B64`, `IOS_KEYCHAIN_PASSWORD`
- `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`, `APPSTORE_API_PRIVATE_KEY_B64`

---

## 7. Post-build verification checklist

For **every** release, before promoting to production:

- [ ] Install the build on a clean Android device. Trigger Power+Volume-Down. Expect the OS toast “Can't take screenshot due to security policy”.
- [ ] On Android, open Recent Apps — the Kang card must show a blank/security overlay, not the live UI.
- [ ] Mirror the device to a desktop with `scrcpy`. Expect a black frame on every protected route.
- [ ] Start screen recording on iOS. Expect the app to switch to the blurred overlay until recording stops.
- [ ] On iOS, swipe up to the app switcher. Expect the blur overlay, not the live UI.
- [ ] Trigger PrintScreen in a desktop browser session against the published URL — confirm `security_capture_events` records a `key:PrintScreen` row (audit log working alongside the native block).
- [ ] Confirm the **assetlinks** check passes: `https://developers.google.com/digital-asset-links/tools/generator`.
- [ ] Confirm Play Console / App Store Connect data-safety forms are still accurate.

---

## 8. Reference paths in this repo

- `native/android/SecureViewPlugin.java` — Capacitor plugin enabling `FLAG_SECURE`.
- `native/ios/SecureViewPlugin.swift` — Capacitor plugin drawing the iOS blur overlay.
- `src/lib/security/secureView.ts` — JS bridge invoked by `ScreenshotGuard`.
- `src/components/security/ScreenshotGuard.tsx` — calls `SecureView.enable()` on protected routes.
- `src/components/security/screenshot-guard-config.ts` — protected route + sensitive-component allowlist.
- `supabase/functions/record-capture-event/index.ts` — server-side audit sink.
- Admin dashboard: `/admin/capture-events` — retention controls + audit table.

---

## 9. Retention reminder

The `security_capture_events` table is governed by a configurable retention window
(`system_config.security_capture_events_retention_days`, default **90 days**) and a nightly
`pg_cron` job (`security-capture-events-cleanup`, 03:15 UTC) that calls
`public.cleanup_security_capture_events()`. Admins can change the window or run a manual
cleanup from `/admin/capture-events`.
