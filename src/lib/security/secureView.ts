/**
 * SecureView — JS bridge for the custom Capacitor plugin that hardens the
 * native shell against screen capture.
 *
 * Behaviour:
 *   - Android: toggles `WindowManager.LayoutParams.FLAG_SECURE` on the
 *     window. This prevents screenshots, screen recording, and screen
 *     mirroring of the app entirely (the user sees a black frame in any
 *     capture).
 *   - iOS: subscribes to `UIScreen.capturedDidChangeNotification` and
 *     `UIApplication.willResignActiveNotification`, blurring the visible
 *     WebView with a UIBlurEffect overlay during capture / app-switching.
 *
 * In the browser (no Capacitor) every call is a no-op and `isNative`
 * returns false, so this module is safe to import from the PWA build.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface SecureViewPlugin {
  enable(options?: { reason?: string }): Promise<{ ok: true }>;
  disable(): Promise<{ ok: true }>;
  isEnabled(): Promise<{ enabled: boolean }>;
  /**
   * Subscribes to native screen-capture events. The handler is invoked
   * with `{ captured: true }` when the OS reports an active capture
   * (screen recording, AirPlay mirroring, etc.).
   */
  addListener(
    eventName: "captureStateChanged",
    listener: (event: { captured: boolean }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

// Browser no-op fallback so the PWA build keeps working.
const noop: SecureViewPlugin = {
  enable: async () => ({ ok: true }),
  disable: async () => ({ ok: true }),
  isEnabled: async () => ({ enabled: false }),
  addListener: async () => ({ remove: async () => {} }),
};

const native = registerPlugin<SecureViewPlugin>("SecureView", { web: () => noop });

export const SecureView = native;

export function isNativeShell(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Convenience helper: enables FLAG_SECURE on mount, disables it on
 * unmount. No-op on the web. Pair with the ScreenshotGuard route check.
 */
export async function enableSecureViewForCurrentRoute(reason: string): Promise<() => void> {
  if (!isNativeShell()) return () => {};
  try {
    await SecureView.enable({ reason });
  } catch (e) {
    console.warn("[SecureView] enable failed", e);
  }
  return () => {
    SecureView.disable().catch(() => {});
  };
}
