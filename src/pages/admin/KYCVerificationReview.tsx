import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { DocumentPreviewLightbox } from "@/components/admin/DocumentPreviewLightbox";
import { Shield, FileText, CheckCircle, XCircle, Clock, Eye, Image as ImageIcon, Search, Users, Filter } from "lucide-react";
import { format } from "date-fns";

export default function KYCVerificationReview() {
  const [selectedKYC, setSelectedKYC] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: kycSubmissions, isLoading } = useQuery({
    queryKey: ["kyc-submissions-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*, profiles(full_name, email)")
        .is("institution_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const getDisplayName = (kyc: any) => {
    const profile = kyc.profiles as any;
    return profile?.full_name || `User ${kyc.user_id?.slice(0, 8)}`;
  };

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { error } = await supabase
        .from("kyc_verifications")
        .update({ status, updated_at: new Date().toISOString(), rejection_reason: notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-submissions-admin"] });
      toast({ title: "KYC Review Complete", description: `Submission has been ${reviewAction}.` });
      setReviewDialogOpen(false);
      setDetailOpen(false);
      setSelectedKYC(null);
      setReviewNotes("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleReview = (kyc: any, action: "approved" | "rejected") => {
    setSelectedKYC(kyc);
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const submitReview = () => {
    if (selectedKYC) {
      reviewMutation.mutate({ id: selectedKYC.id, status: reviewAction, notes: reviewNotes });
    }
  };

  const openPreview = (url: string | null, label: string) => {
    if (url) { setPreviewUrl(url); setPreviewLabel(label); }
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
    let items = kycSubmissions?.filter((kyc) => kyc.status === status) || [];
    if (searchQuery) {
      items = items.filter(k =>
        `${getDisplayName(k)} ${k.document_number}`.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return items;
  };

  const allFiltered = searchQuery
    ? kycSubmissions?.filter(k => `${getDisplayName(k)} ${k.document_number}`.toLowerCase().includes(searchQuery.toLowerCase()))
    : kycSubmissions;

  const stats = {
    total: kycSubmissions?.length || 0,
    pending: filterByStatus("pending").length,
    approved: filterByStatus("approved").length,
    rejected: filterByStatus("rejected").length,
  };

  const DocButton = ({ url, label }: { url: string | null; label: string }) => (
    <Button variant="outline" size="sm" disabled={!url} onClick={() => openPreview(url, label)} className="text-xs h-8">
      <Eye className="h-3 w-3 mr-1" />{label}
    </Button>
  );

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
                <TableHead className="text-xs font-semibold">Applicant</TableHead>
                <TableHead className="text-xs font-semibold">Document</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Submitted</TableHead>
                <TableHead className="text-xs font-semibold">Documents</TableHead>
                <TableHead className="text-xs font-semibold w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((kyc) => (
                <TableRow key={kyc.id} className="group">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{getDisplayName(kyc)}</p>
                      <p className="text-xs text-muted-foreground font-mono">{kyc.user_id?.slice(0, 8)}…</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm capitalize">{kyc.document_type?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{kyc.document_number}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(kyc.created_at), "PP")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <DocButton url={kyc.document_front_url} label="Front" />
                      <DocButton url={kyc.document_back_url} label="Back" />
                      <DocButton url={kyc.selfie_url} label="Selfie" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedKYC(kyc); setDetailOpen(true); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {kyc.status === "pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleReview(kyc, "approved")}>
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleReview(kyc, "rejected")}>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">KYC Verification Review</h1>
            <p className="text-xs text-muted-foreground">Review and approve individual identity verification submissions</p>
          </div>
        </div>
      </div>

      {/* Stats */}
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or document number..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="pending" className="rounded-md px-3 text-xs font-medium">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="approved" className="rounded-md px-3 text-xs font-medium">Approved ({stats.approved})</TabsTrigger>
          <TabsTrigger value="rejected" className="rounded-md px-3 text-xs font-medium">Rejected ({stats.rejected})</TabsTrigger>
          <TabsTrigger value="all" className="rounded-md px-3 text-xs font-medium">All ({allFiltered?.length || 0})</TabsTrigger>
        </TabsList>

        {["pending", "approved", "rejected"].map((status) => (
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
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>KYC Submission Detail</DialogTitle>
          </DialogHeader>
          {selectedKYC && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div><p className="text-xs text-muted-foreground">Full Name</p><p className="text-sm font-medium">{getDisplayName(selectedKYC)}</p></div>
                <div><p className="text-xs text-muted-foreground">Document Type</p><p className="text-sm capitalize">{selectedKYC.document_type?.replace(/_/g, " ")}</p></div>
                <div><p className="text-xs text-muted-foreground">Document Number</p><p className="text-sm font-mono">{selectedKYC.document_number}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p>{getStatusBadge(selectedKYC.status)}</div>
                <div><p className="text-xs text-muted-foreground">Submitted</p><p className="text-sm">{format(new Date(selectedKYC.created_at), "PPp")}</p></div>
                <div><p className="text-xs text-muted-foreground">User ID</p><p className="text-sm font-mono text-xs">{selectedKYC.user_id?.slice(0, 12)}…</p></div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Uploaded Documents</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { url: selectedKYC.document_front_url, label: "ID Front" },
                    { url: selectedKYC.document_back_url, label: "ID Back" },
                    { url: selectedKYC.selfie_url, label: "Selfie" },
                  ].map(doc => (
                    <button
                      key={doc.label}
                      className="relative rounded-lg border border-border/60 overflow-hidden aspect-[4/3] bg-muted/30 hover:border-primary/50 transition-colors group disabled:opacity-40"
                      disabled={!doc.url}
                      onClick={() => openPreview(doc.url, doc.label)}
                    >
                      {doc.url ? (
                        <>
                          <img src={doc.url} alt={doc.label} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                        <span className="text-[10px] text-white font-medium">{doc.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedKYC.rejection_reason && (
                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <p className="text-xs font-semibold text-destructive mb-1">Rejection Reason</p>
                  <p className="text-sm text-muted-foreground">{selectedKYC.rejection_reason}</p>
                </div>
              )}

              {selectedKYC.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => handleReview(selectedKYC, "approved")} className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReview(selectedKYC, "rejected")} className="flex-1">
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
            <DialogTitle>{reviewAction === "approved" ? "Approve" : "Reject"} KYC Submission</DialogTitle>
            <DialogDescription>
              {reviewAction === "approved" ? "Confirm identity verification approval." : "Provide a reason for rejection."}
            </DialogDescription>
          </DialogHeader>
          {selectedKYC && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-semibold text-sm">{selectedKYC.first_name} {selectedKYC.last_name}</p>
                <p className="text-xs text-muted-foreground">{selectedKYC.document_type} • {selectedKYC.document_number}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-notes" className="text-xs">Review Notes {reviewAction === "rejected" && <span className="text-destructive">*</span>}</Label>
                <Textarea id="review-notes" placeholder="Add review notes…" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} className="text-sm" />
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

      {/* Document Preview Lightbox */}
      <DocumentPreviewLightbox url={previewUrl} label={previewLabel} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
