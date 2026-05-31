import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, FileText, Settings, TrendingUp, Plus, BarChart3, Gift, Loader2, Store, ArrowUpRight, Activity, Calculator, ShieldCheck, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreateFeeStructureForm } from "@/components/fee-management/CreateFeeStructureForm";
import { FeeStructuresTable } from "@/components/fee-management/FeeStructuresTable";
import { TransactionFeesTable } from "@/components/fee-management/TransactionFeesTable";
import { InvoicesTable } from "@/components/fee-management/InvoicesTable";
import { WaiversManagement } from "@/components/fee-management/WaiversManagement";
import { FeeAnalytics } from "@/components/fee-management/FeeAnalytics";
import { FeeSimulator } from "@/components/fee-management/FeeSimulator";

import { MerchantFeesTab } from "@/components/fee-management/MerchantFeesTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { runFeeStructuresAudit, downloadAuditReport } from "@/lib/fee-management/auditFeeStructures";

export default function FeeManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [institutions, setInstitutions] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [transactionFees, setTransactionFees] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [institutionTypeFilter, setInstitutionTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [auditRunning, setAuditRunning] = useState(false);

  useEffect(() => { checkAdminAccess(); }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: isAdminRole } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdminRole) {
        toast({ title: "Access Denied", description: "Admin access required", variant: "destructive" });
        navigate('/'); return;
      }
      setIsAdmin(true);
      loadData();
    } catch { navigate('/'); }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [instRes, feeRes, feesRes, invRes] = await Promise.all([
        supabase.from('institutions').select('id, institution_name, institution_type, status').eq('status', 'approved').order('institution_name'),
        supabase.from('fee_structures').select('*, institutions!fee_structures_institution_id_fkey(institution_name)').order('created_at', { ascending: false }),
        supabase.from('transaction_fees').select('*, institutions!transaction_fees_institution_id_fkey(institution_name)').order('transaction_date', { ascending: false }).limit(200),
        supabase.from('institution_invoices').select('*, institutions(institution_name)').order('created_at', { ascending: false }).limit(50),
      ]);
      setInstitutions(instRes.data || []);
      setFeeStructures(feeRes.data || []);
      setTransactionFees(feesRes.data || []);
      setInvoices(invRes.data || []);
    } catch { toast({ title: "Error", description: "Failed to load data", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const createFeeStructure = async (formData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isPlatform = formData.fee_scope === 'platform';
      const { error } = await supabase.from('fee_structures').insert({
        institution_id: isPlatform ? null : formData.institution_id,
        fee_scope: formData.fee_scope || 'institution',
        transaction_type: formData.transaction_type,
        fee_model: formData.fee_model,
        fixed_amount: formData.fixed_amount || 0,
        percentage_rate: formData.percentage_rate || 0,
        min_fee_amount: formData.min_fee_amount || 0,
        max_fee_amount: formData.max_fee_amount || null,
        tiered_rates: formData.tiered_rates || null,
        effective_from: formData.effective_from || new Date().toISOString().split('T')[0],
        effective_until: formData.effective_until || null,
        is_active: true,
        created_by: user?.id,
        daily_limit: formData.daily_limit ?? -1,
        monthly_limit: formData.monthly_limit ?? -1,
        max_charge_cap: formData.max_charge_cap ?? -1,
        agent_commission_percent: formData.agent_commission_percent ?? 0,
        agent_commission_fixed: formData.agent_commission_fixed ?? 0,
        referral_percent_commission: formData.referral_percent_commission ?? 0,
        referral_fixed_commission: formData.referral_fixed_commission ?? 0,
        merchant_percent_charge: formData.merchant_percent_charge ?? 0,
        merchant_fixed_charge: formData.merchant_fixed_charge ?? 0,
      });
      if (error) throw error;
      toast({ title: "Success", description: "Fee structure created" });
      setShowCreateDialog(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to create", variant: "destructive" });
    }
  };

  const generateInvoice = async () => {
    if (!selectedInstitution) return;
    setGeneratingInvoice(true);
    try {
      const today = new Date();
      let periodStart: Date, periodEnd: Date;
      if (billingCycle === 'monthly') {
        periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
        periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      } else if (billingCycle === 'quarterly') {
        const qm = Math.floor(today.getMonth() / 3) * 3;
        periodStart = new Date(today.getFullYear(), qm, 1);
        periodEnd = new Date(today.getFullYear(), qm + 3, 0);
      } else {
        // on_demand: default to last 30 days
        periodEnd = new Date();
        periodStart = new Date(Date.now() - 30 * 86400000);
      }
      const { error } = await supabase.functions.invoke('generate-invoice', {
        body: { institution_id: selectedInstitution, billing_cycle: billingCycle, period_start: periodStart.toISOString().split('T')[0], period_end: periodEnd.toISOString().split('T')[0] },
      });
      if (error) throw error;
      toast({ title: "Invoice Generated", description: "Invoice created successfully" });
      setShowInvoiceDialog(false);
      loadData();
    } catch { toast({ title: "Error", description: "Failed to generate invoice", variant: "destructive" }); }
    finally { setGeneratingInvoice(false); }
  };

  const filteredStructures = institutionFilter === 'all' ? feeStructures : feeStructures.filter(s => s.institution_id === institutionFilter);
  const filteredFees = institutionFilter === 'all' ? transactionFees : transactionFees.filter(f => f.institution_id === institutionFilter);
  const filteredInvoices = institutionFilter === 'all' ? invoices : invoices.filter(i => i.institution_id === institutionFilter);

  const thisMonth = new Date();
  const monthlyFees = transactionFees.filter(f => { const d = new Date(f.transaction_date); return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear(); }).reduce((s, f) => s + Number(f.final_fee || 0), 0);
  const ytdFees = transactionFees.filter(f => new Date(f.transaction_date).getFullYear() === thisMonth.getFullYear()).reduce((s, f) => s + Number(f.final_fee || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || (i.status !== 'paid' && i.status !== 'cancelled' && new Date(i.due_date) < new Date()));
  const activeStructures = feeStructures.filter(f => f.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const statCards = [
    {
      label: "Active Structures",
      value: activeStructures,
      icon: Settings,
      gradient: "from-[hsl(217,91%,35%)] to-[hsl(217,91%,50%)]",
      bgLight: "bg-[hsl(217,91%,96%)]",
      iconBg: "bg-[hsl(217,91%,35%)]",
      trend: "+3 this month",
    },
    {
      label: "Monthly Revenue",
      value: `${monthlyFees.toLocaleString()} XAF`,
      icon: DollarSign,
      gradient: "from-[hsl(155,72%,40%)] to-[hsl(155,72%,50%)]",
      bgLight: "bg-[hsl(155,72%,95%)]",
      iconBg: "bg-[hsl(155,72%,40%)]",
      trend: "Current period",
    },
    {
      label: "YTD Revenue",
      value: `${ytdFees.toLocaleString()} XAF`,
      icon: TrendingUp,
      gradient: "from-[hsl(258,80%,58%)] to-[hsl(258,80%,68%)]",
      bgLight: "bg-[hsl(258,80%,95%)]",
      iconBg: "bg-[hsl(258,80%,58%)]",
      trend: "Year to date",
    },
    {
      label: "Pending Invoices",
      value: pendingInvoices.length,
      icon: FileText,
      gradient: "from-[hsl(38,92%,50%)] to-[hsl(38,92%,60%)]",
      bgLight: "bg-[hsl(38,92%,95%)]",
      iconBg: "bg-[hsl(38,92%,50%)]",
      trend: "Awaiting payment",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Fee Management</h1>
              <p className="text-sm text-muted-foreground">Configure fees, limits, waivers & billing across the platform</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
            <SelectTrigger className="w-[220px] h-9 text-sm rounded-lg border-border bg-card shadow-sm">
              <SelectValue placeholder="All Institutions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Institutions</SelectItem>
              {institutions.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>{inst.institution_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, idx) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.4 }}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg} text-primary-foreground shadow-sm`}>
                <s.icon className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">{s.value}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">{s.label}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{s.trend}</p>
            {/* Decorative gradient blob */}
            <div className={`absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-gradient-to-br ${s.gradient} opacity-[0.07] group-hover:opacity-[0.12] transition-opacity`} />
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="structures" className="space-y-5">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-11 items-center gap-1 rounded-2xl bg-muted/60 p-1.5 shadow-sm border border-border/50">
            <TabsTrigger value="structures" className="rounded-xl gap-1.5 px-4 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Settings className="h-3.5 w-3.5" /> Structures
            </TabsTrigger>
            <TabsTrigger value="fees" className="rounded-xl gap-1.5 px-4 text-xs font-semibold data-[state=active]:bg-[hsl(155,72%,40%)] data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <DollarSign className="h-3.5 w-3.5" /> Fees
            </TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-xl gap-1.5 px-4 text-xs font-semibold data-[state=active]:bg-[hsl(38,92%,50%)] data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <FileText className="h-3.5 w-3.5" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="waivers" className="rounded-xl gap-1.5 px-4 text-xs font-semibold data-[state=active]:bg-[hsl(258,80%,58%)] data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Gift className="h-3.5 w-3.5" /> Waivers
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl gap-1.5 px-4 text-xs font-semibold data-[state=active]:bg-[hsl(172,66%,40%)] data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <BarChart3 className="h-3.5 w-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="merchant-fees" className="rounded-xl gap-1.5 px-4 text-xs font-semibold data-[state=active]:bg-[hsl(217,91%,55%)] data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Store className="h-3.5 w-3.5" /> Merchants
            </TabsTrigger>
            <TabsTrigger value="simulator" className="rounded-xl gap-1.5 px-4 text-xs font-semibold data-[state=active]:bg-[hsl(351,88%,46%)] data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Calculator className="h-3.5 w-3.5" /> Simulator
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="structures" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-foreground">Fee Structures</h3>
              <p className="text-xs text-muted-foreground">Create and manage fee configurations per institution and transaction type</p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="rounded-xl shadow-sm">
              <Plus className="mr-1.5 h-4 w-4" /> Create Structure
            </Button>
          </div>
          <FeeStructuresTable structures={filteredStructures} institutions={institutions} onRefresh={loadData} />
        </TabsContent>

        <TabsContent value="fees">
          <TransactionFeesTable fees={filteredFees} />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesTable
            invoices={filteredInvoices}
            institutions={institutions}
            onGenerateInvoice={(instId, cycle) => {
              setSelectedInstitution(instId);
              setBillingCycle(cycle);
              setShowInvoiceDialog(true);
            }}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="waivers">
          <WaiversManagement institutions={institutions} onRefresh={loadData} />
        </TabsContent>

        <TabsContent value="analytics">
          <FeeAnalytics transactionFees={filteredFees} feeStructures={filteredStructures} />
        </TabsContent>


        <TabsContent value="merchant-fees">
          <MerchantFeesTab />
        </TabsContent>

        <TabsContent value="simulator">
          <FeeSimulator institutions={institutions} />
        </TabsContent>
      </Tabs>

      {/* Create Fee Structure Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Fee Structure</DialogTitle>
            <DialogDescription>Define a fee model for a specific institution and transaction type</DialogDescription>
          </DialogHeader>
          <CreateFeeStructureForm
            institutions={institutions}
            onSubmit={createFeeStructure}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Generate Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
            <DialogDescription>Create an invoice for an institution's accumulated fees</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Institution</Label>
              <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                <SelectTrigger><SelectValue placeholder="Select institution" /></SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.institution_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Billing Cycle</Label>
              <Select value={billingCycle} onValueChange={setBillingCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="on_demand">On-Demand</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateInvoice} disabled={!selectedInstitution || generatingInvoice} className="w-full rounded-xl">
              {generatingInvoice ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : 'Generate Invoice'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
