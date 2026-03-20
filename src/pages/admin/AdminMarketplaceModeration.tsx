import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Search, Store, Clock, Eye, ExternalLink, ShieldCheck} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type StoreStatus = "pending" | "approved" | "rejected" | "suspended";

const STATUS_CONFIG: Record<StoreStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Pending Review", variant: "outline", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  suspended: { label: "Suspended", variant: "secondary", icon: AlertTriangle },
};

export default function AdminMarketplaceModeration() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<{ store: any; action: StoreStatus } | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pos_store_profiles")
      .select("*, gateway_merchants(id, business_name, user_id)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load stores");
    } else {
      setStores(data || []);
    }
    setLoading(false);
  };

  const submitModerationAction = async () => {
    if (!actionDialog) return;
    setSubmitting(true);
    try {
      const { store, action } = actionDialog;

      const updatePayload: any = {
        status: action,
        moderation_notes: notes || null,
        moderated_at: new Date().toISOString(),
      };

      // Also toggle is_published based on action
      if (action === "approved") updatePayload.is_published = true;
      if (action === "rejected" || action === "suspended") updatePayload.is_published = false;

      const { error } = await supabase
        .from("pos_store_profiles")
        .update(updatePayload)
        .eq("id", store.id);

      if (error) throw error;

      // Log in audit_logs
      await supabase.rpc("log_audit_event", {
        _action_type: action,
        _entity_type: "pos_store_profile",
        _entity_id: store.id,
        _details: { store_name: store.store_name, notes, action },
      });

      const actionLabels: Record<StoreStatus, string> = {
        approved: "Store approved and published",
        rejected: "Store rejected",
        suspended: "Store suspended",
        pending: "Store reset to pending",
      };
      toast.success(actionLabels[action]);
      setActionDialog(null);
      setNotes("");
      setSelectedStore(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit action");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatus = (store: any): StoreStatus => {
    return (store.status as StoreStatus) || (store.is_published ? "approved" : "pending");
  };

  const filteredStores = stores.filter(s => {
    const status = getStatus(s);
    const matchesTab = activeTab === "all" || status === activeTab;
    const matchesSearch = !search || s.store_name?.toLowerCase().includes(search.toLowerCase()) || s.city?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const counts = {
    pending: stores.filter(s => getStatus(s) === "pending").length,
    approved: stores.filter(s => getStatus(s) === "approved").length,
    rejected: stores.filter(s => getStatus(s) === "rejected").length,
    suspended: stores.filter(s => getStatus(s) === "suspended").length,
    all: stores.length,
  };

  if (loading) return <div className="space-y-6 flex justify-center py-20">
      <AdminPageHeader icon={ShieldCheck} title="Marketplace Moderation" description="Review and approve merchant storefronts for the consumer marketplace" />
<Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Review", value: counts.pending, icon: Clock, color: "text-amber-500" },
          { label: "Approved", value: counts.approved, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Rejected", value: counts.rejected, icon: XCircle, color: "text-destructive" },
          { label: "Suspended", value: counts.suspended, icon: AlertTriangle, color: "text-muted-foreground" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by store name or city..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="suspended">Suspended ({counts.suspended})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {filteredStores.length === 0 ? (
                <div className="py-14 text-center">
                  <Store className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">No stores found</p>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "pending" ? "No stores awaiting review" : "No stores in this category"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStores.map(store => {
                      const status = getStatus(store);
                      const cfg = STATUS_CONFIG[status];
                      const StatusIcon = cfg.icon;
                      return (
                        <TableRow key={store.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {store.logo_url ? (
                                <img src={store.logo_url} alt="" className="h-8 w-8 rounded object-cover" />
                              ) : (
                                <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                  <Store className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-sm">{store.store_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {store.gateway_merchants?.business_name || "—"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{store.category || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{store.city || "—"}</TableCell>
                          <TableCell className="text-sm">{store.rating?.toFixed(1) || "0.0"} ⭐</TableCell>
                          <TableCell>
                            <Badge variant={cfg.variant} className="gap-1 text-xs">
                              <StatusIcon className="h-3 w-3" /> {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {store.created_at ? format(new Date(store.created_at), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedStore(store)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {status !== "approved" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-emerald-600 hover:text-emerald-600"
                                  onClick={() => { setActionDialog({ store, action: "approved" }); setNotes(""); }}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {status !== "rejected" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => { setActionDialog({ store, action: "rejected" }); setNotes(""); }}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {status !== "suspended" && status === "approved" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-amber-600 hover:text-amber-600"
                                  onClick={() => { setActionDialog({ store, action: "suspended" }); setNotes(""); }}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                </Button>
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
      </Tabs>

      {/* Store Detail Dialog */}
      {selectedStore && (
        <Dialog open={!!selectedStore} onOpenChange={() => setSelectedStore(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedStore.store_name}</DialogTitle>
              <DialogDescription>{selectedStore.tagline || "No tagline provided"}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedStore.banner_url && (
                <img src={selectedStore.banner_url} alt="banner" className="w-full h-32 object-cover rounded-lg" />
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Category", value: selectedStore.category },
                  { label: "City", value: selectedStore.city },
                  { label: "Phone", value: selectedStore.phone },
                  { label: "Email", value: selectedStore.email },
                  { label: "Rating", value: selectedStore.rating?.toFixed(1) + " ⭐" },
                  { label: "Reviews", value: selectedStore.review_count },
                  { label: "Published", value: selectedStore.is_published ? "Yes" : "No" },
                  { label: "Moderated", value: selectedStore.moderated_at ? format(new Date(selectedStore.moderated_at), "MMM d, yyyy") : "Never" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value || "—"}</p>
                  </div>
                ))}
              </div>
              {selectedStore.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{selectedStore.description}</p>
                </div>
              )}
              {selectedStore.moderation_notes && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground mb-1">Moderation Notes</p>
                  <p className="text-sm">{selectedStore.moderation_notes}</p>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedStore(null)}>Close</Button>
              {getStatus(selectedStore) !== "approved" && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => { setActionDialog({ store: selectedStore, action: "approved" }); setSelectedStore(null); setNotes(""); }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve Store
                </Button>
              )}
              {getStatus(selectedStore) !== "rejected" && (
                <Button
                  variant="destructive"
                  onClick={() => { setActionDialog({ store: selectedStore, action: "rejected" }); setSelectedStore(null); setNotes(""); }}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Action Confirmation Dialog */}
      {actionDialog && (
        <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="capitalize">
                {actionDialog.action === "approved" ? "Approve" : actionDialog.action === "rejected" ? "Reject" : "Suspend"} Store
              </DialogTitle>
              <DialogDescription>
                {actionDialog.action === "approved"
                  ? `Approving "${actionDialog.store.store_name}" will publish it on the consumer marketplace.`
                  : actionDialog.action === "rejected"
                  ? `Rejecting "${actionDialog.store.store_name}" will remove it from the marketplace.`
                  : `Suspending "${actionDialog.store.store_name}" will hide it from the marketplace and flag it for review.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Notes {actionDialog.action !== "approved" ? "(required)" : "(optional)"}</Label>
              <Textarea
                rows={3}
                placeholder={
                  actionDialog.action === "approved"
                    ? "Optional approval notes..."
                    : "Provide a reason for this decision..."
                }
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button
                variant={actionDialog.action === "approved" ? "default" : "destructive"}
                onClick={submitModerationAction}
                disabled={submitting || (actionDialog.action !== "approved" && !notes.trim())}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm {actionDialog.action === "approved" ? "Approval" : actionDialog.action === "rejected" ? "Rejection" : "Suspension"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
