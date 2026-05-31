import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DocumentPreviewLightbox } from "@/components/admin/DocumentPreviewLightbox";
import { getKycDocumentUrl } from "@/lib/kyc-storage";
import {
  Shield, FileText, CheckCircle, XCircle, Clock, Eye,
  Image as ImageIcon, Search, Users, User, Calendar, Hash,
  ArrowRight, Loader2, Download, MessageSquare, HelpCircle,
  Building2, Smartphone, History, Layers,
} from "lucide-react";
import { format } from "date-fns";
import { useKycReviewPermissions } from "@/hooks/useKycReviewPermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function KYCVerificationReview() {
  const [selectedKYC, setSelectedKYC] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected" | "info_requested">("approved");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dedupeByUser, setDedupeByUser] = useState(true);
  const [resolvedThumbs, setResolvedThumbs] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canReview, loading: permLoading } = useKycReviewPermissions();

  const { data: kycSubmissions, isLoading } = useQuery({
    queryKey: ["kyc-submissions-admin"],
    queryFn: async () => {
      const allData: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("kyc_verifications")
          .select("*, profiles(full_name, email)")
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });

  const getDisplayName = (kyc: any) => {
    const profile = kyc.profiles as any;
    return profile?.full_name || `User ${kyc.user_id?.slice(0, 8)}`;
  };

  const getEmail = (kyc: any) => {
    const profile = kyc.profiles as any;
    return profile?.email || null;
  };

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const body: Record<string, unknown> = { kyc_id: id, action: status };
      if (status === "rejected") body.rejection_reason = notes;
      if (status === "info_requested") body.info_request_message = notes;
      const { data, error } = await supabase.functions.invoke("admin-kyc-review", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-submissions-admin"] });
      const labels: Record<string, string> = {
        approved: "approved",
        rejected: "rejected",
        info_requested: "marked as needing more information",
      };
      toast({ title: "KYC Review Complete", description: `Submission has been ${labels[reviewAction]}. Notification sent to customer.` });
      setReviewDialogOpen(false);
      setDetailOpen(false);
      setSelectedKYC(null);
      setReviewNotes("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleReview = (kyc: any, action: "approved" | "rejected" | "info_requested") => {
    setSelectedKYC(kyc);
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const handleOpenDetail = async (kyc: any) => {
    setSelectedKYC(kyc);
    setDetailOpen(true);
    const urls: Record<string, string> = {};
    for (const field of ['document_front_url', 'document_back_url', 'selfie_url'] as const) {
      if (kyc[field]) {
        const signed = await getKycDocumentUrl(kyc[field]);
        if (signed) urls[field] = signed;
      }
    }
    setResolvedThumbs(urls);
  };

  const submitReview = () => {
    if (selectedKYC) {
      reviewMutation.mutate({ id: selectedKYC.id, status: reviewAction, notes: reviewNotes });
    }
  };

  const openPreview = async (storedPath: string | null, label: string) => {
    if (!storedPath) return;
    const signedUrl = await getKycDocumentUrl(storedPath);
    if (signedUrl) { setPreviewUrl(signedUrl); setPreviewLabel(label); }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock; label: string; className: string }> = {
      pending: { variant: "outline", icon: Clock, label: "Pending Review", className: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" },
      approved: { variant: "outline", icon: CheckCircle, label: "Approved", className: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" },
      rejected: { variant: "outline", icon: XCircle, label: "Rejected", className: "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800" },
      info_requested: { variant: "outline", icon: HelpCircle, label: "Info Requested", className: "border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800" },
    };
    return configs[status] || configs.pending;
  };

  const getStatusBadge = (status: string) => {
    const c = getStatusConfig(status);
    return (
      <Badge variant={c.variant} className={`flex items-center gap-1.5 w-fit text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 ${c.className}`}>
        <c.icon className="h-3 w-3" />{c.label}
      </Badge>
    );
  };

  const filterByStatus = (status: string) => {
    let items = kycSubmissions?.filter((kyc) => kyc.status === status) || [];
    if (searchQuery) {
      items = items.filter(k =>
        `${getDisplayName(k)} ${k.document_number} ${getEmail(k) || ""}`.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return items;
  };

  const allFiltered = searchQuery
    ? kycSubmissions?.filter(k => `${getDisplayName(k)} ${k.document_number} ${getEmail(k) || ""}`.toLowerCase().includes(searchQuery.toLowerCase()))
    : kycSubmissions;

  const stats = {
    total: kycSubmissions?.length || 0,
    pending: filterByStatus("pending").length,
    approved: filterByStatus("approved").length,
    rejected: filterByStatus("rejected").length,
    info_requested: filterByStatus("info_requested").length,
  };

  // ── Loading skeleton ──
  const TableSkeleton = () => (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-1.5">
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // ── Document indicator for table rows ──
  const DocIndicator = ({ url, label }: { url: string | null; label: string }) => (
    <button
      disabled={!url}
      onClick={() => openPreview(url, label)}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-all
        ${url
          ? "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/40 cursor-pointer"
          : "border-border/40 bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
        }`}
    >
      {url ? <Eye className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
      {label}
    </button>
  );

  const renderTable = (items: any[]) => (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-2xl bg-muted/50 p-5 mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No submissions found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Submissions matching your criteria will appear here</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/30">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pl-6">Applicant</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Document</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Submitted</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((kyc) => (
                <TableRow key={kyc.id} className="group hover:bg-muted/20 transition-colors">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{getDisplayName(kyc)}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{getEmail(kyc) || `ID: ${kyc.user_id?.slice(0, 8)}…`}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium capitalize">{kyc.document_type?.replace(/_/g, " ")}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{kyc.document_number}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span className="text-xs">{format(new Date(kyc.created_at), "dd MMM yyyy")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <DocIndicator url={kyc.document_front_url} label="Front" />
                      <DocIndicator url={kyc.document_back_url} label="Back" />
                      <DocIndicator url={kyc.selfie_url} label="Selfie" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 font-medium"
                        onClick={() => handleOpenDetail(kyc)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Review
                      </Button>
                      {kyc.status === "pending" && canReview && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleReview(kyc, "approved")} title="Approve">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-50" onClick={() => handleReview(kyc, "info_requested")} title="Request more info">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleReview(kyc, "rejected")} title="Reject">
                            <XCircle className="h-4 w-4" />
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
      <AdminPageHeader icon={Shield} title="KYC Verification" description="Review and approve customer identity submissions" />
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, or doc #..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-64 text-sm bg-background"
          />
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Submissions", value: stats.total, icon: Users, iconBg: "bg-primary/10 text-primary" },
          { label: "Pending Review", value: stats.pending, icon: Clock, iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" },
          { label: "Approved", value: stats.approved, icon: CheckCircle, iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" },
          { label: "Rejected", value: stats.rejected, icon: XCircle, iconBg: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400" },
        ].map(s => (
          <Card key={s.label} className="relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground">{isLoading ? "—" : s.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="inline-flex h-10 items-center rounded-xl bg-muted p-1 gap-0.5">
          {[
            { value: "pending", label: "Pending", count: stats.pending },
            { value: "info_requested", label: "Info Requested", count: stats.info_requested },
            { value: "approved", label: "Approved", count: stats.approved },
            { value: "rejected", label: "Rejected", count: stats.rejected },
            { value: "all", label: "All", count: allFiltered?.length || 0 },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-lg px-4 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              {tab.label}
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/10 px-1.5 text-[10px] font-bold tabular-nums">
                {isLoading ? "…" : tab.count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {["pending", "info_requested", "approved", "rejected"].map((status) => (
          <TabsContent key={status} value={status}>
            {isLoading ? <TableSkeleton /> : renderTable(filterByStatus(status))}
          </TabsContent>
        ))}
        <TabsContent value="all">
          {isLoading ? <TableSkeleton /> : renderTable(allFiltered || [])}
        </TabsContent>
      </Tabs>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden">
          <div className="bg-primary/5 border-b px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                KYC Submission Detail
              </DialogTitle>
            </DialogHeader>
          </div>
          {selectedKYC && (
            <div className="p-6 space-y-6">
              {/* Applicant info */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-foreground">{getDisplayName(selectedKYC)}</p>
                  <p className="text-sm text-muted-foreground">{getEmail(selectedKYC) || `User ${selectedKYC.user_id?.slice(0, 12)}…`}</p>
                </div>
                {getStatusBadge(selectedKYC.status)}
              </div>

              {/* Detail grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { icon: FileText, label: "Document Type", value: selectedKYC.document_type?.replace(/_/g, " ") },
                  { icon: Hash, label: "Document Number", value: selectedKYC.document_number, mono: true },
                  { icon: Calendar, label: "Submitted", value: format(new Date(selectedKYC.created_at), "dd MMM yyyy, HH:mm") },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-muted/40 border border-border/50 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <item.icon className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                    </div>
                    <p className={`text-sm font-medium capitalize ${item.mono ? "font-mono" : ""}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Documents gallery */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Submitted Documents
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "document_front_url", label: "ID Front" },
                    { key: "document_back_url", label: "ID Back" },
                    { key: "selfie_url", label: "Selfie" },
                  ].map(doc => {
                    const storedPath = selectedKYC[doc.key];
                    const thumbUrl = resolvedThumbs[doc.key];
                    return (
                      <button
                        key={doc.label}
                        className="relative rounded-xl border-2 border-border/50 overflow-hidden aspect-[4/3] bg-muted/20 hover:border-primary/50 transition-all group disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        disabled={!storedPath}
                        onClick={() => openPreview(storedPath, doc.label)}
                      >
                        {thumbUrl ? (
                          <>
                            <img src={thumbUrl} alt={doc.label} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-lg p-2 shadow-lg">
                                <Eye className="h-5 w-5 text-foreground" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-1.5">
                            {storedPath ? (
                              <>
                                <div className="rounded-lg bg-primary/10 p-2">
                                  <FileText className="h-5 w-5 text-primary/60" />
                                </div>
                                <span className="text-[10px] text-primary/60 font-semibold">Click to view</span>
                              </>
                            ) : (
                              <>
                                <div className="rounded-lg bg-muted p-2">
                                  <ImageIcon className="h-5 w-5 text-muted-foreground/25" />
                                </div>
                                <span className="text-[10px] text-muted-foreground/40 font-medium">Not uploaded</span>
                              </>
                            )}
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 py-2">
                          <span className="text-[11px] text-white font-semibold">{doc.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rejection reason */}
              {selectedKYC.rejection_reason && (
                <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-destructive mb-1">Rejection Reason</p>
                    <p className="text-sm text-muted-foreground">{selectedKYC.rejection_reason}</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {selectedKYC.status === "pending" && canReview && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button onClick={() => handleReview(selectedKYC, "approved")} className="flex-1 min-w-[140px] h-10 font-semibold gap-2">
                    <CheckCircle className="h-4 w-4" /> Approve
                  </Button>
                  <Button variant="outline" onClick={() => handleReview(selectedKYC, "info_requested")} className="flex-1 min-w-[140px] h-10 font-semibold gap-2 border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300">
                    <MessageSquare className="h-4 w-4" /> Request more info
                  </Button>
                  <Button variant="destructive" onClick={() => handleReview(selectedKYC, "rejected")} className="flex-1 min-w-[140px] h-10 font-semibold gap-2">
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
              {selectedKYC.status === "pending" && !canReview && !permLoading && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  You do not have permission to act on KYC submissions. Contact a compliance officer or platform admin.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Review Confirmation Dialog ── */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewAction === "approved" ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : reviewAction === "info_requested" ? (
                <MessageSquare className="h-5 w-5 text-sky-600" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {reviewAction === "approved" ? "Approve" : reviewAction === "info_requested" ? "Request More Information" : "Reject"} KYC Submission
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approved"
                ? "Confirm identity verification approval. The customer will be notified."
                : reviewAction === "info_requested"
                ? "Describe what additional information or documents are required. The customer will receive an email and in-app notification with this message and can resubmit."
                : "Provide a clear reason for rejection. The customer will be notified."}
            </DialogDescription>
          </DialogHeader>
          {selectedKYC && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{getDisplayName(selectedKYC)}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedKYC.document_type?.replace(/_/g, " ")} • {selectedKYC.document_number}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-notes" className="text-xs font-semibold">
                  {reviewAction === "info_requested" ? "Message to customer" : "Review Notes"}
                  {(reviewAction === "rejected" || reviewAction === "info_requested") && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Textarea
                  id="review-notes"
                  placeholder={
                    reviewAction === "rejected"
                      ? "Explain why this submission is being rejected…"
                      : reviewAction === "info_requested"
                      ? "e.g. Please upload a clearer photo of the back of your ID and a fresh selfie holding the document."
                      : "Optional notes…"
                  }
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  className="text-sm resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={submitReview}
              variant={reviewAction === "rejected" ? "destructive" : "default"}
              disabled={
                reviewMutation.isPending ||
                ((reviewAction === "rejected" || reviewAction === "info_requested") && !reviewNotes.trim())
              }
              className="gap-2"
            >
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {reviewAction === "approved" ? "Approve" : reviewAction === "info_requested" ? "Send request" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Lightbox */}
      <DocumentPreviewLightbox url={previewUrl} label={previewLabel} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
