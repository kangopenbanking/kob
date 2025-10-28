import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw } from "lucide-react";

interface TopUpFormProps {
  card: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TopUpForm = ({ card, onSuccess, onCancel }: TopUpFormProps) => {
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  const { data: accountsData } = useQuery({
    queryKey: ['user-accounts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          balances:account_balances(*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
  });

  const accounts = accountsData || [];
  const selectedAccount = accounts.find((a: any) => a.id === sourceAccountId);
  const availableBalance = selectedAccount?.balances?.find(
    (b: any) => b.balance_type === 'InterimAvailable'
  );

  const fetchExchangeRate = async (currency: string) => {
    if (currency === 'USD') {
      setExchangeRate(1);
      return;
    }

    setIsLoadingRate(true);
    try {
      const rateResponse = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=USD`);
      const rateData = await rateResponse.json();

      if (rateData.rates?.USD) {
        setExchangeRate(rateData.rates.USD);
      }
    } catch (error: any) {
      console.error('Error fetching rate:', error);
      toast.error('Failed to fetch exchange rate');
    } finally {
      setIsLoadingRate(false);
    }
  };

  useEffect(() => {
    if (selectedAccount && amount) {
      const currency = selectedAccount.currency as string;
      fetchExchangeRate(currency);
    }
  }, [selectedAccount, amount]);

  const calculateConversion = () => {
    if (!amount || !exchangeRate) return null;

    const sourceAmount = parseFloat(amount);
    const usdBeforeFee = sourceAmount * exchangeRate;
    const conversionFee = usdBeforeFee * 0.015; // 1.5% fee
    const finalUsd = usdBeforeFee - conversionFee;

    return {
      sourceAmount,
      usdBeforeFee,
      conversionFee,
      finalUsd,
      feePercentage: 1.5,
    };
  };

  const conversion = calculateConversion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceAccountId || !amount || !selectedAccount) {
      toast.error('Please fill in all fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (amountNum <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    if (availableBalance && Number(availableBalance.amount) < amountNum) {
      toast.error('Insufficient balance');
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('virtual-card-topup', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          virtual_card_id: card.id,
          source_account_id: sourceAccountId,
          amount_source_currency: amountNum,
          source_currency: selectedAccount.currency,
        },
      });

      if (response.error) throw response.error;

      toast.success('Card topped up successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error topping up card:', error);
      toast.error(error.message || 'Failed to top up card');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-primary/5 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold text-primary">
              ${parseFloat(card.balance_usd || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sourceAccount">Source Account *</Label>
        <Select value={sourceAccountId} onValueChange={setSourceAccountId} required>
          <SelectTrigger>
            <SelectValue placeholder="Select source account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account: any) => {
              const balance = account.balances?.find(
                (b: any) => b.balance_type === 'InterimAvailable'
              );
              return (
                <SelectItem key={account.id} value={account.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{account.account_holder_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {account.currency} {balance ? parseFloat(balance.amount).toFixed(2) : '0.00'}
                    </span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">
          Amount {selectedAccount && `(${selectedAccount.currency})`} *
        </Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        {availableBalance && (
          <p className="text-sm text-muted-foreground">
            Available: {selectedAccount.currency} {Number(availableBalance.amount).toFixed(2)}
          </p>
        )}
      </div>

      {conversion && selectedAccount && (
        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Exchange Rate</span>
            <span className="font-mono flex items-center gap-2">
              {isLoadingRate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  1 {selectedAccount.currency} = ${exchangeRate?.toFixed(6)}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchExchangeRate(selectedAccount.currency as string)}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">USD (before fees)</span>
            <span className="font-mono">${conversion.usdBeforeFee.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Conversion Fee ({conversion.feePercentage}%)</span>
            <span className="font-mono text-destructive">-${conversion.conversionFee.toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">You'll receive</span>
              <span className="text-xl font-bold text-primary">
                ${conversion.finalUsd.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isProcessing || !conversion || isLoadingRate}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Top Up Card'
          )}
        </Button>
      </div>
    </form>
  );
};
