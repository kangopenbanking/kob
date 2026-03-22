import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Zap, Droplets, Wifi, Tv, Phone, Shield, ChevronRight, CheckCircle2, Loader2, Receipt, Clock, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useAccountBalances, useRecentBillPayments } from '@/hooks/useCustomerData';
import { useQueryClient } from '@tanstack/react-query';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { KANG_PLATFORM_ID } from '@/constants/platform';

interface BillCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  billers: string[];
}

const categories: BillCategory[] = [
  { id: 'electricity', name: 'Electricity', icon: <Zap className="h-5 w-5" strokeWidth={1.5} />, gradient: 'from-amber-400 to-orange-500', iconBg: 'bg-amber-500', billers: ['ENEO', 'AES SONEL', 'PowerCam'] },
  { id: 'water', name: 'Water', icon: <Droplets className="h-5 w-5" strokeWidth={1.5} />, gradient: 'from-sky-400 to-blue-500', iconBg: 'bg-sky-500', billers: ['CamWater', 'SNEC'] },
  { id: 'internet', name: 'Internet', icon: <Wifi className="h-5 w-5" strokeWidth={1.5} />, gradient: 'from-emerald-400 to-teal-500', iconBg: 'bg-emerald-500', billers: ['Camtel', 'MTN Fiber', 'Orange Fiber', 'YooMee'] },
  { id: 'tv', name: 'TV', icon: <Tv className="h-5 w-5" strokeWidth={1.5} />, gradient: 'from-violet-400 to-purple-500', iconBg: 'bg-violet-500', billers: ['Canal+', 'DStv', 'StarTimes'] },
  { id: 'phone', name: 'Phone', icon: <Phone className="h-5 w-5" strokeWidth={1.5} />, gradient: 'from-rose-400 to-pink-500', iconBg: 'bg-rose-500', billers: ['MTN', 'Orange', 'Nexttel'] },
  { id: 'insurance', name: 'Insurance', icon: <Shield className="h-5 w-5" strokeWidth={1.5} />, gradient: 'from-orange-400 to-red-500', iconBg: 'bg-orange-500', billers: ['Activa', 'Chanas', 'SAAR'] },
];

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 14, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } } };

const CustomerBills: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useCustomerAccounts(user?.id);
  const accountIds = accounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);
  const { data: recentBills = [], isLoading: billsLoading } = useRecentBillPayments(user?.id);

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

      if (primaryAccount?.id && primaryBalance) {
        const newAmount = Math.max(walletBalance - amountNum, 0);
        await supabase.from('account_balances')
          .update({ amount: newAmount, balance_datetime: new Date().toISOString() })
          .eq('id', (primaryBalance as any).id);
      }

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
    <div className="flex flex-col gap-0 pb-28">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-5 pb-7 pt-5">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleBack} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5 text-white" strokeWidth={1.5} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold text-white">
              {selectedBiller ? selectedBiller : selectedCategory ? selectedCategory.name : 'Pay Bills'}
            </h1>
            <p className="text-xs text-white/70">
              {selectedBiller ? 'Enter payment details' : selectedCategory ? 'Select a biller' : 'Quick & secure bill payments'}
            </p>
          </div>
        </div>

        {/* Wallet Balance Pill */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="relative z-10 mt-4 flex items-center gap-2.5 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <CreditCard className="h-4.5 w-4.5 text-white" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/60">Available Balance</span>
            <span className="text-base font-bold text-white">{walletBalance.toLocaleString()} <span className="text-xs font-normal text-white/70">XAF</span></span>
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col gap-5 px-5 pt-5">
        <AnimatePresence mode="wait">
          {/* ── MAIN: Categories ── */}
          {!selectedCategory && !selectedBiller && (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-5">
              {/* Search */}
              <motion.div variants={fadeUp} initial="initial" animate="animate" className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                <Input placeholder="Search billers or categories…" value={search} onChange={e => setSearch(e.target.value)}
                  className="h-11 rounded-2xl border-border/50 bg-muted/40 pl-10 text-sm shadow-sm focus-visible:ring-primary/30" />
              </motion.div>

              {/* Category Grid */}
              <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-3 gap-3">
                {filteredCategories.map(cat => (
                  <motion.button key={cat.id} variants={fadeUp} whileTap={{ scale: 0.93 }} onClick={() => setSelectedCategory(cat)}
                    className="group flex flex-col items-center gap-2.5 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/40 transition-shadow active:shadow-md">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${cat.gradient} text-white shadow-md`}>
                      {cat.icon}
                    </div>
                    <span className="text-xs font-semibold text-foreground">{cat.name}</span>
                  </motion.button>
                ))}
              </motion.div>

              {/* Recent Payments */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <h2 className="text-sm font-bold text-foreground">Recent Payments</h2>
                </div>
                {billsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : recentBills.length === 0 ? (
                  <motion.div variants={fadeUp} initial="initial" animate="animate"
                    className="flex flex-col items-center gap-3 rounded-2xl bg-muted/30 py-10 ring-1 ring-border/30">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Receipt className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xs text-muted-foreground">No recent bill payments</p>
                  </motion.div>
                ) : (
                  <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-2.5">
                    {recentBills.map((bill: any) => {
                      const meta = bill.metadata as any;
                      const cat = meta?.category ? categories.find(c => c.id === meta.category) : null;
                      return (
                        <motion.div key={bill.id} variants={fadeUp}
                          className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-sm ring-1 ring-border/40">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cat?.gradient || 'from-gray-400 to-gray-500'} text-white shadow-sm`}>
                            {cat?.icon || <Receipt className="h-4 w-4" strokeWidth={1.5} />}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold text-foreground">{meta?.biller || bill.transaction_information || 'Bill Payment'}</span>
                            <span className="text-[11px] text-muted-foreground">{new Date(bill.booking_datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm font-bold text-foreground">{Number(bill.amount).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">XAF</span></span>
                            <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                              <CheckCircle2 className="h-3 w-3" strokeWidth={2} /> Paid
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── BILLER LIST ── */}
          {selectedCategory && !selectedBiller && (
            <motion.div key="billers" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }} className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">Choose your provider</p>
              <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-2.5">
                {selectedCategory.billers.map(biller => (
                  <motion.button key={biller} variants={fadeUp} whileTap={{ scale: 0.97 }} onClick={() => setSelectedBiller(biller)}
                    className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/40 transition-shadow active:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${selectedCategory.gradient} text-white shadow-sm`}>
                        {selectedCategory.icon}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-semibold text-foreground">{biller}</span>
                        <span className="text-[11px] text-muted-foreground capitalize">{selectedCategory.name}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/50" strokeWidth={1.5} />
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* ── PAYMENT FORM ── */}
          {selectedBiller && (
            <motion.div key="form" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }} className="flex flex-col gap-5">
              {paid ? (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-br from-primary/5 to-primary/10 py-12 ring-1 ring-primary/20">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.15 }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                    <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={1.5} />
                  </motion.div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-base font-bold text-foreground">Payment Successful</p>
                    <p className="text-xs text-muted-foreground">Your bill has been paid</p>
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* Biller Info Card */}
                  <motion.div variants={fadeUp} initial="initial" animate="animate"
                    className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/40">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${selectedCategory?.gradient} text-white shadow-md`}>
                      {selectedCategory?.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground">{selectedBiller}</span>
                      <span className="text-[11px] text-muted-foreground capitalize">{selectedCategory?.name} Payment</span>
                    </div>
                  </motion.div>

                  {/* Form */}
                  <motion.div variants={fadeUp} initial="initial" animate="animate" transition={{ delay: 0.08 }}
                    className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/40">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Account / Meter Number</label>
                      <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Enter account number"
                        className="h-12 rounded-xl border-border/50 bg-muted/30 text-sm font-medium" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Amount (XAF)</label>
                      <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                        className="h-14 rounded-xl border-border/50 bg-muted/30 text-center text-2xl font-bold" />
                    </div>

                    {/* Quick Amounts */}
                    <div className="flex gap-2">
                      {[5000, 10000, 25000, 50000].map(v => (
                        <motion.button key={v} whileTap={{ scale: 0.93 }} onClick={() => setAmount(String(v))}
                          className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${amountNum === v
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-muted/50 text-muted-foreground ring-1 ring-border/30'}`}>
                          {(v / 1000)}k
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div variants={fadeUp} initial="initial" animate="animate" transition={{ delay: 0.16 }}>
                    <Button onClick={handlePayRequest} disabled={paying || !accountNumber || amountNum <= 0}
                      className="h-13 w-full rounded-2xl bg-gradient-to-r from-primary to-primary/85 text-base font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                      {paying ? (
                        <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />Processing…</span>
                      ) : (
                        <span>Pay {amountNum > 0 ? `${amountNum.toLocaleString()} XAF` : 'Now'}</span>
                      )}
                    </Button>
                  </motion.div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handlePay} />
    </div>
  );
};

export default CustomerBills;
