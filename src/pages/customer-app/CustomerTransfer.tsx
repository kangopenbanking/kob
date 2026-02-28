import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Search, User, ChevronRight, CheckCircle2, Loader2, Wallet, Clock, X, Phone, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useAccountBalances } from '@/hooks/useCustomerData';

const quickAmounts = [5000, 10000, 25000, 50000, 100000];

const CustomerTransfer: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { data: accounts = [], isLoading: acctLoading } = useCustomerAccounts(user?.id);
  const accountIds = accounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);

  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientType, setRecipientType] = useState<'phone' | 'account'>('phone');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedAccountIdx, setSelectedAccountIdx] = useState(0);
  const amountRef = useRef<HTMLInputElement>(null);

  const totalBalance = accounts.reduce((sum: number, acc: any) => {
    const b = balances.find((bl: any) => bl.account_id === acc.id);
    return sum + (b?.amount ?? 0);
  }, 0);

  const selectedAccount = accounts[selectedAccountIdx];
  const selectedBalance = selectedAccount
    ? balances.find((b: any) => b.account_id === selectedAccount.id)
    : null;
  const availableBalance = selectedBalance?.amount ?? totalBalance;
  const currency = balances[0]?.currency || 'XAF';
  const amountNum = Number(amount || 0);
  const isOverBalance = amountNum > availableBalance;

  const handleContinue = () => {
    if (!amount || amountNum <= 0) { toast.error('Enter a valid amount'); return; }
    if (!recipient.trim()) { toast.error('Enter recipient details'); return; }
    if (isOverBalance) { toast.error('Insufficient balance'); return; }
    setStep('confirm');
  };

  const handleSend = () => {
    setSending(true);
    // TODO: Integrate with actual transfer API
    setTimeout(() => {
      setSending(false);
      setStep('success');
      toast.success(`${currency} ${amountNum.toLocaleString()} sent successfully`);
    }, 1500);
  };

  const handleReset = () => {
    setStep('form');
    setAmount('');
    setRecipient('');
    setNote('');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => {
          if (step === 'confirm') setStep('form');
          else if (step === 'success') handleReset();
          else navigate(-1);
        }}>
          <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold text-foreground">
          {step === 'confirm' ? 'Confirm Transfer' : step === 'success' ? 'Transfer Complete' : 'Send Money'}
        </h1>
      </div>

      <AnimatePresence mode="wait">
        {/* ─── SUCCESS ─── */}
        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-5 px-5 pt-12 pb-8 flex-1">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
              <CheckCircle2 className="h-12 w-12 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
            </motion.div>
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{currency} {amountNum.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-2">Sent to <span className="font-semibold text-foreground">{recipient}</span></p>
              {note && <p className="text-xs text-muted-foreground mt-1 italic">"{note}"</p>}
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-[hsl(150,40%,90%)]/50 px-4 py-2">
              <Clock className="h-3.5 w-3.5 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
              <p className="text-[11px] font-semibold text-[hsl(150,40%,35%)]">Processing · Usually instant</p>
            </div>
            <div className="w-full mt-auto space-y-3 pt-8">
              <Button className="w-full rounded-2xl h-12 text-sm font-bold" onClick={handleReset}>
                <Send className="mr-2 h-4 w-4" strokeWidth={1.5} /> Send Another
              </Button>
              <Button variant="outline" className="w-full rounded-2xl h-12 text-sm font-bold" onClick={() => navigate(-1)}>
                Done
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─── CONFIRM ─── */}
        {step === 'confirm' && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-5 px-5 pt-3 pb-8 flex-1">
            {/* Summary Card */}
            <div className="rounded-3xl border-2 border-foreground bg-card overflow-hidden">
              <div className="bg-[hsl(225,50%,22%)] p-6 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(0,0%,100%)]/60 mb-1">Amount</p>
                <p className="text-3xl font-bold text-[hsl(0,0%,100%)]">{currency} {amountNum.toLocaleString()}</p>
              </div>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between px-5 py-4">
                  <span className="text-xs text-muted-foreground">Recipient</span>
                  <span className="text-sm font-bold text-foreground">{recipient}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <span className="text-xs text-muted-foreground">From</span>
                  <span className="text-sm font-bold text-foreground">
                    {selectedAccount?.nickname || selectedAccount?.account_holder_name || 'Primary Account'}
                  </span>
                </div>
                {note && (
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-xs text-muted-foreground">Note</span>
                    <span className="text-sm text-foreground italic">{note}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-5 py-4">
                  <span className="text-xs text-muted-foreground">Fee</span>
                  <span className="text-sm font-bold text-[hsl(150,60%,40%)]">Free</span>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-3 pt-4">
              <Button className="w-full rounded-2xl h-12 text-sm font-bold" disabled={sending} onClick={handleSend}>
                {sending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                  </span>
                ) : (
                  <><Send className="mr-2 h-4 w-4" strokeWidth={1.5} /> Confirm & Send</>
                )}
              </Button>
              <Button variant="outline" className="w-full rounded-2xl h-12 text-sm font-bold" onClick={() => setStep('form')}>
                Go Back
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─── FORM ─── */}
        {step === 'form' && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-5 px-5 pt-3 pb-8 flex-1">

            {/* Amount Section */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 rounded-3xl bg-[hsl(225,50%,22%)] p-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(0,0%,100%)]/60">Enter Amount</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-[hsl(0,0%,100%)]/60">{currency}</span>
                <input
                  ref={amountRef}
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="bg-transparent text-4xl font-bold text-[hsl(0,0%,100%)] outline-none w-full text-center placeholder:text-[hsl(0,0%,100%)]/30"
                />
              </div>
              {acctLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(0,0%,100%)]/40" />
              ) : (
                <p className={`text-xs ${isOverBalance ? 'text-[hsl(0,70%,65%)]' : 'text-[hsl(0,0%,100%)]/40'}`}>
                  {isOverBalance ? 'Insufficient balance' : `Available: ${availableBalance.toLocaleString()} ${currency}`}
                </p>
              )}
            </motion.div>

            {/* Quick Amount Chips */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {quickAmounts.map((amt) => (
                <button key={amt} onClick={() => setAmount(String(amt))}
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    amount === String(amt)
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                  {amt >= 1000 ? `${amt / 1000}K` : amt}
                </button>
              ))}
            </div>

            {/* Recipient Section */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient</p>

              {/* Type Toggle */}
              <div className="flex gap-2">
                <button onClick={() => setRecipientType('phone')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold transition-all ${
                    recipientType === 'phone' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                  }`}>
                  <Phone className="h-3.5 w-3.5" strokeWidth={1.5} /> Phone
                </button>
                <button onClick={() => setRecipientType('account')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold transition-all ${
                    recipientType === 'account' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                  }`}>
                  <Hash className="h-3.5 w-3.5" strokeWidth={1.5} /> Account
                </button>
              </div>

              {/* Recipient Input */}
              <div className="relative">
                {recipientType === 'phone' ? (
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                ) : (
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                )}
                <Input
                  type={recipientType === 'phone' ? 'tel' : 'text'}
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={recipientType === 'phone' ? '+237 6XX XXX XXX' : 'Enter account ID'}
                  className="h-12 rounded-2xl pl-10 text-sm"
                />
                {recipient && (
                  <button onClick={() => setRecipient('')} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <X className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>

            {/* Source Account */}
            {accounts.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">From</p>
                <div className="space-y-2">
                  {accounts.map((acc: any, i: number) => {
                    const bal = balances.find((b: any) => b.account_id === acc.id);
                    const isSelected = selectedAccountIdx === i;
                    return (
                      <button key={acc.id} onClick={() => setSelectedAccountIdx(i)}
                        className={`flex items-center gap-3 rounded-2xl p-3.5 w-full text-left transition-all ${
                          isSelected ? 'bg-[hsl(225,50%,22%)] ring-2 ring-primary' : 'bg-card border border-border'
                        }`}>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          isSelected ? 'bg-[hsl(0,0%,100%)]/15' : 'bg-muted'
                        }`}>
                          <Wallet className={`h-5 w-5 ${isSelected ? 'text-[hsl(0,0%,100%)]' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs font-bold ${isSelected ? 'text-[hsl(0,0%,100%)]' : 'text-foreground'}`}>
                            {acc.nickname || acc.account_holder_name || `Account ${i + 1}`}
                          </p>
                          <p className={`text-[10px] ${isSelected ? 'text-[hsl(0,0%,100%)]/60' : 'text-muted-foreground'}`}>
                            {(bal?.amount ?? 0).toLocaleString()} {currency}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-5 w-5 text-[hsl(0,0%,100%)]" strokeWidth={1.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {accounts.length === 0 && !acctLoading && (
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <p className="text-sm font-semibold text-muted-foreground">No accounts linked</p>
                <p className="text-xs text-muted-foreground mt-1">Link an account to send money</p>
              </div>
            )}

            {/* Note */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Note (optional)</p>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's this for?"
                className="h-11 rounded-2xl text-sm"
                maxLength={100}
              />
            </div>

            {/* CTA */}
            <Button
              className="w-full rounded-2xl h-12 text-sm font-bold mt-auto"
              disabled={!amount || !recipient.trim() || isOverBalance || acctLoading}
              onClick={handleContinue}
            >
              <Send className="mr-2 h-4 w-4" strokeWidth={1.5} /> Continue
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerTransfer;
