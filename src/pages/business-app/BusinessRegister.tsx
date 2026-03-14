import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Store, ArrowRight, ArrowLeft, CheckCircle2, Building2, Mail, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import kangLogo from '@/assets/kang-logo.png';
import { useSupportedCountries } from '@/hooks/useSupportedCountries';

const STEPS = [
  { title: 'Business Info', description: 'Tell us about your business' },
  { title: 'Contact', description: 'How can we reach you?' },
  { title: 'Settings', description: 'Configure preferences' },
  { title: 'Review', description: 'Confirm your details' },
];

const BUSINESS_TYPES = [
  'sole_proprietorship', 'partnership', 'limited_company', 'ngo',
  'cooperative', 'freelancer', 'e_commerce', 'saas', 'marketplace', 'other',
];

const BusinessRegister: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: supportedCountries = [] } = useSupportedCountries();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    business_type: '',
    business_description: '',
    country: 'Cameroon',
    business_email: '',
    business_phone: '',
    contact_name: '',
    default_currency: 'XAF',
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const canProceed = () => {
    if (step === 0) return form.business_name.trim().length >= 2 && form.business_type;
    if (step === 1) return form.business_email.trim().includes('@');
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Auth Required', description: 'Please sign in first', variant: 'destructive' });
        navigate('/biz/auth');
        return;
      }

      const { data: existing } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id).maybeSingle();
      if (existing) {
        toast({ title: 'Info', description: 'You already have a merchant account' });
        navigate('/biz/home');
        return;
      }

      const { error } = await supabase.from('gateway_merchants').insert({
        user_id: user.id,
        business_name: form.business_name.trim(),
        business_email: form.business_email.trim() || null,
        business_phone: form.business_phone.trim() || null,
        status: 'DRAFT',
        kyb_status: 'not_submitted',
        environment: 'sandbox',
        metadata: {
          business_type: form.business_type,
          business_description: form.business_description,
          country: form.country,
          contact_name: form.contact_name,
          default_currency: form.default_currency || 'XAF',
        },
      });

      if (error) throw error;

      toast({ title: 'Welcome!', description: 'Merchant account created! Welcome aboard 🎉' });
      setTimeout(() => navigate('/biz/home'), 500);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create merchant account', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="relative overflow-hidden bg-primary px-6 pb-14 pt-12">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[hsl(0,0%,100%)]/[0.08]" />
        <div className="absolute -left-8 bottom-4 h-28 w-28 rounded-full bg-[hsl(0,0%,100%)]/[0.05]" />
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(0,0%,100%)]/20 shadow-lg backdrop-blur-sm">
            <img src={kangLogo} alt="Kang" className="h-10 w-10 rounded-xl object-contain" />
          </div>
          <h1 className="text-xl font-bold text-primary-foreground">Register Your Business</h1>
          <p className="mt-1 text-sm text-primary-foreground/70">Start accepting payments in minutes</p>
        </motion.div>
      </div>

      <div className="relative z-10 -mt-6 flex flex-1 flex-col px-5 pb-10">
        {/* Progress */}
        <div className="mb-5 flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary text-primary-foreground ring-3 ring-primary/20' :
                'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 w-6 ${i < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-border/50 bg-card p-5 shadow-xl shadow-black/5"
        >
          <h2 className="text-base font-bold text-foreground">{STEPS[step].title}</h2>
          <p className="text-xs text-muted-foreground mb-4">{STEPS[step].description}</p>

          <div className="space-y-4">
            {step === 0 && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Business Name *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9 rounded-xl" placeholder="Acme Technologies" value={form.business_name} onChange={e => update('business_name', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Business Type *</Label>
                  <Select value={form.business_type} onValueChange={v => update('business_type', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Country</Label>
                  <Select value={form.country} onValueChange={v => update('country', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {supportedCountries.map(c => <SelectItem key={c.code} value={c.country}>{c.flag} {c.country}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea className="rounded-xl" placeholder="Describe your business..." value={form.business_description} onChange={e => update('business_description', e.target.value)} rows={3} />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Business Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9 rounded-xl" type="email" placeholder="billing@acme.com" value={form.business_email} onChange={e => update('business_email', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9 rounded-xl" placeholder="+237 6XX XXX XXX" value={form.business_phone} onChange={e => update('business_phone', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contact Person</Label>
                  <Input className="rounded-xl" placeholder="John Doe" value={form.contact_name} onChange={e => update('contact_name', e.target.value)} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Default Currency</Label>
                  <Select value={form.default_currency} onValueChange={v => update('default_currency', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XAF">XAF (CFA Franc BEAC)</SelectItem>
                      <SelectItem value="XOF">XOF (CFA Franc BCEAO)</SelectItem>
                      <SelectItem value="NGN">NGN (Nigerian Naira)</SelectItem>
                      <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">What happens next?</p>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />Account starts in Sandbox mode</li>
                    <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />Complete KYB verification to go live</li>
                    <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />Get API keys immediately</li>
                  </ul>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Business', form.business_name],
                    ['Type', form.business_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())],
                    ['Country', form.country],
                    ['Currency', form.default_currency],
                    ['Email', form.business_email || '—'],
                    ['Phone', form.business_phone || '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="rounded-xl border border-border/40 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-xs font-semibold mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    By creating your account, you agree to our Terms of Service and Merchant Agreement.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3 mt-5">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="rounded-xl gap-1.5 text-xs h-10">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            <div className="flex-1" />
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="rounded-xl gap-1.5 text-xs h-10 bg-foreground text-background hover:bg-foreground/90">
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting} className="rounded-xl gap-1.5 text-xs h-10 bg-foreground text-background hover:bg-foreground/90">
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Account
              </Button>
            )}
          </div>
        </motion.div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <button onClick={() => navigate('/biz/auth')} className="font-medium text-primary hover:underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default BusinessRegister;
