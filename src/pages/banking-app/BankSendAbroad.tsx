import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Globe, ArrowRight, Banknote, Clock, CheckCircle2, ChevronLeft,
  Loader2, AlertTriangle, Search, ShieldCheck, Zap, TrendingUp, Eye,
} from 'lucide-react';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  created: { label: 'Submitted', color: 'bg-muted text-muted-foreground' },
  pending: { label: 'Processing', color: 'bg-amber-100 text-amber-800' },
  received: { label: 'In Transit', color: 'bg-blue-100 text-blue-800' },
  credited: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
  settled: { label: 'Settled', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', color: 'bg-destructive/10 text-destructive' },
};

type Step = 'corridors' | 'form' | 'quote' | 'success';

const BankSendAbroad: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('corridors');
  const [selectedCorridor, setSelectedCorridor] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('bank_transfer');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [receiverBankName, setReceiverBankName] = useState('');
  const [receiverAccountNumber, setReceiverAccountNumber] = useState('');
  const [purpose, setPurpose] = useState('personal');
  const [narration, setNarration] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [countryFilter, setCountryFilter] = useState('');

  const { data: corridors, isLoading: loadingCorridors, error: corridorsError } = useQuery({
    queryKey: ['bank-outbound-corridors'],
    queryFn: async () => {
      const res = await supabase.functions.invoke('remittance-outbound', { body: { action: 'get_corridors' } });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      return res.data?.corridors || [];
    },
  });

  const quoteMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('remittance-outbound', {
        body: { action: 'get_quote', corridor_id: selectedCorridor?.id, amount: parseFloat(amount) },
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => { setQuote(data); setStep('quote'); },
    onError: (err: any) => toast({ title: 'Quote Error', description: err.message, variant: 'destructive' }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('remittance-outbound', {
        body: {
          action: 'send', corridor_id: selectedCorridor?.id, amount: parseFloat(amount),
          quote_id: quote?.quote_id, receiver_name: receiverName,
          receiver_phone: receiverPhone || undefined, receiver_email: receiverEmail || undefined,
          receiver_country: selectedCorridor?.to_country,
          receiver_bank_name: receiverBankName || undefined,
          receiver_account_number: receiverAccountNumber || undefined,
          delivery_method: deliveryMethod, purpose_code: purpose, narration: narration || undefined,
        },
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => { setResult(data); setStep('success'); },
    onError: (err: any) => toast({ title: 'Transfer Failed', description: err.message, variant: 'destructive' }),
  });

  const filteredCorridors = corridors?.filter((c: any) => {
    if (!countryFilter) return true;
    const haystack = [
      c.to_country_name,
      c.to_country,
      c.to_currency,
      c.remittance_partners?.display_name,
      c.remittance_partners?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(countryFilter.toLowerCase());
  }) || [];

  const goBack = () => {
    if (step === 'corridors') navigate(`/bank/${institutionId}/payments`);
    else if (step === 'form') setStep('corridors');
    else if (step === 'quote') setStep('form');
    else setStep('corridors');
  };

  const resetForm = () => {
    setStep('corridors'); setSelectedCorridor(null); setAmount('');
    setReceiverName(''); setReceiverPhone(''); setReceiverEmail('');
    setReceiverBankName(''); setReceiverAccountNumber('');
    setQuote(null); setResult(null); setNarration('');
  };

  const stepLabels = ['Destination', 'Details', 'Quote', 'Done'];
  const stepIndex = ['corridors', 'form', 'quote', 'success'].indexOf(step);

  return (
    <div className="flex flex-col px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Button variant="ghost" size="icon" onClick={goBack} className="h-9 w-9">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Send Abroad</h1>
          <p className="text-xs text-muted-foreground">International transfers via partner network</p>
        </div>
        <Globe className="h-5 w-5 text-primary" />
      </div>

      {/* Step Indicator */}
      {step !== 'success' && (
        <div className="flex items-center gap-1 mt-4 mb-5 px-1">
          {stepLabels.slice(0, 3).map((label, i) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1 w-full rounded-full transition-all duration-500 ${i <= stepIndex ? 'bg-primary' : 'bg-muted'}`} />
              <span className={`text-[9px] font-medium ${i <= stepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: Corridors */}
        {step === 'corridors' && (
          <motion.div key="corridors" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Zap, label: 'Fast', sub: '< 24hrs', color: 'hsl(var(--bank-amber))' },
                { icon: ShieldCheck, label: 'Secure', sub: 'Encrypted', color: 'hsl(var(--bank-mint))' },
                { icon: TrendingUp, label: 'Low Fees', sub: 'From 1.5%', color: 'hsl(var(--bank-sky))' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border/50 bg-card p-3 text-center">
                  <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${stat.color}15` }}>
                    <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                  </div>
                  <p className="text-xs font-bold text-foreground">{stat.label}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by country..." value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}
                className="pl-10 rounded-2xl h-11 bg-muted/50 border-border/50" />
            </div>

            <p className="text-xs font-bold text-foreground px-1">Available Corridors</p>

            {loadingCorridors ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : corridorsError ? (
              <div className="text-center py-16">
                <AlertTriangle className="h-8 w-8 text-destructive/70 mx-auto mb-3" />
                <p className="font-semibold text-foreground">Unable to load corridors</p>
                <p className="text-xs text-muted-foreground mt-1">Please try again in a moment.</p>
              </div>
            ) : filteredCorridors.length > 0 ? (
              <div className="space-y-2">
                {filteredCorridors.map((c: any) => (
                  <Card key={c.id} className="cursor-pointer border-border/50 hover:border-primary/40 hover:shadow-md transition-all active:scale-[0.98]"
                    onClick={() => { setSelectedCorridor(c); setStep('form'); }}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{c.from_country} → {c.to_country}</p>
                          <p className="text-[11px] text-muted-foreground">{c.from_currency} → {c.to_currency} · {c.remittance_partners?.display_name || c.remittance_partners?.name || 'Partner'}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Globe className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-semibold text-foreground">No corridors available</p>
                <p className="text-xs text-muted-foreground mt-1">Contact support to enable new destinations</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 2: Form */}
        {step === 'form' && selectedCorridor && (
          <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-primary/5 border border-primary/10 p-3">
              <Globe className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-bold">{selectedCorridor.from_country} → {selectedCorridor.to_country}</p>
                <p className="text-[11px] text-muted-foreground">{selectedCorridor.from_currency} → {selectedCorridor.to_currency}</p>
              </div>
              <button onClick={() => setStep('corridors')} className="text-xs text-primary font-semibold">Change</button>
            </div>

            <Card className="border-border/50">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Amount ({selectedCorridor.from_currency})</Label>
                  <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="text-xl font-bold h-14 rounded-2xl" />
                </div>

                {(selectedCorridor.delivery_methods || []).length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Delivery Method</Label>
                    <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                      <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(selectedCorridor.delivery_methods || []).map((m: string) => (
                          <SelectItem key={m} value={m}>{m.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold">Receiver Name *</Label>
                  <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Full name" className="rounded-2xl" />
                </div>

                {deliveryMethod === 'paypal_email' ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">PayPal Email *</Label>
                    <Input type="email" value={receiverEmail} onChange={(e) => setReceiverEmail(e.target.value)} placeholder="receiver@email.com" className="rounded-2xl" />
                  </div>
                ) : deliveryMethod === 'mobile_money' ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Mobile Number *</Label>
                    <Input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="+233..." className="rounded-2xl" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Bank Name</Label>
                      <Input value={receiverBankName} onChange={(e) => setReceiverBankName(e.target.value)} placeholder="Receiver's bank" className="rounded-2xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Account Number *</Label>
                      <Input value={receiverAccountNumber} onChange={(e) => setReceiverAccountNumber(e.target.value)} placeholder="Account/IBAN" className="rounded-2xl" />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold">Purpose</Label>
                  <Select value={purpose} onValueChange={setPurpose}>
                    <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['personal', 'family_support', 'business', 'education', 'medical', 'rent'].map((p) => (
                        <SelectItem key={p} value={p}>{p.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={() => quoteMutation.mutate()} disabled={!amount || !receiverName || quoteMutation.isPending}
                  className="w-full h-12 rounded-2xl text-base font-bold gap-2">
                  {quoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Get Quote
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Quote */}
        {step === 'quote' && quote && (
          <motion.div key="quote" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-5 space-y-4">
                <div className="text-center">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">You Send</p>
                  <p className="text-3xl font-bold text-foreground">{parseFloat(amount).toLocaleString()} <span className="text-base font-normal text-muted-foreground">{quote.currency_in}</span></p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <span className="text-xs font-mono text-muted-foreground">Rate: 1 {quote.currency_in} = {quote.fx_rate} {quote.currency_out}</span>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">They Receive</p>
                  <p className="text-3xl font-bold text-primary">{quote.amount_out?.toLocaleString()} <span className="text-base font-normal">{quote.currency_out}</span></p>
                </div>
                <div className="flex justify-between text-sm border-t border-border/50 pt-3">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-semibold">{quote.fee_total?.toLocaleString()} {quote.currency_in}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Partner</span>
                  <span className="font-semibold">{quote.partner}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> ~{Math.round((quote.delivery_estimate_seconds || 3600) / 60)} min</span>
                </div>

                <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}
                  className="w-full h-12 rounded-2xl text-base font-bold gap-2">
                  {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Confirm & Send
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && result && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 text-center py-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Transfer Submitted!</h2>
            <p className="text-sm text-muted-foreground">Reference: <span className="font-mono font-semibold">{result.partner_reference}</span></p>
            <div className="grid grid-cols-2 gap-3 text-sm mt-4">
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-[10px] text-muted-foreground">Sent</p>
                <p className="font-bold">{result.amount_in?.toLocaleString()} {result.currency_in}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-[10px] text-muted-foreground">Receiver Gets</p>
                <p className="font-bold text-primary">{result.amount_out?.toLocaleString()} {result.currency_out}</p>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={resetForm} className="flex-1 rounded-2xl">New Transfer</Button>
              <Button onClick={() => navigate(`/bank/${institutionId}/more/remittances`)} className="flex-1 rounded-2xl">View History</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BankSendAbroad;
