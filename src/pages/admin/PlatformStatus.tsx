import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  ShieldCheck, Webhook, Building2, Gauge, Loader2, ExternalLink,
} from "lucide-react";

const PUBLIC_API = "https://api.kangopenbanking.com/v1";

type Status = "ok" | "degraded" | "down" | "unknown";

interface ProbeResult {
  status: Status;
  http: number;
  latencyMs: number;
  detail?: string;
  payloadPreview?: string;
}

async function probeUrl(url: string): Promise<ProbeResult> {
  const start = performance.now();
  try {
    const r = await fetch(url, { method: "GET", cache: "no-store" });
    const latencyMs = Math.round(performance.now() - start);
    const text = await r.text().catch(() => "");
    let status: Status = "down";
    if (r.ok) status = "ok";
    else if (r.status === 401 || r.status === 403) status = "degraded";
    return {
      status,
      http: r.status,
      latencyMs,
      payloadPreview: text.slice(0, 200),
    };
  } catch (err) {
    return {
      status: "down",
      http: 0,
      latencyMs: Math.round(performance.now() - start),
      detail: err instanceof Error ? err.message : "network error",
    };
  }
}

function StatusDot({ status }: { status: Status }) {
  const map: Record<Status, { bg: string; label: string; Icon: typeof CheckCircle2 }> = {
    ok: { bg: "bg-emerald-500", label: "Healthy", Icon: CheckCircle2 },
    degraded: { bg: "bg-amber-500", label: "Degraded", Icon: AlertTriangle },
    down: { bg: "bg-destructive", label: "Down", Icon: XCircle },
    unknown: { bg: "bg-muted-foreground", label: "Unknown", Icon: Activity },
  };
  const s = map[status];
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${s.bg}`} aria-hidden />
      <span className="text-sm text-muted-foreground">{s.label}</span>
    </div>
  );
}

function SubsystemCard({
  title,
  description,
  Icon,
  result,
  isLoading,
  onRetest,
  helperLink,
}: {
  title: string;
  description: string;
  Icon: typeof CheckCircle2;
  result?: ProbeResult;
  isLoading: boolean;
  onRetest: () => void;
  helperLink?: { label: string; url: string };
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md border border-border p-2">
              <Icon className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <StatusDot status={result?.status ?? "unknown"} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : result ? (
          <div className="space-y-2 rounded-md bg-muted/30 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">HTTP</span>
              <span className="font-mono">{result.http || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Latency</span>
              <span className="font-mono">{result.latencyMs} ms</span>
            </div>
            {result.detail && (
              <div className="text-destructive">{result.detail}</div>
            )}
            {result.payloadPreview && (
              <ScrollArea className="max-h-20">
                <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
                  {result.payloadPreview}
                </pre>
              </ScrollArea>
            )}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onRetest} disabled={isLoading}>
            <RefreshCw className="mr-2 h-3 w-3" strokeWidth={1.5} />
            Run test
          </Button>
          {helperLink && (
            <a
              href={helperLink.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {helperLink.label}
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformStatus() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  // OAuth / OIDC discovery probe
  const oidc = useQuery({
    queryKey: ["status-oidc", tick],
    queryFn: () => probeUrl(`${PUBLIC_API}/.well-known/openid-configuration`),
  });

  // OpenAPI spec probe
  const openapi = useQuery({
    queryKey: ["status-openapi", tick],
    queryFn: () => probeUrl(`${PUBLIC_API}/openapi.json`),
  });

  // Public API spec probe
  const spec = useQuery({
    queryKey: ["status-spec", tick],
    queryFn: () => probeUrl(`${PUBLIC_API}/public-api-spec`),
  });

  // Webhook router presence: count rows in webhook_inbox via DB
  const webhookCounts = useQuery({
    queryKey: ["status-webhook-counts", tick],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("webhook_inbox" as any)
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Pending institution registrations
  const pendingInstitutions = useQuery({
    queryKey: ["status-pending-institutions", tick],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("institutions" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review");
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Recent audit log volume (last 24h)
  const auditVolume = useQuery({
    queryKey: ["status-audit-volume", tick],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("audit_logs" as any)
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Active API client count
  const activeClients = useQuery({
    queryKey: ["status-active-clients", tick],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("api_clients" as any)
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const handleRefreshAll = () => {
    refresh();
    toast.success("Re-running all subsystem checks");
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Status"
        description="Live health of OAuth/OIDC, webhook routing, institution approvals, and rate-limit / audit subsystems."
        icon={Activity}
        action={
          <Button variant="outline" size="sm" onClick={handleRefreshAll}>
            <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Refresh all
          </Button>
        }
      />

      {/* Summary metrics */}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Active API Clients", value: activeClients.data, loading: activeClients.isLoading },
          { label: "Pending Institutions", value: pendingInstitutions.data, loading: pendingInstitutions.isLoading },
          { label: "Webhooks (inbox)", value: webhookCounts.data, loading: webhookCounts.isLoading },
          { label: "Audit Events (24h)", value: auditVolume.data, loading: auditVolume.isLoading },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              {m.loading ? (
                <Skeleton className="mt-2 h-7 w-16" />
              ) : (
                <p className="mt-1 text-2xl font-semibold tracking-tight">{m.value ?? "—"}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subsystem probes */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SubsystemCard
          title="OAuth 2.0 / OIDC"
          description="OpenID discovery metadata for authorization, token, and JWKS endpoints."
          Icon={ShieldCheck}
          result={oidc.data}
          isLoading={oidc.isFetching}
          onRetest={() => oidc.refetch()}
          helperLink={{
            label: "View discovery JSON",
            url: `${PUBLIC_API}/.well-known/openid-configuration`,
          }}
        />

        <SubsystemCard
          title="OpenAPI Specification"
          description="Public spec served at /v1/openapi.json with branded servers."
          Icon={Activity}
          result={openapi.data}
          isLoading={openapi.isFetching}
          onRetest={() => openapi.refetch()}
          helperLink={{ label: "Open spec", url: `${PUBLIC_API}/openapi.json` }}
        />

        <SubsystemCard
          title="Public API Spec (raw)"
          description="Raw upstream specification for SDK and tooling generation."
          Icon={Activity}
          result={spec.data}
          isLoading={spec.isFetching}
          onRetest={() => spec.refetch()}
          helperLink={{ label: "Open raw spec", url: `${PUBLIC_API}/public-api-spec` }}
        />

        <SubsystemCard
          title="Webhook Routing"
          description="Inbound provider webhooks (Stripe, Flutterwave, PayPal) processed through the unified router."
          Icon={Webhook}
          result={
            webhookCounts.isLoading
              ? undefined
              : {
                  status: "ok",
                  http: 200,
                  latencyMs: 0,
                  payloadPreview: `webhook_inbox rows: ${webhookCounts.data ?? 0}`,
                }
          }
          isLoading={webhookCounts.isFetching}
          onRetest={() => webhookCounts.refetch()}
          helperLink={{ label: "Webhook admin", url: "/admin/webhooks" }}
        />

        <SubsystemCard
          title="Institution Approval"
          description="Bank, Credit Union, and Fintech registrations awaiting review."
          Icon={Building2}
          result={
            pendingInstitutions.isLoading
              ? undefined
              : {
                  status: (pendingInstitutions.data ?? 0) > 0 ? "degraded" : "ok",
                  http: 200,
                  latencyMs: 0,
                  payloadPreview: `pending: ${pendingInstitutions.data ?? 0}`,
                }
          }
          isLoading={pendingInstitutions.isFetching}
          onRetest={() => pendingInstitutions.refetch()}
          helperLink={{ label: "Review queue", url: "/admin/institution-verification" }}
        />

        <SubsystemCard
          title="Rate Limiting & Audit"
          description="Per-client sliding-window limits and immutable audit trail."
          Icon={Gauge}
          result={
            auditVolume.isLoading
              ? undefined
              : {
                  status: (auditVolume.data ?? 0) > 0 ? "ok" : "degraded",
                  http: 200,
                  latencyMs: 0,
                  payloadPreview: `events 24h: ${auditVolume.data ?? 0}`,
                }
          }
          isLoading={auditVolume.isFetching}
          onRetest={() => auditVolume.refetch()}
          helperLink={{ label: "Open audit logs", url: "/admin/audit-logs" }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoint reference</CardTitle>
          <CardDescription>
            Public, unauthenticated endpoints required by Standing Orders P1 and P4.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { name: "OpenAPI JSON", url: `${PUBLIC_API}/openapi.json` },
            { name: "OpenID Configuration", url: `${PUBLIC_API}/.well-known/openid-configuration` },
            { name: "JWKS", url: `${PUBLIC_API}/.well-known/jwks.json` },
            { name: "Health", url: `${PUBLIC_API}/health` },
            { name: "Public Spec", url: `${PUBLIC_API}/public-api-spec` },
          ].map((e) => (
            <div
              key={e.url}
              className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{e.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{e.url}</span>
              </div>
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Open
                <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
              </a>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
