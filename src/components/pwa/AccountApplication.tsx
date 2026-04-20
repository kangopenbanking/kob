import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, MapPin, ArrowRight, ArrowLeft, Building2, Calendar, Briefcase, Shield, Eye, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useTenant } from './TenantProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sounds } from '@/lib/sounds';

interface AccountApplicationProps {
  onComplete: () => void;
  onSkip?: () => void;
}

import { useSupportedCountries } from '@/hooks/useSupportedCountries';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const STEPS = ['Personal', 'Contact', 'Account', 'Security', 'Review'];

export const AccountApplication: React.FC<AccountApplicationProps> = ({ onComplete, onSkip }) => {
  const { data: supportedCountries = [] } = useSupportedCountries('banking');
  const tenant = useTenant();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: '' as '' | 'male' | 'female' | 'other',
    nationality: 'Cameroon',
    countryCode: '+237',
    phone: '',
    email: '',
    city: '',
    address: '',
    accountType: 'savings' as 'savings' | 'current' | 'business',
    occupation: '',
    pin: '',
    pinConfirm: '',
    password: '',
  });

  const progress = ((step + 1) / STEPS.length) * 100;
  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const canNext = () => {
    switch (step) {
      case 0: return form.fullName && form.dateOfBirth && form.gender;
      case 1: return form.phone.length >= 6 && form.city;
      case 2: return form.accountType;
      case 3: return form.pin.length === 6 && form.pin === form.pinConfirm && form.password.length >= 8;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step === 3 && form.pin !== form.pinConfirm) {
      sounds.error();
      toast.error('PINs do not match');
      return;
    }
    sounds.navigate();
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    sounds.navigate();
    setStep(s => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const fullPhone = `${form.countryCode}${form.phone}`;
      const emailForAuth = form.email || `${fullPhone.replace(/\+/g, '')}@temp.kob.cm`;

      // 1. Sign up
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailForAuth,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            phone: fullPhone,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Sign up failed');

      // 2. Update profile with extended fields
      await supabase.from('profiles').update({
        full_name: form.fullName,
        phone_number: fullPhone,
        date_of_birth: form.dateOfBirth,
        gender: form.gender,
        city: form.city,
        address: form.address,
        occupation: form.occupation,
        account_type: form.accountType,
        institution_id: tenant.id || null,
      }).eq('id', signUpData.user.id);

      // 3. Set PIN code
      const { error: pinError } = await supabase.functions.invoke('pin-code-set', {
        body: { pin_code: form.pin },
      });

      if (pinError) {
        console.error('PIN set failed (non-blocking):', pinError);
      }

      // 4. Normalize placeholder email to {user_id}@temp.kob.cm when no real
      //    email was provided. This keeps every account's auth email unique
      //    and tied to its stable user id rather than its phone number.
      if (!form.email) {
        const { error: normErr } = await supabase.functions.invoke('normalize-user-email');
        if (normErr) {
          console.error('Email normalization failed (non-blocking):', normErr);
        }
      }

      sounds.success();
      toast.success('Account created successfully!');
      onComplete();
    } catch (err: any) {
      sounds.error();
      toast.error(extractEdgeFunctionError(err, 'Failed to create account'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Open an Account</h1>
          <p className="text-sm text-muted-foreground">Apply for a {tenant.name} account</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-2">
        <Progress value={progress} className="h-1.5" />
      </div>
      <div className="mb-6 flex justify-between">
        {STEPS.map((s, i) => (
          <span key={s} className={`text-[10px] font-bold uppercase tracking-wider ${i <= step ? 'text-primary' : 'text-muted-foreground/40'}`}>
            {s}
          </span>
        ))}
      </div>

      {/* Steps */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex flex-1 flex-col gap-4"
        >
          {/* Step 0: Personal Info */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label className="text-sm">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                  <Input placeholder="Full legal name" value={form.fullName} onChange={e => update('fullName', e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Date of Birth</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                  <Input type="date" value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Gender</Label>
                <div className="flex gap-3">
                  {(['male', 'female', 'other'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => update('gender', g)}
                      className={`flex-1 rounded-xl border-2 p-3 text-center text-sm font-medium capitalize transition-colors ${
                        form.gender === g ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Nationality</Label>
                <Input value={form.nationality} onChange={e => update('nationality', e.target.value)} placeholder="Cameroon" />
              </div>
            </>
          )}

          {/* Step 1: Contact & Address */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label className="text-sm">Phone Number</Label>
                <div className="flex gap-2">
                  <Select value={form.countryCode} onValueChange={v => update('countryCode', v)}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {supportedCountries.map(cc => (
                        <SelectItem key={`${cc.dial_code}-${cc.code}`} value={cc.dial_code}>{cc.flag} {cc.dial_code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                    <Input type="tel" placeholder="6 XX XX XX XX" value={form.phone} onChange={e => update('phone', e.target.value.replace(/\D/g, ''))} className="pl-10" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Email (optional)</Label>
                <Input type="email" placeholder="you@example.com" value={form.email} onChange={e => update('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">City</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                  <Input placeholder="Douala, Yaoundé..." value={form.city} onChange={e => update('city', e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Address</Label>
                <Input placeholder="Street address" value={form.address} onChange={e => update('address', e.target.value)} />
              </div>
            </>
          )}

          {/* Step 2: Account Setup */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label className="text-sm">Account Type</Label>
                <div className="flex flex-col gap-3">
                  {([
                    { val: 'savings' as const, label: 'Savings', desc: 'Earn interest on your deposits' },
                    { val: 'current' as const, label: 'Current', desc: 'Day-to-day transactions' },
                    { val: 'business' as const, label: 'Business', desc: 'For businesses and enterprises' },
                  ]).map(t => (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => update('accountType', t.val)}
                      className={`rounded-xl border-2 p-4 text-left transition-colors ${
                        form.accountType === t.val ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <p className={`text-sm font-bold ${form.accountType === t.val ? 'text-primary' : 'text-foreground'}`}>{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Occupation</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                  <Input placeholder="e.g. Software Engineer" value={form.occupation} onChange={e => update('occupation', e.target.value)} className="pl-10" />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Security */}
          {step === 3 && (
            <>
              <div className="rounded-xl bg-primary/5 p-3 text-center">
                <Shield className="mx-auto mb-1 h-6 w-6 text-primary" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground">Your PIN will be used to authorize transactions</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Set 6-Digit PIN</Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={form.pin} onChange={v => update('pin', v)}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Confirm PIN</Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={form.pinConfirm} onChange={v => update('pinConfirm', v)}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {form.pinConfirm.length === 6 && form.pin !== form.pinConfirm && (
                  <p className="text-xs text-destructive text-center">PINs do not match</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Create Password</Label>
                <Input type="password" placeholder="Min. 8 characters" value={form.password} onChange={e => update('password', e.target.value)} minLength={8} required />
              </div>
            </>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <>
              <div className="flex flex-col items-center mb-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-2">
                  <Eye className="h-7 w-7 text-primary" strokeWidth={1.5} />
                </div>
                <h2 className="text-lg font-bold text-foreground">Review Your Application</h2>
              </div>
              <div className="rounded-2xl border bg-card p-4 flex flex-col gap-3">
                {[
                  { label: 'Full Name', value: form.fullName },
                  { label: 'Date of Birth', value: form.dateOfBirth },
                  { label: 'Gender', value: form.gender },
                  { label: 'Phone', value: `${form.countryCode}${form.phone}` },
                  { label: 'City', value: form.city },
                  { label: 'Account Type', value: form.accountType },
                  { label: 'Occupation', value: form.occupation || 'Not specified' },
                  { label: 'PIN Set', value: '••••••' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-semibold text-foreground capitalize">{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={handleBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canNext()} className="flex-1 gap-1.5">
            Continue <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading} className="flex-1 gap-1.5">
            {loading ? 'Creating Account...' : 'Submit Application'}
            {!loading && <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />}
          </Button>
        )}
      </div>

      {onSkip && step === 0 && (
        <div className="mt-4 text-center">
          <Button type="button" variant="ghost" onClick={onSkip} className="text-muted-foreground">
            I already have an account
          </Button>
        </div>
      )}
    </div>
  );
};
