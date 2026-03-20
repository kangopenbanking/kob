import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, FileText, CreditCard } from "lucide-react";
import { format } from "date-fns";

const invokeFileConnector = async (action: string, params: any = {}) => {
  const { data, error } = await supabase.functions.invoke("bank-file-connector", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
};

export default function ReconciliationDashboard() {
  const { data: reconciliations, isLoading, refetch } = useQuery({
    queryKey: ["admin-reconciliations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_reconciliations")
        .select("*, bank_connections(bank_name, institution_id)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: mmTransactions } = useQuery({
    queryKey: ["admin-mm-settlement-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mobile_money_transactions")
        .select("status, amount, currency")
        .eq("is_kob_facilitated", true)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: btTransactions } = useQuery({
    queryKey: ["admin-bt-settlement-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transfer_transactions")
        .select("status, amount, currency")
        .eq("is_kob_facilitated", true)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: batchesData } = useQuery({
    queryKey: ["recon-batches"],
    queryFn: () => invokeFileConnector("list_batches"),
  });

  const { data: ingestionData } = useQuery({
    queryKey: ["recon-ingestion-files"],
    queryFn: () => invokeFileConnector("list_files", { file_type: "payment_status" }),
  });

  const batches = batchesData?.batches || [];
  const statusFiles = ingestionData?.files || [];

  const mmStats = {
    total: mmTransactions?.length || 0,
    completed: mmTransactions?.filter((t) => t.status === "completed").length || 0,
    volume: mmTransactions?.filter((t) => t.status === "completed").reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
  };

  const btStats = {
    total: btTransactions?.length || 0,
    completed: btTransactions?.filter((t) => t.status === "completed").length || 0,
    volume: btTransactions?.filter((t) => t.status === "completed").reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
  };

  const batchStats = {
    total: batches.length,
    executed: batches.filter((b: any) => b.status === "executed").length,
    partial: batches.filter((b: any) => b.status === "partially_failed").length,
    failed: batches.filter((b: any) => b.status === "failed").length,
    pending: batches.filter((b: any) => ["draft", "generated", "delivered"].includes(b.status)).length,
  };

  const getStatusBadge = (status: string) => {
    if (status === "completed" || status === "executed" || status === "reconciled") return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
    if (status === "in_progress" || status === "generated" || status === "delivered") return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1" />{status}</Badge>;
    if (status === "failed") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    if (status === "partially_failed") return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"><AlertTriangle className="h-3 w-3 mr-1" />Partial</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reconciliation Dashboard</h1>
          <p className="text-muted-foreground mt-2">Cross-channel reconciliation for Mobile Money, Cards, Bank Transfers, and File-Based Batches</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Mobile Money Volume</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mmStats.volume)}</div>
            <p className="text-xs text-muted-foreground">{mmStats.completed}/{mmStats.total} completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Bank Transfer Volume</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(btStats.volume)}</div>
            <p className="text-xs text-muted-foreground">{btStats.completed}/{btStats.total} completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Reconciliations</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reconciliations?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Bank reconciliation records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">File-Based Batches</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batchStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {batchStats.executed} executed · {batchStats.partial} partial · {batchStats.pending} pending
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bank-recon">
        <TabsList>
          <TabsTrigger value="bank-recon"><FileText className="h-4 w-4 mr-1" />Bank Reconciliation</TabsTrigger>
          <TabsTrigger value="batch-recon"><CreditCard className="h-4 w-4 mr-1" />Batch Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="bank-recon">
          <Card>
            <CardHeader>
              <CardTitle>Bank Reconciliation History</CardTitle>
              <CardDescription>Settlement matching results across all connected banks</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Loading...</p>
              ) : reconciliations?.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No reconciliation records found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Matched</TableHead>
                      <TableHead>Unmatched (Bank)</TableHead>
                      <TableHead>Unmatched (System)</TableHead>
                      <TableHead>Discrepancies</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliations?.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-mono text-xs">{format(new Date(rec.reconciliation_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{(rec.bank_connections as any)?.bank_name || "Unknown"}</TableCell>
                        <TableCell>{getStatusBadge(rec.status)}</TableCell>
                        <TableCell className="text-green-600 font-medium">{rec.matched_count || 0}</TableCell>
                        <TableCell className="text-yellow-600">{rec.unmatched_bank_count || 0}</TableCell>
                        <TableCell className="text-orange-600">{rec.unmatched_system_count || 0}</TableCell>
                        <TableCell>{rec.discrepancies ? <Badge variant="destructive">Has Issues</Badge> : <Badge variant="outline">Clean</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch-recon">
          <Card>
            <CardHeader>
              <CardTitle>File-Based Batch Reconciliation</CardTitle>
              <CardDescription>Batch payment jobs and status file ingestion results</CardDescription>
            </CardHeader>
            <CardContent>
              {batches.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No batch payment jobs found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch ID</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">{b.id?.slice(0, 8)}</TableCell>
                        <TableCell>{b.banks?.display_name || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{b.batch_type}</Badge></TableCell>
                        <TableCell>{b.totals_json?.count || 0}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(b.totals_json?.total_amount || 0)}</TableCell>
                        <TableCell>{getStatusBadge(b.status)}</TableCell>
                        <TableCell className="text-xs">{new Date(b.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {statusFiles.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-2">Status File History</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Filename</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Received</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statusFiles.map((f: any) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-mono text-xs">{f.original_filename}</TableCell>
                          <TableCell>{f.banks?.display_name || "—"}</TableCell>
                          <TableCell>{getStatusBadge(f.status)}</TableCell>
                          <TableCell className="text-xs">{new Date(f.received_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
