import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { StatusBadge } from "@/components/institution/connector/StatusBadge";
import { ConnectorEmptyState } from "@/components/institution/connector/ConnectorEmptyState";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Activity, Upload, FileText, AlertTriangle, Banknote, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function ConnectorOverview() {
  const { bankId, bankName, loading: bankLoading } = useBankConnector();
  const navigate = useNavigate();

  const { data: uploads, isLoading: uploadsLoading } = useQuery({
    queryKey: ["connector-overview-uploads", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("bank_file_uploads")
        .select("id, file_type, status, received_at")
        .eq("bank_id", bankId)
        .order("received_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!bankId,
  });

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["connector-overview-batches", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("bank_batch_jobs")
        .select("id, status, created_at, totals_json")
        .eq("bank_id", bankId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!bankId,
  });

  const { data: recentRuns } = useQuery({
    queryKey: ["connector-overview-runs", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("ingestion_runs")
        .select("id, status, started_at, finished_at, totals_json, file_id")
        .eq("bank_id", bankId)
        .order("started_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!bankId,
  });

  if (bankLoading) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={Activity} title="Connector Overview" description="Loading..." />
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!bankId) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={Activity} title="Connector Overview" description="File-based bank integration hub" />
        <ConnectorEmptyState
          icon={Activity}
          title="No Bank Connected"
          description="Your institution doesn't have an active bank profile linked. Contact your administrator to set up the bank connector."
        />
      </div>
    );
  }

  const fileTypes = ["accounts", "balances", "transactions", "beneficiaries"];
  const lastImports = fileTypes.map((ft) => {
    const latest = uploads?.find((u) => u.file_type === ft);
    return { type: ft, latest };
  });

  const last7DaysUploads = uploads?.filter((u) => {
    const d = new Date(u.received_at);
    return d > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }) ?? [];
  const successCount = last7DaysUploads.filter((u) => u.status === "processed").length;
  const failCount = last7DaysUploads.filter((u) => u.status === "failed").length;

  return (
    <div className="space-y-6">
      <ConnectorPageHeader icon={Activity} title="Connector Overview" description={`File-based integration for ${bankName ?? "your bank"}`}>
        <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/fi-portal/connector/templates")}>
          <FileText className="h-4 w-4 mr-2" /> Templates
        </Button>
      </ConnectorPageHeader>

      {/* Integration Mode */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 dark:bg-blue-900/30 p-2.5">
              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold">Integration Mode: File (SFTP / Portal)</p>
              <p className="text-sm text-muted-foreground">Upload CSV files to sync accounts, balances, transactions, and beneficiaries</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Freshness Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {lastImports.map(({ type, latest }) => (
          <Card key={type}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{type}</p>
              {latest ? (
                <div className="mt-1">
                  <p className="text-sm font-medium">{format(new Date(latest.received_at), "MMM d, yyyy HH:mm")}</p>
                  <StatusBadge status={latest.status} className="mt-1" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">No imports yet</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Import Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Import Health (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{successCount}</span>
              <span className="text-sm text-muted-foreground">Successful</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{failCount}</span>
              <span className="text-sm text-muted-foreground">Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{last7DaysUploads.length}</span>
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/fi-portal/connector/uploads")}>
              <Upload className="h-4 w-4 mr-2" /> Upload File
            </Button>
            <Button variant="outline" onClick={() => navigate("/fi-portal/connector/batches")}>
              <Banknote className="h-4 w-4 mr-2" /> Generate Batch Payment
            </Button>
            <Button variant="outline" onClick={() => navigate("/fi-portal/connector/status")}>
              <FileText className="h-4 w-4 mr-2" /> Upload Status File
            </Button>
            {failCount > 0 && (
              <Button variant="outline" onClick={() => navigate("/fi-portal/connector/uploads")}>
                <AlertTriangle className="h-4 w-4 mr-2" /> View Errors ({failCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns && recentRuns.length > 0 ? (
            <div className="space-y-3">
              {recentRuns.slice(0, 5).map((run) => {
                const totals = run.totals_json as any;
                return (
                  <div key={run.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">Ingestion Run</p>
                      <p className="text-xs text-muted-foreground">
                        {run.started_at ? format(new Date(run.started_at), "MMM d, HH:mm") : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {totals && (
                        <span className="text-xs text-muted-foreground">
                          {totals.rows_ok ?? 0} ok / {totals.rows_invalid ?? 0} invalid
                        </span>
                      )}
                      <StatusBadge status={run.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
