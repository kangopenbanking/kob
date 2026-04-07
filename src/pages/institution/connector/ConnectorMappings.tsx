import { useState } from "react";
import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { StatusBadge } from "@/components/institution/connector/StatusBadge";
import { ConnectorEmptyState } from "@/components/institution/connector/ConnectorEmptyState";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GitBranch, Plus, Copy, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const FILE_TYPES = ["accounts", "balances", "transactions", "beneficiaries"];

const CANONICAL_FIELDS: Record<string, string[]> = {
  accounts: ["account_number", "account_holder_name", "account_type", "currency", "status", "opened_date"],
  balances: ["account_number", "balance_type", "amount", "currency", "balance_date"],
  transactions: ["account_number", "transaction_id", "amount", "currency", "credit_debit", "date", "description", "reference"],
  beneficiaries: ["account_number", "beneficiary_name", "bank_code", "reference"],
};

export default function ConnectorMappings() {
  const { bankId, loading: bankLoading } = useBankConnector();
  const [activeTab, setActiveTab] = useState("accounts");
  const [showEditor, setShowEditor] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMapping, setEditMapping] = useState("{}");
  const queryClient = useQueryClient();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["connector-mappings", bankId, activeTab],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("bank_data_mappings")
        .select("*")
        .eq("bank_id", bankId)
        .eq("file_type", activeTab)
        .order("version", { ascending: false });
      return data ?? [];
    },
    enabled: !!bankId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!bankId) throw new Error("No bank");
      const maxVersion = mappings?.length ? Math.max(...mappings.map((m) => m.version)) : 0;
      let parsedMapping: any;
      try { parsedMapping = JSON.parse(editMapping); } catch { throw new Error("Invalid JSON mapping"); }
      const { error } = await supabase.from("bank_data_mappings").insert({
        bank_id: bankId,
        file_type: activeTab,
        version: maxVersion + 1,
        mapping_json: parsedMapping,
        is_active: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mapping created"); setShowEditor(false); queryClient.invalidateQueries({ queryKey: ["connector-mappings"] }); },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err)),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, activate }: { id: string; activate: boolean }) => {
      if (activate && bankId) {
        // Deactivate all others first
        await supabase.from("bank_data_mappings").update({ is_active: false }).eq("bank_id", bankId).eq("file_type", activeTab);
      }
      const { error } = await supabase.from("bank_data_mappings").update({ is_active: activate }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mapping updated"); queryClient.invalidateQueries({ queryKey: ["connector-mappings"] }); },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err)),
  });

  if (bankLoading) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={GitBranch} title="Mapping Profiles" description="Loading..." />
        <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!bankId) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={GitBranch} title="Mapping Profiles" description="Map CSV columns to canonical fields" />
        <ConnectorEmptyState icon={GitBranch} title="No Bank Connected" description="Link a bank profile to manage mapping profiles." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConnectorPageHeader icon={GitBranch} title="Mapping Profiles" description="Map bank CSV columns to KOB canonical schema">
        <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => { setEditMapping("{}"); setShowEditor(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Profile
        </Button>
      </ConnectorPageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {FILE_TYPES.map((ft) => <TabsTrigger key={ft} value={ft} className="capitalize">{ft}</TabsTrigger>)}
        </TabsList>

        {FILE_TYPES.map((ft) => (
          <TabsContent key={ft} value={ft}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : mappings && mappings.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Version</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Created</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m) => (
                        <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-3 font-medium">v{m.version}</td>
                          <td className="p-3"><StatusBadge status={m.is_active ? "active" : "inactive"} /></td>
                          <td className="p-3">{format(new Date(m.created_at), "MMM d, yyyy")}</td>
                          <td className="p-3 text-right space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate({ id: m.id, activate: !m.is_active })}>
                              {m.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                              setEditMapping(JSON.stringify(m.mapping_json, null, 2));
                              setShowEditor(true);
                            }}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : (
              <ConnectorEmptyState
                icon={GitBranch}
                title={`No ${ft} Mapping Profiles`}
                description="Create a mapping profile to define how your CSV columns map to the canonical schema."
                actionLabel="Create Profile"
                onAction={() => { setEditMapping("{}"); setShowEditor(true); }}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Canonical Fields Reference */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Canonical Fields — {activeTab}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(CANONICAL_FIELDS[activeTab] ?? []).map((f) => (
              <span key={f} className="px-2 py-1 bg-muted rounded text-xs font-mono">{f}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Mapping Profile — {activeTab}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Define field mappings as JSON. Map your CSV column names to the canonical field names above.</p>
            <Textarea value={editMapping} onChange={(e) => setEditMapping(e.target.value)} rows={12} className="font-mono text-xs" placeholder='{"csv_column": "canonical_field"}' />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save as New Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
