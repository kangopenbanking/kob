/**
 * CustomerSettingsSecurity — Settings → Security page where the user can
 * re-open the ScreenshotGuard decision after the initial popup. Toggling
 * "off" goes through the same impact-warning confirmation as the
 * first-run dialog. Every change is persisted to the backend and audited.
 */
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, ShieldCheck, ShieldOff, Eye, FileWarning, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  useScreenshotGuardConsent,
  setScreenshotGuardConsent,
} from "@/components/security/ScreenshotGuardConsent";

const CustomerSettingsSecurity: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const consent = useScreenshotGuardConsent();
  const enabled = consent !== "disabled"; // default-on for null
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleToggle = async (next: boolean) => {
    if (!next) {
      setConfirmOpen(true);
      return;
    }
    await setScreenshotGuardConsent("enabled", pathname);
    toast.success("Screen protection enabled");
  };

  const confirmDisable = async () => {
    setConfirmOpen(false);
    await setScreenshotGuardConsent("disabled", pathname);
    toast.warning("Screen protection turned off", {
      description: "Watermark and shortcut blocking are now disabled on this device.",
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">Security</h1>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                {enabled ? (
                  <ShieldCheck className="h-5 w-5 text-primary" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold">Screen Protection</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Forensic watermark, screenshot blocking and app-switcher
                  blur on financial pages.
                </p>
                <div className="mt-2">
                  {enabled ? (
                    <Badge variant="secondary" className="text-[10px]">Recommended · On</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">Off — not recommended</Badge>
                  )}
                </div>
              </div>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              aria-label="Toggle screen protection"
              data-testid="screenshot-guard-toggle"
            />
          </div>

          <ul className="mt-4 space-y-3 text-sm text-foreground/90">
            <li className="flex gap-3">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Near-invisible watermark stamped with your name and a
                timestamp so any leaked screenshot is traceable to you.
              </span>
            </li>
            <li className="flex gap-3">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Blocks screenshot, copy and print shortcuts on balances,
                cards, transfers and statements.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Hides sensitive details when you switch apps, defeating
                app-switcher previews and shoulder-surfing.
              </span>
            </li>
          </ul>

          <p className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Your preference is saved to your account and follows you across
            devices when you are signed in. Each change is recorded in the
            security audit log.
          </p>
        </section>
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
              What will change:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="text-destructive">•</span>
                The forensic watermark will no longer appear, so leaked
                screenshots cannot be traced to your account.
              </li>
              <li className="flex gap-2">
                <span className="text-destructive">•</span>
                Screenshot, copy and print shortcuts will work normally on
                balances, cards and transfers.
              </li>
              <li className="flex gap-2">
                <span className="text-destructive">•</span>
                Sensitive details will be visible in the app-switcher
                preview when you leave the app.
              </li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            We recommend keeping protection on. You can re-enable it
            anytime from this page.
          </p>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Keep it on
            </Button>
            <Button variant="destructive" onClick={confirmDisable} className="gap-2" data-testid="confirm-disable-guard">
              <ShieldOff className="h-4 w-4" />
              Yes, turn off
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomerSettingsSecurity;
