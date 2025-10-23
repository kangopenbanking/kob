import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, FileText, Settings, TrendingUp, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreateFeeStructureForm } from "@/components/fee-management/CreateFeeStructureForm";
import { FeeStructuresTable } from "@/components/fee-management/FeeStructuresTable";
import { TransactionFeesTable } from "@/components/fee-management/TransactionFeesTable";
import { InvoicesTable } from "@/components/fee-management/InvoicesTable";
import { WaiversManagement } from "@/components/fee-management/WaiversManagement";

export default function FeeManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [recentFees, setRecentFees] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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
      
      setRecentFees(feesData || []);

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

  const generateInvoice = async (institutionId: string, billingCycle: string) => {
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
          institution_id: institutionId,
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

      loadData();
    } catch (error) {
      console.error('Generate invoice error:', error);
      toast({
        title: "Error",
        description: "Failed to generate invoice",
        variant: "destructive"
      });
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

  const totalFeesThisMonth = recentFees
    .filter(f => new Date(f.transaction_date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    .reduce((sum, f) => sum + Number(f.final_fee), 0);

  const totalFeesYTD = recentFees.reduce((sum, f) => sum + Number(f.final_fee), 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Fee Management</h1>
            <p className="text-muted-foreground">
              Configure transaction fees and manage billing for institutions
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Fee Structure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Fee Structure</DialogTitle>
              </DialogHeader>
              <CreateFeeStructureForm 
                institutions={institutions}
                onSubmit={createFeeStructure}
                onCancel={() => setShowCreateDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active Fee Structures</p>
                <p className="text-3xl font-bold">{feeStructures.length}</p>
              </div>
              <Settings className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Fees (This Month)</p>
                <p className="text-3xl font-bold">
                  {totalFeesThisMonth.toLocaleString()} XAF
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Pending Invoices</p>
                <p className="text-3xl font-bold">
                  {invoices.filter(i => i.status === 'pending' || i.status === 'sent').length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Revenue (YTD)</p>
                <p className="text-3xl font-bold">
                  {totalFeesYTD.toLocaleString()} XAF
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="structures" className="space-y-6">
        <TabsList>
          <TabsTrigger value="structures">Fee Structures</TabsTrigger>
          <TabsTrigger value="fees">Transaction Fees</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="waivers">Waivers</TabsTrigger>
        </TabsList>

        <TabsContent value="structures">
          <FeeStructuresTable structures={feeStructures} onRefresh={loadData} />
        </TabsContent>

        <TabsContent value="fees">
          <TransactionFeesTable fees={recentFees} />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesTable 
            invoices={invoices} 
            institutions={institutions}
            onGenerateInvoice={generateInvoice}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="waivers">
          <WaiversManagement institutions={institutions} onRefresh={loadData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
