import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { DocumentPreviewLightbox } from "@/components/admin/DocumentPreviewLightbox";
import { getKycDocumentUrl } from "@/lib/kyc-storage";
import { Shield, FileText, CheckCircle, XCircle, Clock, Eye, Search, Users, UserPlus, Image as ImageIcon, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionKYCManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedKYC, setSelectedKYC] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvedThumbs, setResolvedThumbs] = useState<Record<string, string>>({});

  const { data: kycSubmissions, isLoading, refetch } = useQuery({
    queryKey: ["fi-kyc-submissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Check if user is institution owner
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      // Also check if user is staff assigned to an institution
      let institutionId = institution?.id;
      if (!institutionId) {
        const { data: staffAssignment } = await supabase
          .from("staff_assignments")
          .select("institution_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        institutionId = staffAssignment?.institution_id;
      }
      if (!institutionId) return [];

      // Get user IDs of customers who have accounts at this institution
      const { data: accountUsers } = await supabase
        .from("accounts")
        .select("user_id")
        .eq("institution_id", institutionId)
        .eq("is_active", true);

      const customerUserIds = [...new Set((accountUsers || []).map(a => a.user_id))];
      if (customerUserIds.length === 0) return [];

      // Fetch KYC for those customers only
      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*, profiles(full_name, email, phone_number)")
        .in("user_id", customerUserIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Live realtime sync — refresh on any KYC insert/update so admins see new submissions instantly
  useEffect(() => {
    const channel = supabase
      .channel('institution-kyc-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kyc_verifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fi-kyc-submissions'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-kyc-review", {
        body: { kyc_id: id, action: status, rejection_reason: notes || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fi-kyc-submissions"] });
      toast({ title: "KYC Review Complete", description: `Verification has been ${reviewAction}. Customer notified.` });
      setReviewDialogOpen(false);
      setDetailOpen(false);
      setSelectedKYC(null);
      setReviewNotes("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleReview = (kyc: any, action: "approved" | "rejected") => { setSelectedKYC(kyc); setReviewAction(action); setReviewDialogOpen(true); };
  const submitReview = () => { if (selectedKYC) reviewMutation.mutate({ id: selectedKYC.id, status: reviewAction, notes: reviewNotes }); };
  const openPreview = async (storedPath: string | null, label: string) => {
    if (!storedPath) return;
    const signedUrl = await getKycDocumentUrl(storedPath);
    if (signedUrl) { setPreviewUrl(signedUrl); setPreviewLabel(label); }
  };

  const getDisplayName = (kyc: any) => (kyc.profiles as any)?.full_name || `User ${kyc.user_id?.slice(0, 8)}`;

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
      pending: { variant: "secondary", icon: Clock },
      approved: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
    };
    const c = config[status] || { variant: "outline" as const, icon: Clock };
    return <Badge variant={c.variant} className="flex items-center gap-1 w-fit text-[10px] uppercase tracking-wider"><c.icon className="h-3 w-3" />{status}</Badge>;
  };

  const filterByStatus = (status: string) => {
    let items = kycSubmissions?.filter((kyc) => kyc.status === status) || [];
    if (searchQuery) items = items.filter(k => `${getDisplayName(k)} ${k.document_number}`.toLowerCase().includes(searchQuery.toLowerCase()));
    return items;
  };

  const allFiltered = searchQuery
    ? kycSubmissions?.filter(k => `${getDisplayName(k)} ${k.document_number}`.toLowerCase().includes(searchQuery.toLowerCase()))
    : kycSubmissions;

  const stats = { total: kycSubmissions?.length || 0, pending: filterByStatus("pending").length, approved: filterByStatus("approved").length, rejected: filterByStatus("rejected").length };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fi-purple/10 border border-fi-purple/20"><Shield className="h-5 w-5 text-fi-purple" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">KYC Verification</h1>
            <p className="text-xs text-muted-foreground">Review and manage customer identity verifications</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate("/fi-portal/customer-onboarding")}><UserPlus className="h-3.5 w-3.5 mr-1.5" />New Verification</Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-fi-purple bg-fi-purple/10 border-fi-purple/20" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20" },
          { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-destructive bg-destructive/10 border-destructive/20" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or document…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="pending" className="rounded-md px-3 text-xs font-medium">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="approved" className="rounded-md px-3 text-xs font-medium">Approved ({stats.approved})</TabsTrigger>
          <TabsTrigger value="rejected" className="rounded-md px-3 text-xs font-medium">Rejected ({stats.rejected})</TabsTrigger>
          <TabsTrigger value="all" className="rounded-md px-3 text-xs font-medium">All ({allFiltered?.length || 0})</TabsTrigger>
        </TabsList>

        {["pending", "approved", "rejected"].map(status => (
          <TabsContent key={status} value={status}>
            {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p> : (
              <Card className="border-border/60"><CardContent className="p-0">
                {filterByStatus(status).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16"><FileText className="h-12 w-12 text-muted-foreground/30 mb-3" /><p className="text-sm text-muted-foreground">No {status} verifications</p></div>
                ) : (
                  <Table>
                    <TableHeader><TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">Customer</TableHead>
                      <TableHead className="text-xs font-semibold">Type</TableHead>
                      <TableHead className="text-xs font-semibold">Document</TableHead>
                      <TableHead className="text-xs font-semibold">Risk</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold">Submitted</TableHead>
                      <TableHead className="text-xs font-semibold">Documents</TableHead>
                      <TableHead className="text-xs font-semibold w-[100px]">Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{filterByStatus(status).map(kyc => (
                      <TableRow key={kyc.id}>
                        <TableCell><p className="font-medium text-sm">{getDisplayName(kyc)}</p><p className="text-xs text-muted-foreground">{(kyc.profiles as any)?.email}</p></TableCell>
                        <TableCell className="text-sm capitalize">{kyc.verification_type}</TableCell>
                        <TableCell><p className="text-sm capitalize">{kyc.document_type?.replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">{kyc.document_number}</p></TableCell>
                        <TableCell><Badge variant={kyc.risk_level === "high" ? "destructive" : "outline"} className="text-[10px]">{kyc.risk_level || "—"}</Badge></TableCell>
                        <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{kyc.created_at ? format(new Date(kyc.created_at), "PP") : "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {kyc.document_front_url && <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openPreview(kyc.document_front_url, "ID Front")}><Eye className="h-3 w-3 mr-1" />ID</Button>}
                            {kyc.selfie_url && <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openPreview(kyc.selfie_url, "Selfie")}><Eye className="h-3 w-3 mr-1" />Selfie</Button>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                              setSelectedKYC(kyc); setDetailOpen(true);
                              const urls: Record<string, string> = {};
                              for (const f of ['document_front_url', 'document_back_url', 'selfie_url'] as const) {
                                if (kyc[f]) { const s = await getKycDocumentUrl(kyc[f]); if (s) urls[f] = s; }
                              }
                              setResolvedThumbs(urls);
                            }}><Eye className="h-3.5 w-3.5" /></Button>
                            {kyc.status === "pending" && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-fi-green hover:bg-fi-green/10" onClick={() => handleReview(kyc, "approved")}><CheckCircle className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleReview(kyc, "rejected")}><XCircle className="h-3.5 w-3.5" /></Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </CardContent></Card>
            )}
          </TabsContent>
        ))}
        <TabsContent value="all">
          {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p> : (
            <Card className="border-border/60"><CardContent className="p-0">
              {(allFiltered?.length || 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16"><FileText className="h-12 w-12 text-muted-foreground/30 mb-3" /><p className="text-sm text-muted-foreground">No verifications found</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Customer</TableHead>
                    <TableHead className="text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Submitted</TableHead>
                    <TableHead className="text-xs font-semibold w-[80px]">View</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{allFiltered?.map(kyc => (
                    <TableRow key={kyc.id}>
                      <TableCell><p className="font-medium text-sm">{getDisplayName(kyc)}</p></TableCell>
                      <TableCell className="text-sm capitalize">{kyc.verification_type}</TableCell>
                      <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{kyc.created_at ? format(new Date(kyc.created_at), "PP") : "—"}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedKYC(kyc); setDetailOpen(true); }}><Eye className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader><DialogTitle>KYC Verification Detail</DialogTitle></DialogHeader>
          {selectedKYC && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div><p className="text-xs text-muted-foreground">Customer</p><p className="text-sm font-medium">{getDisplayName(selectedKYC)}</p></div>
                <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm">{(selectedKYC.profiles as any)?.email || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Verification Type</p><p className="text-sm capitalize">{selectedKYC.verification_type}</p></div>
                <div><p className="text-xs text-muted-foreground">Document</p><p className="text-sm capitalize">{selectedKYC.document_type?.replace(/_/g, " ")}</p></div>
                <div><p className="text-xs text-muted-foreground">Document No.</p><p className="text-sm font-mono">{selectedKYC.document_number}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p>{getStatusBadge(selectedKYC.status)}</div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Documents</p>
                <div className="grid grid-cols-3 gap-3">
                  {[{ key: "document_front_url", label: "ID Front" }, { key: "document_back_url", label: "ID Back" }, { key: "selfie_url", label: "Selfie" }].map(doc => {
                    const storedPath = selectedKYC[doc.key];
                    const thumbUrl = resolvedThumbs[doc.key];
                    return (
                    <button key={doc.label} className="relative rounded-lg border border-border/60 overflow-hidden aspect-[4/3] bg-muted/30 hover:border-primary/50 transition-colors group disabled:opacity-40" disabled={!storedPath} onClick={() => openPreview(storedPath, doc.label)}>
                      {thumbUrl ? (
                        <><img src={thumbUrl} alt={doc.label} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center"><Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" /></div></>
                      ) : (<div className="flex flex-col items-center justify-center h-full"><ImageIcon className="h-6 w-6 text-muted-foreground/20" /></div>)}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5"><span className="text-[10px] text-white font-medium">{doc.label}</span></div>
                    </button>
                    );
                  })}
                </div>
              </div>
              {selectedKYC.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => handleReview(selectedKYC, "approved")} className="flex-1"><CheckCircle className="h-4 w-4 mr-1" /> Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReview(selectedKYC, "rejected")} className="flex-1"><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === "approved" ? "Approve" : "Reject"} KYC</DialogTitle>
            <DialogDescription>{reviewAction === "approved" ? "Confirm verification approval." : "Provide a reason for rejection."}</DialogDescription>
          </DialogHeader>
          {selectedKYC && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-semibold text-sm">{getDisplayName(selectedKYC)}</p>
                <p className="text-xs text-muted-foreground">{selectedKYC.verification_type} • {selectedKYC.document_number}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Review Notes</Label>
                <Textarea placeholder="Add review notes…" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} className="text-sm" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={submitReview} variant={reviewAction === "approved" ? "default" : "destructive"} disabled={reviewMutation.isPending}>{reviewAction === "approved" ? "Approve" : "Reject"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPreviewLightbox url={previewUrl} label={previewLabel} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
