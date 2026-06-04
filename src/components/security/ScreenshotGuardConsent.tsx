/**
 * ScreenshotGuardConsent — first-run dialog letting the user opt in or out
 * of the ScreenshotGuard forensic deterrent layer.
 *
 * Preference is stored in localStorage under `kob:screenshot-guard:consent`:
 *   - "enabled"  → Guard runs on protected routes (default after consent).
 *   - "disabled" → Guard is fully suppressed across the session/device.
 *   - <unset>    → dialog is shown on next mount of a protected route.
 *
 * The choice can be changed any time from Settings → Security.
 */
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Eye, FileWarning } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

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

export function writeScreenshotGuardConsent(v: ScreenshotGuardConsent) {
  try {
    localStorage.setItem(STORAGE_KEY, v);
    window.dispatchEvent(new CustomEvent("kob:screenshot-guard:consent", { detail: v }));
  } catch {
    /* noop */
  }
}

export function useScreenshotGuardConsent(): ScreenshotGuardConsent | null {
  const [consent, setConsent] = useState<ScreenshotGuardConsent | null>(() =>
    readScreenshotGuardConsent(),
  );
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

interface Props {
  open: boolean;
  onChoose: (v: ScreenshotGuardConsent) => void;
}

export function ScreenshotGuardConsentDialog({ open, onChoose }: Props) {
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
            We recommend keeping screen protection on for your financial pages.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-3 text-sm text-foreground/90">
          <li className="flex gap-3">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Adds a near-invisible watermark stamped with your name and a
              timestamp, so any leaked screenshot is traceable to your account.
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
          <span className="font-medium">Settings → Security</span>. Disabling
          protection turns off the watermark and shortcut blocking on this
          device.
        </p>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onChoose("disabled")}
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
