import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getKycDocumentUrl } from "@/lib/kyc-storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { DocumentPreviewLightbox } from "@/components/admin/DocumentPreviewLightbox";
import { Building2, FileText, CheckCircle, XCircle, Clock, Eye, Search, Users, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

export default function BusinessKYCReview() {
  const [selectedKYB, setSelectedKYB] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvedThumbs, setResolvedThumbs] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: kybSubmissions, isLoading } = useQuery({
    queryKey: ["business-kyc-submissions"],
    queryFn: async () => {
      // Fetch from business_kyc table (institution KYB submissions)
      const { data: bkycData, error: bkycErr } = await supabase.from("business_kyc").select("*").order("created_at", { ascending: false });
      if (bkycErr) throw bkycErr;

      // Also fetch gateway merchant KYB submissions
      const { data: merchantData, error: mErr } = await supabase
        .from("gateway_merchants")
        .select("id, business_name, status, kyb_status, kyb_documents, kyb_rejection_reason, metadata, created_at, updated_at, user_id, business_email, business_phone")
        .neq("kyb_status", "not_submitted")
        .order("created_at", { ascending: false });
      if (mErr) throw mErr;

      // Normalize merchant KYB records into the same shape as business_kyc
      const merchantKybs = (merchantData || []).map((m: any) => {
        const meta = m.metadata || {};
        const kybSub = meta.kyb_submission || {};
        return {
          id: m.id,
          _source: "gateway_merchant" as const,
          business_name: m.business_name,
          business_type: meta.business_type || "merchant",
          registration_number: kybSub.registration_number || meta.kyb_business_registration || "—",
          industry: meta.industry || "Commerce",
          tax_id: kybSub.tax_id || meta.kyb_tax_id || null,
          vat_number: null,
          business_address: kybSub.business_address || meta.kyb_business_address || null,
          business_description: meta.business_description || null,
          annual_turnover: null,
          number_of_employees: null,
          verification_status: m.kyb_status === "verified" ? "approved" : m.kyb_status === "rejected" ? "rejected" : "pending",
          risk_rating: null,
          rejection_reason: m.kyb_rejection_reason,
          created_at: kybSub.submitted_at || m.created_at,
          updated_at: m.updated_at,
          user_id: m.user_id,
          // Document fields – merchant KYB stores docs differently
          registration_certificate_url: null,
          articles_of_association_url: null,
          tax_certificate_url: null,
          proof_of_address_url: null,
          bank_statement_url: null,
          kyb_documents: m.kyb_documents || (kybSub.documents?.length ? kybSub.documents : null),
        };
      });

      // Tag business_kyc records with source
      const bkycTagged = (bkycData || []).map((b: any) => ({ ...b, _source: "business_kyc" as const }));

      // Merge and sort by created_at descending
      const merged = [...bkycTagged, ...merchantKybs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return merged;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      // Get the institution_id linked to this KYB record
      const { data: kybRecord } = await supabase.from("business_kyc").select("user_id").eq("id", id).single();
      let institutionId: string | null = null;
      if (kybRecord) {
        const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", kybRecord.user_id).maybeSingle();
        institutionId = inst?.id || null;
      }

      const action = status === 'approved' ? 'approve' : 'reject';
      const { data, error } = await supabase.functions.invoke("admin-kyb-verify", {
        body: { kyb_id: id, institution_id: institutionId, action, rejection_reason: notes || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-kyc-submissions"] });
      toast({ title: "Business KYC Review Complete", description: `Submission has been ${reviewAction}. Notification sent.` });
      setReviewDialogOpen(false);
      setDetailOpen(false);
      setSelectedKYB(null);
      setReviewNotes("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleReview = (kyb: any, action: "approved" | "rejected") => {
    setSelectedKYB(kyb);
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const submitReview = () => {
    if (selectedKYB) {
      reviewMutation.mutate({ id: selectedKYB.id, status: reviewAction, notes: reviewNotes });
    }
  };

  const openPreview = async (storedPath: string | null, label: string) => {
    if (!storedPath) return;
    const signedUrl = await getKycDocumentUrl(storedPath);
    if (signedUrl) { setPreviewUrl(signedUrl); setPreviewLabel(label); }
  };

  const handleOpenDetail = async (kyb: any) => {
    setSelectedKYB(kyb);
    setDetailOpen(true);
    const urls: Record<string, string> = {};
    for (const doc of DOCS) {
      if (kyb[doc.key]) {
        const signed = await getKycDocumentUrl(kyb[doc.key]);
        if (signed) urls[doc.key] = signed;
      }
    }
    setResolvedThumbs(urls);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
      pending: { variant: "secondary", icon: Clock },
      approved: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
    };
    const c = config[status] || { variant: "outline" as const, icon: Clock };
    return (
      <Badge variant={c.variant} className="flex items-center gap-1 w-fit text-[10px] uppercase tracking-wider">
        <c.icon className="h-3 w-3" />{status}
      </Badge>
    );
  };

  const filterByStatus = (status: string) => {
    let items = kybSubmissions?.filter((k) => k.verification_status === status) || [];
    if (searchQuery) {
      items = items.filter(k => `${k.business_name} ${k.registration_number}`.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return items;
  };

  const allFiltered = searchQuery
    ? kybSubmissions?.filter(k => `${k.business_name} ${k.registration_number}`.toLowerCase().includes(searchQuery.toLowerCase()))
    : kybSubmissions;

  const stats = {
    total: kybSubmissions?.length || 0,
    pending: filterByStatus("pending").length,
    approved: filterByStatus("approved").length,
    rejected: filterByStatus("rejected").length,
  };

  const DOCS = [
    { key: "registration_certificate_url", label: "Registration Certificate" },
    { key: "articles_of_association_url", label: "Articles of Association" },
    { key: "tax_certificate_url", label: "Tax Certificate" },
    { key: "proof_of_address_url", label: "Proof of Address" },
    { key: "bank_statement_url", label: "Bank Statement" },
  ];

  const renderTable = (items: any[]) => (
    <Card className="border-border/60">
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No submissions found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Business</TableHead>
                <TableHead className="text-xs font-semibold">Industry</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Risk</TableHead>
                <TableHead className="text-xs font-semibold">Submitted</TableHead>
                <TableHead className="text-xs font-semibold">Documents</TableHead>
                <TableHead className="text-xs font-semibold w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((kyb) => (
                <TableRow key={kyb.id} className="group">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{kyb.business_name}</p>
                      <p className="text-xs text-muted-foreground">{kyb.business_type} • {kyb.registration_number}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{kyb.industry}</TableCell>
                  <TableCell>{getStatusBadge(kyb.verification_status)}</TableCell>
                  <TableCell>
                    <Badge variant={kyb.risk_rating === "high" ? "destructive" : "outline"} className="text-[10px]">
                      {kyb.risk_rating || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(kyb.created_at), "PP")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {DOCS.filter(d => kyb[d.key]).slice(0, 3).map(d => (
                        <Button key={d.key} variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => openPreview(kyb[d.key], d.label)}>
                          <Eye className="h-3 w-3 mr-1" />{d.label.split(" ")[0]}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenDetail(kyb)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {kyb.verification_status === "pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleReview(kyb, "approved")}>
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleReview(kyb, "rejected")}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Business KYC (KYB) Review</h1>
            <p className="text-xs text-muted-foreground">Review and approve business identity & compliance submissions</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-primary bg-primary/10 border-primary/20" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-200" },
          { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-green-600 bg-green-50 border-green-200" },
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
        <Input placeholder="Search by business name or registration…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
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
            {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p> : renderTable(filterByStatus(status))}
          </TabsContent>
        ))}
        <TabsContent value="all">
          {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p> : renderTable(allFiltered || [])}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Business KYC Detail</DialogTitle></DialogHeader>
          {selectedKYB && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div><p className="text-xs text-muted-foreground">Business Name</p><p className="text-sm font-medium">{selectedKYB.business_name}</p></div>
                <div><p className="text-xs text-muted-foreground">Business Type</p><p className="text-sm">{selectedKYB.business_type}</p></div>
                <div><p className="text-xs text-muted-foreground">Registration No.</p><p className="text-sm font-mono">{selectedKYB.registration_number}</p></div>
                <div><p className="text-xs text-muted-foreground">Industry</p><p className="text-sm">{selectedKYB.industry}</p></div>
                <div><p className="text-xs text-muted-foreground">Tax ID</p><p className="text-sm">{selectedKYB.tax_id || "N/A"}</p></div>
                <div><p className="text-xs text-muted-foreground">Risk Rating</p><Badge variant={selectedKYB.risk_rating === "high" ? "destructive" : "outline"} className="text-[10px]">{selectedKYB.risk_rating || "N/A"}</Badge></div>
                <div><p className="text-xs text-muted-foreground">Annual Turnover</p><p className="text-sm">{selectedKYB.annual_turnover ? `XAF ${selectedKYB.annual_turnover.toLocaleString()}` : "N/A"}</p></div>
                <div><p className="text-xs text-muted-foreground">Employees</p><p className="text-sm">{selectedKYB.number_of_employees || "N/A"}</p></div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Business Documents</p>
                <div className="grid grid-cols-3 gap-3">
                  {DOCS.map(doc => {
                    const storedPath = selectedKYB[doc.key];
                    const thumbUrl = resolvedThumbs[doc.key];
                    const isImage = thumbUrl?.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) || storedPath?.match(/\.(jpg|jpeg|png|webp)/i);
                    return (
                      <button
                        key={doc.key}
                        className="relative rounded-lg border border-border/60 overflow-hidden aspect-[4/3] bg-muted/30 hover:border-primary/50 transition-colors group disabled:opacity-40"
                        disabled={!storedPath}
                        onClick={() => openPreview(storedPath, doc.label)}
                      >
                        {thumbUrl && isImage ? (
                          <>
                            <img src={thumbUrl} alt={doc.label} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </>
                        ) : storedPath ? (
                          <div className="flex flex-col items-center justify-center h-full gap-1">
                            <FileText className="h-6 w-6 text-muted-foreground/50" />
                            <span className="text-[10px] text-muted-foreground">Click to view</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full">
                            <ImageIcon className="h-6 w-6 text-muted-foreground/20" />
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                          <span className="text-[10px] text-white font-medium">{doc.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedKYB.rejection_reason && (
                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <p className="text-xs font-semibold text-destructive mb-1">Rejection Reason</p>
                  <p className="text-sm text-muted-foreground">{selectedKYB.rejection_reason}</p>
                </div>
              )}

              {selectedKYB.verification_status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => handleReview(selectedKYB, "approved")} className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReview(selectedKYB, "rejected")} className="flex-1">
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
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
            <DialogTitle>{reviewAction === "approved" ? "Approve" : "Reject"} Business KYC</DialogTitle>
            <DialogDescription>{reviewAction === "approved" ? "Confirm business verification approval." : "Provide a reason for rejection."}</DialogDescription>
          </DialogHeader>
          {selectedKYB && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-semibold text-sm">{selectedKYB.business_name}</p>
                <p className="text-xs text-muted-foreground">{selectedKYB.business_type} • {selectedKYB.registration_number}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kyb-notes" className="text-xs">Review Notes</Label>
                <Textarea id="kyb-notes" placeholder="Add review notes…" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} className="text-sm" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={submitReview} variant={reviewAction === "approved" ? "default" : "destructive"} disabled={reviewMutation.isPending}>
              {reviewAction === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPreviewLightbox url={previewUrl} label={previewLabel} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
