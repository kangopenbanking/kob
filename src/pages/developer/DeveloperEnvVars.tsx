import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { DeveloperBreadcrumb } from "@/components/developer/DeveloperBreadcrumb";
import { CodeBlock } from "@/components/developer/CodeBlock";

type EnvVar = {
  name: string;
  required: "Required" | "Optional" | "Auto";
  scope: "Build" | "Runtime" | "Both";
  defaultValue?: string;
  description: string;
};

const VARS: EnvVar[] = [
  { name: "NODE_VERSION", required: "Required", scope: "Build", defaultValue: "20", description: "Node.js version used by Netlify build image. Pinned in netlify.toml." },
  { name: "EXPECTED_OPENAPI_VERSION", required: "Auto", scope: "Build", description: "Computed at build time from src/config/version.ts via scripts/print-expected-version.mjs. Do not set manually." },
  { name: "AUDIT_BASE", required: "Required", scope: "Build", defaultValue: "https://kangopenbanking.com", description: "Base URL used by scripts/audit-public-access.mjs to verify deployed pages return 200." },
  { name: "PREDEPLOY_OFFLINE", required: "Optional", scope: "Build", description: "Set to 1 to skip the live public-access audit (used on deploy previews and branch deploys)." },
  { name: "SLACK_WEBHOOK_URL", required: "Optional", scope: "Build", description: "Incoming Slack webhook for predeploy failure notifications." },
  { name: "VITE_SUPABASE_URL", required: "Auto", scope: "Build", defaultValue: "https://wdzkzeahdtxlynetndqw.supabase.co", description: "Lovable Cloud backend URL injected automatically. Do not edit." },
  { name: "VITE_SUPABASE_PUBLISHABLE_KEY", required: "Auto", scope: "Build", description: "Lovable Cloud publishable anon key injected automatically." },
  { name: "VITE_SUPABASE_PROJECT_ID", required: "Auto", scope: "Build", defaultValue: "wdzkzeahdtxlynetndqw", description: "Project ref injected automatically." },
  { name: "VITE_FIREBASE_API_KEY", required: "Required", scope: "Build", description: "Firebase Web API key for client SDK initialisation." },
  { name: "VITE_FIREBASE_AUTH_DOMAIN", required: "Required", scope: "Build", description: "Firebase Auth domain (e.g. project.firebaseapp.com)." },
  { name: "VITE_FIREBASE_PROJECT_ID", required: "Required", scope: "Build", description: "Firebase project identifier." },
  { name: "VITE_STRIPE_PUBLIC_KEY", required: "Required", scope: "Build", description: "Stripe publishable key for client-side Elements." },
];

const API_HOSTS = [
  { name: "Production gateway", url: "https://api.kangopenbanking.com/v1", purpose: "All public REST traffic" },
  { name: "Sandbox gateway", url: "https://sandbox-api.kangopenbanking.com/v1", purpose: "Free sandbox traffic with test credentials" },
  { name: "Direct backend", url: "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1", purpose: "Direct backend mandate (Edge Functions). Used by SDKs and the worker origin." },
];

export default function DeveloperEnvVars() {
  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEO
        title="Required Netlify Environment Variables — Kang Open Banking"
        description="Documented Netlify build and runtime environment variables for the Kang Open Banking developer portal and OpenAPI artifact generation."
        canonical="https://kangopenbanking.com/developer/env-vars"
      />
      <DeveloperBreadcrumb />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Netlify Environment Variables
        </h1>
        <p className="text-muted-foreground">
          Variables consumed by the Netlify build, the predeploy gates, and the public OpenAPI
          artifact pipeline. Keep this list authoritative — every variable below must be set in
          <code className="px-1">Netlify → Site settings → Environment variables</code> before
          publishing.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>API Base URLs &amp; Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Purpose</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {API_HOSTS.map((h) => (
                <TableRow key={h.url}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell><code>{h.url}</code></TableCell>
                  <TableCell className="text-muted-foreground">{h.purpose}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {VARS.map((v) => (
                <TableRow key={v.name}>
                  <TableCell className="font-mono text-xs">{v.name}</TableCell>
                  <TableCell>
                    <Badge variant={v.required === "Required" ? "default" : "secondary"}>
                      {v.required}
                    </Badge>
                  </TableCell>
                  <TableCell>{v.scope}</TableCell>
                  <TableCell><code className="text-xs">{v.defaultValue ?? "—"}</code></TableCell>
                  <TableCell className="text-muted-foreground">{v.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setting variables in Netlify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Use the Netlify CLI for repeatable provisioning:</p>
          <CodeBlock examples={[{ language: "bash", code: `netlify env:set NODE_VERSION 20
netlify env:set AUDIT_BASE https://kangopenbanking.com
netlify env:set VITE_FIREBASE_API_KEY "<value>"
netlify env:set VITE_FIREBASE_AUTH_DOMAIN "kang-open-banking-5e1e2.firebaseapp.com"
netlify env:set VITE_FIREBASE_PROJECT_ID "kang-open-banking-5e1e2"
netlify env:set VITE_STRIPE_PUBLIC_KEY "<value>"
# Optional
netlify env:set SLACK_WEBHOOK_URL "<incoming-webhook>"` }]} />
          <p>
            See <a className="underline" href="/developer/deployment-status">Deployment Status</a>
            {" "}to verify that the latest build published every required artifact.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
