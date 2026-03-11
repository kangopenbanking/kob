import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { RefreshCw, Banknote, FileText, Calendar, CreditCard, Search, Plus, Download, Eye, TrendingUp, CheckCircle, XCircle, Clock, ToggleLeft, Star, Users, AlertTriangle, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const statusStyles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  draft: { variant: "outline", className: "" },
  submitted: { variant: "secondary", className: "bg-fi-amber/15 text-fi-amber border-fi-amber/30" },
  under_review: { variant: "secondary", className: "bg-fi-blue/15 text-fi-blue border-fi-blue/30" },
  approved: { variant: "default", className: "bg-fi-green/15 text-fi-green border-fi-green/30" },
  disbursed: { variant: "default", className: "bg-fi-teal/15 text-fi-teal border-fi-teal/30" },
  rejected: { variant: "destructive", className: "bg-destructive/15 text-destructive border-destructive/30" },
  defaulted: { variant: "destructive", className: "" },
  closed: { variant: "secondary", className: "" },
  active: { variant: "default", className: "bg-fi-green/15 text-fi-green border-fi-green/30" },
};

export default function InstitutionLoans() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [preapprovedOffers, setPreapprovedOffers] = useState<any[]>([]);
  const [marketplaceApps, setMarketplaceApps] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Detail sheet
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [selectedMarketplaceApp, setSelectedMarketplaceApp] = useState<any>(null);

  // Create product dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create pre-approved offer dialog
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [actingOnApp, setActingOnApp] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [declineReasonInput, setDeclineReasonInput] = useState("");
  const [newOffer, setNewOffer] = useState({
    product_name: "", description: "", min_credit_score: 650, max_credit_score: 850,
    min_amount: "100000", max_amount: "5000000", interest_rate_annual: "15",
    max_tenure_months: "36", requires_existing_account: false,
  });
  const [newProduct, setNewProduct] = useState({
    product_name: "", product_code: "", loan_type: "personal_loan" as string,
    interest_rate: "12", interest_calculation_method: "reducing_balance",
    min_amount: "50000", max_amount: "5000000",
    min_tenure_months: "3", max_tenure_months: "60",
    processing_fee_percentage: "1", description: "",
    requires_collateral: false, requires_guarantor: false,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      let instId: string | null = null;
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (institution) {
        instId = institution.id;
      } else {
        const { data: staff } = await supabase.from("staff_assignments").select("institution_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
        if (staff) instId = staff.institution_id;
      }
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);

      const { data: prods } = await supabase.from("loan_products").select("*").eq("institution_id", instId).order("created_at", { ascending: false });
      setProducts(prods || []);
      const productIds = (prods || []).map(p => p.id);
      if (productIds.length > 0) {
        const { data: apps } = await supabase.from("loan_applications").select("*").in("loan_product_id", productIds).order("created_at", { ascending: false });
        setApplications(apps || []);
        const appIds = (apps || []).map(a => a.id);
        if (appIds.length > 0) {
          const { data: loanAccounts } = await supabase.from("loan_accounts").select("id").in("application_id", appIds);
          const loanAccountIds = (loanAccounts || []).map(la => la.id);
          if (loanAccountIds.length > 0) {
            const { data: reps } = await supabase.from("loan_repayments").select("*").in("loan_id", loanAccountIds).order("created_at", { ascending: false }).limit(200);
            setRepayments(reps || []);
          }
        }
      }
      // Load pre-approved offers
      const { data: offers } = await supabase.from("preapproved_loan_offers").select("*").eq("institution_id", instId).order("created_at", { ascending: false });
      setPreapprovedOffers(offers || []);

      // Load marketplace applications (pre-approved loan applications)
      const { data: mktApps } = await supabase.from("preapproved_loan_applications").select("*").eq("institution_id", instId).order("created_at", { ascending: false });
      setMarketplaceApps(mktApps || []);
    } catch (error) { console.error("Error loading loans:", error); }
    finally { setLoading(false); }
  };

  const handleCreateProduct = async () => {
    if (!institutionId || !newProduct.product_name || !newProduct.product_code) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("loan_products").insert({
        institution_id: institutionId,
        product_name: newProduct.product_name,
        product_code: newProduct.product_code,
        loan_type: newProduct.loan_type as any,
        interest_rate: Number(newProduct.interest_rate),
        interest_calculation_method: newProduct.interest_calculation_method,
        min_amount: Number(newProduct.min_amount),
        max_amount: Number(newProduct.max_amount),
        min_tenure_months: Number(newProduct.min_tenure_months),
        max_tenure_months: Number(newProduct.max_tenure_months),
        processing_fee_percentage: Number(newProduct.processing_fee_percentage) || null,
        description: newProduct.description || null,
        requires_collateral: newProduct.requires_collateral,
        requires_guarantor: newProduct.requires_guarantor,
        is_active: true,
      });
      if (error) throw error;
      toast.success("Loan product created successfully");
      setShowCreate(false);
      setNewProduct({ product_name: "", product_code: "", loan_type: "personal_loan", interest_rate: "12", interest_calculation_method: "reducing_balance", min_amount: "50000", max_amount: "5000000", min_tenure_months: "3", max_tenure_months: "60", processing_fee_percentage: "1", description: "", requires_collateral: false, requires_guarantor: false });
      loadData();
    } catch (err: any) { toast.error(err.message || "Failed to create product"); }
    finally { setCreating(false); }
  };

  const handleToggleProduct = async (productId: string, currentActive: boolean) => {
    const { error } = await supabase.from("loan_products").update({ is_active: !currentActive }).eq("id", productId);
    if (error) { toast.error("Failed to update product"); return; }
    toast.success(`Product ${!currentActive ? 'activated' : 'deactivated'}`);
    loadData();
  };

  const handleUpdateApplicationStatus = async (appId: string, newStatus: "active" | "approved" | "completed" | "defaulted" | "disbursed" | "draft" | "rejected" | "submitted" | "under_review" | "written_off") => {
    const { error } = await supabase.from("loan_applications").update({ status: newStatus }).eq("id", appId);
    if (error) { toast.error("Failed to update status"); return; }
    toast.success(`Application ${newStatus}`);
    setSelectedApp(null);
    loadData();
  };

  const handleCreatePreapprovedOffer = async () => {
    if (!institutionId || !newOffer.product_name) return;
    setCreatingOffer(true);
    try {
      const { error } = await supabase.from("preapproved_loan_offers").insert({
        institution_id: institutionId,
        product_name: newOffer.product_name,
        description: newOffer.description || null,
        min_credit_score: newOffer.min_credit_score,
        max_credit_score: newOffer.max_credit_score,
        min_amount: Number(newOffer.min_amount),
        max_amount: Number(newOffer.max_amount),
        interest_rate_annual: Number(newOffer.interest_rate_annual),
        max_tenure_months: Number(newOffer.max_tenure_months),
        requires_existing_account: newOffer.requires_existing_account,
        is_active: true,
      });
      if (error) throw error;
      toast.success("Pre-approved offer created successfully");
      setShowCreateOffer(false);
      setNewOffer({ product_name: "", description: "", min_credit_score: 650, max_credit_score: 850, min_amount: "100000", max_amount: "5000000", interest_rate_annual: "15", max_tenure_months: "36", requires_existing_account: false });
      loadData();
    } catch (err: any) { toast.error(err.message || "Failed to create offer"); }
    finally { setCreatingOffer(false); }
  };

  const handleToggleOffer = async (offerId: string, currentActive: boolean) => {
    const { error } = await supabase.from("preapproved_loan_offers").update({ is_active: !currentActive }).eq("id", offerId);
    if (error) { toast.error("Failed to update offer"); return; }
    toast.success(`Offer ${!currentActive ? 'activated' : 'deactivated'}`);
    loadData();
  };

  const handleUpdateMarketplaceApp = async (appId: string, newStatus: string, declineReason?: string) => {
    // For approve/decline after hard check, use the edge function for notifications
    if ((newStatus === 'approved' || newStatus === 'declined') && selectedMarketplaceApp?.status === 'hard_check_initiated') {
      setActingOnApp(true);
      const { data, error } = await supabase.functions.invoke('credit-ops', {
        body: { action: 'review-application', application_id: appId, decision: newStatus, decline_reason: declineReason || undefined, review_notes: reviewNotes || undefined },
      });
      setActingOnApp(false);
      if (error || data?.error) {
        toast.error(data?.error || 'Failed to submit decision');
        return;
      }
      toast.success(`Application ${newStatus}. Customer notified via push & email.`);
      setSelectedMarketplaceApp(null);
      setReviewNotes('');
      setDeclineReasonInput('');
      loadData();
      return;
    }

    const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (declineReason) updateData.decline_reason = declineReason;
    if (newStatus === 'declined') updateData.score_impact = -5;
    const { error } = await supabase.from("preapproved_loan_applications").update(updateData).eq("id", appId);
    if (error) { toast.error("Failed to update application"); return; }
    toast.success(`Application ${newStatus}`);
    setSelectedMarketplaceApp(null);
    setReviewNotes('');
    setDeclineReasonInput('');
    loadData();
  };

  const exportCSV = () => {
    const headers = ["Application #", "Amount", "Tenure", "Status", "Purpose", "Credit Score", "Date"];
    const rows = applications.map(a => [a.application_number, a.requested_amount, a.tenure_months, a.status, a.purpose, a.credit_score || '', a.created_at ? format(new Date(a.created_at), 'yyyy-MM-dd') : '']);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `loan-applications-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const totalRequested = applications.reduce((s, a) => s + Number(a.requested_amount || 0), 0);
  const approvedCount = applications.filter(a => ['approved', 'disbursed', 'active'].includes(a.status)).length;
  const pendingCount = applications.filter(a => ['submitted', 'under_review'].includes(a.status)).length;
  const totalRepaid = repayments.reduce((s, r) => s + Number(r.amount || 0), 0);

  const filteredProducts = useMemo(() => products.filter(p => {
    if (searchQuery && !p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.product_code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }), [products, searchQuery]);

  const filteredApplications = useMemo(() => applications.filter(a => {
    if (searchQuery && !(a.application_number || "").toLowerCase().includes(searchQuery.toLowerCase()) && !(a.purpose || "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  }), [applications, searchQuery, statusFilter]);

  const stats = [
    { label: "Total Requested", value: `${(totalRequested / 1000000).toFixed(1)}M XAF`, icon: Banknote, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20", sub: `${applications.length} applications` },
    { label: "Approved", value: approvedCount, icon: CheckCircle, color: "text-fi-green bg-fi-green/10 border-fi-green/20", sub: `${applications.length > 0 ? ((approvedCount / applications.length) * 100).toFixed(0) : 0}% approval rate` },
    { label: "Pending Review", value: pendingCount, icon: Clock, color: "text-fi-blue bg-fi-blue/10 border-fi-blue/20", sub: "Awaiting decision" },
    { label: "Total Repaid", value: `${totalRepaid.toLocaleString()} XAF`, icon: TrendingUp, color: "text-fi-purple bg-fi-purple/10 border-fi-purple/20", sub: `${repayments.length} payments` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-amber/10 border border-fi-amber/20">
            <Banknote className="h-5.5 w-5.5 text-fi-amber" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Loans Management</h1>
            <p className="text-xs text-muted-foreground">Products, applications, approvals & repayments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-xs"><Download className="h-3.5 w-3.5" />Export</Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 text-xs bg-fi-amber text-white hover:bg-fi-amber/90"><Plus className="h-3.5 w-3.5" />New Product</Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial="hidden" animate="visible" variants={fadeUp} custom={i + 1}>
            <Card className="border-border/60 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
                <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-20" /> : s.value}</div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{s.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products or applications..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="disbursed">Disbursed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Tabs */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={6}>
        <Tabs defaultValue="applications" className="space-y-4">
          <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1 flex-wrap">
            <TabsTrigger value="applications" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Applications ({filteredApplications.length})</TabsTrigger>
            <TabsTrigger value="products" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Products ({filteredProducts.length})</TabsTrigger>
            <TabsTrigger value="repayments" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Repayments ({repayments.length})</TabsTrigger>
            <TabsTrigger value="preapproved" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1">
              <Star className="h-3 w-3" />Pre-Approved ({preapprovedOffers.length})
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1">
              <Users className="h-3 w-3" />Marketplace ({marketplaceApps.length})
            </TabsTrigger>
          </TabsList>

          {/* Applications */}
          <TabsContent value="applications">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Loan Applications</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[10px] bg-fi-amber/10 text-fi-amber">{pendingCount} pending</Badge>
                  <Badge variant="outline" className="text-[10px] bg-fi-green/10 text-fi-green">{approvedCount} approved</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div> : filteredApplications.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No loan applications</p>
                    <p className="text-xs mt-1">Applications from the banking app will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Application #</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tenure</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Purpose</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Credit Score</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Decision</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredApplications.map(a => {
                          const style = statusStyles[a.status] || statusStyles.draft;
                          return (
                            <TableRow key={a.id} className="hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setSelectedApp(a)}>
                              <TableCell className="font-mono text-xs text-muted-foreground">{a.application_number}</TableCell>
                              <TableCell className="text-sm font-semibold">{Number(a.requested_amount).toLocaleString()} XAF</TableCell>
                              <TableCell className="text-sm">{a.tenure_months}mo</TableCell>
                              <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">{a.purpose || '—'}</TableCell>
                              <TableCell>
                                {a.credit_score ? (
                                  <Badge variant="outline" className={`text-[10px] ${a.credit_score >= 700 ? 'bg-fi-green/10 text-fi-green' : a.credit_score >= 580 ? 'bg-fi-amber/10 text-fi-amber' : 'bg-destructive/10 text-destructive'}`}>
                                    {a.credit_score}
                                  </Badge>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell>
                                {a.auto_decision ? (
                                  <Badge variant="outline" className="text-[10px] capitalize">{a.auto_decision.replace('_', ' ')}</Badge>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell><Badge variant={style.variant} className={`text-[10px] ${style.className}`}>{a.status}</Badge></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{a.created_at ? format(new Date(a.created_at), 'PP') : '—'}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={e => { e.stopPropagation(); setSelectedApp(a); }}>
                                  <Eye className="h-3 w-3" />Review
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products */}
          <TabsContent value="products">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Loan Products</CardTitle>
                <Badge variant="outline" className="text-[10px]">{products.filter(p => p.is_active).length} active</Badge>
              </CardHeader>
              <CardContent>
                {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div> : filteredProducts.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Banknote className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No loan products</p>
                    <Button size="sm" onClick={() => setShowCreate(true)} className="mt-4 gap-1.5"><Plus className="h-3.5 w-3.5" />Create Product</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Product</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Code</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Interest Rate</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount Range</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tenure</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Applications</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.map(p => {
                          const appCount = applications.filter(a => a.loan_product_id === p.id).length;
                          return (
                            <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{p.product_name}</p>
                                  {p.description && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{p.description}</p>}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{p.product_code}</TableCell>
                              <TableCell><Badge variant="outline" className="text-[10px] capitalize">{p.loan_type?.replace('_', ' ')}</Badge></TableCell>
                              <TableCell className="text-sm font-semibold text-fi-amber">{p.interest_rate}% p.a.</TableCell>
                              <TableCell className="text-xs">{Number(p.min_amount).toLocaleString()} — {Number(p.max_amount).toLocaleString()}</TableCell>
                              <TableCell className="text-sm">{p.min_tenure_months}–{p.max_tenure_months}mo</TableCell>
                              <TableCell><Badge variant="secondary" className="text-[10px]">{appCount}</Badge></TableCell>
                              <TableCell><Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">{p.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => handleToggleProduct(p.id, p.is_active)} className="h-7 px-2 text-xs gap-1">
                                  <ToggleLeft className="h-3 w-3" />{p.is_active ? 'Disable' : 'Enable'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Repayments */}
          <TabsContent value="repayments">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Loan Repayments</CardTitle>
                <Badge variant="outline" className="text-[10px]">{repayments.length} payments</Badge>
              </CardHeader>
              <CardContent>
                {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : repayments.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground"><Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" /><p className="text-sm font-medium">No repayments recorded</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Principal</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Interest</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fees</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Method</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repayments.map(r => (
                          <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-semibold text-sm text-fi-green">+{Number(r.amount).toLocaleString()} XAF</TableCell>
                            <TableCell className="text-sm">{Number(r.principal_paid).toLocaleString()}</TableCell>
                            <TableCell className="text-sm">{Number(r.interest_paid).toLocaleString()}</TableCell>
                            <TableCell className="text-sm">{Number(r.fees_paid).toLocaleString()}</TableCell>
                            <TableCell className="text-sm capitalize">{r.payment_method?.replace('_', ' ') || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.created_at ? format(new Date(r.created_at), 'PP p') : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pre-Approved Offers */}
          <TabsContent value="preapproved">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Pre-Approved Loan Offers</CardTitle>
                <Button size="sm" onClick={() => setShowCreateOffer(true)} className="gap-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />New Offer</Button>
              </CardHeader>
              <CardContent>
                {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div> : preapprovedOffers.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No pre-approved offers configured</p>
                    <p className="text-xs mt-1">Create offers that appear on customers' credit score pages based on score benchmarks</p>
                    <Button size="sm" onClick={() => setShowCreateOffer(true)} className="mt-4 gap-1.5"><Plus className="h-3.5 w-3.5" />Create Offer</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Product</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Score Range</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount Range</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rate</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tenure</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Account Req.</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Apps</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preapprovedOffers.map(o => {
                          const appCount = marketplaceApps.filter(a => a.offer_id === o.id).length;
                          return (
                            <TableRow key={o.id} className="hover:bg-muted/40 transition-colors">
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{o.product_name}</p>
                                  {o.description && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{o.description}</p>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
                                  {o.min_credit_score}–{o.max_credit_score}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{Number(o.min_amount).toLocaleString()} — {Number(o.max_amount).toLocaleString()}</TableCell>
                              <TableCell className="text-sm font-semibold text-emerald-600">{o.interest_rate_annual}% p.a.</TableCell>
                              <TableCell className="text-sm">{o.max_tenure_months}mo</TableCell>
                              <TableCell><Badge variant={o.requires_existing_account ? "default" : "secondary"} className="text-[10px]">{o.requires_existing_account ? 'Yes' : 'No'}</Badge></TableCell>
                              <TableCell><Badge variant="secondary" className="text-[10px]">{appCount}</Badge></TableCell>
                              <TableCell><Badge variant={o.is_active ? "default" : "secondary"} className="text-[10px]">{o.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => handleToggleOffer(o.id, o.is_active)} className="h-7 px-2 text-xs gap-1">
                                  <ToggleLeft className="h-3 w-3" />{o.is_active ? 'Disable' : 'Enable'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Marketplace Applications */}
          <TabsContent value="marketplace">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Marketplace Loan Applications</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[10px] bg-fi-amber/10 text-fi-amber">{marketplaceApps.filter(a => a.status === 'pending_review').length} pending</Badge>
                  <Badge variant="outline" className="text-[10px] bg-fi-green/10 text-fi-green">{marketplaceApps.filter(a => a.status === 'approved').length} approved</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div> : marketplaceApps.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No marketplace applications</p>
                    <p className="text-xs mt-1">Applications from customers who apply via their CrediQ credit score page will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Application ID</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tenure</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Credit Score</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Existing A/C</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hard Check</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marketplaceApps.map(a => {
                          const mktStatus = {
                            pending_review: { variant: "secondary" as const, className: "bg-fi-amber/15 text-fi-amber border-fi-amber/30" },
                            hard_check_initiated: { variant: "secondary" as const, className: "bg-fi-blue/15 text-fi-blue border-fi-blue/30" },
                            approved: { variant: "default" as const, className: "bg-fi-green/15 text-fi-green border-fi-green/30" },
                            declined: { variant: "destructive" as const, className: "bg-destructive/15 text-destructive border-destructive/30" },
                          }[a.status] || { variant: "secondary" as const, className: "" };
                          return (
                            <TableRow key={a.id} className="hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setSelectedMarketplaceApp(a)}>
                              <TableCell className="font-mono text-xs text-muted-foreground">{a.id.slice(0, 8)}...</TableCell>
                              <TableCell className="text-sm font-semibold">{Number(a.requested_amount).toLocaleString()} XAF</TableCell>
                              <TableCell className="text-sm">{a.requested_tenure_months || '—'}mo</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] ${(a.credit_score_at_application || 0) >= 700 ? 'bg-fi-green/10 text-fi-green' : (a.credit_score_at_application || 0) >= 580 ? 'bg-fi-amber/10 text-fi-amber' : 'bg-destructive/10 text-destructive'}`}>
                                  {a.credit_score_at_application || '—'}
                                </Badge>
                              </TableCell>
                              <TableCell><Badge variant={a.has_existing_account ? "default" : "outline"} className="text-[10px]">{a.has_existing_account ? 'Yes' : 'No'}</Badge></TableCell>
                              <TableCell>
                                {a.hard_inquiry_id ? (
                                  <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 dark:border-red-700 dark:text-red-400">
                                    <ShieldAlert className="h-3 w-3 mr-0.5" />Logged
                                  </Badge>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell><Badge variant={mktStatus.variant} className={`text-[10px] capitalize ${mktStatus.className}`}>{a.status.replace('_', ' ')}</Badge></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{a.created_at ? format(new Date(a.created_at), 'PP') : '—'}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={e => { e.stopPropagation(); setSelectedMarketplaceApp(a); }}>
                                  <Eye className="h-3 w-3" />Review
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </motion.div>

      {/* Application Detail/Review Sheet */}
      <Sheet open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">Application Review</SheetTitle>
          </SheetHeader>
          {selectedApp && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-fi-amber/5 border border-fi-amber/20 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Requested Amount</p>
                <p className="text-3xl font-bold text-fi-amber">{Number(selectedApp.requested_amount).toLocaleString()} XAF</p>
                {selectedApp.recommended_amount && selectedApp.recommended_amount !== selectedApp.requested_amount && (
                  <p className="text-xs text-muted-foreground mt-1">Recommended: {Number(selectedApp.recommended_amount).toLocaleString()} XAF</p>
                )}
              </div>
              
              {selectedApp.credit_score && (
                <div className="rounded-lg border border-border/40 p-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Credit Score</span>
                  <Badge variant="outline" className={`text-sm font-bold ${selectedApp.credit_score >= 700 ? 'bg-fi-green/10 text-fi-green border-fi-green/30' : selectedApp.credit_score >= 580 ? 'bg-fi-amber/10 text-fi-amber border-fi-amber/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                    {selectedApp.credit_score}
                  </Badge>
                </div>
              )}

              {[
                { label: "Application #", value: selectedApp.application_number },
                { label: "Status", value: selectedApp.status },
                { label: "Auto Decision", value: selectedApp.auto_decision?.replace('_', ' ') || '—' },
                { label: "Tenure", value: `${selectedApp.tenure_months} months` },
                { label: "Frequency", value: selectedApp.repayment_frequency || 'monthly' },
                { label: "Purpose", value: selectedApp.purpose || '—' },
                { label: "Submitted", value: selectedApp.submitted_at ? format(new Date(selectedApp.submitted_at), 'PPp') : '—' },
                { label: "Created", value: selectedApp.created_at ? format(new Date(selectedApp.created_at), 'PPp') : '—' },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="text-sm font-medium capitalize">{f.value}</span>
                </div>
              ))}

              {/* Action buttons for pending applications */}
              {['submitted', 'under_review'].includes(selectedApp.status) && (
                <div className="pt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Actions</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 gap-1.5 bg-fi-green text-white hover:bg-fi-green/90" onClick={() => handleUpdateApplicationStatus(selectedApp.id, 'approved')}>
                      <CheckCircle className="h-3.5 w-3.5" />Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 gap-1.5" onClick={() => handleUpdateApplicationStatus(selectedApp.id, 'rejected')}>
                      <XCircle className="h-3.5 w-3.5" />Reject
                    </Button>
                  </div>
                  {selectedApp.status === 'submitted' && (
                    <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => handleUpdateApplicationStatus(selectedApp.id, 'under_review')}>
                      <Clock className="h-3.5 w-3.5" />Mark Under Review
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Product Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-fi-amber" />Create Loan Product</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Product Name *</Label>
                <Input placeholder="e.g. Personal Loan" value={newProduct.product_name} onChange={e => setNewProduct(p => ({ ...p, product_name: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Product Code *</Label>
                <Input placeholder="e.g. PL-001" value={newProduct.product_code} onChange={e => setNewProduct(p => ({ ...p, product_code: e.target.value }))} className="h-9 text-sm font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Loan Type *</Label>
                <Select value={newProduct.loan_type} onValueChange={v => setNewProduct(p => ({ ...p, loan_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal_loan">Personal Loan</SelectItem>
                    <SelectItem value="business_loan">Business Loan</SelectItem>
                    <SelectItem value="salary_advance">Salary Advance</SelectItem>
                    <SelectItem value="mortgage">Mortgage</SelectItem>
                    <SelectItem value="auto_loan">Auto Loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Interest Rate (% p.a.) *</Label>
                <Input type="number" step="0.1" value={newProduct.interest_rate} onChange={e => setNewProduct(p => ({ ...p, interest_rate: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Min Amount (XAF)</Label>
                <Input type="number" value={newProduct.min_amount} onChange={e => setNewProduct(p => ({ ...p, min_amount: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Max Amount (XAF)</Label>
                <Input type="number" value={newProduct.max_amount} onChange={e => setNewProduct(p => ({ ...p, max_amount: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Min Tenure (months)</Label>
                <Input type="number" value={newProduct.min_tenure_months} onChange={e => setNewProduct(p => ({ ...p, min_tenure_months: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Max Tenure (months)</Label>
                <Input type="number" value={newProduct.max_tenure_months} onChange={e => setNewProduct(p => ({ ...p, max_tenure_months: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Interest Method</Label>
                <Select value={newProduct.interest_calculation_method} onValueChange={v => setNewProduct(p => ({ ...p, interest_calculation_method: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                    <SelectItem value="flat_rate">Flat Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Processing Fee (%)</Label>
                <Input type="number" step="0.1" value={newProduct.processing_fee_percentage} onChange={e => setNewProduct(p => ({ ...p, processing_fee_percentage: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Input placeholder="Product description..." value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} className="h-9 text-sm" />
            </div>
            <Button onClick={handleCreateProduct} disabled={creating || !newProduct.product_name || !newProduct.product_code} className="mt-2 bg-fi-amber text-white hover:bg-fi-amber/90">
              {creating ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Marketplace Application Review Sheet */}
      <Sheet open={!!selectedMarketplaceApp} onOpenChange={() => setSelectedMarketplaceApp(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">Marketplace Application Review</SheetTitle>
          </SheetHeader>
          {selectedMarketplaceApp && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Requested Amount</p>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{Number(selectedMarketplaceApp.requested_amount).toLocaleString()} XAF</p>
                <p className="text-xs text-muted-foreground mt-1">Tenure: {selectedMarketplaceApp.requested_tenure_months || '—'} months</p>
              </div>

              <div className="rounded-lg border border-border/40 p-3 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Credit Score at Application</span>
                <Badge variant="outline" className={`text-sm font-bold ${(selectedMarketplaceApp.credit_score_at_application || 0) >= 700 ? 'bg-fi-green/10 text-fi-green border-fi-green/30' : (selectedMarketplaceApp.credit_score_at_application || 0) >= 580 ? 'bg-fi-amber/10 text-fi-amber border-fi-amber/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                  {selectedMarketplaceApp.credit_score_at_application || '—'}
                </Badge>
              </div>

              {selectedMarketplaceApp.hard_inquiry_id && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
                  <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20">
                    <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800 dark:text-red-300">Hard Credit Check Logged</p>
                      <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">A hard inquiry was recorded on the customer's credit profile (−5 pts impact).</p>
                    </div>
                  </div>
                  {/* Checks completed breakdown */}
                  <div className="px-3 py-2 space-y-1.5 bg-background">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Checks Completed</p>
                    {[
                      { label: 'Identity Verification (KYC)', done: true },
                      { label: 'Credit Score Assessment', done: true, detail: `Score: ${selectedMarketplaceApp.credit_score_at_application || '—'}` },
                      { label: 'Debt-to-Income Ratio', done: selectedMarketplaceApp.status !== 'pending_review', detail: selectedMarketplaceApp.status !== 'pending_review' ? 'Within acceptable range' : 'Pending' },
                      { label: 'Existing Loan Obligations', done: selectedMarketplaceApp.status !== 'pending_review', detail: selectedMarketplaceApp.status !== 'pending_review' ? 'Reviewed' : 'Pending' },
                      { label: 'Account History Review', done: selectedMarketplaceApp.has_existing_account, detail: selectedMarketplaceApp.has_existing_account ? 'Existing customer' : 'No prior history' },
                      { label: 'Fraud & AML Screening', done: selectedMarketplaceApp.status !== 'pending_review' },
                      { label: 'Affordability Assessment', done: ['approved', 'declined'].includes(selectedMarketplaceApp.status), detail: selectedMarketplaceApp.status === 'approved' ? 'Passed' : selectedMarketplaceApp.status === 'declined' ? 'Failed' : 'Pending' },
                    ].map(check => (
                      <div key={check.label} className="flex items-center gap-2 py-1 border-b border-border/20 last:border-0">
                        {check.done ? (
                          <CheckCircle className="h-3.5 w-3.5 text-fi-green shrink-0" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${check.done ? 'text-foreground' : 'text-muted-foreground'}`}>{check.label}</p>
                          {check.detail && <p className="text-[10px] text-muted-foreground">{check.detail}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!selectedMarketplaceApp.has_existing_account && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">No Existing Account</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">This customer does not currently bank with your institution. Account opening may be required.</p>
                  </div>
                </div>
              )}

              {[
                { label: "Application ID", value: selectedMarketplaceApp.id.slice(0, 12) + '...' },
                { label: "Status", value: selectedMarketplaceApp.status.replace(/_/g, ' ') },
                { label: "Existing Account", value: selectedMarketplaceApp.has_existing_account ? 'Yes' : 'No' },
                { label: "Applied", value: selectedMarketplaceApp.created_at ? format(new Date(selectedMarketplaceApp.created_at), 'PPp') : '—' },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="text-sm font-medium capitalize">{f.value}</span>
                </div>
              ))}

              {selectedMarketplaceApp.decline_reason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-semibold text-destructive mb-1">Decline Reason</p>
                  <p className="text-sm">{selectedMarketplaceApp.decline_reason}</p>
                </div>
              )}

              {/* Decision result badge for completed applications */}
              {['approved', 'declined'].includes(selectedMarketplaceApp.status) && (
                <div className={`rounded-xl p-4 text-center border ${selectedMarketplaceApp.status === 'approved' ? 'bg-fi-green/5 border-fi-green/20' : 'bg-destructive/5 border-destructive/20'}`}>
                  {selectedMarketplaceApp.status === 'approved' ? (
                    <CheckCircle className="h-8 w-8 text-fi-green mx-auto mb-2" />
                  ) : (
                    <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  )}
                  <p className={`text-sm font-bold ${selectedMarketplaceApp.status === 'approved' ? 'text-fi-green' : 'text-destructive'}`}>
                    Application {selectedMarketplaceApp.status === 'approved' ? 'Approved' : 'Declined'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Customer has been notified via push notification and email.</p>
                </div>
              )}

              {/* Actions for pending_review */}
              {selectedMarketplaceApp.status === 'pending_review' && (
                <div className="pt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Actions</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 gap-1.5 bg-fi-green text-white hover:bg-fi-green/90" onClick={() => handleUpdateMarketplaceApp(selectedMarketplaceApp.id, 'approved')}>
                      <CheckCircle className="h-3.5 w-3.5" />Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 gap-1.5" onClick={() => handleUpdateMarketplaceApp(selectedMarketplaceApp.id, 'declined', 'Application did not meet lending criteria after full review')}>
                      <XCircle className="h-3.5 w-3.5" />Decline
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => handleUpdateMarketplaceApp(selectedMarketplaceApp.id, 'hard_check_initiated')}>
                    <ShieldAlert className="h-3.5 w-3.5" />Initiate Full Credit Check
                  </Button>
                </div>
              )}

              {/* Actions for hard_check_initiated - approve/decline after full review */}
              {selectedMarketplaceApp.status === 'hard_check_initiated' && (
                <div className="pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Final Decision</p>
                  <p className="text-xs text-muted-foreground">All credit checks are complete. Make a final decision on this application. The customer will be notified via push notification and email.</p>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Review Notes (optional)</Label>
                    <Textarea 
                      value={reviewNotes} 
                      onChange={e => setReviewNotes(e.target.value)} 
                      placeholder="Internal notes about the decision..." 
                      className="text-sm min-h-[60px]" 
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1 gap-1.5 bg-fi-green text-white hover:bg-fi-green/90" 
                      disabled={actingOnApp}
                      onClick={() => handleUpdateMarketplaceApp(selectedMarketplaceApp.id, 'approved')}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />{actingOnApp ? 'Processing...' : 'Approve & Notify'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="flex-1 gap-1.5" 
                      disabled={actingOnApp}
                      onClick={() => {
                        const reason = declineReasonInput || 'Application did not meet lending criteria after full credit review';
                        handleUpdateMarketplaceApp(selectedMarketplaceApp.id, 'declined', reason);
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />{actingOnApp ? 'Processing...' : 'Decline & Notify'}
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-destructive">Decline Reason (if declining)</Label>
                    <Input 
                      value={declineReasonInput} 
                      onChange={e => setDeclineReasonInput(e.target.value)} 
                      placeholder="Reason for declining..." 
                      className="text-sm h-8" 
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Pre-Approved Offer Dialog */}
      <Dialog open={showCreateOffer} onOpenChange={setShowCreateOffer}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-emerald-600" />Create Pre-Approved Offer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Product Name *</Label>
              <Input placeholder="e.g. Instant Personal Loan" value={newOffer.product_name} onChange={e => setNewOffer(p => ({ ...p, product_name: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea placeholder="Brief description of the offer..." value={newOffer.description} onChange={e => setNewOffer(p => ({ ...p, description: e.target.value }))} className="text-sm min-h-[60px]" />
            </div>

            {/* Credit Score Benchmark */}
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Credit Score Benchmark</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Minimum Score</span>
                  <span className="font-bold">{newOffer.min_credit_score}</span>
                </div>
                <Slider value={[newOffer.min_credit_score]} onValueChange={v => setNewOffer(p => ({ ...p, min_credit_score: v[0] }))} min={300} max={850} step={10} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Maximum Score</span>
                  <span className="font-bold">{newOffer.max_credit_score}</span>
                </div>
                <Slider value={[newOffer.max_credit_score]} onValueChange={v => setNewOffer(p => ({ ...p, max_credit_score: v[0] }))} min={newOffer.min_credit_score} max={850} step={10} />
              </div>
              <p className="text-[10px] text-muted-foreground">Customers with scores between {newOffer.min_credit_score} and {newOffer.max_credit_score} will see this offer</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Min Amount (XAF)</Label>
                <Input type="number" value={newOffer.min_amount} onChange={e => setNewOffer(p => ({ ...p, min_amount: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Max Amount (XAF)</Label>
                <Input type="number" value={newOffer.max_amount} onChange={e => setNewOffer(p => ({ ...p, max_amount: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Interest Rate (% p.a.) *</Label>
                <Input type="number" step="0.1" value={newOffer.interest_rate_annual} onChange={e => setNewOffer(p => ({ ...p, interest_rate_annual: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Max Tenure (months)</Label>
                <Input type="number" value={newOffer.max_tenure_months} onChange={e => setNewOffer(p => ({ ...p, max_tenure_months: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
              <div>
                <p className="text-sm font-medium">Require Existing Account</p>
                <p className="text-[10px] text-muted-foreground">Only show to customers who bank with you</p>
              </div>
              <Switch checked={newOffer.requires_existing_account} onCheckedChange={v => setNewOffer(p => ({ ...p, requires_existing_account: v }))} />
            </div>
            <Button onClick={handleCreatePreapprovedOffer} disabled={creatingOffer || !newOffer.product_name} className="mt-2 bg-emerald-600 text-white hover:bg-emerald-700">
              {creatingOffer ? 'Creating...' : 'Create Pre-Approved Offer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
