import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Info, Package, ShieldCheck } from "lucide-react";

interface SdkRelease {
  version: string;
  apiVersion: string;
  released: string;
  status: "current" | "supported" | "deprecated";
  notes: string[];
}

const NODE_RELEASES: SdkRelease[] = [
  {
    version: "2.4.0",
    apiVersion: "v1 (OpenAPI 4.17.2)",
    released: "2026-04-28",
    status: "current",
    notes: [
      "Added cursor pagination helpers (starting_after / ending_before).",
      "Added webhook replay protection (X-Webhook-ID dedupe, 409 WH_004 surfaced).",
      "New typed clients for /v1/status and /v1/version.",
    ],
  },
  {
    version: "2.3.1",
    apiVersion: "v1 (OpenAPI 4.16.0)",
    released: "2026-03-30",
    status: "supported",
    notes: [
      "Added marketplace split payment helpers.",
      "Hardened idempotency key client-side validation (UUID v4).",
    ],
  },
  {
    version: "2.2.0",
    apiVersion: "v1 (OpenAPI 4.12.0)",
    released: "2026-02-10",
    status: "supported",
    notes: ["Initial AISP/PISP cursor pagination preview.", "Improved retry/backoff (exponential + jitter)."],
  },
  {
    version: "1.9.4",
    apiVersion: "v1 (OpenAPI 4.4.0)",
    released: "2025-11-12",
    status: "deprecated",
    notes: ["Last release before TypeScript v5 requirement.", "End of support: 2026-10-28 (180 days after deprecation)."],
  },
];

const PYTHON_RELEASES: SdkRelease[] = [
  {
    version: "2.4.0",
    apiVersion: "v1 (OpenAPI 4.17.2)",
    released: "2026-04-28",
    status: "current",
    notes: ["Cursor pagination iterators.", "Native asyncio webhook verifier with replay protection."],
  },
  {
    version: "2.3.0",
    apiVersion: "v1 (OpenAPI 4.16.0)",
    released: "2026-03-22",
    status: "supported",
    notes: ["Added marketplace split helpers.", "Pydantic v2 models."],
  },
  {
    version: "1.9.0",
    apiVersion: "v1 (OpenAPI 4.4.0)",
    released: "2025-11-04",
    status: "deprecated",
    notes: ["End of support: 2026-10-28."],
  },
];

const PHP_RELEASES: SdkRelease[] = [
  {
    version: "1.6.0",
    apiVersion: "v1 (OpenAPI 4.17.2)",
    released: "2026-04-28",
    status: "current",
    notes: ["Cursor pagination iterators (PSR-7 compatible).", "Webhook X-Webhook-ID dedupe helper."],
  },
  {
    version: "1.5.2",
    apiVersion: "v1 (OpenAPI 4.16.0)",
    released: "2026-03-30",
    status: "supported",
    notes: ["Stable release. Recommended for Laravel 10/11."],
  },
];

function StatusBadge({ status }: { status: SdkRelease["status"] }) {
  if (status === "current") return <Badge variant="default">Current</Badge>;
  if (status === "deprecated") return <Badge variant="destructive">Deprecated</Badge>;
  return <Badge variant="secondary">Supported</Badge>;
}

function ReleaseTable({ releases }: { releases: SdkRelease[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Version</TableHead>
          <TableHead>API</TableHead>
          <TableHead>Released</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {releases.map((r) => (
          <TableRow key={r.version}>
            <TableCell className="font-mono text-sm">{r.version}</TableCell>
            <TableCell className="text-sm">{r.apiVersion}</TableCell>
            <TableCell className="text-sm">{r.released}</TableCell>
            <TableCell><StatusBadge status={r.status} /></TableCell>
            <TableCell>
              <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                {r.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function SdkVersionPinning() {
  return (
    <>
      <Helmet>
        <title>SDK Version Pinning & Changelog — Kang Open Banking</title>
        <meta name="description" content="Pin official Kang Open Banking SDK versions, review per-release changelogs, and follow upgrade guidance across API versions." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/guides/sdk-versioning" />
      </Helmet>

      <div className="max-w-5xl mx-auto p-6 space-y-6" data-testid="sdk-versioning-page">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7" /> SDK Version Pinning & Changelog
          </h1>
          <p className="text-muted-foreground mt-2">
            Every official SDK is pinned to a specific Kang Open Banking API version. Use the pinning recipes below to upgrade safely across API versions and review per-release changes.
          </p>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Versioning policy</AlertTitle>
          <AlertDescription>
            We follow Semantic Versioning. Patch releases are 100% backward compatible. Minor releases add functionality. Major releases follow a 180-day deprecation window with migration guides published in the <a href="/developer/changelog" className="underline">Changelog</a>.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4" /> Pinning recipes</CardTitle>
            <CardDescription>Lock the SDK version for reproducible builds.</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock
              examples={[
                { language: "bash", label: "Node.js (npm)", code: "npm install --save-exact @kangopenbanking/sdk@2.4.0" },
                { language: "bash", label: "Node.js (yarn)", code: "yarn add @kangopenbanking/sdk@2.4.0 --exact" },
                { language: "bash", label: "Python (pip)", code: "pip install kangopenbanking==2.4.0" },
                { language: "toml", label: "Python (poetry)", code: '[tool.poetry.dependencies]\nkangopenbanking = "2.4.0"' },
                { language: "json", label: "PHP (composer)", code: '{\n  "require": {\n    "kangopenbanking/sdk-php": "1.6.0"\n  }\n}' },
                { language: "xml", label: "Java (Maven)", code: '<dependency>\n  <groupId>com.kangopenbanking</groupId>\n  <artifactId>sdk</artifactId>\n  <version>1.6.0</version>\n</dependency>' },
                { language: "go", label: "Go (modules)", code: 'require github.com/kangopenbanking/kob-go v1.6.0' },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Release history</CardTitle>
            <CardDescription>Each row maps an SDK version to the underlying OpenAPI spec.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="node">
              <TabsList>
                <TabsTrigger value="node">Node.js</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="php">PHP</TabsTrigger>
              </TabsList>
              <TabsContent value="node" className="pt-4"><ReleaseTable releases={NODE_RELEASES} /></TabsContent>
              <TabsContent value="python" className="pt-4"><ReleaseTable releases={PYTHON_RELEASES} /></TabsContent>
              <TabsContent value="php" className="pt-4"><ReleaseTable releases={PHP_RELEASES} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upgrade guidance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><strong>Patch (e.g. 2.4.0 → 2.4.1):</strong> Drop in. No code changes required.</p>
            <p><strong>Minor (e.g. 2.3.x → 2.4.0):</strong> Review the release notes for new optional parameters. Backward compatible.</p>
            <p><strong>Major (e.g. 1.x → 2.x):</strong> Follow the migration guide in the <a href="/developer/changelog" className="underline">Changelog</a>. Old major versions remain supported for 180 days from the deprecation announcement.</p>
            <p><strong>API version pinning:</strong> All SDKs send <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">X-API-Version: 2026-04-28</code> automatically. Override per request to pin to an earlier API contract.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
