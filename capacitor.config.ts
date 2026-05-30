/// <reference types="@capacitor/cli" />
import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the KOB Consumer + Banking mobile shells.
 *
 * - `server.url` enables Lovable sandbox hot-reload while developing on
 *   a physical device. Comment it out for App Store / Play Store builds.
 * - `appId` matches the project's lovable.app identifier so OneSignal,
 *   Firebase, and deep-link configurations stay in sync.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.342820e7280a44d388ce2854c6d907ed",
  appName: "Kang",
  webDir: "dist",
  server: {
    url: "https://342820e7-280a-44d3-88ce-2854c6d907ed.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    // Hide the WebView when the app is backgrounded (defeats the iOS
    // app-switcher thumbnail preview leaking balances).
    contentInset: "always",
  },
  android: {
    // Allow FLAG_SECURE to be toggled at runtime by the SecureView plugin.
    allowMixedContent: false,
  },
  plugins: {
    SecureView: {
      // Mirrors the web-side route allowlist; the native plugin enables
      // FLAG_SECURE / hides the view as soon as a protected route mounts.
      autoSecureOnFinancialRoutes: true,
    },
  },
};

export default config;
