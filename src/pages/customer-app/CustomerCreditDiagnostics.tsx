/**
 * Credit Check Diagnostics — surfaces the recent OTP requests, Didit
 * webhook events, KYC verification rows, and credit events for the
 * signed-in user so gaps between modules can be audited in one place.
 *
 * Read-only, no PII beyond what the user themselves supplied. Every
 * query is scoped by `user_id = auth.uid()` and covered by RLS.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft, Loader2, ShieldCheck, Phone, Webhook, Activity,
  CheckCircle2, XCircle, AlertCircle, Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

type Row = Record<string, any>;

function statusIcon(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (["approved", "verified", "success", "completed", "delivered"].includes(s))
    return <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(150,60%,35%)]" strokeWidth={2} />;
  if (["rejected", "failed", "error"].includes(s))
    return <XCircle className="h-3.5 w-3.5 text-destructive" strokeWidth={2} />;
  if (["pending", "processing", "manual_review", "sent"].includes(s))
    return <Clock className="h-3.5 w-3.5 text-[hsl(45,60%,40%)]" strokeWidth={2} />;
  return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />;
}

const Section: React.FC<{
  icon: React.ElementType;
  title: string;
  count: number;
  isLoading: boolean;
  children: React.ReactNode;
  emptyText: string;
}> = ({ icon: Icon, title, count, isLoading, children, emptyText }) => (
  <section className="rounded-3xl border border-border bg-card p-5">
    <div className="flex items-center gap-3 mb-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-background border border-border">
        <Icon className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">
          {isLoading ? "Loading…" : `${count} record${count === 1 ? "" : "s"}`}
        </p>
      </div>
    </div>
    {isLoading ? (
      <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
    ) : count === 0 ? (
      <p className="text-xs text-muted-foreground">{emptyText}</p>
    ) : (
      <div className="space-y-2">{children}</div>
    )}
  </section>
);

const CustomerCreditDiagnostics: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const uid = user?.id;

  const kyc = useQuery({
    queryKey: ["diag-kyc", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Row[]> => {
      const { data } = await (supabase as any)
        .from("kyc_verifications")
        .select("id, status, verification_type, provider, created_at, updated_at, decision_reason")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const didit = useQuery({
    queryKey: ["diag-didit", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Row[]> => {
      const { data } = await (supabase as any)
        .from("didit_webhook_events")
        .select("id, event_type, status, session_id, processed_at, received_at, error_message")
        .eq("user_id", uid!)
        .order("received_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const otp = useQuery({
    queryKey: ["diag-otp", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Row[]> => {
      const { data } = await (supabase as any)
        .from("otp_request_log")
        .select("id, phone_number, delivery_method, status, otp_type, created_at, error_code")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const events = useQuery({
    queryKey: ["diag-credit-events", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Row[]> => {
      const { data } = await (supabase as any)
        .from("credit_events")
        .select("id, event_type, value_numeric, description, event_time")
        .eq("user_id", uid!)
        .order("event_time", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const fmt = (v?: string | null) => (v ? format(new Date(v), "MMM d, HH:mm") : "—");

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">Credit Check Diagnostics</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Recent identity, phone and credit signals recorded on your account.
          </p>
        </div>
      </div>

      <Section icon={ShieldCheck} title="Didit / KYC verifications" count={kyc.data?.length ?? 0} isLoading={kyc.isLoading} emptyText="No verification attempts recorded yet.">
        {(kyc.data ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-background p-3">
            <div className="flex items-center gap-2 mb-1">
              {statusIcon(r.status)}
              <span className="text-xs font-bold text-foreground uppercase tracking-wide">{r.status || "unknown"}</span>
              <span className="text-[10px] text-muted-foreground">· {r.provider || "provider n/a"}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {r.verification_type || "identity"} · created {fmt(r.created_at)} · updated {fmt(r.updated_at)}
            </p>
            {r.decision_reason && (
              <p className="text-[11px] text-foreground mt-1"><span className="font-semibold">Reason:</span> {r.decision_reason}</p>
            )}
          </div>
        ))}
      </Section>

      <Section icon={Webhook} title="Didit webhook events" count={didit.data?.length ?? 0} isLoading={didit.isLoading} emptyText="No Didit webhook events for your session yet.">
        {(didit.data ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-background p-3">
            <div className="flex items-center gap-2 mb-1">
              {statusIcon(r.status || (r.processed_at ? "success" : "pending"))}
              <span className="text-xs font-bold text-foreground">{r.event_type || "event"}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              received {fmt(r.received_at)} · processed {fmt(r.processed_at)}
            </p>
            {r.session_id && (
              <p className="text-[10px] text-muted-foreground mt-0.5">session {r.session_id.slice(0, 8)}…</p>
            )}
            {r.error_message && (
              <p className="text-[11px] text-destructive mt-1">Error: {r.error_message}</p>
            )}
          </div>
        ))}
      </Section>

      <Section icon={Phone} title="Phone OTP requests" count={otp.data?.length ?? 0} isLoading={otp.isLoading} emptyText="No OTP requests recorded for your account.">
        {(otp.data ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-background p-3">
            <div className="flex items-center gap-2 mb-1">
              {statusIcon(r.status)}
              <span className="text-xs font-bold text-foreground">{r.otp_type || "otp"}</span>
              <span className="text-[10px] text-muted-foreground">· {r.delivery_method || "auto"}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {r.phone_number ? `${r.phone_number} · ` : ""}{fmt(r.created_at)}
            </p>
            {r.error_code && (
              <p className="text-[11px] text-destructive mt-1">Code: {r.error_code}</p>
            )}
          </div>
        ))}
      </Section>

      <Section icon={Activity} title="Credit events" count={events.data?.length ?? 0} isLoading={events.isLoading} emptyText="No credit events yet — activities like savings deposits appear here.">
        {(events.data ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-background p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-foreground">{r.event_type}</span>
              {typeof r.value_numeric === "number" && (
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {r.value_numeric > 0 ? "+" : ""}{r.value_numeric}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{fmt(r.event_time)}</p>
            {r.description && <p className="text-[11px] text-foreground mt-1">{r.description}</p>}
          </div>
        ))}
      </Section>
    </div>
  );
};

export default CustomerCreditDiagnostics;
