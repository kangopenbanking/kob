/**
 * ScreenshotGuard — Standard-tier deterrent for financial pages in the
 * Consumer (/app) and Banking (/bank/:institutionId) PWAs.
 *
 * IMPORTANT — what this is and is NOT:
 *   Web/PWA platforms cannot block OS-level screenshots. Only native iOS/
 *   Android apps can (FLAG_SECURE, isCaptured). This component is a
 *   *deterrent layer* that:
 *     - Renders a diagonal, repeating forensic watermark (holder name +
 *       last-4 of user id + UTC timestamp) over the page so any leaked
 *       screenshot is traceable to the account that captured it.
 *     - Intercepts capture shortcuts (PrintScreen, Cmd/Ctrl+Shift+3/4/5,
 *       Cmd/Ctrl+P) — clears the clipboard and flashes a warning toast.
 *     - Disables right-click, long-press, drag, and selection on the
 *       subtree to prevent casual "Save Image" / "Copy" exfiltration.
 *     - Masks the document with a blur the moment the tab loses focus or
 *       visibility (defeats iOS app-switcher previews and most
 *       screen-recording workflows that briefly background the tab).
 *     - Emits a "kob:screenshot_attempt" analytics event so security can
 *       monitor patterns.
 *
 * Activated only on routes listed in screenshot-guard-config.ts.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  FINANCIAL_ROUTE_PATTERNS,
  SCREENSHOT_GUARD_OPT_OUT,
  appContextForPath,
} from "./screenshot-guard-config";
import { useScreenshotIdentity } from "./useScreenshotIdentity";
import { recordCaptureEvent, type CaptureKind } from "@/lib/security/recordCaptureEvent";
import { SecureView, isNativeShell } from "@/lib/security/secureView";

const CAPTURE_KEY_COMBOS: Array<(e: KeyboardEvent) => boolean> = [
  (e) => e.key === "PrintScreen",
  // macOS screenshot shortcuts
  (e) => (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5")),
  // Windows snipping tool
  (e) => (e.metaKey && e.shiftKey && e.key.toLowerCase() === "s"),
  // Ctrl+P (print to PDF is a common exfil path)
  (e) => ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p"),
  // Save As
  (e) => ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"),
];

function isFinancialRoute(pathname: string): boolean {
  const optedOut = SCREENSHOT_GUARD_OPT_OUT.some((p) => matchPath({ path: p, end: false }, pathname) != null);
  if (optedOut) return false;
  return FINANCIAL_ROUTE_PATTERNS.some((p) => matchPath({ path: p, end: false }, pathname) != null);
}

function emitAttempt(kind: CaptureKind | string, pathname: string) {
  const detail = { event: "kob:screenshot_attempt", kind, pathname, ts: Date.now() };
  logger.warn("[security] screenshot attempt", detail);
  try {
    window.dispatchEvent(new CustomEvent("kob:analytics", { detail }));
  } catch {
    /* noop */
  }
  recordCaptureEvent({
    kind: kind as CaptureKind,
    pathname,
    appContext: appContextForPath(pathname),
  });
}


export function ScreenshotGuard() {
  const { pathname } = useLocation();
  const active = useMemo(() => isFinancialRoute(pathname), [pathname]);
  const identity = useScreenshotIdentity();
  const [hidden, setHidden] = useState(false);
  const lastToast = useRef(0);

  // ---- Capture-shortcut interception ---------------------------------
  useEffect(() => {
    if (!active) return;

    const warn = (kind: string) => {
      const now = Date.now();
      if (now - lastToast.current < 1500) return;
      lastToast.current = now;
      emitAttempt(kind, pathname);
      try {
        // Clear the clipboard so a captured screenshot can't be paired with
        // a quietly-copied amount or account number.
        navigator.clipboard?.writeText?.("").catch(() => {});
      } catch {
        /* noop */
      }
      toast.warning("Screenshots are restricted on financial pages", {
        description:
          "For your security, capturing balances and account details is discouraged. Any screenshot is watermarked with your identity.",
        duration: 4500,
      });
      // Briefly hide content so a quick PrintScreen captures the mask.
      setHidden(true);
      window.setTimeout(() => setHidden(false), 900);
    };

    const onKey = (e: KeyboardEvent) => {
      if (CAPTURE_KEY_COMBOS.some((fn) => fn(e))) {
        e.preventDefault();
        warn(`key:${e.key}`);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      warn("contextmenu");
    };

    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      try { e.clipboardData?.setData("text/plain", ""); } catch { /* noop */ }
      warn("copy");
    };

    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("copy", onCopy, true);
    window.addEventListener("dragstart", onDragStart, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("copy", onCopy, true);
      window.removeEventListener("dragstart", onDragStart, true);
    };
  }, [active, pathname]);

  // ---- Blur on visibility/blur ---------------------------------------
  useEffect(() => {
    if (!active) return;
    const onVis = () => setHidden(document.visibilityState !== "visible");
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [active]);

  // ---- CSS injection (selection / callout / mask) --------------------
  useEffect(() => {
    if (!active) return;
    const style = document.createElement("style");
    style.id = "kob-screenshot-guard-style";
    style.textContent = `
      html[data-kob-secure="1"] body {
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }
      html[data-kob-secure="1"] img,
      html[data-kob-secure="1"] svg { -webkit-user-drag: none; }
      html[data-kob-secure-hide="1"] body > * { filter: blur(18px) saturate(0.6); transition: filter 120ms ease; }
      .kob-screenshot-watermark {
        position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
        opacity: 0.14; mix-blend-mode: multiply;
      }
      @media (prefers-color-scheme: dark) {
        .kob-screenshot-watermark { mix-blend-mode: screen; opacity: 0.10; }
      }
    `;
    document.head.appendChild(style);
    document.documentElement.setAttribute("data-kob-secure", "1");

    // Samsung Internet honours this meta; other browsers ignore it.
    const meta = document.createElement("meta");
    meta.setAttribute("name", "screenshot");
    meta.setAttribute("content", "no-allow");
    document.head.appendChild(meta);

    return () => {
      style.remove();
      meta.remove();
      document.documentElement.removeAttribute("data-kob-secure");
      document.documentElement.removeAttribute("data-kob-secure-hide");
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (hidden) document.documentElement.setAttribute("data-kob-secure-hide", "1");
    else document.documentElement.removeAttribute("data-kob-secure-hide");
  }, [active, hidden]);

  if (!active) return null;

  return (
    <Watermark
      name={identity.name}
      shortId={identity.shortId}
    />
  );
}

// ---- Forensic watermark ---------------------------------------------
function Watermark({ name, shortId }: { name: string; shortId: string }) {
  const [stamp, setStamp] = useState(() => new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC");
  useEffect(() => {
    const id = window.setInterval(
      () => setStamp(new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC"),
      30_000,
    );
    return () => window.clearInterval(id);
  }, []);

  const label = `${name} · ${shortId} · ${stamp}`;
  // Render as a tiled SVG using <pattern> so it scales with viewport and
  // resists trivial DOM-based stripping.
  return (
    <div className="kob-screenshot-watermark" aria-hidden="true" data-testid="screenshot-watermark">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="kob-wm" patternUnits="userSpaceOnUse" width="360" height="160" patternTransform="rotate(-30)">
            <text
              x="0"
              y="40"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize="12"
              fontWeight="600"
              fill="currentColor"
            >
              {label}
            </text>
            <text
              x="80"
              y="110"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize="12"
              fontWeight="600"
              fill="currentColor"
            >
              {label}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#kob-wm)" />
      </svg>
    </div>
  );
}
