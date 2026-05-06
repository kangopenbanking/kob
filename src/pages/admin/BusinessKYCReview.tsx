import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getKycDocumentUrl } from "@/lib/kyc-storage";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { DocumentPreviewLightbox } from "@/components/admin/DocumentPreviewLightbox";
import {
  Building2, FileText, CheckCircle, XCircle, Clock, Eye, Search,
  Users, Image as ImageIcon, ShieldCheck, AlertTriangle, Store,
  Landmark, Calendar, Hash, Globe, Briefcase, MoreHorizontal,
  Download, RefreshCw,  ClipboardCheck} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const DOCS = [
  { key: "registration_certificate_url", label: "Registration Certificate", icon: FileText },
  { key: "articles_of_association_url", label: "Articles of Association", icon: FileText },
  { key: "tax_certificate_url", label: "Tax Certificate", icon: FileText },
  { key: "proof_of_address_url", label: "Proof of Address", icon: FileText },
  { key: "bank_statement_url", label: "Bank Statement", icon: FileText },
];

const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock; label: string; className: string }> = {
  pending: { variant: "secondary", icon: Clock, label: "Pending Review", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  approved: { variant: "default", icon: CheckCircle, label: "Approved", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  rejected: { variant: "destructive", icon: XCircle, label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

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

  // ─── Data Fetching ───
  const { data: kybSubmissions, isLoading, isRefetching } = useQuery({
    queryKey: ["business-kyc-submissions"],
    queryFn: async () => {
      const { data: bkycData, error: bkycErr } = await supabase.from("business_kyc").select("*").order("created_at", { ascending: false });
      if (bkycErr) throw bkycErr;

      const { data: merchantData, error: mErr } = await supabase
        .from("gateway_merchants")
        .select("id, business_name, business_email, business_phone, status, kyb_status, metadata, created_at, updated_at, user_id")
        .neq("kyb_status", "not_submitted")
        .order("created_at", { ascending: false });
      if (mErr) throw mErr;

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
          rejection_reason: kybSub.rejection_reason || meta.kyb_rejection_reason || null,
          created_at: kybSub.submitted_at || m.created_at,
          updated_at: m.updated_at,
          user_id: m.user_id,
          business_email: m.business_email,
          business_phone: m.business_phone,
          // Read doc URLs from individual kyb_submission fields first, fall back to documents array
          registration_certificate_url: kybSub.registration_certificate_url || null,
          articles_of_association_url: kybSub.articles_of_association_url || null,
          tax_certificate_url: kybSub.tax_certificate_url || null,
          proof_of_address_url: kybSub.proof_of_address_url || null,
          bank_statement_url: kybSub.bank_statement_url || null,
        };
      });

      const bkycTagged = (bkycData || []).map((b: any) => ({ ...b, _source: "business_kyc" as const }));

      return [...bkycTagged, ...merchantKybs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

  // ─── Mutations ───
  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes, source }: { id: string; status: string; notes: string; source?: string }) => {
      if (source === "gateway_merchant") {
        const decision = status === "approved" ? "approve" : "reject";
        const { data, error } = await supabase.functions.invoke("gateway-merchant-kyb-review", {
          body: { action: "review", merchant_id: id, decision, reason: notes || undefined },
        });
        if (error) throw new Error(extractEdgeFunctionError(error, "Failed to review KYB"));
        if (data?.error || data?.detail) throw new Error(data.error || data.detail);
      } else {
        const { data: kybRecord } = await supabase.from("business_kyc").select("user_id").eq("id", id).single();
        let institutionId: string | null = null;
        if (kybRecord) {
          const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", kybRecord.user_id).maybeSingle();
          institutionId = inst?.id || null;
        }
        const action = status === "approved" ? "approve" : "reject";
        const { data, error } = await supabase.functions.invoke("admin-kyb-verify", {
          body: { kyb_id: id, institution_id: institutionId, action, rejection_reason: notes || undefined },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-kyc-submissions"] });
      toast({ title: "KYB Review Complete", description: `Submission has been ${reviewAction}. Notification sent.` });
      setReviewDialogOpen(false);
      setDetailOpen(false);
      setSelectedKYB(null);
      setReviewNotes("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // ─── Handlers ───
  const handleReview = (kyb: any, action: "approved" | "rejected") => {
    setSelectedKYB(kyb);
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const submitReview = () => {
    if (selectedKYB) {
      reviewMutation.mutate({ id: selectedKYB.id, status: reviewAction, notes: reviewNotes, source: selectedKYB._source });
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

  // ─── Helpers ───
  const getStatusBadge = (status: string) => {
    const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
      <Badge variant="outline" className={`flex items-center gap-1.5 w-fit text-[10px] uppercase tracking-wider font-semibold border ${c.className}`}>
        <c.icon className="h-3 w-3" />{c.label}
      </Badge>
    );
  };

  const getSourceBadge = (source: string) => (
    <Badge variant="outline" className={`text-[10px] font-medium gap-1 ${source === "gateway_merchant" ? "border-primary/30 text-primary" : "border-muted-foreground/30 text-muted-foreground"}`}>
      {source === "gateway_merchant" ? <Store className="h-2.5 w-2.5" /> : <Landmark className="h-2.5 w-2.5" />}
      {source === "gateway_merchant" ? "Merchant" : "Institution"}
    </Badge>
  );

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

  const docCount = (kyb: any) => DOCS.filter(d => kyb[d.key]).length;

  // ─── Loading Skeleton ───
  const renderSkeleton = () => (
    <Card className="border-border/40">
      <CardContent className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  // ─── Table Renderer ───
  const renderTable = (items: any[]) => (
    <Card className="border-border/40 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
              <FileText className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No submissions found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">KYB submissions will appear here once submitted</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 pl-4">Business</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Source</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Risk</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Submitted</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Docs</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-[100px] text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((kyb, idx) => (
                <motion.tr
                  key={`${kyb._source}-${kyb.id}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => handleOpenDetail(kyb)}
                >
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 border border-primary/10 shrink-0">
                        <Building2 className="h-4 w-4 text-primary/70" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{kyb.business_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{kyb.business_type} • {kyb.registration_number}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getSourceBadge(kyb._source)}</TableCell>
                  <TableCell>{getStatusBadge(kyb.verification_status)}</TableCell>
                  <TableCell>
                    {kyb.risk_rating ? (
                      <Badge variant={kyb.risk_rating === "high" ? "destructive" : "outline"} className="text-[10px] font-medium">
                        {kyb.risk_rating === "high" && <AlertTriangle className="h-2.5 w-2.5 mr-1" />}
                        {kyb.risk_rating}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(kyb.created_at), "PP")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[11px] text-muted-foreground font-medium">{docCount(kyb)}/{DOCS.length}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {kyb.verification_status === "pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10" onClick={() => handleReview(kyb, "approved")}>
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleReview(kyb, "rejected")}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => handleOpenDetail(kyb)}>
                            <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                          </DropdownMenuItem>
                          {kyb.verification_status === "pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleReview(kyb, "approved")} className="text-emerald-600">
                                <CheckCircle className="h-3.5 w-3.5 mr-2" /> Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReview(kyb, "rejected")} className="text-destructive">
                                <XCircle className="h-3.5 w-3.5 mr-2" /> Reject
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  // ─── Render ───
  return (
    <div className="space-y-6">
      <AdminPageHeader icon={ClipboardCheck} title="Business KYC Review" description="Review and verify business KYC documentation and submissions">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-primary-foreground hover:bg-primary-foreground/10"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["business-kyc-submissions"] })}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </AdminPageHeader>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Submissions", value: stats.total, icon: Users, className: "bg-primary/5 border-primary/10 text-primary" },
          { label: "Pending Review", value: stats.pending, icon: Clock, className: "bg-amber-500/5 border-amber-500/10 text-amber-600" },
          { label: "Approved", value: stats.approved, icon: CheckCircle, className: "bg-emerald-500/5 border-emerald-500/10 text-emerald-600" },
          { label: "Rejected", value: stats.rejected, icon: XCircle, className: "bg-destructive/5 border-destructive/10 text-destructive" },
        ].map(s => (
          <Card key={s.label} className="border-border/40 shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{s.label}</p>
                  <p className="text-2xl font-bold mt-1 tracking-tight">{isLoading ? "—" : s.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${s.className}`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              {s.label === "Pending Review" && stats.pending > 0 && (
                <p className="text-[10px] text-amber-600/80 mt-2 font-medium">⚡ Requires attention</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Search business name or registration…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm border-border/40 bg-background"
          />
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted/60 p-1 border border-border/30">
          <TabsTrigger value="pending" className="rounded-md px-3 text-xs font-medium data-[state=active]:shadow-sm">
            <Clock className="h-3 w-3 mr-1.5" /> Pending ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="approved" className="rounded-md px-3 text-xs font-medium data-[state=active]:shadow-sm">
            <CheckCircle className="h-3 w-3 mr-1.5" /> Approved ({stats.approved})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="rounded-md px-3 text-xs font-medium data-[state=active]:shadow-sm">
            <XCircle className="h-3 w-3 mr-1.5" /> Rejected ({stats.rejected})
          </TabsTrigger>
          <TabsTrigger value="all" className="rounded-md px-3 text-xs font-medium data-[state=active]:shadow-sm">
            All ({allFiltered?.length || 0})
          </TabsTrigger>
        </TabsList>

        {["pending", "approved", "rejected"].map(status => (
          <TabsContent key={status} value={status}>
            {isLoading ? renderSkeleton() : renderTable(filterByStatus(status))}
          </TabsContent>
        ))}
        <TabsContent value="all">
          {isLoading ? renderSkeleton() : renderTable(allFiltered || [])}
        </TabsContent>
      </Tabs>

      {/* ─── Detail Dialog ─── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">KYB Submission Detail</DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedKYB?.business_name} — {selectedKYB?._source === "gateway_merchant" ? "Merchant" : "Institution"} submission
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedKYB && (
            <div className="px-6 pb-6 space-y-5">
              {/* Status Bar */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/30">
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedKYB.verification_status)}
                  {getSourceBadge(selectedKYB._source)}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Submitted {format(new Date(selectedKYB.created_at), "PPp")}
                </span>
              </div>

              {/* Business Info Grid */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">Business Information</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Building2, label: "Business Name", value: selectedKYB.business_name },
                    { icon: Briefcase, label: "Business Type", value: selectedKYB.business_type },
                    { icon: Hash, label: "Registration No.", value: selectedKYB.registration_number, mono: true },
                    { icon: Globe, label: "Industry", value: selectedKYB.industry },
                    { icon: Hash, label: "Tax ID", value: selectedKYB.tax_id || "N/A" },
                    { icon: AlertTriangle, label: "Risk Rating", value: selectedKYB.risk_rating || "Not assessed" },
                    { icon: Briefcase, label: "Annual Turnover", value: selectedKYB.annual_turnover ? `XAF ${Number(selectedKYB.annual_turnover).toLocaleString()}` : "N/A" },
                    { icon: Users, label: "Employees", value: selectedKYB.number_of_employees || "N/A" },
                  ].map((field) => (
                    <div key={field.label} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/20">
                      <field.icon className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">{field.label}</p>
                        <p className={`text-sm mt-0.5 truncate ${field.mono ? "font-mono" : ""}`}>{field.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedKYB.business_description && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-1">Business Description</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{selectedKYB.business_description}</p>
                </div>
              )}

              <Separator className="opacity-50" />

              {/* Documents */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">Submitted Documents</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {DOCS.map(doc => {
                    const storedPath = selectedKYB[doc.key];
                    const thumbUrl = resolvedThumbs[doc.key];
                    const isImage = thumbUrl?.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) || storedPath?.match(/\.(jpg|jpeg|png|webp)/i);
                    return (
                      <button
                        key={doc.key}
                        className="relative rounded-xl border border-border/40 overflow-hidden aspect-[4/3] bg-muted/20 hover:border-primary/40 transition-all group disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={!storedPath}
                        onClick={() => openPreview(storedPath, doc.label)}
                      >
                        {thumbUrl && isImage ? (
                          <>
                            <img src={thumbUrl} alt={doc.label} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                              <Eye className="h-5 w-5 text-background opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                            </div>
                          </>
                        ) : storedPath ? (
                          <div className="flex flex-col items-center justify-center h-full gap-1.5">
                            <FileText className="h-6 w-6 text-primary/40" />
                            <span className="text-[10px] text-muted-foreground font-medium">Click to view</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full">
                            <ImageIcon className="h-6 w-6 text-muted-foreground/15" />
                            <span className="text-[9px] text-muted-foreground/40 mt-1">Not uploaded</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-foreground/50 to-transparent px-2 py-1.5">
                          <span className="text-[10px] text-background font-medium drop-shadow">{doc.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rejection Reason */}
              {selectedKYB.rejection_reason && (
                <div className="p-3 bg-destructive/5 border border-destructive/15 rounded-xl">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    <p className="text-xs font-semibold text-destructive">Rejection Reason</p>
                  </div>
                  <p className="text-sm text-muted-foreground pl-5">{selectedKYB.rejection_reason}</p>
                </div>
              )}

              {/* Action Buttons */}
              {selectedKYB.verification_status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => handleReview(selectedKYB, "approved")} className="flex-1 h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <CheckCircle className="h-4 w-4" /> Approve KYB
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReview(selectedKYB, "rejected")} className="flex-1 h-9 gap-1.5">
                    <XCircle className="h-4 w-4" /> Reject KYB
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Review Confirmation Dialog ─── */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${reviewAction === "approved" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-destructive/10 border-destructive/20"}`}>
                {reviewAction === "approved" ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-destructive" />}
              </div>
              <div>
                <DialogTitle className="text-base">{reviewAction === "approved" ? "Approve" : "Reject"} KYB Submission</DialogTitle>
                <DialogDescription className="text-xs">{reviewAction === "approved" ? "Confirm business verification approval." : "Provide a detailed reason for rejection."}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedKYB && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border/30">
                <Building2 className="h-5 w-5 text-primary/50 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedKYB.business_name}</p>
                  <p className="text-[11px] text-muted-foreground">{selectedKYB.business_type} • {selectedKYB.registration_number}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kyb-notes" className="text-xs font-medium">
                  {reviewAction === "rejected" ? "Rejection Reason *" : "Review Notes (optional)"}
                </Label>
                <Textarea
                  id="kyb-notes"
                  placeholder={reviewAction === "rejected" ? "Please provide a clear reason for rejection…" : "Add any review notes…"}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setReviewDialogOpen(false)} className="h-9">Cancel</Button>
            <Button
              size="sm"
              onClick={submitReview}
              className={`h-9 gap-1.5 ${reviewAction === "approved" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
              variant={reviewAction === "rejected" ? "destructive" : "default"}
              disabled={reviewMutation.isPending || (reviewAction === "rejected" && !reviewNotes.trim())}
            >
              {reviewMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : reviewAction === "approved" ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {reviewAction === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPreviewLightbox url={previewUrl} label={previewLabel} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}
