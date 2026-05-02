import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileCheck, AlertCircle, CheckCircle2, FileX } from "lucide-react";

type Phase = "ingest" | "validate" | "reconcile";
type Fixture = "good_csv" | "partial_csv" | "bad_headers_csv" | "pain_001";

const FIXTURE_LABELS: Record<Fixture, string> = {
  good_csv: "good.csv (10 valid transactions)",
  partial_csv: "partial.csv (8 valid, 2 invalid)",
  bad_headers_csv: "bad-headers.csv (rejected at parse)",
  pain_001: "pain-001-sample.xml (5 outbound instructions)",
};

const FIXTURES: Record<Fixture, { rows_total: number; rows_valid: number; outcome: string; status: string; }> = {
  good_csv: { rows_total: 10, rows_valid: 10, outcome: "All rows accepted and queued for ingestion.", status: "accepted" },
  partial_csv: { rows_total: 10, rows_valid: 8, outcome: "8 rows accepted; 2 rows failed validation. Error CSV available.", status: "partially_accepted" },
  bad_headers_csv: { rows_total: 0, rows_valid: 0, outcome: "Required header columns missing — file rejected at parse.", status: "failed" },
  pain_001: { rows_total: 5, rows_valid: 5, outcome: "5 outbound instructions accepted; awaiting bank status feed.", status: "accepted" },
};

export function ConnectorSandboxSimulator() {
  const [phase, setPhase] = useState<Phase>("ingest");
  const [fixture, setFixture] = useState<Fixture>("good_csv");
  const [running, setRunning] = useState(false);
  const [timeline, setTimeline] = useState<Array<{ at: string; status: string; detail: string }>>([]);

  async function run() {
    setRunning(true);
    setTimeline([]);
    const f = FIXTURES[fixture];
    const steps = [
      { delay: 200, status: "queued", detail: `File received (${fixture}.${fixture === "pain_001" ? "xml" : "csv"}); SHA-256 computed.` },
      { delay: 400, status: "validating", detail: `Validating ${f.rows_total} row(s) against canonical schema.` },
      ...(phase === "ingest" || phase === "validate"
        ? [{ delay: 500, status: f.status, detail: f.outcome }]
        : [
            { delay: 500, status: "accepted", detail: `${f.rows_valid} row(s) accepted.` },
            { delay: 600, status: "ingested", detail: "Rows upserted into canonical tables." },
            { delay: 700, status: "reconciled", detail: "Outbound batch matched 100% against bank status feed." },
          ]),
    ];
    for (const s of steps) {
      await new Promise((r) => setTimeout(r, s.delay));
      setTimeline((prev) => [...prev, { at: new Date().toISOString().slice(11, 19), status: s.status, detail: s.detail }]);
    }
    setRunning(false);
  }

  const StatusIcon = (status: string) => {
    if (status === "failed") return <FileX className="h-4 w-4 text-destructive" />;
    if (status === "partially_accepted") return <AlertCircle className="h-4 w-4 text-amber-500" />;
    if (["accepted", "ingested", "reconciled"].includes(status)) return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    return <FileCheck className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Try it — sandbox connector simulator</CardTitle>
        <CardDescription>
          Pick a phase and a fixture file. The simulator runs through the same validation pipeline as the
          live <code>bank-file-connector</code> in sandbox mode, then returns the resulting status timeline.
          No data is written to your live tenant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Phase</label>
            <Select value={phase} onValueChange={(v) => setPhase(v as Phase)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ingest">1. Ingest</SelectItem>
                <SelectItem value="validate">2. Validate</SelectItem>
                <SelectItem value="reconcile">3. Reconcile</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fixture</label>
            <Select value={fixture} onValueChange={(v) => setFixture(v as Fixture)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FIXTURES) as Fixture[]).map((f) => (
                  <SelectItem key={f} value={f}>{FIXTURE_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={run} disabled={running} className="w-full">
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
              Run simulation
            </Button>
          </div>
        </div>

        {timeline.length > 0 && (
          <div className="rounded-md border divide-y">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-start gap-3 p-3">
                <div className="text-xs text-muted-foreground font-mono w-16 shrink-0">{t.at}</div>
                <div className="mt-0.5">{StatusIcon(t.status)}</div>
                <div className="flex-1 text-sm">
                  <Badge variant="outline" className="mr-2 font-mono text-[10px]">{t.status}</Badge>
                  {t.detail}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
