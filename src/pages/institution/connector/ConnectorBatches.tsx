import { useState } from "react";
import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { StatusBadge } from "@/components/institution/connector/StatusBadge";
import { ConnectorEmptyState } from "@/components/institution/connector/ConnectorEmptyState";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, Plus, Download, Loader2, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface BatchItem {
  beneficiary_name: string;
  beneficiary_account_number: string;
  beneficiary_bank_code: string;
  amount: string;
  narration: string;
}

export default function ConnectorBatches() {
  const { bankId, loading: bankLoading } = useBankConnector();
  const [showCreate, setShowCreate] = useState(false);
  const [batchType, setBatchType] = useState("outgoing_transfers");
  const [items, setItems] = useState<BatchItem[]>([{ beneficiary_name: "", beneficiary_account_number: "", beneficiary_bank_code: "", amount: "", narration: "" }]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<string>("csv");
  const queryClient = useQueryClient();

  const { data: batches, isLoading } = useQuery({
    queryKey: ["connector-batches", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("bank_batch_jobs")
        .select("*, bank_batch_items(count)")
        .eq("bank_id", bankId)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!bankId,
  });

  const createBatch = useMutation({
    mutationFn: async () => {
      if (!bankId) throw new Error("No bank");
      const { data: { user } } = await supabase.auth.getUser();
      const validItems = items.filter((i) => i.beneficiary_name && i.amount && parseFloat(i.amount) > 0);
      if (validItems.length === 0) throw new Error("Add at least one valid payment item");

      const { data, error } = await supabase.functions.invoke("bank-file-connector", {
        body: {
          action: "create_batch",
          bank_id: bankId,
          environment: "sandbox",
          batch_type: batchType,
          created_by: user?.id,
          items: validItems.map((i) => ({
            beneficiary_name: i.beneficiary_name,
            beneficiary_account_number: i.beneficiary_account_number,
            beneficiary_bank_code: i.beneficiary_bank_code || null,
            amount: parseFloat(i.amount),
            currency: "XAF",
            narration: i.narration || null,
          })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Batch created via backend");
      setShowCreate(false);
      setItems([{ beneficiary_name: "", beneficiary_account_number: "", beneficiary_bank_code: "", amount: "", narration: "" }]);
      queryClient.invalidateQueries({ queryKey: ["connector-batches"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleGenerateFile = async (batchId: string, fmt: string) => {
    setGenerating(batchId);
    try {
      const { data, error } = await supabase.functions.invoke("bank-file-connector", {
        body: { action: "generate_batch_file", batch_id: batchId, format: fmt },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // The edge function returns the file content — trigger download
      if (data?.content) {
        const ext = fmt === "pain001" ? "xml" : "csv";
        const mimeType = fmt === "pain001" ? "application/xml" : "text/csv";
        const blob = new Blob([data.content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batch_${batchId.slice(0, 8)}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`${fmt === "pain001" ? "ISO 20022 pain.001" : "CSV"} file generated & stored`);
      queryClient.invalidateQueries({ queryKey: ["connector-batches"] });
    } catch (err: any) {
      toast.error(err?.message || "File generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const addItem = () => setItems([...items, { beneficiary_name: "", beneficiary_account_number: "", beneficiary_bank_code: "", amount: "", narration: "" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof BatchItem, value: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  if (bankLoading) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={Banknote} title="Batch Payments" description="Loading..." />
        <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!bankId) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={Banknote} title="Batch Payments" description="Generate payment instruction files" />
        <ConnectorEmptyState icon={Banknote} title="No Bank Connected" description="Link a bank profile to manage batch payments." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConnectorPageHeader icon={Banknote} title="Batch Payments" description="Create batch payment jobs and generate instruction files">
        <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Batch
        </Button>
      </ConnectorPageHeader>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : batches && batches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Items</th>
                    <th className="text-left p-3 font-medium">Total</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const totals = b.totals_json as any;
                    return (
                      <tr key={b.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 whitespace-nowrap">{format(new Date(b.created_at), "MMM d, HH:mm")}</td>
                        <td className="p-3 capitalize">{b.batch_type.replace(/_/g, " ")}</td>
                        <td className="p-3">{totals?.items_count ?? totals?.count ?? "—"}</td>
                        <td className="p-3 font-medium">{(totals?.total_amount ?? 0).toLocaleString()} {totals?.currency ?? "XAF"}</td>
                        <td className="p-3"><StatusBadge status={b.status} /></td>
                        <td className="p-3 text-right flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerateFile(b.id, "csv")}
                            disabled={generating === b.id}
                            title="Generate CSV"
                          >
                            {generating === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerateFile(b.id, "pain001")}
                            disabled={generating === b.id}
                            title="Generate ISO 20022 pain.001"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <ConnectorEmptyState
              icon={Banknote}
              title="No Batch Payments"
              description="Create your first batch payment job to generate instruction files for your bank."
              actionLabel="Create Batch"
              onAction={() => setShowCreate(true)}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Batch Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Batch Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Batch Type</label>
              <Select value={batchType} onValueChange={setBatchType}>
                <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outgoing_transfers">Outgoing Transfers</SelectItem>
                  <SelectItem value="salary">Salary Payments</SelectItem>
                  <SelectItem value="merchant_payouts">Merchant Payouts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Payment Items</p>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-6 gap-2 items-end">
                  <Input placeholder="Name" value={item.beneficiary_name} onChange={(e) => updateItem(idx, "beneficiary_name", e.target.value)} className="col-span-1" />
                  <Input placeholder="Account #" value={item.beneficiary_account_number} onChange={(e) => updateItem(idx, "beneficiary_account_number", e.target.value)} className="col-span-1" />
                  <Input placeholder="Bank Code" value={item.beneficiary_bank_code} onChange={(e) => updateItem(idx, "beneficiary_bank_code", e.target.value)} className="col-span-1" />
                  <Input placeholder="Amount" type="number" value={item.amount} onChange={(e) => updateItem(idx, "amount", e.target.value)} className="col-span-1" />
                  <Input placeholder="Narration" value={item.narration} onChange={(e) => updateItem(idx, "narration", e.target.value)} className="col-span-1" />
                  <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} disabled={items.length === 1}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createBatch.mutate()} disabled={createBatch.isPending}>
              {createBatch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
