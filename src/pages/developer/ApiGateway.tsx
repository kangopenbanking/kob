// ============================================================
// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// /developer/api-gateway documents the public branded API host.
// Required by Guardian Standing Orders P1 (Public First) + P4 (Open Spec).
// ============================================================

import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, Copy, Globe, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  API_PUBLIC_GATEWAY_URL,
  API_CONFIG,
  getCanonicalUrl,
} from "@/config/api";

const GATEWAY_HOST = new URL(API_PUBLIC_GATEWAY_URL).origin; // https://api.kangopenbanking.com
const GATEWAY_BASE = API_PUBLIC_GATEWAY_URL;                 // https://api.kangopenbanking.com/v1

interface HealthSnapshot {
  status: string;
  version: string;
  timestamp: string;
  upstream: { status: string; latency_ms: number | null; http_status: number | null };
}

const SNIPPETS: Record<string, string> = {
  curl: `# List accounts (replace YOUR_API_KEY with your sandbox or production key)
curl -X GET "${GATEWAY_BASE}/accounts" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Accept: application/json"`,
  node: `// npm i node-fetch
import fetch from "node-fetch";

const res = await fetch("${GATEWAY_BASE}/accounts", {
  headers: {
    "x-api-key": process.env.KOB_API_KEY!,
    "Accept": "application/json",
  },
});
const data = await res.json();
console.log(data);`,
  python: `import os, requests

resp = requests.get(
    "${GATEWAY_BASE}/accounts",
    headers={
        "x-api-key": os.environ["KOB_API_KEY"],
        "Accept": "application/json",
    },
    timeout=10,
)
resp.raise_for_status()
print(resp.json())`,
  php: `<?php
$ch = curl_init("${GATEWAY_BASE}/accounts");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "x-api-key: " . getenv("KOB_API_KEY"),
    "Accept: application/json",
  ],
]);
echo curl_exec($ch);`,
  go: `package main

import (
  "fmt"; "io"; "net/http"; "os"
)

func main() {
  req, _ := http.NewRequest("GET", "${GATEWAY_BASE}/accounts", nil)
  req.Header.Set("x-api-key", os.Getenv("KOB_API_KEY"))
  req.Header.Set("Accept", "application/json")
  resp, err := http.DefaultClient.Do(req)
  if err != nil { panic(err) }
  defer resp.Body.Close()
  body, _ := io.ReadAll(resp.Body)
  fmt.Println(string(body))
}`,
  java: `// Java 11+
import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();
var req = HttpRequest.newBuilder()
    .uri(URI.create("${GATEWAY_BASE}/accounts"))
    .header("x-api-key", System.getenv("KOB_API_KEY"))
    .header("Accept", "application/json")
    .GET().build();
var resp = client.send(req, HttpResponse.BodyHandlers.ofString());
System.out.println(resp.body());`,
};

export default function ApiGateway() {
  const { toast } = useToast();
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${GATEWAY_HOST}/health`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !cancelled && setHealth(d))
      .catch((e) => !cancelled && setHealthError(e?.message ?? "unreachable"));
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: label });
  };

  const canonical = getCanonicalUrl("/developer/api-gateway");

  return (
    <>
      <Helmet>
        <title>API Gateway · Kang Open Banking</title>
        <meta
          name="description"
          content="Public branded API host api.kangopenbanking.com — base URL, authentication, SDK snippets, and live health for the Kang Open Banking API gateway."
        />
        <link rel="canonical" href={canonical} />
      </Helmet>

      <div className="container mx-auto max-w-5xl py-10 space-y-8">
        <header className="space-y-3">
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3" /> Public branded host
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight">API Gateway</h1>
          <p className="text-lg text-muted-foreground">
            Every public integration with the Kang Open Banking API uses the
            branded host{" "}
            <code className="rounded bg-muted px-2 py-0.5 text-foreground">
              {GATEWAY_HOST}
            </code>
            . All examples, SDK defaults, and OpenAPI <code>servers[]</code>{" "}
            entries below are generated from the same single source of truth.
          </p>
        </header>

        {/* Base URL card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Base URL
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border bg-muted/40 p-4">
              <code className="text-base">{GATEWAY_BASE}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy("Base URL copied", GATEWAY_BASE)}
              >
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
            </div>
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li>
                <strong className="text-foreground">Versioning:</strong> path-based
                (<code>/v1</code>) — never breaking within a major.
              </li>
              <li>
                <strong className="text-foreground">TLS:</strong> 1.2 minimum, 1.3
                preferred, FAPI 1.0 Advanced compliant.
              </li>
              <li>
                <strong className="text-foreground">Auth:</strong> API key via{" "}
                <code>x-api-key</code> or OAuth 2.0 Bearer token.
              </li>
              <li>
                <strong className="text-foreground">Spec:</strong>{" "}
                <a
                  href={`${GATEWAY_HOST}/openapi.json`}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  openapi.json
                </a>{" "}
                ·{" "}
                <a
                  href={`${GATEWAY_HOST}/openapi.yaml`}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  openapi.yaml
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Live health card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Live gateway health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {healthError ? (
              <p className="text-sm text-destructive">
                Could not reach {GATEWAY_HOST}/health — {healthError}
              </p>
            ) : !health ? (
              <p className="text-sm text-muted-foreground">Probing gateway…</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-4">
                <Stat label="Status" value={health.status} />
                <Stat label="Version" value={health.version} />
                <Stat
                  label="Upstream"
                  value={`${health.upstream.status}${
                    health.upstream.http_status
                      ? ` (${health.upstream.http_status})`
                      : ""
                  }`}
                />
                <Stat
                  label="Latency"
                  value={
                    health.upstream.latency_ms != null
                      ? `${health.upstream.latency_ms} ms`
                      : "—"
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              All <code>/v1/*</code> endpoints require either a registered API
              key in the <code>x-api-key</code> header, or a valid OAuth 2.0
              Bearer token issued via <code>/v1/oauth/token</code>.
            </p>
            <p className="text-muted-foreground">
              The sandbox (<code>/v1/sandbox/*</code>), OpenAPI spec, and{" "}
              <code>/health</code> are intentionally public — see{" "}
              <a
                href="/developer/sandbox"
                className="text-primary hover:underline"
              >
                Free Sandbox
              </a>
              .
            </p>
            <p>
              Need a key?{" "}
              <a
                href="/developer/registration"
                className="text-primary hover:underline"
              >
                Register your institution →
              </a>
            </p>
          </CardContent>
        </Card>

        {/* SDK snippets */}
        <Card>
          <CardHeader>
            <CardTitle>Quickstart snippets</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl">
              <TabsList className="flex-wrap">
                {Object.keys(SNIPPETS).map((k) => (
                  <TabsTrigger key={k} value={k}>
                    {k.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.entries(SNIPPETS).map(([k, code]) => (
                <TabsContent key={k} value={k} className="mt-4">
                  <div className="relative">
                    <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs">
                      <code>{code}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute right-3 top-3"
                      onClick={() => copy(`${k} snippet copied`, code)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Spec downloads */}
        <Card>
          <CardHeader>
            <CardTitle>Specification & tools</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <SpecLink
              label="OpenAPI 3.1 (JSON)"
              href={`${GATEWAY_HOST}/openapi.json`}
            />
            <SpecLink
              label="OpenAPI 3.1 (YAML)"
              href={`${GATEWAY_HOST}/openapi.yaml`}
            />
            <SpecLink label="Postman collection" href={API_CONFIG.POSTMAN_COLLECTION} />
            <SpecLink label="Interactive explorer" href="/developer/api-explorer" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-medium capitalize">{value}</p>
    </div>
  );
}

function SpecLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border bg-card p-3 text-sm transition-colors hover:bg-muted"
    >
      <span className="font-medium">{label}</span>
      <span className="block truncate text-xs text-muted-foreground">{href}</span>
    </a>
  );
}
