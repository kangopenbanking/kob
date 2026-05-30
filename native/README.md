# SecureView — Native screen-capture protection

The KOB Consumer (`/app`) and Banking (`/bank/:institutionId`) PWAs ship
with a layered web-only deterrent (forensic watermark, blur-on-blur,
PrintScreen interception). When wrapped in a Capacitor native shell, the
**SecureView** plugin upgrades that to true OS-level protection.

| Platform | Mechanism | Effect |
|---|---|---|
| Android | `WindowManager.FLAG_SECURE` | Screenshots and screen recordings produce a **black image**. Casting / mirroring hides the window from the secondary display. |
| iOS | `UIScreen.capturedDidChangeNotification` + `willResignActiveNotification` + `UIBlurEffect` | App switcher thumbnails are **blurred**. Active screen recording is **blurred** for the duration of the capture. |
| Web (PWA) | No-op | The web-only watermark + blur + key interception in `ScreenshotGuard` remains the deterrent. |

## One-time setup

After cloning this repository:

```bash
git pull
npm install
npx cap add ios          # macOS with Xcode
npx cap add android      # Android Studio
```

### 1. Install the Android plugin

Copy `native/android/SecureViewPlugin.java` into:

```
android/app/src/main/java/app/lovable/kob/secureview/SecureViewPlugin.java
```

Register it in `android/app/src/main/java/app/lovable/kob/MainActivity.java`
inside `onCreate`:

```java
import app.lovable.kob.secureview.SecureViewPlugin;

@Override
public void onCreate(Bundle savedInstanceState) {
    registerPlugin(SecureViewPlugin.class);
    super.onCreate(savedInstanceState);
}
```

### 2. Install the iOS plugin

Copy `native/ios/SecureViewPlugin.swift` into:

```
ios/App/App/plugins/SecureView/SecureViewPlugin.swift
```

Create `ios/App/App/plugins/SecureView/SecureViewPlugin.m`:

```objc
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(SecureViewPlugin, "SecureView",
    CAP_PLUGIN_METHOD(enable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(disable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(isEnabled, CAPPluginReturnPromise);
)
```

Then in Xcode, drag the `SecureView` folder into the **App** target so
both files are compiled.

### 3. Sync and run

```bash
npm run build
npx cap sync
npx cap run android   # or: npx cap run ios
```

## How it activates at runtime

`ScreenshotGuard` calls `enableSecureViewForCurrentRoute()` whenever the
user enters a route listed in `src/components/security/screenshot-guard-config.ts`
(Home, Wallet, Cards, Transfer, Statements, etc. for both apps). On
leaving the route, it calls `disable()` so non-financial pages (Settings,
Help, etc.) remain capturable for legitimate support use cases.

## Production checklist

- [ ] Remove the `server.url` block in `capacitor.config.ts` before the
      App Store / Play Store build — that line points at the Lovable
      sandbox for hot-reload.
- [ ] Test on a real device: take a screenshot on Home, then on Settings;
      Home should be black, Settings should capture normally.
- [ ] On iOS, verify the app-switcher preview shows a blurred frame and
      not your balance.
- [ ] Confirm `record-capture-event` receives `native:capture_detected`
      events during a screen recording on iOS.

## Reference

- [Capacitor: Creating Plugins](https://capacitorjs.com/docs/plugins/creating-plugins)
- [Android FLAG_SECURE](https://developer.android.com/reference/android/view/WindowManager.LayoutParams#FLAG_SECURE)
- [iOS UIScreen.isCaptured](https://developer.apple.com/documentation/uikit/uiscreen/2921651-iscaptured)
- [Lovable: Capacitor Mobile Development guide](https://lovable.dev/blog/capacitor-mobile-development)
