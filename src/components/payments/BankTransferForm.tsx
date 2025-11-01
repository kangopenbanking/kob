import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";

interface Bank {
  id: string;
  code: string;
  name: string;
}

export const BankTransferForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [verifiedName, setVerifiedName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const [narration, setNarration] = useState("");

  useEffect(() => {
    fetchBanks();
  }, [currency]);

  const fetchBanks = async () => {
    try {
      // Map currency to country code
      const countryMap: Record<string, string> = {
        XAF: 'CM',
        NGN: 'NG',
        GHS: 'GH',
        KES: 'KE',
        UGX: 'UG',
        TZS: 'TZ',
        ZAR: 'ZA',
      };

      const { data, error } = await supabase.functions.invoke('flutterwave-list-banks', {
        body: { country: countryMap[currency] || 'CM' },
      });

      if (error) throw error;

      setBanks(data.banks || []);
    } catch (error: any) {
      console.error('Error fetching banks:', error);
      toast({
        title: "Error",
        description: "Failed to fetch bank list",
        variant: "destructive",
      });
    }
  };

  const verifyAccount = async () => {
    if (!selectedBank || !accountNumber) {
      toast({
        title: "Validation Error",
        description: "Please select a bank and enter account number",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    setVerifiedName("");

    try {
      const { data, error } = await supabase.functions.invoke('flutterwave-verify-bank', {
        body: {
          account_number: accountNumber,
          account_bank: selectedBank,
        },
      });

      if (error) throw error;

      setVerifiedName(data.account_name);
      toast({
        title: "Account Verified",
        description: `Account holder: ${data.account_name}`,
      });
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify bank account",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verifiedName) {
      toast({
        title: "Verification Required",
        description: "Please verify the account before transferring",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const selectedBankData = banks.find(b => b.code === selectedBank);

      const { data, error } = await supabase.functions.invoke('flutterwave-bank-transfer', {
        body: {
          account_bank: selectedBank,
          account_number: accountNumber,
          amount: parseFloat(amount),
          currency,
          narration,
          beneficiary_name: verifiedName,
          bank_name: selectedBankData?.name,
        },
      });

      if (error) throw error;

      toast({
        title: "Transfer Initiated",
        description: `Transfer of ${currency} ${amount} initiated successfully`,
      });

      // Reset form
      setSelectedBank("");
      setAccountNumber("");
      setVerifiedName("");
      setAmount("");
      setNarration("");
    } catch (error: any) {
      console.error('Transfer error:', error);
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to initiate transfer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Transfer</CardTitle>
        <CardDescription>
          Transfer money directly to any bank account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <Label htmlFor="currency">Currency *</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="XAF">XAF (FCFA)</SelectItem>
                <SelectItem value="NGN">NGN (₦)</SelectItem>
                <SelectItem value="GHS">GHS (₵)</SelectItem>
                <SelectItem value="KES">KES (KSh)</SelectItem>
                <SelectItem value="UGX">UGX (USh)</SelectItem>
                <SelectItem value="TZS">TZS (TSh)</SelectItem>
                <SelectItem value="ZAR">ZAR (R)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="bank">Bank *</Label>
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger id="bank">
                <SelectValue placeholder="Select a bank" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.code} value={bank.code}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="accountNumber">Account Number *</Label>
            <div className="flex gap-2">
              <Input
                id="accountNumber"
                placeholder="Enter account number"
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value);
                  setVerifiedName("");
                }}
                required
              />
              <Button
                type="button"
                onClick={verifyAccount}
                disabled={verifying || !selectedBank || !accountNumber}
                variant="outline"
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
          </div>

          {verifiedName && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {verifiedName}
              </span>
            </div>
          )}

          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="narration">Narration (Optional)</Label>
            <Textarea
              id="narration"
              placeholder="Payment description"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              rows={3}
            />
          </div>

          <Button type="submit" disabled={loading || !verifiedName} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Transfer ${currency} ${amount || '0.00'}`
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
