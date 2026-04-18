import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2, Loader2, Wallet, Clock, X, Phone, Hash, Globe, CreditCard, User, Landmark, Smartphone, Mail, History, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useAccountBalances, useCustomerTransactions } from '@/hooks/useCustomerData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const quickAmounts = [5000, 10000, 25000, 50000, 100000];

type RecipientType = 'phone' | 'account' | 'name' | 'rib' | 'iban';

const CustomerTransfer: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading: acctLoading } = useCustomerAccounts(user?.id);
  const accountIds = accounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);
  const { data: recentTx = [] } = useCustomerTransactions(user?.id, undefined, 30);

  // Derive last 5 unique outbound recipients from transaction history
  const recentRecipients = useMemo(() => {
    const seen = new Set<string>();
    const out: { label: string; identifier: string; type: RecipientType }[] = [];
    for (const tx of (recentTx as any[])) {
      if (tx.credit_debit_indicator !== 'Debit') continue;
      const md = tx.merchant_details || {};
      const info = (tx.transaction_information as string) || '';
      // "Transfer to <name|recipient>"
      const m = info.match(/^Transfer to (.+?)(?: -.*)?$/i);
      const label = (m?.[1] || md.recipient_name || '').trim();
      const identifier = (md.destination_account_id || md.recipient || '').toString().trim();
      if (!label || !identifier) continue;
      const key = `${label}|${identifier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label, identifier, type: 'name' });
      if (out.length >= 5) break;
    }
    return out;
  }, [recentTx]);

  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('phone');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedAccountIdx, setSelectedAccountIdx] = useState(0);
  const [showPin, setShowPin] = useState(false);
  const [transferResult, setTransferResult] = useState<any>(null);
  const [nameSuggestions, setNameSuggestions] = useState<any[]>([]);
  const [nameSearching, setNameSearching] = useState(false);
  const [selectedRecipientName, setSelectedRecipientName] = useState('');
  const [selectedRecipientHasAccount, setSelectedRecipientHasAccount] = useState<boolean | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Debounced name search
  const searchByName = useCallback(async (query: string) => {
    if (query.length < 2 || !user) {
      setNameSuggestions([]);
      return;
    }
    setNameSearching(true);
    try {
      // Use the search_profiles_by_name RPC which masks phone numbers for privacy
      const { data: profiles, error: rpcError } = await supabase
        .rpc('search_profiles_by_name', { _query: query, _limit: 6 });

      if (rpcError) {
        console.error('Name search RPC error:', rpcError);
        setNameSuggestions([]);
        return;
      }

      if (profiles && profiles.length > 0) {
        // Look up accounts for these users (optional — registered users without
        // a provisioned account can still receive funds via their user_id, the
        // transfer engine resolves/creates a destination wallet on the fly).
        const userIds = profiles
          .map((p: any) => p.id)
          .filter((id: string) => id !== user?.id); // exclude self
        const { data: accts } = await supabase
          .from('accounts')
          .select('id, account_holder_name, user_id')
          .in('user_id', userIds)
          .eq('is_active', true);

        const suggestions = profiles
          .filter((p: any) => p.id !== user?.id)
          .map((p: any) => {
            const acct = accts?.find(a => a.user_id === p.id);
            return {
              userId: p.id,
              name: p.full_name,
              phone: p.phone_masked, // Already masked by RPC (e.g. +237677****)
              accountId: acct?.id || p.id, // fall back to user_id when no account
              hasAccount: !!acct,
            };
          });
        setNameSuggestions(suggestions);
      } else {
        setNameSuggestions([]);
      }
      setShowSuggestions(true);
    } catch (err) {
      console.error('Name search error:', err);
    } finally {
      setNameSearching(false);
    }
  }, [user]);

  const selectedAccount = accounts[selectedAccountIdx] as any;
  const selectedBalance = selectedAccount
    ? balances.find((b: any) => b.account_id === selectedAccount.id)
    : null;
  const availableBalance = (selectedBalance?.amount as number) ?? 0;
  const currency = (balances[0] as any)?.currency || 'XAF';
  const amountNum = Number(amount || 0);
  const isOverBalance = amountNum > availableBalance;

  // Format RIB display
  const formatRibDisplay = (value: string): string => {
    const digits = value.replace(/\D/g, '').substring(0, 23);
    if (digits.length <= 5) return digits;
    if (digits.length <= 10) return `${digits.substring(0, 5)}-${digits.substring(5)}`;
    if (digits.length <= 21) return `${digits.substring(0, 5)}-${digits.substring(5, 10)}-${digits.substring(10)}`;
    return `${digits.substring(0, 5)}-${digits.substring(5, 10)}-${digits.substring(10, 21)}-${digits.substring(21)}`;
  };

  const formatIbanDisplay = (value: string): string => {
    const clean = value.replace(/\s/g, '').toUpperCase().substring(0, 34);
    return clean.match(/.{1,4}/g)?.join(' ') || clean;
  };

  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (recipientType === 'rib') setRecipient(formatRibDisplay(raw));
    else if (recipientType === 'iban') setRecipient(formatIbanDisplay(raw));
    else setRecipient(raw);

    // For name type: clear selected state and trigger debounced search
    if (recipientType === 'name') {
      setSelectedRecipientName('');
      setSelectedRecipientHasAccount(null);
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
      nameDebounceRef.current = setTimeout(() => searchByName(raw), 300);
    }
  };

  const getRecipientValidation = (): { valid: boolean; hint: string } => {
    const clean = recipient.replace(/[\s\-]/g, '');
    switch (recipientType) {
      case 'rib':
        return { valid: /^\d{23}$/.test(clean), hint: clean.length > 0 ? `${clean.length}/23 digits` : 'Enter 23-digit RIB number' };
      case 'iban':
        return { valid: /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/i.test(clean) && clean.length >= 15, hint: clean.length > 0 ? `${clean.length} characters` : 'e.g. CM21 10005 00100 ...' };
      case 'name':
        return { valid: !!selectedRecipientName, hint: selectedRecipientName ? `Sending to ${selectedRecipientName}` : "Type a name to search" };
      default:
        return { valid: clean.length > 0, hint: '' };
    }
  };

  const validation = getRecipientValidation();

  const getIdentifierType = (): string => {
    switch (recipientType) {
      case 'rib': return 'DOMESTIC_RIB';
      case 'iban': return 'IBAN';
      case 'name': return 'NAME';
      default: return 'LOCAL_BANK';
    }
  };

  const getRailLabel = (): string => {
    switch (recipientType) {
      case 'rib': return 'Domestic Interbank';
      case 'iban': return 'International';
      case 'name': return 'Internal';
      default: return 'Internal';
    }
  };

  const handleContinue = () => {
    if (!amount || amountNum <= 0) { toast.error('Please enter an amount to send'); return; }
    if (amountNum < 100) { toast.error('Minimum transfer amount is 100 XAF'); return; }
    if (!recipient.trim()) { toast.error('Please enter the recipient\'s phone number, name, or account details'); return; }
    if (recipientType === 'name' && !selectedRecipientName) {
      toast.error('Please pick a recipient from the search suggestions');
      return;
    }
    if (!validation.valid && (recipientType === 'rib' || recipientType === 'iban')) { toast.error(`Please enter a valid ${recipientType === 'rib' ? 'RIB (23 digits)' : 'IBAN'} number`); return; }
    if (isOverBalance) { toast.error(`Insufficient balance. You have ${availableBalance.toLocaleString()} ${currency} available`); return; }
    setStep('confirm');
  };

  const handleSend = async () => {
    setSending(true);
    try {
      // For name-based transfers, preserve spaces; for others, strip formatting
      const cleanRecipient = recipientType === 'name'
        ? recipient.trim()
        : recipient.replace(/[\s\-]/g, '');
      const idempotencyKey = `transfer_${selectedAccount?.id}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('api-transfers', {
        body: {
          source_account_id: selectedAccount?.id,
          destination_account_id: cleanRecipient,
          amount: amountNum,
          currency,
          description: `Transfer to ${selectedRecipientName || recipient}${note ? ` - ${note}` : ''}`,
          identifier_type: getIdentifierType(),
          idempotency_key: idempotencyKey,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTransferResult(data);

      // Invalidate AND refetch balance caches so dashboard shows updated balance immediately
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['customer-accounts'] }),
        queryClient.refetchQueries({ queryKey: ['account-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['customer-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['spending-summary'] }),
      ]);

      setStep('success');
      toast.success(`${amountNum.toLocaleString()} ${currency} sent to ${selectedRecipientName || recipient}. Your new balance is updated.`);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Transfer could not be completed. Please verify recipient details and try again.'));
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setStep('form');
    setAmount('');
    setRecipient('');
    setNote('');
    setTransferResult(null);
    setSelectedRecipientName('');
    setSelectedRecipientHasAccount(null);
    setNameSuggestions([]);
    setShowSuggestions(false);
  };

  const recipientTypes: { key: RecipientType; label: string; icon: React.ElementType }[] = [
    { key: 'phone', label: 'Phone', icon: Phone },
    { key: 'name', label: 'Name', icon: User },
    { key: 'account', label: 'Account', icon: Hash },
    { key: 'rib', label: 'RIB', icon: CreditCard },
    { key: 'iban', label: 'IBAN', icon: Globe },
  ];

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
              <p className="text-sm text-muted-foreground mt-2">
                Sent to <span className="font-semibold text-foreground">{transferResult?.receiver || recipient}</span>
              </p>
              {note && <p className="text-xs text-muted-foreground mt-1 italic">"{note}"</p>}
            </div>
            {transferResult?.rail && (
              <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{transferResult.rail}</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-2xl bg-[hsl(150,40%,90%)]/50 px-4 py-2">
              <Clock className="h-3.5 w-3.5 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
              <p className="text-[11px] font-semibold text-[hsl(150,40%,35%)]">
                {transferResult?.status === 'Booked' ? 'Completed' : 'Processing · Usually instant'}
              </p>
            </div>
            {transferResult?.transaction_reference && (
              <p className="font-mono text-[10px] text-muted-foreground">Ref: {transferResult.transaction_reference}</p>
            )}
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
            <div className="rounded-3xl border-2 border-foreground bg-card overflow-hidden">
              <div className="bg-[hsl(225,50%,22%)] p-6 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(0,0%,100%)]/60 mb-1">Amount</p>
                <p className="text-3xl font-bold text-[hsl(0,0%,100%)]">{currency} {amountNum.toLocaleString()}</p>
              </div>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between px-5 py-4">
                  <span className="text-xs text-muted-foreground">Recipient</span>
                  <span className="text-sm font-bold text-foreground font-mono text-right max-w-[60%] break-all">
                    {selectedRecipientName || recipient}
                  </span>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    recipientType === 'rib' ? 'bg-[hsl(210,80%,93%)] text-[hsl(210,60%,45%)]'
                    : recipientType === 'iban' ? 'bg-[hsl(270,50%,92%)] text-[hsl(270,50%,45%)]'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {getRailLabel()}
                  </span>
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
              <Button className="w-full rounded-2xl h-12 text-sm font-bold" disabled={sending} onClick={() => setShowPin(true)}>
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
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').replace(/^0+/, ''))}
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
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient</p>
                <button
                  type="button"
                  onClick={() => navigate('/app/send-money')}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary"
                >
                  <Smartphone className="h-3 w-3" strokeWidth={2} />
                  <Landmark className="h-3 w-3" strokeWidth={2} />
                  <Mail className="h-3 w-3" strokeWidth={2} />
                  <span>MoMo · Bank · PayPal</span>
                  <ChevronRight className="h-3 w-3" strokeWidth={2} />
                </button>
              </div>

              {/* Recent Recipients */}
              {recentRecipients.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                    <History className="h-3 w-3" strokeWidth={1.5} /> Recent
                  </p>
                  <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {recentRecipients.map((r, i) => (
                      <button
                        key={`${r.identifier}-${i}`}
                        type="button"
                        onClick={() => {
                          setRecipientType('name');
                          setRecipient(r.identifier);
                          setSelectedRecipientName(r.label);
                          setNameSuggestions([]);
                          setShowSuggestions(false);
                        }}
                        className="shrink-0 flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 hover:bg-muted/80 transition-colors"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                        </div>
                        <span className="text-xs font-semibold text-foreground max-w-[120px] truncate">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Type Toggle */}
              <div className="grid grid-cols-5 gap-1.5">
                {recipientTypes.map(({ key, label, icon: Icon }) => {
                  const colorMap: Record<string, { active: string; inactive: string }> = {
                    phone: { active: 'bg-[#1B2B5E] text-white', inactive: 'bg-[#D4E4F7] text-[#1B2B5E]' },
                    account: { active: 'bg-[#2D7A5F] text-white', inactive: 'bg-[#D5EDE2] text-[#2D7A5F]' },
                    rib: { active: 'bg-[#C46A5A] text-white', inactive: 'bg-[#F4B8B8] text-[#C46A5A]' },
                    iban: { active: 'bg-[#8B6914] text-white', inactive: 'bg-[#F5E6D0] text-[#8B6914]' },
                    name: { active: 'bg-[#6B4FA0] text-white', inactive: 'bg-[#E8DEF8] text-[#6B4FA0]' },
                  };
                  const colors = colorMap[key] || { active: 'bg-foreground text-background', inactive: 'bg-muted text-muted-foreground' };
                  return (
                    <button key={key} onClick={() => { setRecipientType(key); setRecipient(''); setSelectedRecipientName(''); setSelectedRecipientHasAccount(null); setNameSuggestions([]); setShowSuggestions(false); }}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-bold transition-all border-2 ${
                        recipientType === key ? `${colors.active} border-transparent` : `${colors.inactive} border-transparent`
                      }`}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={recipientType === key ? 2 : 1.5} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Recipient Input */}
              <div className="relative">
                {recipientType === 'phone' ? (
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" strokeWidth={1.5} />
                ) : recipientType === 'name' ? (
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" strokeWidth={1.5} />
                ) : recipientType === 'rib' ? (
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" strokeWidth={1.5} />
                ) : recipientType === 'iban' ? (
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" strokeWidth={1.5} />
                ) : (
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" strokeWidth={1.5} />
                )}

                {/* Name type: show selected badge or search input */}
                {recipientType === 'name' && selectedRecipientName ? (
                  <div className="flex items-center h-12 rounded-2xl pl-10 pr-3 bg-card border border-border">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                      </div>
                      <span className="text-sm font-semibold text-foreground">{selectedRecipientName}</span>
                    </div>
                    <button onClick={() => { setSelectedRecipientName(''); setSelectedRecipientHasAccount(null); setRecipient(''); setNameSuggestions([]); }}>
                      <X className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </button>
                  </div>
                ) : (
                  <Input
                    type={recipientType === 'phone' ? 'tel' : 'text'}
                    value={recipient}
                    onChange={handleRecipientChange}
                    onFocus={() => { if (recipientType === 'name' && nameSuggestions.length > 0) setShowSuggestions(true); }}
                    onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }}
                    placeholder={
                      recipientType === 'phone' ? '+237 6XX XXX XXX'
                      : recipientType === 'name' ? 'Search by name...'
                      : recipientType === 'rib' ? '10005-00100-01234567890-23'
                      : recipientType === 'iban' ? 'CM21 1000 5001 0001 2345 6789 023'
                      : 'KOB account ID or account number'
                    }
                    className={`h-12 rounded-2xl pl-10 text-sm ${recipientType === 'rib' || recipientType === 'iban' ? 'font-mono tracking-wider' : ''}`}
                  />
                )}

                {/* Name search loading indicator */}
                {recipientType === 'name' && nameSearching && !selectedRecipientName && (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}

                {/* Clear button for non-name types */}
                {recipient && recipientType !== 'name' && (
                  <button onClick={() => setRecipient('')} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <X className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </button>
                )}

                {/* Name suggestions dropdown */}
                {recipientType === 'name' && showSuggestions && nameSuggestions.length > 0 && !selectedRecipientName && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                    {nameSuggestions.map((s, i) => (
                      <button
                        key={s.userId + i}
                        className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          // Use accountId (UUID) if available for direct resolution
                          setRecipient(s.accountId || s.name);
                          setSelectedRecipientName(s.name);
                          setSelectedRecipientHasAccount(!!s.hasAccount);
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                          <User className="h-4 w-4 text-primary" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                          {s.phone && (
                            <p className="text-[10px] text-muted-foreground">{s.phone}</p>
                          )}
                        </div>
                        {s.hasAccount ? (
                          <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[hsl(150,40%,90%)] text-[hsl(150,60%,30%)] shrink-0">Active</span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[hsl(40,80%,90%)] text-[hsl(35,70%,35%)] shrink-0">New</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* No results message */}
                {recipientType === 'name' && showSuggestions && nameSuggestions.length === 0 && !nameSearching && recipient.length >= 2 && !selectedRecipientName && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-2xl border border-border bg-card shadow-lg p-4">
                    <p className="text-xs text-muted-foreground text-center">No users found matching "{recipient}"</p>
                  </div>
                )}
              </div>

              {/* Validation hint for RIB/IBAN */}
              {((recipientType === 'rib' || recipientType === 'iban') && recipient) || (recipientType === 'name' && selectedRecipientName) ? (
                <p className={`text-[10px] ${validation.valid ? 'text-[hsl(150,60%,40%)]' : 'text-muted-foreground'}`}>
                  {validation.hint}
                </p>
              ) : null}

              {/* Auto-provisioning notice for new (unprovisioned) recipients */}
              {recipientType === 'name' && selectedRecipientName && selectedRecipientHasAccount === false && (
                <div className="mt-2 rounded-xl border border-[hsl(40,80%,75%)] bg-[hsl(40,90%,96%)] p-3">
                  <p className="text-[11px] font-semibold text-[hsl(35,70%,30%)] mb-1">
                    {selectedRecipientName} doesn't have an active Kang wallet yet
                  </p>
                  <p className="text-[10px] leading-relaxed text-[hsl(35,60%,30%)]">
                    We'll automatically create a wallet for them when you send. <span className="font-semibold">Please notify {selectedRecipientName.split(' ')[0]} to sign in to Kang and complete account activation</span> (verify phone, set PIN, and complete KYC) so they can access and use the funds you send.
                  </p>
                </div>
              )}
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
                            {((bal as any)?.amount ?? 0).toLocaleString()} {currency}
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
              disabled={
                !amount ||
                !recipient.trim() ||
                isOverBalance ||
                acctLoading ||
                ((recipientType === 'rib' || recipientType === 'iban') && !validation.valid) ||
                (recipientType === 'name' && !selectedRecipientName)
              }
              onClick={handleContinue}
            >
              <Send className="mr-2 h-4 w-4" strokeWidth={1.5} /> Continue
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handleSend} />
    </div>
  );
};

export default CustomerTransfer;
