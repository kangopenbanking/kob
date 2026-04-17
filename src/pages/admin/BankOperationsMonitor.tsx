// Wave 5A/5C — Admin monitor for bank polling jobs and the retry queue.
// Read-only dashboard surfacing operational health: last run, next run,
// failure counts, dead-lettered retries.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface SyncJob {
  id: string;
  bank_id: string;
  op_type: string;
  external_account_id: string | null;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  consecutive_failures: number;
  backoff_seconds: number;
}

interface RetryRow {
  id: string;
  bank_id: string;
  operation: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  dead_lettered_at: string | null;
  created_at: string;
}

const StatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return <Badge variant="outline">unknown</Badge>;
  if (status === "ok" || status === "completed") {
    return <Badge variant="outline" className="border-primary text-primary"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
  }
  if (status === "failed" || status === "dead_letter") {
    return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{status}</Badge>;
  }
  if (status === "pending" || status === "processing") {
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
};

export default function BankOperationsMonitor() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [retries, setRetries] = useState<RetryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [jobsRes, retriesRes] = await Promise.all([
      supabase.from("bank_sync_jobs").select("*").order("next_run_at", { ascending: true }).limit(100),
      supabase.from("bank_retry_queue").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (jobsRes.data) setJobs(jobsRes.data as unknown as SyncJob[]);
    if (retriesRes.data) setRetries(retriesRes.data as unknown as RetryRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bank Operations Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live status of polling jobs and retry queue across all configured banks.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Polling jobs ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operation</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead className="text-right">Failures</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.op_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {j.external_account_id ?? "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={j.last_status} /></TableCell>
                  <TableCell className="text-xs">
                    {j.last_run_at ? new Date(j.last_run_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {j.next_run_at ? new Date(j.next_run_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">{j.consecutive_failures}</TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No polling jobs configured yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retry queue ({retries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Next attempt</TableHead>
                <TableHead>Last error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {retries.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.operation}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-xs">{r.attempt_count} / {r.max_attempts}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(r.next_attempt_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                    {r.last_error ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {retries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Retry queue is empty.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
