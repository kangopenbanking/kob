import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Zap, Droplets, Wifi, Tv, Phone, Shield, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useAccountBalances } from '@/hooks/useCustomerData';
import { useQueryClient } from '@tanstack/react-query';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';

interface BillCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  billers: string[];
}

const categories: BillCategory[] = [
  { id: 'electricity', name: 'Electricity', icon: <Zap className="h-6 w-6" strokeWidth={1.5} />, color: 'hsl(45,90%,88%)', billers: ['ENEO', 'AES SONEL', 'PowerCam'] },
  { id: 'water', name: 'Water', icon: <Droplets className="h-6 w-6" strokeWidth={1.5} />, color: 'hsl(200,80%,90%)', billers: ['CamWater', 'SNEC'] },
  { id: 'internet', name: 'Internet', icon: <Wifi className="h-6 w-6" strokeWidth={1.5} />, color: 'hsl(160,60%,88%)', billers: ['Camtel', 'MTN Fiber', 'Orange Fiber', 'YooMee'] },
  { id: 'tv', name: 'TV', icon: <Tv className="h-6 w-6" strokeWidth={1.5} />, color: 'hsl(280,60%,90%)', billers: ['Canal+', 'DStv', 'StarTimes'] },
  { id: 'phone', name: 'Phone', icon: <Phone className="h-6 w-6" strokeWidth={1.5} />, color: 'hsl(340,70%,90%)', billers: ['MTN', 'Orange', 'Nexttel'] },
  { id: 'insurance', name: 'Insurance', icon: <Shield className="h-6 w-6" strokeWidth={1.5} />, color: 'hsl(25,80%,90%)', billers: ['Activa', 'Chanas', 'SAAR'] },
];

interface RecentBill {
  id: string;
  biller: string;
  category: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending';
}

const recentBills: RecentBill[] = [];

const KANG_PLATFORM_ID = 'f493095b-037a-40cf-82bc-3a3ab74550dd';

const CustomerBills: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useCustomerAccounts(user?.id);
  const accountIds = accounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BillCategory | null>(null);
  const [selectedBiller, setSelectedBiller] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const primaryAccount = accounts[0] as any;
  const primaryBalance = primaryAccount ? balances.find((b: any) => b.account_id === primaryAccount.id) : null;
  const walletBalance = (primaryBalance?.amount as number) ?? 0;
  const amountNum = Number(amount) || 0;

  const filteredCategories = search
    ? categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.billers.some(b => b.toLowerCase().includes(search.toLowerCase())))
    : categories;

  const handlePayRequest = () => {
    if (!accountNumber || !amount) { toast.error('Please fill in all fields'); return; }
    if (amountNum <= 0) { toast.error('Enter a valid amount'); return; }
    if (amountNum > walletBalance) { toast.error('Insufficient balance'); return; }
    setShowPin(true);
  };

  const handlePay = async () => {
    setPaying(true);
    try {
      // 1. Create bill payment transaction
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user!.id,
        institution_id: KANG_PLATFORM_ID,
        account_id: primaryAccount?.id || null,
        transaction_type: 'bill_payment',
        amount: amountNum,
        currency: 'XAF',
        status: 'completed',
        credit_debit_indicator: 'Debit',
        transaction_information: `${selectedBiller} - ${selectedCategory?.name} bill (Acct: ${accountNumber})`,
        booking_datetime: new Date().toISOString(),
        value_datetime: new Date().toISOString(),
        metadata: {
          biller: selectedBiller,
          category: selectedCategory?.id,
          meter_account: accountNumber,
        },
      });
      if (txError) throw txError;

      // 2. Deduct from wallet balance
      if (primaryAccount?.id && primaryBalance) {
        const newAmount = Math.max(walletBalance - amountNum, 0);
        await supabase.from('account_balances')
          .update({ amount: newAmount, balance_datetime: new Date().toISOString() })
          .eq('id', (primaryBalance as any).id);
      }

      // 3. Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['customer-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-balances'] });
      queryClient.invalidateQueries({ queryKey: ['customer-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['customer-bill-payments'] });
      queryClient.invalidateQueries({ queryKey: ['spending-summary'] });

      setPaid(true);
      toast.success(`Payment of ${amountNum.toLocaleString()} XAF to ${selectedBiller} successful`);
      setTimeout(() => {
        setPaid(false);
        setSelectedBiller(null);
        setSelectedCategory(null);
        setAccountNumber('');
        setAmount('');
      }, 2500);
    } catch (err: any) {
      toast.error(err.message || 'Bill payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleBack = () => {
    if (selectedBiller) { setSelectedBiller(null); setAccountNumber(''); setAmount(''); }
    else if (selectedCategory) setSelectedCategory(null);
    else navigate(-1);
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={handleBack}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">
          {selectedBiller ? selectedBiller : selectedCategory ? selectedCategory.name : 'Pay Bills'}
        </h1>
      </div>

      <AnimatePresence mode="wait">
        {!selectedCategory && !selectedBiller && (
          <motion.div key="main" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input placeholder="Search billers..." value={search} onChange={e => setSearch(e.target.value)} className="rounded-2xl border-border bg-muted/50 pl-10" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {filteredCategories.map(cat => (
                <motion.button key={cat.id} whileTap={{ scale: 0.95 }} onClick={() => setSelectedCategory(cat)}
                  className="flex flex-col items-center gap-2 rounded-3xl border-2 p-4" style={{ backgroundColor: cat.color, borderColor: cat.color }}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/60">{cat.icon}</div>
                  <span className="text-xs font-medium text-foreground">{cat.name}</span>
                </motion.button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground">Recent Payments</h2>
              {recentBills.map(bill => (
                <motion.div key={bill.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{bill.biller}</span>
                    <span className="text-xs text-muted-foreground">{bill.category} · {bill.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{bill.amount.toLocaleString()} XAF</span>
                    <CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {selectedCategory && !selectedBiller && (
          <motion.div key="billers" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Select a biller</p>
            {selectedCategory.billers.map(biller => (
              <motion.button key={biller} whileTap={{ scale: 0.97 }} onClick={() => setSelectedBiller(biller)}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: selectedCategory.color }}>
                    {selectedCategory.icon}
                  </div>
                  <span className="text-sm font-medium text-foreground">{biller}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              </motion.button>
            ))}
          </motion.div>
        )}

        {selectedBiller && (
          <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-5">
            {paid ? (
              <div className="flex flex-col items-center gap-4 py-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-8 w-8 text-primary" strokeWidth={1.5} />
                </div>
                <p className="text-base font-semibold text-foreground">Payment Successful</p>
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-border bg-card p-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Account / Meter Number</label>
                      <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Enter account number" className="rounded-xl border-border" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Amount (XAF)</label>
                      <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="rounded-xl border-border text-lg font-semibold" />
                    </div>
                  </div>
                </div>
                <Button onClick={handlePayRequest} disabled={paying} className="h-12 rounded-2xl text-base font-semibold">
                  {paying ? (
                    <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />Processing...</span>
                  ) : 'Pay Now'}
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handlePay} />
    </div>
  );
};

export default CustomerBills;
