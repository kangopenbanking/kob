import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, ArrowLeftRight, FileCheck, Upload, CreditCard } from "lucide-react";
import { CardPaymentForm } from "@/components/payments/CardPaymentForm";
import { BankTransferForm } from "@/components/payments/BankTransferForm";
import { TransactionHistory } from "@/components/banking/TransactionHistory";
import { BulkTransferProcessor } from "@/components/banking/BulkTransferProcessor";
import { ReconciliationDetails } from "@/components/banking/ReconciliationDetails";
import { BankStatementGenerator } from "@/components/banking/BankStatementGenerator";
import { BankConnectionManager } from "@/components/banking/BankConnectionManager";
import { TransactionImportPreview } from "@/components/banking/TransactionImportPreview";
import { ErrorHandlingDashboard } from "@/components/banking/ErrorHandlingDashboard";

export default function BankingOps() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [transferForm, setTransferForm] = useState({
    source_account: "",
    destination_account: "",
    amount: "",
    description: "",
  });

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('api-transfers', {
        body: {
          source_account_id: transferForm.source_account,
          destination_account_id: transferForm.destination_account,
          amount: parseFloat(transferForm.amount),
          description: transferForm.description,
        },
      });

      if (error) throw error;

      toast({
        title: "Transfer Initiated",
        description: `Transaction reference: ${data.transaction_reference}`,
      });

      setTransferForm({
        source_account: "",
        destination_account: "",
        amount: "",
        description: "",
      });
    } catch (error: any) {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-verification', {
        body: {
          account_number: transferForm.destination_account,
        },
      });

      if (error) throw error;

      toast({
        title: data.verified ? "Account Verified" : "Verification Failed",
        description: data.message,
        variant: data.verified ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Verification Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Banking Operations</h1>
            <p className="text-muted-foreground mt-2">
              Manage inter-bank transfers, reconciliation, and bank integrations
            </p>
          </div>
        </div>

        <Tabs defaultValue="transfers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto">
            <TabsTrigger value="transfers" className="gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Transfers
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2">
              <FileCheck className="h-4 w-4" />
              Reconciliation
            </TabsTrigger>
            <TabsTrigger value="banks" className="gap-2">
              <Building2 className="h-4 w-4" />
              Banks
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              Import
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2">
              <FileCheck className="h-4 w-4" />
              Monitoring
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transfers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Inter-Bank Transfer</CardTitle>
                <CardDescription>
                  Initiate transfers between bank accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTransfer} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="source_account">Source Account ID</Label>
                      <Input
                        id="source_account"
                        placeholder="Enter source account ID"
                        value={transferForm.source_account}
                        onChange={(e) =>
                          setTransferForm({ ...transferForm, source_account: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="destination_account">Destination Account ID</Label>
                      <div className="flex gap-2">
                        <Input
                          id="destination_account"
                          placeholder="Enter destination account ID"
                          value={transferForm.destination_account}
                          onChange={(e) =>
                            setTransferForm({ ...transferForm, destination_account: e.target.value })
                          }
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleVerification}
                          disabled={!transferForm.destination_account || loading}
                        >
                          Verify
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount (XAF)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={transferForm.amount}
                        onChange={(e) =>
                          setTransferForm({ ...transferForm, amount: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        placeholder="Transfer description"
                        value={transferForm.description}
                        onChange={(e) =>
                          setTransferForm({ ...transferForm, description: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full md:w-auto">
                    {loading ? "Processing..." : "Initiate Transfer"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>View and track all transaction operations</CardDescription>
              </CardHeader>
              <CardContent>
                <TransactionHistory />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation" className="space-y-6">
            <BankStatementGenerator />
            <ReconciliationDetails />
          </TabsContent>

          <TabsContent value="banks" className="space-y-6">
            <BankConnectionManager />
          </TabsContent>

          <TabsContent value="bulk" className="space-y-6">
            <BulkTransferProcessor />
          </TabsContent>

          <TabsContent value="import" className="space-y-6">
            <TransactionImportPreview />
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Processing</CardTitle>
                <CardDescription>
                  Process payments via Mobile Money, Credit/Debit Cards, and Bank Transfers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="card" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="card">Credit/Debit Card</TabsTrigger>
                    <TabsTrigger value="bank">Bank Transfer</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="card" className="mt-6">
                    <CardPaymentForm />
                  </TabsContent>
                  
                  <TabsContent value="bank" className="mt-6">
                    <BankTransferForm />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6">
            <ErrorHandlingDashboard />
          </TabsContent>
        </Tabs>
      </div>
  );
}
