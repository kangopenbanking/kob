import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, FileText, Settings, TrendingUp, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { CreateFeeStructureForm } from "@/components/fee-management/CreateFeeStructureForm";
import { FeeStructuresTable } from "@/components/fee-management/FeeStructuresTable";
import { TransactionFeesTable } from "@/components/fee-management/TransactionFeesTable";
import { InvoicesTable } from "@/components/fee-management/InvoicesTable";
import { WaiversManagement } from "@/components/fee-management/WaiversManagement";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: isAdminRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (!isAdminRole) {
        toast({
          title: "Access Denied",
          description: "Admin access required",
          variant: "destructive"
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      loadData();
    } catch (error) {
      console.error('Auth error:', error);
      navigate('/');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: instData } = await supabase
        .from('institutions')
        .select('id, institution_name, status')
        .eq('status', 'approved')
        .order('institution_name');
      
      setInstitutions(instData || []);

      const { data: feeData } = await supabase
        .from('fee_structures')
        .select(`
          *,
          institutions(institution_name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      setFeeStructures(feeData || []);

      const { data: feesData } = await supabase
        .from('transaction_fees')
        .select(`
          *,
          institutions(institution_name)
        `)
        .order('transaction_date', { ascending: false })
        .limit(50);
      
      setTransactionFees(feesData || []);

      const { data: invoiceData } = await supabase
        .from('institution_invoices')
        .select(`
          *,
          institutions(institution_name)
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      
      setInvoices(invoiceData || []);

    } catch (error) {
      console.error('Load data error:', error);
      toast({
        title: "Error",
        description: "Failed to load fee management data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createFeeStructure = async (formData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('fee_structures')
        .insert({
          institution_id: formData.institution_id,
          transaction_type: formData.transaction_type,
          fee_model: formData.fee_model,
          fixed_amount: formData.fixed_amount || 0,
          percentage_rate: formData.percentage_rate || 0,
          min_fee_amount: formData.min_fee_amount || 0,
          max_fee_amount: formData.max_fee_amount || null,
          tiered_rates: formData.tiered_rates || null,
          effective_from: formData.effective_from || new Date().toISOString().split('T')[0],
          is_active: true,
          created_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Fee structure created successfully"
      });

      setShowCreateDialog(false);
      loadData();
    } catch (error) {
      console.error('Create fee structure error:', error);
      toast({
        title: "Error",
        description: "Failed to create fee structure",
        variant: "destructive"
      });
    }
  };

  const generateInvoice = async () => {
    if (!selectedInstitution) return;
    
    setGeneratingInvoice(true);
    try {
      const today = new Date();
      let periodStart, periodEnd;

      if (billingCycle === 'monthly') {
        periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
        periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      } else if (billingCycle === 'quarterly') {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
        periodStart = new Date(today.getFullYear(), quarterStartMonth, 1);
        periodEnd = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
      } else {
        periodEnd = new Date();
        periodStart = new Date(today.setDate(today.getDate() - 30));
      }

      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: {
          institution_id: selectedInstitution,
          billing_cycle: billingCycle,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0]
        }
      });

      if (error) throw error;

      toast({
        title: "Invoice Generated",
        description: "Invoice has been generated and sent to the institution"
      });

      setShowInvoiceDialog(false);
      loadData();
    } catch (error) {
      console.error('Generate invoice error:', error);
      toast({
        title: "Error",
        description: "Failed to generate invoice",
        variant: "destructive"
      });
    } finally {
      setGeneratingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading fee management...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Fee Management</h1>
          <p className="text-muted-foreground mt-2">
            Configure transaction fees and manage billing for institutions
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fee Structures</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{feeStructures.length}</div>
              <p className="text-xs text-muted-foreground">Active structures</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Fees</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {transactionFees
                  .filter(f => {
                    const feeDate = new Date(f.created_at);
                    const now = new Date();
                    return feeDate.getMonth() === now.getMonth() && 
                           feeDate.getFullYear() === now.getFullYear();
                  })
                  .reduce((sum, f) => sum + Number(f.calculated_fee), 0)
                  .toFixed(2)} XAF
              </div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">YTD Fees</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {transactionFees
                  .filter(f => {
                    const feeDate = new Date(f.created_at);
                    const now = new Date();
                    return feeDate.getFullYear() === now.getFullYear();
                  })
                  .reduce((sum, f) => sum + Number(f.calculated_fee), 0)
                  .toFixed(2)} XAF
              </div>
              <p className="text-xs text-muted-foreground">Year to date</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {invoices.filter(i => i.status === 'pending').length}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="structures" className="space-y-4">
          <TabsList>
            <TabsTrigger value="structures">Fee Structures</TabsTrigger>
            <TabsTrigger value="fees">Transaction Fees</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="waivers">Waivers</TabsTrigger>
          </TabsList>

          <TabsContent value="structures" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Fee Structures</h3>
                <p className="text-sm text-muted-foreground">
                  Create and manage fee structures for institutions
                </p>
              </div>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Fee Structure
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Fee Structure</DialogTitle>
                    <DialogDescription>
                      Define a new fee structure for an institution
                    </DialogDescription>
                  </DialogHeader>
                  <CreateFeeStructureForm
                    institutions={institutions}
                    onSubmit={createFeeStructure}
                    onCancel={() => setShowCreateDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <FeeStructuresTable structures={feeStructures} onRefresh={loadData} />
          </TabsContent>

          <TabsContent value="fees" className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Transaction Fees</h3>
              <p className="text-sm text-muted-foreground">
                View all calculated transaction fees
              </p>
            </div>
            <TransactionFeesTable fees={transactionFees} />
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Invoices</h3>
                <p className="text-sm text-muted-foreground">
                  Manage institution invoices
                </p>
              </div>
              <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate Invoice</DialogTitle>
                    <DialogDescription>
                      Create a new invoice for an institution
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="institution">Institution</Label>
                      <Select
                        value={selectedInstitution}
                        onValueChange={setSelectedInstitution}
                      >
                        <SelectTrigger id="institution">
                          <SelectValue placeholder="Select institution" />
                        </SelectTrigger>
                        <SelectContent>
                          {institutions.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.institution_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing-cycle">Billing Cycle</Label>
                      <Select
                        value={billingCycle}
                        onValueChange={setBillingCycle}
                      >
                        <SelectTrigger id="billing-cycle">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={generateInvoice}
                      disabled={!selectedInstitution || generatingInvoice}
                      className="w-full"
                    >
                      {generatingInvoice ? "Generating..." : "Generate Invoice"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <InvoicesTable 
              invoices={invoices} 
              institutions={institutions}
              onGenerateInvoice={(instId: string, cycle: string) => {
                setSelectedInstitution(instId);
                setBillingCycle(cycle);
                setShowInvoiceDialog(true);
              }}
              onRefresh={loadData}
            />
          </TabsContent>

          <TabsContent value="waivers" className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Fee Waivers</h3>
              <p className="text-sm text-muted-foreground">
                Manage fee waivers and exemptions
              </p>
            </div>
            <WaiversManagement institutions={institutions} onRefresh={loadData} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
