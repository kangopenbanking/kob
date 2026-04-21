import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, RefreshCw } from "lucide-react";

const HEALTHZ_URL = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/healthz";
const OIDC_URL = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oidc-config";

interface SecurityCapability {
  key: string;
  label: string;
  status: string;
  endpoint?: string;
  detail?: string;
}

const STATUS_TONES: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  live: { label: "Live", variant: "default" },
  required: { label: "Required", variant: "default" },
  supported: { label: "Supported", variant: "secondary" },
  degraded: { label: "Degraded", variant: "outline" },
  unknown: { label: "Unknown", variant: "outline" },
};

export function LiveVerificationPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(HEALTHZ_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || "Unable to reach healthz endpoint");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const capabilities: SecurityCapability[] = data
    ? [
        { key: "oauth2", label: "OAuth 2.0 / 2.1", status: data.security.oauth2.status, endpoint: data.security.oauth2.endpoint, detail: data.security.oauth2.flows?.join(", ") },
        { key: "oidc", label: "OpenID Connect Core", status: data.security.oidc.status, endpoint: data.security.oidc.endpoint, detail: data.security.oidc.spec },
        { key: "mtls", label: "mTLS (FAPI 1.0 Advanced)", status: data.security.mtls.status, detail: data.security.mtls.rfc },
        { key: "dcr", label: "Dynamic Client Registration", status: data.security.dcr.status, endpoint: data.security.dcr.endpoint, detail: data.security.dcr.spec },
        { key: "par", label: "Pushed Authorization Requests", status: data.security.par.status, endpoint: data.security.par.endpoint, detail: data.security.par.spec },
        { key: "jar", label: "JWT-Secured Auth Requests", status: data.security.jar.status, detail: data.security.jar.spec },
        { key: "pkce", label: "PKCE (S256)", status: data.security.pkce.status, detail: data.security.pkce.spec },
        { key: "webhooks", label: "HMAC-SHA256 Webhooks", status: data.security.webhooks.status, detail: data.security.webhooks.header },
        { key: "jwks", label: "JWKS Endpoint", status: data.security.jwks.status, endpoint: data.security.jwks.endpoint, detail: data.security.jwks.rotation },
      ]
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            Live Security Posture
            {data && <Badge variant="outline">v{data.version}</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Verified against{" "}
            <a href={HEALTHZ_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
              /healthz
            </a>{" "}
            and{" "}
            <a href={OIDC_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
              /oidc-config
            </a>
            . No login required — anyone can run this check.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Re-verify</span>
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Could not reach /healthz: {error}</span>
          </div>
        )}
        {loading && !data && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Probing live endpoints…
          </div>
        )}
        {data && (
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((c) => {
              const tone = STATUS_TONES[c.status] ?? STATUS_TONES.unknown;
              const live = c.status === "live" || c.status === "required" || c.status === "supported";
              return (
                <div key={c.key} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {live ? (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-medium text-sm">{c.label}</span>
                    </div>
                    {c.detail && <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>}
                    {c.endpoint && (
                      <a
                        href={c.endpoint}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline break-all"
                      >
                        Verify <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <Badge variant={tone.variant} className="shrink-0">{tone.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
        {data?.known_limitations?.length > 0 && (
          <div className="mt-4 rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-medium text-foreground mb-1">Honest disclosure — known limitations</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
              {data.known_limitations.map((l: string, i: number) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
