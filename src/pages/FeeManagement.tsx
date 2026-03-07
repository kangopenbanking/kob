import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, FileText, Settings, TrendingUp, Plus, BarChart3, Gift, Loader2, Sliders } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreateFeeStructureForm } from "@/components/fee-management/CreateFeeStructureForm";
import { FeeStructuresTable } from "@/components/fee-management/FeeStructuresTable";
import { TransactionFeesTable } from "@/components/fee-management/TransactionFeesTable";
import { InvoicesTable } from "@/components/fee-management/InvoicesTable";
import { WaiversManagement } from "@/components/fee-management/WaiversManagement";
import { FeeAnalytics } from "@/components/fee-management/FeeAnalytics";
import { LimitsChargesTab } from "@/components/fee-management/LimitsChargesTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

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
        supabase.from('institutions').select('id, institution_name, status').eq('status', 'approved').order('institution_name'),
        supabase.from('fee_structures').select('*, institutions(institution_name)').order('created_at', { ascending: false }),
        supabase.from('transaction_fees').select('*, institutions(institution_name)').order('transaction_date', { ascending: false }).limit(200),
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
      const { error } = await supabase.from('fee_structures').insert({
        institution_id: formData.institution_id,
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

  // Institution-filtered data
  const filteredStructures = institutionFilter === 'all' ? feeStructures : feeStructures.filter(s => s.institution_id === institutionFilter);
  const filteredFees = institutionFilter === 'all' ? transactionFees : transactionFees.filter(f => f.institution_id === institutionFilter);
  const filteredInvoices = institutionFilter === 'all' ? invoices : invoices.filter(i => i.institution_id === institutionFilter);

  // Summary stats
  const thisMonth = new Date();
  const monthlyFees = transactionFees.filter(f => { const d = new Date(f.transaction_date); return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear(); }).reduce((s, f) => s + Number(f.final_fee || 0), 0);
  const ytdFees = transactionFees.filter(f => new Date(f.transaction_date).getFullYear() === thisMonth.getFullYear()).reduce((s, f) => s + Number(f.final_fee || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || (i.status !== 'paid' && i.status !== 'cancelled' && new Date(i.due_date) < new Date()));
  const activeWaivers = feeStructures.length; // placeholder count

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const statCards = [
    { label: "Active Structures", value: feeStructures.filter(f => f.is_active).length, icon: Settings, color: "from-blue-500/10 to-blue-500/5", iconColor: "text-blue-600" },
    { label: "Monthly Revenue", value: `${monthlyFees.toLocaleString()} XAF`, icon: DollarSign, color: "from-emerald-500/10 to-emerald-500/5", iconColor: "text-emerald-600" },
    { label: "YTD Revenue", value: `${ytdFees.toLocaleString()} XAF`, icon: TrendingUp, color: "from-purple-500/10 to-purple-500/5", iconColor: "text-purple-600" },
    { label: "Pending Invoices", value: pendingInvoices.length, icon: FileText, color: "from-amber-500/10 to-amber-500/5", iconColor: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Management</h1>
          <p className="text-sm text-muted-foreground">Configure transaction fees, waivers, and billing for all institutions</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
            <SelectTrigger className="w-[200px] h-9 text-sm">
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s, idx) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`rounded-xl border bg-gradient-to-br ${s.color} p-4 shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.iconColor}`} />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="structures" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="structures" className="rounded-lg gap-1.5"><Settings className="h-3.5 w-3.5" /> Structures</TabsTrigger>
          <TabsTrigger value="fees" className="rounded-lg gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Fees</TabsTrigger>
          <TabsTrigger value="invoices" className="rounded-lg gap-1.5"><FileText className="h-3.5 w-3.5" /> Invoices</TabsTrigger>
          <TabsTrigger value="waivers" className="rounded-lg gap-1.5"><Gift className="h-3.5 w-3.5" /> Waivers</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Analytics</TabsTrigger>
          <TabsTrigger value="limits" className="rounded-lg gap-1.5"><Sliders className="h-3.5 w-3.5" /> Limits & Charges</TabsTrigger>
        </TabsList>

        <TabsContent value="structures" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold">Fee Structures</h3>
              <p className="text-xs text-muted-foreground">Create and manage fee configurations per institution and transaction type</p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
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

        <TabsContent value="limits">
          <LimitsChargesTab />
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
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateInvoice} disabled={!selectedInstitution || generatingInvoice} className="w-full">
              {generatingInvoice ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : 'Generate Invoice'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
