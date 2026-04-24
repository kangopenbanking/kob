import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Zap, ArrowRight, FileJson, FileCode, Activity, Globe } from "lucide-react";
import { API_PUBLIC_GATEWAY_URL } from "@/config/api";

export function OpenBankingSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Open Banking APIs</h2>
        <p className="text-muted-foreground max-w-2xl">
          PSD2-inspired account access and payment initiation for the CEMAC region.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Account Information (AISP)</CardTitle>
                <CardDescription>Consent-based access to accounts, balances & transaction history</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link to="/developer/api/aisp">
              <Button variant="outline" size="sm">
                AISP Docs <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Payment Initiation (PISP)</CardTitle>
                <CardDescription>Initiate domestic & cross-border payments from bank accounts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link to="/developer/api/pisp">
              <Button variant="outline" size="sm">
                PISP Docs <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/*
        PERMANENT PUBLIC LINKS — DO NOT REMOVE (Order P4 — Open Spec Rule).
        These anchors give crawlers a direct, no-JavaScript-required path to
        the OpenAPI specification downloads from the developer landing page.
      */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">API specification &amp; crawler resources</h3>
          <p className="text-sm text-muted-foreground">
            Always-public, no-login spec downloads and a live crawler health check.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Button variant="outline" size="sm" asChild>
            <a href="/openapi.json" target="_blank" rel="noopener noreferrer">
              <FileJson className="mr-2 h-4 w-4" />
              openapi.json
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/openapi.yaml" target="_blank" rel="noopener noreferrer">
              <FileCode className="mr-2 h-4 w-4" />
              openapi.yaml
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/developer/openapi">
              <ArrowRight className="mr-2 h-4 w-4" />
              All spec downloads
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/developer/seo-crawl-check">
              <Activity className="mr-2 h-4 w-4" />
              SEO crawl check
            </Link>
          </Button>
        </div>
      </div>

      {/*
        Branded API gateway URL — surfaced for documentation discovery.
        Backed by the Cloudflare Worker in /worker which proxies to the
        Supabase Edge Functions origin. Runtime apps continue to use the
        direct backend URL (see src/config/api.ts).
      */}
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Branded API base URL</h3>
            <p className="text-sm text-muted-foreground">
              All SDK defaults and code examples use the gateway hostname below.
            </p>
          </div>
          <Badge variant="outline">v1</Badge>
        </div>
        <code className="block rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono break-all">
          {API_PUBLIC_GATEWAY_URL}
        </code>
        <p className="text-xs text-muted-foreground">
          Served by the Kang edge gateway. Forwards transparently to the Supabase
          Edge Functions origin with full streaming, CORS, and rate-limit headers
          preserved. Direct origin URL remains available for self-hosted clients
          and is documented in the OpenAPI <code>servers</code> block.
        </p>
      </div>
    </div>
  );
}
