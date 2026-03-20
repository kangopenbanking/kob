import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, CheckCircle, Clock, XCircle, AlertTriangle, Eye, Shield, Scale} from "lucide-react";
import { format } from "date-fns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function DisputeManagement() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [resolution, setResolution] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Legacy disputes
  const { data: legacyDisputes, isLoading: legacyLoading } = useQuery({
    queryKey: ["admin-disputes", statusFilter],
    queryFn: async () => {
      let query = supabase.from("disputes").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Gateway disputes
  const { data: gatewayDisputes, isLoading: gatewayLoading } = useQuery({
    queryKey: ["admin-gateway-disputes", statusFilter],
    queryFn: async () => {
      let query = supabase.from("gateway_disputes").select("*, gateway_merchants(business_name, business_email)").order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const resolveLegacy = useMutation({
    mutationFn: async ({ id, status, resolution }: { id: string; status: string; resolution: string }) => {
      const { error } = await supabase.from("disputes").update({ status, resolution, resolved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      toast.success("Dispute updated");
      setResolution("");
    },
    onError: () => toast.error("Failed to update dispute"),
  });

  const resolveGateway = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { error } = await supabase.from("gateway_disputes").update({ status, evidence_data: { admin_notes: notes, resolved_at: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      // Send notification email
      const dispute = gatewayDisputes?.find(d => d.id === id);
      if (dispute) {
        const merchant = dispute.gateway_merchants as any;
        supabase.functions.invoke("send-communication", {
          body: {
            template_key: "dispute_resolved",
            recipient_email: merchant?.business_email,
            variables: {
              merchant_name: merchant?.business_name || "Merchant",
              dispute_ref: (dispute as any).dispute_ref || id.slice(0, 8),
              amount: dispute.amount, currency: dispute.currency,
              outcome: status === "won" ? "Won (in your favor)" : "Lost",
              resolution_notes: notes,
            },
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gateway-disputes"] });
      toast.success("Gateway dispute resolved");
      setResolution("");
    },
    onError: () => toast.error("Failed to resolve dispute"),
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      open: { variant: "outline", icon: AlertTriangle },
      investigating: { variant: "secondary", icon: Search },
      under_review: { variant: "secondary", icon: Clock },
      resolved: { variant: "default", icon: CheckCircle },
      won: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
      lost: { variant: "destructive", icon: XCircle },
      closed: { variant: "secondary", icon: Shield },
    };
    const config = variants[status] || variants.open;
    const Icon = config.icon;
    return <Badge variant={config.variant}><Icon className="h-3 w-3 mr-1" />{status.replace(/_/g, " ")}</Badge>;
  };

  const gwStats = {
    total: gatewayDisputes?.length || 0,
    open: gatewayDisputes?.filter(d => d.status === "open").length || 0,
    under_review: gatewayDisputes?.filter(d => d.status === "under_review").length || 0,
    won: gatewayDisputes?.filter(d => d.status === "won").length || 0,
    lost: gatewayDisputes?.filter(d => d.status === "lost").length || 0,
  };

  const legacyStats = {
    total: legacyDisputes?.length || 0,
    open: legacyDisputes?.filter(d => d.status === "open").length || 0,
    investigating: legacyDisputes?.filter(d => d.status === "investigating").length || 0,
    resolved: legacyDisputes?.filter(d => d.status === "resolved").length || 0,
  };

  const filteredLegacy = legacyDisputes?.filter(d =>
    !searchTerm || d.reason?.toLowerCase().includes(searchTerm.toLowerCase()) || d.transaction_ref?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGateway = gatewayDisputes?.filter(d =>
    !searchTerm || (d as any).dispute_ref?.toLowerCase().includes(searchTerm.toLowerCase()) || d.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.gateway_merchants as any)?.business_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Scale} title="Dispute & Chargeback Management" description="Handle payment disputes, chargebacks, and resolution workflows" />


      {/* Combined Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Disputes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{gwStats.total + legacyStats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Open / Needs Action</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{gwStats.open + legacyStats.open}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Under Review</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{gwStats.under_review + legacyStats.investigating}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Won / Resolved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{gwStats.won + legacyStats.resolved}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Lost</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{gwStats.lost}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by reference, reason, or merchant..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="gateway" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gateway">Gateway Disputes ({gwStats.total})</TabsTrigger>
          <TabsTrigger value="legacy">Platform Disputes ({legacyStats.total})</TabsTrigger>
        </TabsList>

        {/* Gateway Disputes */}
        <TabsContent value="gateway">
          <Card>
            <CardHeader>
              <CardTitle>Gateway Chargebacks</CardTitle>
              <CardDescription>Disputes from payment gateway (Stripe, MoMo) merchants</CardDescription>
            </CardHeader>
            <CardContent>
              {gatewayLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> :
              filteredGateway?.length === 0 ? <p className="text-center py-8 text-muted-foreground">No gateway disputes</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Evidence Due</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGateway?.map(d => {
                      const merchant = d.gateway_merchants as any;
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono text-xs">{format(new Date(d.created_at), "MMM dd, yyyy")}</TableCell>
                          <TableCell className="font-mono text-xs">{(d as any).dispute_ref || d.id.slice(0, 8)}</TableCell>
                          <TableCell className="font-medium">{merchant?.business_name || "—"}</TableCell>
                          <TableCell className="font-semibold">{Number(d.amount).toLocaleString()} {d.currency}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{d.reason || "—"}</TableCell>
                          <TableCell>{getStatusBadge(d.status)}</TableCell>
                          <TableCell>{d.evidence_due_by ? format(new Date(d.evidence_due_by), "MMM d") : "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedDispute({ ...d, _type: "gateway" }); setDetailOpen(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                              {(d.status === "open" || d.status === "under_review") && (
                                <Dialog>
                                  <DialogTrigger asChild><Button size="sm" variant="outline">Resolve</Button></DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader><DialogTitle>Resolve Gateway Dispute</DialogTitle></DialogHeader>
                                    <div className="space-y-4">
                                      <div className="rounded-lg bg-muted/50 p-3 text-sm">
                                        <p><strong>Merchant:</strong> {merchant?.business_name}</p>
                                        <p><strong>Amount:</strong> {Number(d.amount).toLocaleString()} {d.currency}</p>
                                        <p><strong>Reason:</strong> {d.reason}</p>
                                        {d.evidence_submitted && <p className="text-green-600">✓ Evidence submitted by merchant</p>}
                                      </div>
                                      <div><Label>Resolution Notes</Label><Textarea value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Enter resolution details..." /></div>
                                      <div className="flex gap-2">
                                        <Button onClick={() => resolveGateway.mutate({ id: d.id, status: "won", notes: resolution })} className="flex-1">Merchant Wins</Button>
                                        <Button variant="destructive" onClick={() => resolveGateway.mutate({ id: d.id, status: "lost", notes: resolution })} className="flex-1">Merchant Loses</Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legacy Disputes */}
        <TabsContent value="legacy">
          <Card>
            <CardHeader>
              <CardTitle>Platform Disputes</CardTitle>
              <CardDescription>General payment disputes and refund requests</CardDescription>
            </CardHeader>
            <CardContent>
              {legacyLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> :
              filteredLegacy?.length === 0 ? <p className="text-center py-8 text-muted-foreground">No disputes found</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLegacy?.map(dispute => (
                      <TableRow key={dispute.id}>
                        <TableCell className="font-mono text-xs">{format(new Date(dispute.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell><Badge variant="outline">{dispute.dispute_type}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{dispute.reason}</TableCell>
                        <TableCell className="font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: dispute.currency }).format(dispute.amount)}</TableCell>
                        <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                        <TableCell className="font-mono text-xs">{dispute.transaction_ref || "N/A"}</TableCell>
                        <TableCell>
                          {dispute.status === "open" || dispute.status === "investigating" ? (
                            <Dialog>
                              <DialogTrigger asChild><Button size="sm" variant="outline">Resolve</Button></DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Resolve Dispute</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <div><Label>Resolution Notes</Label><Textarea value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Enter resolution details..." /></div>
                                  <div className="flex gap-2">
                                    <Button onClick={() => resolveLegacy.mutate({ id: dispute.id, status: "resolved", resolution })} className="flex-1">Approve Refund</Button>
                                    <Button variant="destructive" onClick={() => resolveLegacy.mutate({ id: dispute.id, status: "rejected", resolution })} className="flex-1">Reject</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <span className="text-xs text-muted-foreground">{dispute.resolution || "—"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {selectedDispute && (
            <>
              <DialogHeader><DialogTitle>Dispute Details</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Reference</span><p className="font-mono font-medium">{selectedDispute.dispute_ref || selectedDispute.id.slice(0, 8)}</p></div>
                  <div><span className="text-muted-foreground">Status</span><p>{getStatusBadge(selectedDispute.status)}</p></div>
                  <div><span className="text-muted-foreground">Amount</span><p className="font-semibold">{Number(selectedDispute.amount).toLocaleString()} {selectedDispute.currency}</p></div>
                  <div><span className="text-muted-foreground">Provider</span><p>{selectedDispute.provider || "Platform"}</p></div>
                  <div><span className="text-muted-foreground">Reason</span><p>{selectedDispute.reason || "—"}</p></div>
                  <div><span className="text-muted-foreground">Created</span><p>{format(new Date(selectedDispute.created_at), "MMM d, yyyy HH:mm")}</p></div>
                  {selectedDispute.gateway_merchants && (
                    <div className="col-span-2"><span className="text-muted-foreground">Merchant</span><p className="font-medium">{(selectedDispute.gateway_merchants as any)?.business_name}</p></div>
                  )}
                </div>
                {selectedDispute.evidence_data && (
                  <div>
                    <Label className="text-muted-foreground">Evidence / Notes</Label>
                    <pre className="mt-1 p-3 rounded-lg bg-muted text-xs overflow-auto max-h-40">{JSON.stringify(selectedDispute.evidence_data, null, 2)}</pre>
                  </div>
                )}
                {selectedDispute.provider_raw && (
                  <div>
                    <Label className="text-muted-foreground">Provider Data</Label>
                    <pre className="mt-1 p-3 rounded-lg bg-muted text-xs overflow-auto max-h-40">{JSON.stringify(selectedDispute.provider_raw, null, 2)}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
