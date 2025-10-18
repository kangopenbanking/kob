import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Send, Download, RefreshCw, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface MobileAccount {
  id: string;
  phone_number: string;
  provider: string;
  account_name: string;
  is_verified: boolean;
  is_active: boolean;
}

interface Transaction {
  id: string;
  transaction_ref: string;
  transaction_type: string;
  provider: string;
  amount: number;
  currency: string;
  phone_number: string;
  status: string;
  description: string;
  created_at: string;
  completed_at: string;
}

export default function MobileMoney() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<MobileAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  // Form states
  const [newAccount, setNewAccount] = useState({
    phone_number: "",
    provider: "mtn",
    account_name: ""
  });

  const [chargeForm, setChargeForm] = useState({
    amount: "",
    phone_number: "",
    provider: "mtn",
    description: ""
  });

  const [transferForm, setTransferForm] = useState({
    amount: "",
    phone_number: "",
    provider: "mtn",
    description: "",
    beneficiary_name: ""
  });

  useEffect(() => {
    checkAuth();
    fetchAccounts();
    fetchTransactions();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from("mobile_money_accounts")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch mobile money accounts",
        variant: "destructive",
      });
    } else {
      setAccounts(data || []);
    }
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from("mobile_money_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch transactions",
        variant: "destructive",
      });
    } else {
      setTransactions(data || []);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccount.phone_number || !newAccount.account_name) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("mobile_money_accounts")
      .insert([{ ...newAccount, user_id: user.id }]);

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add mobile money account",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Mobile money account added successfully",
      });
      setIsAddAccountOpen(false);
      setNewAccount({ phone_number: "", provider: "mtn", account_name: "" });
      fetchAccounts();
    }
  };

  const handleCharge = async () => {
    if (!chargeForm.amount || !chargeForm.phone_number) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke("mobile-money-charge", {
      body: {
        amount: parseFloat(chargeForm.amount),
        phone_number: chargeForm.phone_number,
        provider: chargeForm.provider,
        description: chargeForm.description || "Mobile money charge",
      },
    });

    setLoading(false);

    if (error || !data.success) {
      toast({
        title: "Error",
        description: error?.message || data?.error || "Failed to initiate charge",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: data.data.message,
      });
      setChargeForm({ amount: "", phone_number: "", provider: "mtn", description: "" });
      fetchTransactions();
    }
  };

  const handleTransfer = async () => {
    if (!transferForm.amount || !transferForm.phone_number) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("mobile-money-transfer", {
      body: {
        amount: parseFloat(transferForm.amount),
        phone_number: transferForm.phone_number,
        provider: transferForm.provider,
        description: transferForm.description || "Mobile money transfer",
        beneficiary_name: transferForm.beneficiary_name,
      },
    });

    setLoading(false);

    if (error || !data.success) {
      toast({
        title: "Error",
        description: error?.message || data?.error || "Failed to initiate transfer",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: data.data.message,
      });
      setTransferForm({ amount: "", phone_number: "", provider: "mtn", description: "", beneficiary_name: "" });
      fetchTransactions();
    }
  };

  const handleVerify = async (transactionId: string) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("mobile-money-verify", {
      body: { transaction_id: transactionId },
    });

    setLoading(false);

    if (error || !data.success) {
      toast({
        title: "Error",
        description: error?.message || data?.error || "Failed to verify transaction",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Transaction Updated",
        description: `Status: ${data.data.status}`,
      });
      fetchTransactions();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      successful: "default",
      processing: "secondary",
      pending: "outline",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Mobile Money</h1>
          <p className="text-muted-foreground">Manage MTN and Orange Money transactions</p>
        </div>
        <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Mobile Money Account</DialogTitle>
              <DialogDescription>Add your MTN or Orange Money account</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="account-name">Account Name</Label>
                <Input
                  id="account-name"
                  placeholder="My MTN Account"
                  value={newAccount.account_name}
                  onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="account-phone">Phone Number</Label>
                <Input
                  id="account-phone"
                  placeholder="+237670000000"
                  value={newAccount.phone_number}
                  onChange={(e) => setNewAccount({ ...newAccount, phone_number: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="account-provider">Provider</Label>
                <Select
                  value={newAccount.provider}
                  onValueChange={(value) => setNewAccount({ ...newAccount, provider: value })}
                >
                  <SelectTrigger id="account-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mtn">MTN Mobile Money</SelectItem>
                    <SelectItem value="orange">Orange Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddAccount} disabled={loading} className="w-full">
                {loading ? "Adding..." : "Add Account"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <Card key={account.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Smartphone className="h-5 w-5 text-primary" />
                <Badge variant={account.provider === "mtn" ? "default" : "secondary"}>
                  {account.provider.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">{account.account_name}</div>
              <div className="text-xs text-muted-foreground">{account.phone_number}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="charge" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="charge">Receive Payment</TabsTrigger>
          <TabsTrigger value="transfer">Send Money</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="charge">
          <Card>
            <CardHeader>
              <CardTitle>Receive Payment</CardTitle>
              <CardDescription>Charge a mobile money account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="charge-amount">Amount (XAF)</Label>
                <Input
                  id="charge-amount"
                  type="number"
                  placeholder="10000"
                  value={chargeForm.amount}
                  onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="charge-phone">Phone Number</Label>
                <Input
                  id="charge-phone"
                  placeholder="+237670000000"
                  value={chargeForm.phone_number}
                  onChange={(e) => setChargeForm({ ...chargeForm, phone_number: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="charge-provider">Provider</Label>
                <Select
                  value={chargeForm.provider}
                  onValueChange={(value) => setChargeForm({ ...chargeForm, provider: value })}
                >
                  <SelectTrigger id="charge-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mtn">MTN Mobile Money</SelectItem>
                    <SelectItem value="orange">Orange Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="charge-description">Description (Optional)</Label>
                <Input
                  id="charge-description"
                  placeholder="Payment for services"
                  value={chargeForm.description}
                  onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                />
              </div>
              <Button onClick={handleCharge} disabled={loading} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                {loading ? "Processing..." : "Receive Payment"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer">
          <Card>
            <CardHeader>
              <CardTitle>Send Money</CardTitle>
              <CardDescription>Transfer money to a mobile money account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="transfer-amount">Amount (XAF)</Label>
                <Input
                  id="transfer-amount"
                  type="number"
                  placeholder="10000"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="transfer-phone">Phone Number</Label>
                <Input
                  id="transfer-phone"
                  placeholder="+237670000000"
                  value={transferForm.phone_number}
                  onChange={(e) => setTransferForm({ ...transferForm, phone_number: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="transfer-beneficiary">Beneficiary Name</Label>
                <Input
                  id="transfer-beneficiary"
                  placeholder="John Doe"
                  value={transferForm.beneficiary_name}
                  onChange={(e) => setTransferForm({ ...transferForm, beneficiary_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="transfer-provider">Provider</Label>
                <Select
                  value={transferForm.provider}
                  onValueChange={(value) => setTransferForm({ ...transferForm, provider: value })}
                >
                  <SelectTrigger id="transfer-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mtn">MTN Mobile Money</SelectItem>
                    <SelectItem value="orange">Orange Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="transfer-description">Description (Optional)</Label>
                <Input
                  id="transfer-description"
                  placeholder="Transfer to vendor"
                  value={transferForm.description}
                  onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                />
              </div>
              <Button onClick={handleTransfer} disabled={loading} className="w-full">
                <Send className="mr-2 h-4 w-4" />
                {loading ? "Processing..." : "Send Money"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>View all your mobile money transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="capitalize">{tx.transaction_type}</TableCell>
                      <TableCell className="uppercase">{tx.provider}</TableCell>
                      <TableCell>{tx.phone_number}</TableCell>
                      <TableCell>{tx.amount.toLocaleString()} {tx.currency}</TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell>
                        {tx.status === "processing" || tx.status === "pending" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerify(tx.id)}
                            disabled={loading}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
