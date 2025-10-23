import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, ArrowRight, Building2, Loader2, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface MobileAccount {
  id: string;
  phone_number: string;
  provider: string;
  account_name: string;
}

interface BankAccount {
  id: string;
  account_id: string;
  account_holder_name: string;
  currency: string;
}

interface Transaction {
  id: string;
  transaction_ref: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  provider: string;
  phone_number: string;
  metadata: any;
}

const SUPPORTED_CURRENCIES = [
  { code: 'XAF', name: 'Central African CFA Franc', flag: '🇨🇲' },
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'GHS', name: 'Ghanaian Cedi', flag: '🇬🇭' },
  { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪' },
  { code: 'UGX', name: 'Ugandan Shilling', flag: '🇺🇬' },
  { code: 'TZS', name: 'Tanzanian Shilling', flag: '🇹🇿' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'RWF', name: 'Rwandan Franc', flag: '🇷🇼' },
];

const PROVIDER_CURRENCIES: Record<string, string[]> = {
  mtn: ['XAF', 'NGN', 'GHS', 'UGX', 'RWF', 'ZAR'],
  orange: ['XAF', 'NGN', 'GHS'],
  default: ['XAF', 'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'ZAR', 'RWF']
};

export function MobileMoneyToBankTransfer() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mobileAccounts, setMobileAccounts] = useState<MobileAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    source_mobile_account_id: '',
    destination_account_id: '',
    amount: '',
    currency: 'XAF',
    description: ''
  });

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, []);

  useEffect(() => {
    // Reset currency if current one not supported by selected provider
    if (formData.source_mobile_account_id) {
      const available = getAvailableCurrencies();
      if (!available.find(c => c.code === formData.currency)) {
        setFormData(prev => ({ ...prev, currency: 'XAF' }));
      }
    }
  }, [formData.source_mobile_account_id]);

  const fetchAccounts = async () => {
    try {
      // Fetch mobile money accounts
      const { data: mobileData, error: mobileError } = await supabase
        .from('mobile_money_accounts')
        .select('*')
        .eq('is_active', true);

      if (mobileError) throw mobileError;
      setMobileAccounts(mobileData || []);

      // Fetch bank accounts
      const { data: bankData, error: bankError } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true);

      if (bankError) throw bankError;
      setBankAccounts(bankData || []);
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load accounts",
        variant: "destructive",
      });
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('mobile_money_transactions')
        .select('*')
        .eq('is_bank_deposit', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPaymentLink(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('mobile-money-to-bank', {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.success) {
        setPaymentLink(data.data.payment_link);
        toast({
          title: "Payment Link Generated",
          description: "Complete the payment on your mobile device to credit your bank account",
        });
        
        // Reset form
        setFormData({
          source_mobile_account_id: '',
          destination_account_id: '',
          amount: '',
          currency: 'XAF',
          description: ''
        });

        // Refresh transactions
        fetchTransactions();
      }
    } catch (error: any) {
      console.error('Error initiating transfer:', error);
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to initiate transfer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAvailableCurrencies = () => {
    if (!formData.source_mobile_account_id) {
      return SUPPORTED_CURRENCIES;
    }
    
    const selectedAccount = mobileAccounts.find(
      acc => acc.id === formData.source_mobile_account_id
    );
    
    if (!selectedAccount) return SUPPORTED_CURRENCIES;
    
    const provider = selectedAccount.provider.toLowerCase();
    const allowedCodes = PROVIDER_CURRENCIES[provider] || PROVIDER_CURRENCIES.default;
    
    return SUPPORTED_CURRENCIES.filter(curr => allowedCodes.includes(curr.code));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      processing: "secondary",
      pending: "outline",
      failed: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile Money to Bank Transfer
          </CardTitle>
          <CardDescription>
            Deposit funds from your Mobile Money account directly to your bank account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source (Mobile Money)</Label>
                <Select
                  value={formData.source_mobile_account_id}
                  onValueChange={(value) => setFormData({ ...formData, source_mobile_account_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mobile account" />
                  </SelectTrigger>
                  <SelectContent>
                    {mobileAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.provider} - {account.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Destination (Bank Account)</Label>
                <Select
                  value={formData.destination_account_id}
                  onValueChange={(value) => setFormData({ ...formData, destination_account_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_holder_name} - {account.account_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableCurrencies().map((curr) => (
                        <SelectItem key={curr.code} value={curr.code}>
                          {curr.flag} {curr.code} - {curr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Default: XAF (Central African CFA Franc)
                  </p>
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="E.g., Monthly savings deposit"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Generate Payment Link
                </>
              )}
            </Button>
          </form>

          {paymentLink && (
            <div className="mt-4 p-4 border rounded-lg bg-muted">
              <p className="text-sm font-medium mb-2">Payment Link Ready:</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(paymentLink, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Complete Payment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Deposits</CardTitle>
          <CardDescription>Your mobile money to bank transfers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>{format(new Date(txn.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                    <TableCell className="font-mono text-sm">{txn.transaction_ref}</TableCell>
                    <TableCell>{txn.provider}</TableCell>
                    <TableCell className="font-semibold">
                      {txn.currency} {parseFloat(txn.amount.toString()).toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(txn.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
