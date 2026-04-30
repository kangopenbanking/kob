// Admin-only: replay any saved webhook_inbox event through the matching
// gateway-webhook-* receiver and inspect the verifier's response. Useful for
// confirming signature verification, idempotency behaviour, and error codes.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Play, RefreshCw, ShieldCheck, ShieldAlert, Repeat } from "lucide-react";
import { toast } from "sonner";

type InboxRow = {
  id: string;
  source: string;
  event_id: string | null;
  is_processed: boolean | null;
  processed_at: string | null;
  processing_error: string | null;
  signature: string | null;
  created_at: string;
};

type ReplayResult = {
  status: number;
  code: string | null;
  signature_valid: boolean;
  idempotent_skip: boolean;
  body: unknown;
};

const PROVIDERS = ["all", "stripe", "flutterwave", "paypal"] as const;

export default function AdminWebhookReplay() {
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; data: ReplayResult } | null>(null);

  async function loadRows() {
    setLoading(true);
    let q = supabase
      .from("webhook_inbox")
      .select("id, source, event_id, is_processed, processed_at, processing_error, signature, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (provider !== "all") q = q.eq("source", provider);
    if (search.trim()) q = q.ilike("event_id", `%${search.trim()}%`);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setRows((data as InboxRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadRows(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [provider]);

  async function replay(row: InboxRow) {
    setReplayingId(row.id);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-webhook-replay", {
        body: { inbox_id: row.id },
      });
      if (error) throw error;
      const r: ReplayResult = data?.result;
      setResult({ id: row.id, data: r });
      toast.success(`Replay finished: ${r.status} ${r.code ?? ""}`.trim());
      await loadRows();
    } catch (err: any) {
      toast.error(err?.message ?? "Replay failed");
    } finally {
      setReplayingId(null);
    }
  }

  const noSignatureCount = useMemo(
    () => rows.filter((r) => !r.signature).length,
    [rows],
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <SEO
        title="Webhook Replay — Admin | Kang Open Banking"
        description="Replay saved provider webhook events to verify signature handling and idempotency."
      />

      <header className="space-y-2">
        <Badge variant="outline">Admin · Webhook Tools</Badge>
        <h1 className="text-2xl font-bold">Webhook Replay</h1>
        <p className="text-sm text-muted-foreground">
          Replay any saved <code>webhook_inbox</code> event through its matching internal
          receiver. The receiver re-runs full signature verification and idempotency
          handling — exactly as it would for a live provider delivery.
        </p>
      </header>

      {noSignatureCount > 0 && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Some events cannot be replayed</AlertTitle>
          <AlertDescription>
            {noSignatureCount} of the {rows.length} loaded events have no stored signature
            and will return <code>missing_signature_on_inbox</code> if replayed. These were
            captured before signature persistence was enabled.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent inbox events</CardTitle>
          <CardDescription>Showing the 50 most recent events for the selected provider.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{p === "all" ? "All providers" : p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Filter by event_id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadRows()}
              className="max-w-xs"
            />
            <Button variant="outline" onClick={loadRows} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Event ID</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signature</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No events found.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="secondary">{r.source}</Badge></TableCell>
                    <TableCell className="font-mono text-xs break-all">{r.event_id ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {r.processing_error ? (
                        <Badge variant="destructive">{r.processing_error}</Badge>
                      ) : r.is_processed ? (
                        <Badge>processed</Badge>
                      ) : (
                        <Badge variant="outline">pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.signature ? (
                        <Badge variant="outline" className="gap-1">
                          <ShieldCheck className="h-3 w-3" /> stored
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <ShieldAlert className="h-3 w-3" /> missing
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => replay(r)}
                        disabled={replayingId === r.id}
                      >
                        {replayingId === r.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Play className="h-3.5 w-3.5" />}
                        <span className="ml-2">Replay</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Replay result</CardTitle>
            </div>
            <CardDescription>
              Inbox <code className="text-xs">{result.id}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">HTTP status</div>
                <div className="font-medium">{result.data.status}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Code</div>
                <div className="font-medium">{result.data.code ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Signature valid</div>
                <Badge variant={result.data.signature_valid ? "default" : "destructive"}>
                  {String(result.data.signature_valid)}
                </Badge>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Idempotent skip</div>
                <Badge variant={result.data.idempotent_skip ? "default" : "outline"}>
                  {String(result.data.idempotent_skip)}
                </Badge>
              </div>
            </div>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto max-h-80">
              {JSON.stringify(result.data.body, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
