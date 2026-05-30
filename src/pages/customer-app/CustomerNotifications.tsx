import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Bell,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import {
  SNOOZE_OPTIONS,
  scheduleSnooze,
  clearSnooze,
  isSnoozed,
  getSnoozeUntil,
} from "@/lib/kyc/remindLater";

type KycStatus = "pending" | "approved" | "rejected" | "info_requested";

interface KycRow {
  id: string;
  status: KycStatus;
  rejection_reason: string | null;
  updated_at: string;
  created_at: string;
}

const VERIFY_HREF = "/kyc-verification";

const statusMeta: Record<
  KycStatus | "unverified",
  { icon: React.ComponentType<{ className?: string }>; label: string; tone: string; pill: string }
> = {
  unverified: {
    icon: ShieldCheck,
    label: "Verification required",
    tone: "text-amber-700 dark:text-amber-200",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100",
  },
  pending: {
    icon: Clock,
    label: "Under review",
    tone: "text-sky-700 dark:text-sky-200",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100",
  },
  info_requested: {
    icon: MessageSquare,
    label: "More information needed",
    tone: "text-sky-700 dark:text-sky-200",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100",
  },
  rejected: {
    icon: AlertCircle,
    label: "Not approved",
    tone: "text-red-700 dark:text-red-200",
    pill: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100",
  },
  approved: {
    icon: CheckCircle2,
    label: "Approved",
    tone: "text-emerald-700 dark:text-emerald-200",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100",
  },
};

const CustomerNotifications: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuthenticatedUser();
  const [rows, setRows] = useState<KycRow[]>([]);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(getSnoozeUntil());
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("kyc_verifications")
        .select("id, status, rejection_reason, updated_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled) setRows((data as KycRow[] | null) ?? []);
    };
    load();
    const channel = supabase
      .channel(`kyc-notif-${user.id}`)
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

  const latest = rows[0];
  const currentStatus: KycStatus | "unverified" = latest?.status ?? "unverified";
  const meta = statusMeta[currentStatus];
  const CurrentIcon = meta.icon;
  const snoozed = !!snoozeUntil && snoozeUntil > Date.now();

  const handleSnooze = (ms: number) => {
    scheduleSnooze(ms);
    setSnoozeUntil(Date.now() + ms);
    setSnoozeOpen(false);
  };

  const handleClearSnooze = () => {
    clearSnooze();
    setSnoozeUntil(null);
  };

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-3 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-foreground">Notifications</h1>
          <p className="text-[11px] text-muted-foreground">Identity verification updates</p>
        </div>
        <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </header>

      <div className="space-y-3 px-3 py-4">
        {/* Current status card */}
        <section
          aria-label="Current verification status"
          className="rounded-2xl border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${meta.tone}`}>
              <CurrentIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.pill}`}>
                {meta.label}
              </span>
              <h2 className="mt-1.5 text-sm font-semibold text-foreground">
                {currentStatus === "approved"
                  ? "Your identity is verified"
                  : currentStatus === "rejected"
                  ? "Your last submission was not approved"
                  : currentStatus === "info_requested"
                  ? "Reviewer requested more information"
                  : currentStatus === "pending"
                  ? "Verification in progress"
                  : "Start verifying your identity"}
              </h2>
              {latest?.rejection_reason && (
                <p className="mt-1 text-[12px] text-muted-foreground">{latest.rejection_reason}</p>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {latest
                  ? `Updated ${formatDistanceToNow(new Date(latest.updated_at), { addSuffix: true })}`
                  : "No submission yet"}
              </p>

              {currentStatus !== "approved" && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Button asChild size="sm" className="h-8 rounded-full px-3 text-xs">
                    <Link to={VERIFY_HREF} aria-label="Open verification page">
                      Open verification
                      <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                    </Link>
                  </Button>

                  {snoozed ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleClearSnooze}
                      className="h-8 rounded-full px-2.5 text-[11px]"
                    >
                      Cancel reminder
                    </Button>
                  ) : (
                    <Popover open={snoozeOpen} onOpenChange={setSnoozeOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-haspopup="menu"
                          aria-expanded={snoozeOpen}
                          className="h-8 rounded-full px-2.5 text-[11px]"
                        >
                          Remind me later
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-52 p-1.5" role="menu">
                        <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Remind me
                        </p>
                        <ul className="flex flex-col">
                          {SNOOZE_OPTIONS.map((opt) => (
                            <li key={opt.id}>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => handleSnooze(opt.ms)}
                                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent focus:bg-accent focus:outline-none"
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
              )}

              {snoozed && (
                <p className="mt-2 text-[10px] text-muted-foreground" aria-live="polite">
                  Reminder set for {formatDistanceToNow(new Date(snoozeUntil!), { addSuffix: true })}.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* History */}
        <section aria-label="Verification history" className="space-y-2">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </h2>
          {rows.length === 0 ? (
            <div className="rounded-2xl border bg-card p-6 text-center">
              <Bell className="mx-auto mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs text-muted-foreground">No verification activity yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => {
                const m = statusMeta[r.status];
                const Icon = m.icon;
                return (
                  <li key={r.id}>
                    <article className="flex items-start gap-3 rounded-2xl border bg-card p-3 shadow-sm">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted ${m.tone}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.pill}`}>
                            {m.label}
                          </span>
                          <time className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                          </time>
                        </div>
                        {r.rejection_reason && (
                          <p className="mt-1 text-[12px] text-foreground">{r.rejection_reason}</p>
                        )}
                        <Link
                          to={VERIFY_HREF}
                          className="mt-1.5 inline-flex items-center text-[11px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded"
                          aria-label="Open verification status"
                        >
                          View status
                          <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
};

export default CustomerNotifications;
