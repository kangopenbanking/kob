import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Download } from "lucide-react";
import { format } from "date-fns";

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

  const getStatusBadge = (status: string) => {
    if (status === "completed") return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    if (status === "in_progress") return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1" />In Progress</Badge>;
    if (status === "failed") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reconciliation Dashboard</h1>
          <p className="text-muted-foreground mt-2">Cross-channel reconciliation for Mobile Money, Cards, and Bank Transfers</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

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
    </div>
  );
}
