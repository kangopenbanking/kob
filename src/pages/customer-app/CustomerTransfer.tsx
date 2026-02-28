import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Search, User, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useAccountBalances } from '@/hooks/useCustomerData';

const CustomerTransfer: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { data: accounts = [], isLoading: acctLoading } = useCustomerAccounts(user?.id);
  const accountIds = accounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);

  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const totalBalance = accounts.reduce((sum: number, acc: any) => {
    const b = balances.find((bl: any) => bl.account_id === acc.id);
    return sum + (b?.amount ?? 0);
  }, 0);

  const currency = balances[0]?.currency || 'XAF';

  const handleSend = () => {
    if (!amount || !recipient.trim()) return;
    setSending(true);
    // TODO: Integrate with actual transfer API
    setTimeout(() => {
      setSending(false);
      setSent(true);
      toast.success(`${currency} ${Number(amount).toLocaleString()} sent to ${recipient}`);
      setTimeout(() => {
        setSent(false);
        setAmount('');
        setRecipient('');
      }, 2500);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Transfer</h1>
      </div>

      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
              <CheckCircle2 className="h-10 w-10 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-bold text-foreground">Transfer Successful!</p>
            <p className="text-sm text-muted-foreground">{currency} {Number(amount || 0).toLocaleString()} sent to {recipient}</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
            {/* Amount Input */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 rounded-3xl bg-[hsl(225,50%,22%)] p-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(0,0%,100%)]/60">Enter Amount</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-[hsl(0,0%,100%)]/60">{currency}</span>
                <input type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0" className="bg-transparent text-4xl font-bold text-[hsl(0,0%,100%)] outline-none w-full text-center placeholder:text-[hsl(0,0%,100%)]/30" />
              </div>
              {acctLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(0,0%,100%)]/40" />
              ) : (
                <p className="text-xs text-[hsl(0,0%,100%)]/40">Available: {totalBalance.toLocaleString()} {currency}</p>
              )}
            </motion.div>

            {/* Recipient Input */}
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Recipient</p>
              <button className="flex items-center gap-3 rounded-2xl bg-card p-3.5 w-full" onClick={() => {
                const input = prompt('Enter recipient phone number or account ID');
                if (input) setRecipient(input.trim());
              }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Search className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <span className="flex-1 text-sm font-semibold text-left truncate">
                  {recipient ? (
                    <span className="text-foreground">{recipient}</span>
                  ) : (
                    <span className="text-muted-foreground">Search or enter number</span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </button>
            </div>

            {/* Account Selector */}
            {accounts.length > 0 && (
              <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(225,50%,22%)]">
                  <User className="h-5 w-5 text-[hsl(0,0%,100%)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">From: {accounts[0]?.nickname || accounts[0]?.account_holder_name || 'Account'}</p>
                  <p className="text-[10px] text-muted-foreground">{totalBalance.toLocaleString()} {currency} available</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
            )}

            {accounts.length === 0 && !acctLoading && (
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <p className="text-sm font-semibold text-muted-foreground">No accounts linked</p>
                <p className="text-xs text-muted-foreground mt-1">Link an account to send money</p>
              </div>
            )}

            <Button className="w-full rounded-2xl h-12 text-sm font-bold" disabled={!amount || !recipient.trim() || sending} onClick={handleSend}>
              {sending ? (
                <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Sending...</span>
              ) : (
                <><Send className="mr-2 h-4 w-4" strokeWidth={1.5} /> Send Money</>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerTransfer;
