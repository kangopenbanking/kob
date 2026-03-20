import { useState } from "react";
import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { StatusBadge } from "@/components/institution/connector/StatusBadge";
import { ConnectorEmptyState } from "@/components/institution/connector/ConnectorEmptyState";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Upload, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ConnectorStatus() {
  const { bankId, loading: bankLoading } = useBankConnector();
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
      // Parse CSV and update batch items
      const text = await statusFile.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) throw new Error("Status file must have a header row and at least one data row");

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const refIdx = header.indexOf("reference");
      const statusIdx = header.indexOf("status");
      const codeIdx = header.indexOf("response_code");
      const msgIdx = header.indexOf("response_message");

      if (refIdx === -1 || statusIdx === -1) throw new Error("Status file must have 'reference' and 'status' columns");

      let updated = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const ref = cols[refIdx];
        const status = cols[statusIdx];
        if (!ref || !status) continue;

        const updateData: any = { status };
        if (codeIdx !== -1) updateData.bank_response_code = cols[codeIdx] || null;
        if (msgIdx !== -1) updateData.bank_response_message = cols[msgIdx] || null;

        const { error } = await supabase
          .from("bank_batch_items")
          .update(updateData)
          .eq("reference", ref);
        if (!error) updated++;
      }

      toast.success(`Status file processed: ${updated} items updated`);
      setStatusFile(null);
    } catch (err: any) {
      toast.error(err.message || "Status upload failed");
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
          <p className="text-xs text-muted-foreground mt-2">Required columns: reference, status. Optional: response_code, response_message</p>
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
