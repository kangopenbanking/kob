import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, ArrowLeftRight, FileCheck, Upload, Download } from "lucide-react";

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
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
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
              Bank Connections
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Operations
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
                <CardTitle>Recent Transfers</CardTitle>
                <CardDescription>View and track recent transfer operations</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction Ref</TableHead>
                      <TableHead>Source Account</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={6}>
                        No recent transfers
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Reconciliation</CardTitle>
                <CardDescription>
                  Match and reconcile transactions across banking systems
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recon_bank">Select Bank</Label>
                    <Select value={selectedBank} onValueChange={setSelectedBank}>
                      <SelectTrigger id="recon_bank">
                        <SelectValue placeholder="Choose bank" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank1">Commercial Bank Cameroon</SelectItem>
                        <SelectItem value="bank2">Afriland First Bank</SelectItem>
                        <SelectItem value="bank3">Société Générale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recon_from">From Date</Label>
                    <Input id="recon_from" type="date" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recon_to">To Date</Label>
                    <Input id="recon_to" type="date" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button disabled={!selectedBank}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Bank Statement
                  </Button>
                  <Button variant="outline" disabled={!selectedBank}>
                    Start Reconciliation
                  </Button>
                </div>

                <div className="border rounded-lg p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Select a bank and date range to begin reconciliation
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="banks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bank Integrations</CardTitle>
                <CardDescription>
                  Manage connections to partner banks and financial institutions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { name: "Commercial Bank Cameroon", status: "connected", type: "H2H" },
                      { name: "Afriland First Bank", status: "connected", type: "SFTP" },
                      { name: "Société Générale", status: "pending", type: "REST API" },
                    ].map((bank, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <Building2 className="h-8 w-8 text-primary" />
                            <Badge variant={bank.status === "connected" ? "default" : "secondary"}>
                              {bank.status}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg">{bank.name}</CardTitle>
                          <CardDescription>{bank.type}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button variant="outline" size="sm" className="w-full">
                            Configure
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Button className="w-full md:w-auto">
                    <Building2 className="h-4 w-4 mr-2" />
                    Add New Bank Connection
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Transfer Upload</CardTitle>
                <CardDescription>
                  Upload CSV file for batch transfer processing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Drop CSV file here or click to browse
                  </p>
                  <Input type="file" accept=".csv" className="max-w-xs mx-auto" />
                </div>

                <div className="space-y-2">
                  <Label>CSV Format Requirements</Label>
                  <div className="bg-muted p-4 rounded-lg">
                    <code className="text-sm">
                      source_account,destination_account,amount,description
                      <br />
                      ACC001,ACC002,10000.00,Salary Payment
                      <br />
                      ACC001,ACC003,5000.00,Vendor Payment
                    </code>
                  </div>
                </div>

                <Button disabled>
                  Process Bulk Transfers
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
