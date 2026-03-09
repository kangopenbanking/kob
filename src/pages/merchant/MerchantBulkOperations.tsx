import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, Users, DollarSign, Undo2, FileSpreadsheet, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface BulkJob {
  id: string;
  type: string;
  status: string;
  total_records: number;
  processed_records: number;
  failed_records: number;
  created_at: string;
  completed_at: string | null;
  file_name: string | null;
}

export default function MerchantBulkOperations() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("payouts");

  const { data: merchant } = useQuery({
    queryKey: ["merchant-bulk-ops"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data } = await (supabase as any)
        .from("gateway_merchants")
        .select("id, business_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: bulkJobs = [], isLoading } = useQuery({
    queryKey: ["bulk-jobs", merchant?.id],
    enabled: !!merchant?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gateway_bulk_operations")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as BulkJob[];
    },
  });

  const initBulkMutation = useMutation({
    mutationFn: async (type: string) => {
      if (!merchant?.id) throw new Error("No merchant");
      const { data, error } = await supabase.functions.invoke("gateway-bulk-operations", {
        body: { action: "initiate", merchant_id: merchant.id, operation_type: type },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] });
      toast.success("Bulk operation initiated");
    },
    onError: () => toast.error("Failed to initiate bulk operation"),
  });

  const handleFileUpload = async (type: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      toast.info(`Processing ${file.name} for bulk ${type}...`);
      initBulkMutation.mutate(type);
    };
    input.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-500/10 text-green-600 border-0"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
      case "failed": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case "processing": return <Badge className="bg-blue-500/10 text-blue-600 border-0"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing</Badge>;
      default: return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  const operationTypes = [
    {
      key: "payouts",
      label: "Bulk Payouts",
      icon: DollarSign,
      desc: "Send payments to multiple recipients at once via CSV upload",
      templateHeaders: "recipient_account,bank_code,amount,currency,narration",
    },
    {
      key: "refunds",
      label: "Bulk Refunds",
      icon: Undo2,
      desc: "Process refunds for multiple transactions simultaneously",
      templateHeaders: "transaction_ref,amount,reason",
    },
    {
      key: "customers",
      label: "Customer Import",
      icon: Users,
      desc: "Import customer data in bulk from CSV or spreadsheet",
      templateHeaders: "email,name,phone,metadata",
    },
  ];

  const downloadTemplate = (type: string) => {
    const op = operationTypes.find((o) => o.key === type);
    if (!op) return;
    const blob = new Blob([op.templateHeaders + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-${type}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bulk Operations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Process large-scale payouts, refunds, and imports efficiently
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          {operationTypes.map((op) => (
            <TabsTrigger key={op.key} value={op.key}>
              <op.icon className="h-4 w-4 mr-1" /> {op.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {operationTypes.map((op) => (
          <TabsContent key={op.key} value={op.key}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <op.icon className="h-5 w-5" /> {op.label}
                  </CardTitle>
                  <CardDescription>{op.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Button onClick={() => handleFileUpload(op.key)} disabled={initBulkMutation.isPending}>
                      <Upload className="h-4 w-4 mr-1" /> Upload CSV
                    </Button>
                    <Button variant="outline" onClick={() => downloadTemplate(op.key)}>
                      <Download className="h-4 w-4 mr-1" /> Download Template
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Jobs</span>
                      <span className="font-medium">
                        {bulkJobs.filter((j) => j.type === op.key).length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Records Processed</span>
                      <span className="font-medium">
                        {bulkJobs
                          .filter((j) => j.type === op.key)
                          .reduce((sum, j) => sum + (j.processed_records || 0), 0)
                          .toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Success Rate</span>
                      <span className="font-medium text-green-600">
                        {(() => {
                          const jobs = bulkJobs.filter((j) => j.type === op.key && j.total_records > 0);
                          if (!jobs.length) return "N/A";
                          const total = jobs.reduce((s, j) => s + j.total_records, 0);
                          const failed = jobs.reduce((s, j) => s + (j.failed_records || 0), 0);
                          return total > 0 ? `${(((total - failed) / total) * 100).toFixed(1)}%` : "N/A";
                        })()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Job History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Operation History</CardTitle>
          <CardDescription>Track progress of all bulk operations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : bulkJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No bulk operations yet</p>
              <p className="text-sm">Upload a CSV file to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium capitalize">{job.type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{job.file_name || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-[150px]">
                        <Progress
                          value={job.total_records > 0 ? (job.processed_records / job.total_records) * 100 : 0}
                          className="h-2"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {job.processed_records}/{job.total_records}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(job.created_at), "MMM d, HH:mm")}
                    </TableCell>
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
