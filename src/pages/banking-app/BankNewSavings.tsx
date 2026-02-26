import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PiggyBank, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreateSavingsGoal } from '@/hooks/useBankingData';

const BankNewSavings: React.FC = () => {
  const navigate = useNavigate();
  const createGoal = useCreateSavingsGoal();

  const [productId, setProductId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [openingDeposit, setOpeningDeposit] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['savings-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('savings_products')
        .select('*')
        .eq('is_active', true)
        .order('savings_type');
      if (error) throw error;
      return data || [];
    },
  });

  const selectedProduct = products?.find((p: any) => p.id === productId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !accountName || !openingDeposit) return;

    createGoal.mutate(
      {
        product_id: productId,
        account_name: accountName,
        opening_deposit: Number(openingDeposit),
        target_amount: targetAmount ? Number(targetAmount) : undefined,
        target_date: targetDate || undefined,
      },
      { onSuccess: () => navigate(-1) }
    );
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New Savings Goal</h1>
        <p className="text-sm font-medium text-muted-foreground">Start saving towards your target</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Product selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Savings Product</Label>
            {productsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {(products || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.product_name} — {p.base_interest_rate}% p.a.
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedProduct && (
              <p className="text-xs text-muted-foreground">
                Min. opening balance: XAF {selectedProduct.min_opening_balance?.toLocaleString() ?? 0}
              </p>
            )}
          </div>

          {/* Account name */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Goal Name</Label>
            <Input
              placeholder="e.g. Vacation Fund"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          {/* Opening deposit */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Opening Deposit (XAF)</Label>
            <Input
              type="number"
              placeholder="0"
              value={openingDeposit}
              onChange={(e) => setOpeningDeposit(e.target.value)}
              className="h-12 rounded-xl text-lg font-bold text-center"
            />
          </div>

          {/* Target amount */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Target Amount (optional)</Label>
            <Input
              type="number"
              placeholder="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          {/* Target date */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Target Date (optional)</Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <Button
            type="submit"
            disabled={createGoal.isPending || !productId || !accountName || !openingDeposit}
            className="mt-2 h-14 rounded-2xl bg-[hsl(var(--bank-mint))] text-[hsl(var(--bank-mint-fg))] text-base font-bold hover:bg-[hsl(var(--bank-mint))]/90"
          >
            {createGoal.isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <PiggyBank className="mr-2 h-5 w-5" />
            )}
            {createGoal.isPending ? 'Creating…' : 'Create Savings Goal'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default BankNewSavings;
