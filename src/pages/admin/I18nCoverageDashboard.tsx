import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, AlertTriangle, CheckCircle2, FileWarning } from "lucide-react";

interface AuditRow {
  file: string;
  line: number | string;
  key: string;
  status: "fully_hardcoded" | "used_valid" | "placeholder_broken" | "file_not_found";
  suggested: string;
}

interface AuditReport {
  generated_at: string;
  scanned_files: number;
  summary: Record<string, number>;
  rows: AuditRow[];
}

interface MissingKeyRow {
  id: string;
  string_key: string;
  language: string;
  route: string | null;
  component: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved: boolean;
}

const STATUS_META: Record<AuditRow["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  fully_hardcoded: { label: "Hardcoded", variant: "secondary" },
  used_valid: { label: "Valid t()", variant: "default" },
  placeholder_broken: { label: "Broken", variant: "destructive" },
  file_not_found: { label: "Missing file", variant: "outline" },
};

export default function I18nCoverageDashboard() {
  const { toast } = useToast();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [missing, setMissing] = useState<MissingKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        fetch("/reports/i18n-audit.json", { cache: "no-store" }).then((res) =>
          res.ok ? res.json() : null,
        ),
        supabase
          .from("i18n_missing_keys" as any)
          .select("*")
          .eq("resolved", false)
          .order("last_seen_at", { ascending: false })
          .limit(200),
      ]);
      setReport(r);
      setMissing(((m as any).data as MissingKeyRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function markResolved(id: string) {
    const { error } = await supabase
      .from("i18n_missing_keys" as any)
      .update({ resolved: true })
      .eq("id", id);
    if (error) {
      toast({ title: "Could not update", description: error.message, variant: "destructive" });
      return;
    }
    setMissing((m) => m.filter((row) => row.id !== id));
    toast({ title: "Marked as resolved" });
  }

  async function refreshAudit() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
    toast({ title: "Audit refreshed" });
  }

  const downloads = [
    { href: "/reports/i18n-audit.json", label: "Audit JSON" },
    { href: "/reports/i18n-audit.csv", label: "Audit CSV" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">i18n Coverage Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Per-file translation health for landing surfaces and developer pages, plus runtime missing-key telemetry.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshAudit} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {downloads.map((d) => (
            <Button key={d.href} asChild variant="outline">
              <a href={d.href} download>
                <Download className="mr-2 h-4 w-4" />
                {d.label}
              </a>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
          label="Hardcoded files"
          value={report?.summary.fully_hardcoded ?? 0}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
          label="Valid t() calls"
          value={report?.summary.used_valid ?? 0}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          label="Broken placeholders"
          value={report?.summary.placeholder_broken ?? 0}
        />
        <SummaryCard
          icon={<FileWarning className="h-4 w-4 text-muted-foreground" />}
          label="Runtime missing keys"
          value={missing.length}
        />
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">Static audit</TabsTrigger>
          <TabsTrigger value="runtime">Runtime missing ({missing.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Per-file findings</CardTitle>
              <CardDescription>
                Generated {report?.generated_at ?? "—"}. Run{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  node scripts/i18n-audit.mjs
                </code>{" "}
                to refresh.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : !report ? (
                <p className="text-sm text-muted-foreground">
                  No audit report found. Run the audit script and commit{" "}
                  <code>public/reports/i18n-audit.json</code>.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Suggested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{row.file}</TableCell>
                        <TableCell className="text-xs">{row.line || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{row.key}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_META[row.status].variant}>
                            {STATUS_META[row.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.suggested}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runtime">
          <Card>
            <CardHeader>
              <CardTitle>Runtime missing keys</CardTitle>
              <CardDescription>
                Reported by client-side <code>LanguageContext</code> when <code>t()</code> resolves to the raw key.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {missing.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No unresolved missing keys reported.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Hits</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missing.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">{row.string_key}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.language}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{row.route || "—"}</TableCell>
                        <TableCell>{row.occurrence_count}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(row.last_seen_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => markResolved(row.id)}>
                            Mark resolved
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md border bg-muted/40 p-2">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
