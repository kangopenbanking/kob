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
import { CM_BANKS } from "@/constants/cameroon-banks";

interface Bank {
  id: string;
  code: string;
  name: string;
  source: 'linked' | 'kob' | 'flutterwave' | 'fallback';
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
    setSelectedBank("");
    setVerifiedName("");
    fetchBanks();
  }, [currency]);

  const fetchBanks = async () => {
    const countryMap: Record<string, string> = {
      XAF: 'CM', NGN: 'NG', GHS: 'GH', KES: 'KE', UGX: 'UG', TZS: 'TZ', ZAR: 'ZA',
    };
    const country = countryMap[currency] || 'CM';
    const linkedBanks: Bank[] = [];
    const kobBanks: Bank[] = [];
    const fwBanks: Bank[] = [];

    // Priority 1: User's linked bank accounts
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: linkedAccounts } = await supabase
          .from("accounts")
          .select("id, account_holder_name, swift_bic, rib_bank_code")
          .eq("user_id", user.id)
          .eq("is_active", true) as { data: any[] | null };
        if (linkedAccounts?.length) {
          linkedAccounts.forEach((acc: any) => {
            const bankCode = acc.rib_bank_code || acc.swift_bic || acc.id;
            linkedBanks.push({ id: bankCode, code: bankCode, name: `${acc.account_holder_name || 'Linked Account'}`, source: 'linked' });
          });
        }
      }
    } catch (err) {
      console.warn('[BankTransfer] Linked accounts fetch failed:', err);
    }

    // Priority 2: KOB Partner institutions
    try {
      const query = supabase
        .from("institutions" as any)
        .select("id, institution_name, swift_bic_code")
        .eq("is_active", true)
        .order("institution_name");
      const { data: kobInst } = await query;
      if (kobInst?.length) {
        kobInst.forEach((inst: any) => {
          const code = inst.swift_bic_code || inst.id;
          if (!linkedBanks.some(b => b.code === code)) {
            kobBanks.push({ id: code, code, name: inst.institution_name, source: 'kob' });
          }
        });
      }
    } catch (err) {
      console.warn('[BankTransfer] KOB institutions fetch failed:', err);
    }

    // Priority 3: Flutterwave banks
    try {
      const { data, error } = await supabase.functions.invoke('flutterwave-list-banks', {
        body: { country },
      });
      if (!error && data?.banks?.length) {
        data.banks.forEach((b: any) => {
          const allLocal = [...linkedBanks, ...kobBanks];
          const isDuplicate = allLocal.some(kb => kb.name.toLowerCase().includes(b.name?.toLowerCase()?.slice(0, 10)));
          if (!isDuplicate) {
            fwBanks.push({ id: b.id || b.code, code: b.code, name: b.name, source: 'flutterwave' });
          }
        });
      }
    } catch (err) {
      console.warn('[BankTransfer] Flutterwave fetch failed:', err);
    }

    let merged = [...linkedBanks, ...kobBanks, ...fwBanks];

    if (merged.length === 0 && country === 'CM') {
      merged = CM_BANKS.map(b => ({ id: b.code, code: b.code, name: b.name, source: 'fallback' as const }));
    }

    if (merged.length === 0) {
      toast({
        title: "Bank List Unavailable",
        description: "Could not load banks for this currency. Please try again.",
        variant: "destructive",
      });
    }

    setBanks(merged);
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
                {banks.some(b => b.source === 'linked') && (
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your Linked Accounts</div>
                )}
                {banks.filter(b => b.source === 'linked').map((bank) => (
                  <SelectItem key={`linked-${bank.code}`} value={bank.code}>
                    <span className="flex items-center gap-2">
                      {bank.name}
                      <span className="text-[10px] font-medium text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-full">Linked</span>
                    </span>
                  </SelectItem>
                ))}
                {banks.some(b => b.source === 'kob') && (
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">KOB Partner Banks</div>
                )}
                {banks.filter(b => b.source === 'kob').map((bank) => (
                  <SelectItem key={`kob-${bank.code}`} value={bank.code}>
                    <span className="flex items-center gap-2">
                      {bank.name}
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Partner</span>
                    </span>
                  </SelectItem>
                ))}
                {banks.some(b => b.source === 'flutterwave' || b.source === 'fallback') && (
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">All Banks</div>
                )}
                {banks.filter(b => b.source === 'flutterwave' || b.source === 'fallback').map((bank) => (
                  <SelectItem key={`fw-${bank.code}`} value={bank.code}>
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
