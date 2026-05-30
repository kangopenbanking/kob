import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { AlertCircle, Bell, Clock, MessageSquare, ShieldCheck, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SNOOZE_OPTIONS,
  scheduleSnooze,
  isSnoozed,
  clearSnooze,
  onRemindLaterFired,
} from "@/lib/kyc/remindLater";

type KycStatus = "pending" | "approved" | "rejected" | "info_requested";

interface KycRow {
  id: string;
  status: KycStatus;
  rejection_reason: string | null;
  updated_at: string;
}

interface Props {
  /** Route the user should be taken to in order to act on the banner. Defaults to /kyc-verification. */
  verifyHref?: string;
  /** Route to the in-app notifications center. */
  notificationsHref?: string;
}

/**
 * Modern KYC status notification card.
 * - Smaller, more compact typography.
 * - Full keyboard navigation + ARIA labelling.
 * - Non-blocking: pointer-events scoped to the card itself.
 * - Soft states (unverified / pending) are dismissible and snoozable.
 */
export const KYCStatusBanner: React.FC<Props> = ({
  verifyHref = "/kyc-verification",
  notificationsHref = "/app/notifications",
}) => {
  const { user, loading } = useAuthenticatedUser();
  const [row, setRow] = useState<KycRow | null | undefined>(undefined);
  const [snoozed, setSnoozed] = useState<boolean>(() => isSnoozed());
  const [mounted, setMounted] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("kyc_verifications")
        .select("id, status, rejection_reason, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setRow((data as KycRow | null) ?? null);
    };
    load();

    const channel = supabase
      .channel(`kyc-banner-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kyc_verifications", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, loading]);

  // Animate in + listen for reminder firing.
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    const off = onRemindLaterFired(() => setSnoozed(false));
    return () => {
      cancelAnimationFrame(t);
      off();
    };
  }, []);

  if (loading || row === undefined || !user) return null;
  if (row?.status === "approved") return null;

  const status: KycStatus | "unverified" = row?.status ?? "unverified";
  const isHard = status === "info_requested" || status === "rejected";
  if (!isHard && snoozed) return null;

  const config = (() => {
    switch (status) {
      case "unverified":
        return {
          icon: ShieldCheck,
          label: "Action required",
          title: "Verify your identity to unlock full access",
          message: "Complete a quick KYC check to enable transfers, withdrawals and higher limits.",
          cta: "Start verification",
          tone: "warning" as const,
        };
      case "pending":
        return {
          icon: Clock,
          label: "Under review",
          title: "Your identity verification is in progress",
          message: "Our compliance team is reviewing your documents. You will be notified once a decision is made.",
          cta: "View status",
          tone: "info" as const,
        };
      case "info_requested":
        return {
          icon: MessageSquare,
          label: "More information needed",
          title: "Additional information requested",
          message: row?.rejection_reason || "Our reviewer needs more information. Please open your verification to update your submission.",
          cta: "Update submission",
          tone: "info" as const,
        };
      case "rejected":
        return {
          icon: AlertCircle,
          label: "Not approved",
          title: "Identity verification was not approved",
          message: row?.rejection_reason || "Please review the reason and resubmit your documents to regain full account access.",
          cta: "Resubmit verification",
          tone: "danger" as const,
        };
    }
  })();

  if (!config) return null;
  const Icon = config.icon;

  // Subtle status tint reserved only for the icon tile. The card itself uses
  // the neutral surface tokens to match other in-app guide cards.
  const toneClasses: Record<typeof config.tone, { iconWrap: string; pillDot: string }> = {
    warning: {
      iconWrap: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
      pillDot: "bg-amber-500",
    },
    info: {
      iconWrap: "bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
      pillDot: "bg-sky-500",
    },
    danger: {
      iconWrap: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200",
      pillDot: "bg-red-500",
    },
  };

  const tone = toneClasses[config.tone];
  const headingId = "kyc-banner-title";
  const descId = "kyc-banner-desc";

  const handleSnoozeChoice = (ms: number) => {
    scheduleSnooze(ms);
    setSnoozed(true);
    setSnoozeOpen(false);
  };

  return (
    <div className="px-3 pt-3 pointer-events-none">
      <section
        ref={containerRef}
        role="region"
        aria-labelledby={headingId}
        aria-describedby={descId}
        className={[
          "relative rounded-2xl border bg-card text-card-foreground shadow-sm pointer-events-auto",
          "transition-all duration-300 ease-out",
          mounted ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
        ].join(" ")}
      >
        <div className="flex items-start gap-2.5 p-3">
          <div
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              tone.iconWrap,
            ].join(" ")}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${tone.pillDot}`} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {config.label}
              </span>
            </div>
            <h3
              id={headingId}
              className="mt-0.5 text-[12px] font-semibold leading-snug text-foreground"
            >
              {config.title}
            </h3>
            <p id={descId} className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
              {config.message}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1">
              <Button
                asChild
                size="sm"
                variant="default"
                className="h-7 rounded-full px-2.5 text-[11px] font-medium"
              >
                <Link to={verifyHref} aria-label={config.cta}>
                  {config.cta}
                  <ArrowRight className="ml-1 h-3 w-3" strokeWidth={2} aria-hidden="true" />
                </Link>
              </Button>

              <Button
                asChild
                size="sm"
                variant="ghost"
                className="h-7 rounded-full px-2 text-[10.5px] text-muted-foreground hover:text-foreground"
              >
                <Link to={notificationsHref} aria-label="Open notifications center">
                  <Bell className="mr-0.5 h-3 w-3" strokeWidth={2} aria-hidden="true" />
                  Notifications
                </Link>
              </Button>

              {!isHard && (
                <Popover open={snoozeOpen} onOpenChange={setSnoozeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Remind me later"
                      aria-haspopup="menu"
                      aria-expanded={snoozeOpen}
                      className="h-7 rounded-full px-2 text-[10.5px] text-muted-foreground hover:text-foreground"
                    >
                      Remind me later
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-48 p-1"
                    role="menu"
                    aria-label="Choose a reminder time"
                  >
                    <p className="px-2 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Remind me
                    </p>
                    <ul className="flex flex-col">
                      {SNOOZE_OPTIONS.map((opt) => (
                        <li key={opt.id}>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleSnoozeChoice(opt.ms)}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-accent focus:bg-accent focus:outline-none"
                          >
                            <span>{opt.label}</span>
                            <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {!isHard && (
            <button
              type="button"
              aria-label="Dismiss verification notification"

              onClick={() => {
                scheduleSnooze(24 * 60 * 60 * 1000);
                setSnoozed(true);
              }}
              className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default KYCStatusBanner;

// Re-export so callers can clear snooze if needed (e.g. from the notifications center).
export { clearSnooze as clearKycSnooze } from "@/lib/kyc/remindLater";
