import { useState } from "react";
import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { StatusBadge } from "@/components/institution/connector/StatusBadge";
import { ConnectorEmptyState } from "@/components/institution/connector/ConnectorEmptyState";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Upload, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ConnectorStatus() {
  const { bankId, loading: bankLoading } = useBankConnector();
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [statusFile, setStatusFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: batches } = useQuery({
    queryKey: ["connector-status-batches", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("bank_batch_jobs")
        .select("id, batch_type, status, created_at, totals_json")
        .eq("bank_id", bankId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!bankId,
  });

  const { data: statusEvents, isLoading } = useQuery({
    queryKey: ["connector-status-events", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data: batchIds } = await supabase
        .from("bank_batch_jobs")
        .select("id")
        .eq("bank_id", bankId);
      if (!batchIds || batchIds.length === 0) return [];

      const { data: items } = await supabase
        .from("bank_batch_items")
        .select("id, batch_id, beneficiary_name, amount, status, reference, bank_response_code, bank_response_message")
        .in("batch_id", batchIds.map((b) => b.id))
        .order("created_at", { ascending: false })
        .limit(100);
      return items ?? [];
    },
    enabled: !!bankId,
  });

  const handleUploadStatus = async () => {
    if (!statusFile || !bankId) return;
    setUploading(true);
    try {
      const fileContent = await statusFile.text();

      // Step 1: Upload status file to storage via edge function
      const { data: uploadResult, error: uploadErr } = await supabase.functions.invoke("bank-file-connector", {
        body: {
          action: "upload_file",
          bank_id: bankId,
          file_type: "payment_status",
          environment: "sandbox",
          file_content: fileContent,
          filename: statusFile.name,
          uploaded_by: "portal",
        },
      });

      if (uploadErr) throw uploadErr;
      if (uploadResult?.error) throw new Error(uploadResult.error);

      const fileId = uploadResult?.file?.id;
      if (!fileId) throw new Error("File registration failed");

      // Step 2: Trigger status file ingestion via edge function
      const { data: ingestResult, error: ingestErr } = await supabase.functions.invoke("bank-file-connector", {
        body: { action: "ingest_status_file", file_id: fileId },
      });

      if (ingestErr) throw ingestErr;
      if (ingestResult?.error) throw new Error(ingestResult.error);

      const summary = ingestResult?.summary;
      toast.success(
        `Status file processed: ${summary?.matched ?? 0} matched, ${summary?.executed ?? 0} executed, ${summary?.failed ?? 0} failed, ${summary?.unmatched ?? 0} unmatched`
      );

      if (summary?.unmatched > 0 && ingestResult?.mismatches?.length > 0) {
        toast.warning(`${summary.unmatched} unmatched references detected — check reconciliation`);
      }

      setStatusFile(null);
      queryClient.invalidateQueries({ queryKey: ["connector-status-events"] });
      queryClient.invalidateQueries({ queryKey: ["connector-batches"] });
    } catch (err: any) {
      const msg = err?.message || "Status upload failed";
      if (msg.includes("Duplicate file")) {
        toast.error("This status file has already been uploaded");
      } else {
        toast.error(msg);
      }
    } finally {
      setUploading(false);
    }
  };

  if (bankLoading) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={ClipboardList} title="Status Files" description="Loading..." />
        <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!bankId) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={ClipboardList} title="Status Files" description="Upload execution result files" />
        <ConnectorEmptyState icon={ClipboardList} title="No Bank Connected" description="Link a bank profile to manage status files." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConnectorPageHeader icon={ClipboardList} title="Status Files" description="Upload bank execution status files and track batch item results" />

      {/* Upload Status File */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Upload Status File</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Batch (optional)</label>
              <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger className="w-60"><SelectValue placeholder="Auto-match by reference" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto-match by reference</SelectItem>
                  {batches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {format(new Date(b.created_at), "MMM d")} — {b.batch_type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status CSV</label>
              <Input type="file" accept=".csv" onChange={(e) => setStatusFile(e.target.files?.[0] ?? null)} className="w-64" />
            </div>
            <Button onClick={handleUploadStatus} disabled={!statusFile || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Process Status
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Required columns: reference, status. Optional: executed_at, bank_tx_id, reason_code, reason_message</p>
        </CardContent>
      </Card>

      {/* Batch Items Status Table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Batch Item Statuses</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : statusEvents && statusEvents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Beneficiary</th>
                    <th className="text-left p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Reference</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Response</th>
                  </tr>
                </thead>
                <tbody>
                  {statusEvents.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3">{item.beneficiary_name}</td>
                      <td className="p-3 font-medium">{item.amount.toLocaleString()} XAF</td>
                      <td className="p-3 font-mono text-xs">{item.reference}</td>
                      <td className="p-3"><StatusBadge status={item.status} /></td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {item.bank_response_code && <span className="font-mono">[{item.bank_response_code}]</span>}
                        {item.bank_response_message && ` ${item.bank_response_message}`}
                        {!item.bank_response_code && !item.bank_response_message && "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ConnectorEmptyState
              icon={ClipboardList}
              title="No Status Data"
              description="Upload a status file after your bank has processed a batch payment instruction."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
