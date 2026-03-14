import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Store, Eye, Shield, CheckCircle, XCircle, AlertCircle, Key, Landmark, Clock, Ban, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function MerchantManagement() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null);
  const [kybDecision, setKybDecision] = useState<"approved" | "rejected" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [actionTarget, setActionTarget] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: merchants, isLoading } = useQuery({
    queryKey: ["admin-gateway-merchants"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("gateway_merchants")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: apiKeys } = useQuery({
    queryKey: ["admin-merchant-keys", selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return [];
      const { data } = await (supabase as any)
        .from("gateway_merchant_api_keys")
        .select("*")
        .eq("merchant_id", selectedMerchant.id);
      return data || [];
    },
    enabled: !!selectedMerchant,
  });

  const { data: settlements } = useQuery({
    queryKey: ["admin-merchant-settlements", selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return [];
      const { data } = await (supabase as any)
        .from("gateway_merchant_settlement_accounts")
        .select("*")
        .eq("merchant_id", selectedMerchant.id);
      return data || [];
    },
    enabled: !!selectedMerchant,
  });

  const { data: webhooks } = useQuery({
    queryKey: ["admin-merchant-webhooks", selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return [];
      const { data } = await (supabase as any)
        .from("gateway_merchant_webhooks")
        .select("*")
        .eq("merchant_id", selectedMerchant.id);
      return data || [];
    },
    enabled: !!selectedMerchant,
  });

  const kybMutation = useMutation({
    mutationFn: async ({ merchantId, decision, reason }: { merchantId: string; decision: string; reason?: string }) => {
      const updates: any = {
        kyb_status: decision,
        status: decision === "approved" ? "verified" : "rejected",
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from("gateway_merchants")
        .update(updates)
        .eq("id", merchantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Merchant KYB status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-gateway-merchants"] });
      setKybDecision(null);
      setRejectionReason("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ merchantId, status }: { merchantId: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("gateway_merchants")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", merchantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Merchant status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-gateway-merchants"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const adminManageMutation = useMutation({
    mutationFn: async ({ action, entityId, reason }: { action: string; entityId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action, target_entity_id: entityId, reason },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Merchant ${vars.action.replace('_merchant', '')} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-gateway-merchants"] });
      setSuspendDialogOpen(false);
      setDeleteDialogOpen(false);
      setActionReason("");
    },
    onError: (err: any) => toast.error(err.message || "Action failed"),
  });

  const filtered = (merchants || []).filter((m: any) => {
    const matchSearch = m.business_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.business_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: merchants?.length || 0,
    active: merchants?.filter((m: any) => m.status === "active" || m.status === "verified").length || 0,
    pendingKyb: merchants?.filter((m: any) => m.kyb_status === "submitted").length || 0,
    suspended: merchants?.filter((m: any) => m.status === "suspended").length || 0,
  };

  const statusColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default", verified: "default", draft: "secondary",
      submitted: "outline", under_review: "outline",
      suspended: "destructive", rejected: "destructive", closed: "destructive",
    };
    return map[s] || "secondary";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Merchant Management</h1>
        <p className="text-muted-foreground">Review, approve, and manage gateway merchant accounts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Store className="h-5 w-5 text-primary" />
          <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total Merchants</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div><p className="text-2xl font-bold">{stats.active}</p><p className="text-xs text-muted-foreground">Active / Verified</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Clock className="h-5 w-5 text-yellow-600" />
          <div><p className="text-2xl font-bold">{stats.pendingKyb}</p><p className="text-xs text-muted-foreground">KYB Pending Review</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div><p className="text-2xl font-bold">{stats.suspended}</p><p className="text-xs text-muted-foreground">Suspended</p></div>
        </CardContent></Card>
      </div>

      <div className="flex gap-4">
        <Input placeholder="Search merchants..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> All Merchants ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KYB</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No merchants found</TableCell></TableRow>
              ) : filtered.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.business_name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.business_email}</TableCell>
                  <TableCell><Badge variant={statusColor(m.status)}>{m.status}</Badge></TableCell>
                  <TableCell><Badge variant={statusColor(m.kyb_status)}>{m.kyb_status?.replace("_", " ")}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{m.environment}</Badge></TableCell>
                  <TableCell>{new Date(m.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="space-x-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedMerchant(m)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </DialogTrigger>
                    {m.status === 'suspended' ? (
                      <Button size="sm" variant="outline" onClick={() => adminManageMutation.mutate({ action: 'unsuspend_merchant', entityId: m.id })} disabled={adminManageMutation.isPending}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Unsuspend
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setActionTarget(m); setSuspendDialogOpen(true); }}>
                        <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => { setActionTarget(m); setDeleteDialogOpen(true); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{m.business_name}</DialogTitle>
                          <DialogDescription>Merchant ID: {m.id}</DialogDescription>
                        </DialogHeader>
                        <Tabs defaultValue="details" className="mt-4">
                          <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="kyb">KYB Review</TabsTrigger>
                            <TabsTrigger value="keys">API Keys</TabsTrigger>
                            <TabsTrigger value="settlement">Settlement</TabsTrigger>
                          </TabsList>

                          <TabsContent value="details" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div><span className="text-muted-foreground">Status</span><div><Badge variant={statusColor(m.status)}>{m.status}</Badge></div></div>
                              <div><span className="text-muted-foreground">KYB</span><div><Badge variant={statusColor(m.kyb_status)}>{m.kyb_status?.replace("_"," ")}</Badge></div></div>
                              <div><span className="text-muted-foreground">Email</span><p>{m.business_email}</p></div>
                              <div><span className="text-muted-foreground">Phone</span><p>{m.business_phone || "—"}</p></div>
                              <div><span className="text-muted-foreground">Environment</span><p>{m.environment}</p></div>
                              <div><span className="text-muted-foreground">Fee Bearer</span><p>{m.fee_bearer || "merchant"}</p></div>
                              <div><span className="text-muted-foreground">Daily Charge Limit</span><p>{m.daily_charge_limit?.toLocaleString() || "—"}</p></div>
                              <div><span className="text-muted-foreground">Single Charge Limit</span><p>{m.single_charge_limit?.toLocaleString() || "—"}</p></div>
                              <div><span className="text-muted-foreground">Webhook URL</span><p className="truncate max-w-[200px]">{m.webhook_url || "Not set"}</p></div>
                              <div><span className="text-muted-foreground">Webhooks Registered</span><p>{webhooks?.length || 0}</p></div>
                            </div>
                            <div className="flex gap-2 pt-4 border-t">
                              <span className="text-sm text-muted-foreground mr-2 self-center">Change Status:</span>
                              {["active","suspended","closed"].map(s => (
                                <Button key={s} size="sm" variant={m.status === s ? "default" : "outline"}
                                  disabled={m.status === s}
                                  onClick={() => statusMutation.mutate({ merchantId: m.id, status: s })}
                                  className="capitalize">{s}</Button>
                              ))}
                            </div>
                          </TabsContent>

                          <TabsContent value="kyb" className="space-y-4 mt-4">
                            <div className="text-sm space-y-2">
                              <p><span className="text-muted-foreground">Current KYB Status:</span> <Badge variant={statusColor(m.kyb_status)}>{m.kyb_status?.replace("_"," ")}</Badge></p>
                              <p className="text-muted-foreground">Metadata: {m.metadata ? JSON.stringify(m.metadata, null, 2) : "None submitted"}</p>
                            </div>
                            {m.kyb_status === "submitted" && (
                              <div className="space-y-3 border-t pt-4">
                                <p className="font-medium">Review KYB Submission</p>
                                <div className="flex gap-2">
                                  <Button variant="default" onClick={() => kybMutation.mutate({ merchantId: m.id, decision: "approved" })}>
                                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="destructive"><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader><DialogTitle>Reject KYB</DialogTitle></DialogHeader>
                                      <Textarea placeholder="Reason for rejection..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                                      <DialogFooter>
                                        <Button variant="destructive" onClick={() => kybMutation.mutate({ merchantId: m.id, decision: "rejected", reason: rejectionReason })}>
                                          Confirm Rejection
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="keys" className="mt-4">
                            {!apiKeys?.length ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No API keys</p>
                            ) : (
                              <Table>
                                <TableHeader><TableRow>
                                  <TableHead>Prefix</TableHead><TableHead>Env</TableHead><TableHead>Status</TableHead><TableHead>Last Used</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                  {apiKeys.map((k: any) => (
                                    <TableRow key={k.id}>
                                      <TableCell className="font-mono text-xs">{k.api_key_prefix}...</TableCell>
                                      <TableCell><Badge variant="outline">{k.environment}</Badge></TableCell>
                                      <TableCell><Badge variant={k.is_active ? "default" : "destructive"}>{k.is_active ? "Active" : "Revoked"}</Badge></TableCell>
                                      <TableCell>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </TabsContent>

                          <TabsContent value="settlement" className="mt-4">
                            {!settlements?.length ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No settlement accounts</p>
                            ) : (
                              <Table>
                                <TableHeader><TableRow>
                                  <TableHead>Type</TableHead><TableHead>Bank</TableHead><TableHead>Account</TableHead><TableHead>Currency</TableHead><TableHead>Default</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                  {settlements.map((s: any) => (
                                    <TableRow key={s.id}>
                                      <TableCell className="capitalize">{s.account_type?.replace("_"," ")}</TableCell>
                                      <TableCell>{s.bank_name || "—"}</TableCell>
                                      <TableCell className="font-mono text-xs">{s.account_number || s.phone_number || "—"}</TableCell>
                                      <TableCell>{s.currency}</TableCell>
                                      <TableCell>{s.is_default ? "✓" : "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Merchant</DialogTitle>
            <DialogDescription>Suspend "{actionTarget?.business_name}". The merchant will not be able to process payments.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea placeholder="Enter reason..." value={actionReason} onChange={(e) => setActionReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!actionReason.trim() || adminManageMutation.isPending}
              onClick={() => adminManageMutation.mutate({ action: 'suspend_merchant', entityId: actionTarget?.id, reason: actionReason })}>
              Suspend Merchant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Merchant Permanently</DialogTitle>
            <DialogDescription>Delete "{actionTarget?.business_name}" and all charges, refunds, wallets, API keys, and staff roles. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea placeholder="Enter reason..." value={actionReason} onChange={(e) => setActionReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!actionReason.trim() || adminManageMutation.isPending}
              onClick={() => adminManageMutation.mutate({ action: 'delete_merchant', entityId: actionTarget?.id, reason: actionReason })}>
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
