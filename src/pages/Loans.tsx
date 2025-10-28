import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import LoanProductCard from "@/components/loans/LoanProductCard";
import LoanApplicationForm from "@/components/loans/LoanApplicationForm";
import LoanAccountCard from "@/components/loans/LoanAccountCard";

export default function Loans() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  // Fetch loan products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['loan-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_products')
        .select('*')
        .eq('is_active', true)
        .order('product_name');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's loan applications
  const { data: applications } = useQuery({
    queryKey: ['loan-applications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('loan_applications')
        .select('*, loan_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's loan accounts
  const { data: loanAccounts } = useQuery({
    queryKey: ['loan-accounts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('loan_accounts')
        .select('*, loan_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const activeLoans = loanAccounts?.filter(l => ['active', 'disbursed'].includes(l.status)) || [];
  const totalBorrowed = activeLoans.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
  const totalOutstanding = activeLoans.reduce((sum, loan) => sum + Number(loan.outstanding_balance), 0);
  const pendingApplications = applications?.filter(a => ['submitted', 'under_review'].includes(a.status)).length || 0;

  const handleApply = (product: any) => {
    setSelectedProduct(product);
    setShowApplicationForm(true);
  };

  if (showApplicationForm && selectedProduct) {
    return (
      <LoanApplicationForm
        product={selectedProduct}
        onBack={() => {
          setShowApplicationForm(false);
          setSelectedProduct(null);
        }}
      />
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Loans</h1>
          <p className="text-muted-foreground">Apply for loans and manage your borrowings</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLoans.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Borrowed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBorrowed.toLocaleString()} XAF</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOutstanding.toLocaleString()} XAF</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Applications</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApplications}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Loan Products</TabsTrigger>
          <TabsTrigger value="my-loans">My Loans</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Loan Products</CardTitle>
              <CardDescription>Browse and apply for loans that suit your needs</CardDescription>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="text-center py-8">Loading loan products...</div>
              ) : products && products.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <LoanProductCard
                      key={product.id}
                      product={product}
                      onApply={handleApply}
                    />
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>No loan products available at the moment.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-loans" className="space-y-4">
          {activeLoans.length > 0 ? (
            <div className="grid gap-4">
              {activeLoans.map((loan) => (
                <LoanAccountCard key={loan.id} loan={loan} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Alert>
                  <AlertDescription>You don't have any active loans.</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loan Applications</CardTitle>
              <CardDescription>Track the status of your loan applications</CardDescription>
            </CardHeader>
            <CardContent>
              {applications && applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <Card key={app.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{app.loan_products?.product_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Application #{app.application_number}
                            </p>
                            <p className="text-lg font-bold mt-2">
                              {Number(app.requested_amount).toLocaleString()} XAF
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {app.tenure_months} months • {app.repayment_frequency}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                              app.status === 'approved' ? 'bg-green-100 text-green-800' :
                              app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              app.status === 'under_review' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {app.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <p className="text-xs text-muted-foreground mt-2">
                              Applied: {new Date(app.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {app.rejection_reason && (
                          <Alert className="mt-4">
                            <AlertDescription>{app.rejection_reason}</AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>You haven't submitted any loan applications yet.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
