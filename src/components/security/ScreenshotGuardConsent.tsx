/**
 * ScreenshotGuardConsent — first-run dialog + persistence layer for the
 * user-facing opt-in/opt-out decision on the ScreenshotGuard.
 *
 * Persistence order of truth:
 *   1. localStorage (`kob:screenshot-guard:consent`)  — instant, offline.
 *   2. `public.screenshot_guard_consents` table        — cross-device when
 *      the user is signed in. Loaded on session bootstrap and any change
 *      is written back synchronously.
 *
 * Every accept/disable transition emits a `guard:consent_enabled` or
 * `guard:consent_disabled` event into `security_capture_events` via the
 * existing recordCaptureEvent edge function, with the active pathname.
 */
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Eye, FileWarning, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { recordCaptureEvent } from "@/lib/security/recordCaptureEvent";
import { appContextForPath } from "./screenshot-guard-config";

const STORAGE_KEY = "kob:screenshot-guard:consent";
export type ScreenshotGuardConsent = "enabled" | "disabled";

export function readScreenshotGuardConsent(): ScreenshotGuardConsent | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "enabled" || v === "disabled" ? v : null;
  } catch {
    return null;
  }
}

function writeLocal(v: ScreenshotGuardConsent) {
  try {
    localStorage.setItem(STORAGE_KEY, v);
    window.dispatchEvent(new CustomEvent("kob:screenshot-guard:consent", { detail: v }));
  } catch {
    /* noop */
  }
}

/**
 * Persist the user's choice locally and, when signed in, to the
 * `screenshot_guard_consents` table. Also writes the audit event.
 */
export async function setScreenshotGuardConsent(
  v: ScreenshotGuardConsent,
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "/",
) {
  writeLocal(v);
  const appContext = appContextForPath(pathname);

  recordCaptureEvent({
    kind: v === "enabled" ? "guard:consent_enabled" : "guard:consent_disabled",
    pathname,
    appContext,
    metadata: { decision: v, ts: new Date().toISOString() },
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase.from("screenshot_guard_consents") as any).upsert(
        {
          user_id: user.id,
          decision: v,
          decided_at: new Date().toISOString(),
          last_pathname: pathname,
          last_app_context: appContext,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }
  } catch {
    /* network/RLS failures shouldn't block the local choice */
  }
}

/** Back-compat alias used by ScreenshotGuard.tsx. */
export function writeScreenshotGuardConsent(v: ScreenshotGuardConsent) {
  void setScreenshotGuardConsent(v);
}

/**
 * Subscribe to the consent value. On mount, also hydrate from the
 * backend if the user is signed in (cross-device sync).
 */
export function useScreenshotGuardConsent(): ScreenshotGuardConsent | null {
  const [consent, setConsent] = useState<ScreenshotGuardConsent | null>(() =>
    readScreenshotGuardConsent(),
  );

  // Hydrate from the backend once per mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await (supabase.from("screenshot_guard_consents") as any)
          .select("decision")
          .eq("user_id", user.id)
          .maybeSingle();
        const remote = data?.decision as ScreenshotGuardConsent | undefined;
        if (!remote || cancelled) return;
        if (remote !== readScreenshotGuardConsent()) {
          writeLocal(remote);
          setConsent(remote);
        }
      } catch {
        /* offline / not signed in — fall back to local value */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as ScreenshotGuardConsent;
      setConsent(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setConsent(readScreenshotGuardConsent());
    };
    window.addEventListener("kob:screenshot-guard:consent", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("kob:screenshot-guard:consent", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return consent;
}

// ============================================================
// First-run dialog (shown automatically on protected routes
// when no choice exists yet).
// ============================================================

interface Props {
  open: boolean;
  onChoose: (v: ScreenshotGuardConsent) => void;
}

export function ScreenshotGuardConsentDialog({ open, onChoose }: Props) {
  const [confirmOptOut, setConfirmOptOut] = useState(false);

  // First step — explain the benefits.
  if (!confirmOptOut) {
    return (
      <AlertDialog open={open}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <AlertDialogTitle className="text-center">
              Enable Screen Protection?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              We strongly recommend keeping screen protection on for your
              financial pages.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="space-y-3 text-sm text-foreground/90">
            <li className="flex gap-3">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Adds a near-invisible watermark stamped with your name and a
                timestamp, so any leaked screenshot is traceable to your
                account.
              </span>
            </li>
            <li className="flex gap-3">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Blocks accidental screenshot, copy and print shortcuts on
                balance, card and transfer pages.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Hides sensitive details when you switch apps, defeating
                app-switcher previews and casual shoulder-surfing.
              </span>
            </li>
          </ul>

          <p className="text-xs text-muted-foreground">
            You can change this any time from{" "}
            <span className="font-medium">Settings → Security</span>.
          </p>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOptOut(true)}
              className="gap-2"
            >
              <ShieldOff className="h-4 w-4" />
              Turn off
            </Button>
            <Button onClick={() => onChoose("enabled")} className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Keep protection on
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Second step — opt-out confirmation with explicit impact warning.
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">
            Turn off screen protection?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Please review the impact before continuing.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground/90">
          <p className="mb-2 font-medium text-destructive">
            What will change on this device:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-destructive">•</span>
              The forensic watermark will no longer appear, so leaked
              screenshots cannot be traced back to your account.
            </li>
            <li className="flex gap-2">
              <span className="text-destructive">•</span>
              Screenshot, copy and print shortcuts will work normally on
              balances, cards and transfers.
            </li>
            <li className="flex gap-2">
              <span className="text-destructive">•</span>
              Sensitive details will remain visible in the app-switcher
              preview when you leave the app.
            </li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          We recommend keeping protection on. You can re-enable it anytime
          from <span className="font-medium">Settings → Security</span>.
        </p>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmOptOut(false)}
            className="gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            Keep it on
          </Button>
          <Button
            variant="destructive"
            onClick={() => { setConfirmOptOut(false); onChoose("disabled"); }}
            className="gap-2"
          >
            <ShieldOff className="h-4 w-4" />
            Yes, turn off
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
