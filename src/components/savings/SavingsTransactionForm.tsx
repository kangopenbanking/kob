import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SavingsTransactionFormProps {
  savingsAccount: any;
  type: 'deposit' | 'withdraw';
  onSuccess: () => void;
  onCancel: () => void;
}

export const SavingsTransactionForm = ({ savingsAccount, type, onSuccess, onCancel }: SavingsTransactionFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const functionName = type === 'deposit' ? 'savings-deposit' : 'savings-withdraw';
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          savings_account_id: savingsAccount.id,
          amount: parseFloat(amount),
          [type === 'deposit' ? 'source_account_id' : 'destination_account_id']: null,
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      // Handle approval-required response from withdrawal policy engine
      if (data?.requires_approval) {
        toast({
          title: "Approval Required",
          description: data.message || "This withdrawal requires manager approval before processing.",
        });
        onSuccess();
        return;
      }

      toast({
        title: "Success",
        description: `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} processed successfully`,
      });

      onSuccess();
    } catch (error: any) {
      console.error(`Error processing ${type}:`, error);
      
      let errorMessage = `Failed to process ${type}`;
      
      // Extract specific error messages
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      }
      
      toast({
        title: "Transaction Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === 'deposit' ? 'Deposit to' : 'Withdraw from'} Savings</DialogTitle>
          <DialogDescription>
            {savingsAccount.account_name || savingsAccount.savings_products?.product_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Current Balance</span>
              <span className="font-semibold">{formatCurrency(parseFloat(savingsAccount.current_balance))}</span>
            </div>
            {type === 'withdraw' && (
              <>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Available Balance</span>
                  <span className="font-semibold">{formatCurrency(parseFloat(savingsAccount.available_balance))}</span>
                </div>
                {savingsAccount.savings_products?.max_withdrawals_per_month && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Withdrawals This Month</span>
                    <span className="font-semibold">
                      {savingsAccount.withdrawals_this_month || 0} / {savingsAccount.savings_products.max_withdrawals_per_month}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <Label htmlFor="amount">Amount (XAF) *</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              required
              min="1"
              max={type === 'withdraw' ? parseFloat(savingsAccount.available_balance) : undefined}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Processing..." : type === 'deposit' ? 'Deposit' : 'Withdraw'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
