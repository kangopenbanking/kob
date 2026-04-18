import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  ArrowLeft, ArrowRight, Check, ShoppingCart, PiggyBank, TrendingUp,
  Send, Plane, MoreHorizontal, ShieldCheck, Camera, CreditCard, User,
  Mail, Phone, MapPin, Calendar, Info, Fingerprint, ScanFace, Lock, Loader2,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const TOTAL_STEPS = 8;

const reasonOptions = [
  { id: 'payments', label: 'Make online payments', icon: ShoppingCart, color: 'bg-[hsl(210,80%,93%)]' },
  { id: 'daily', label: 'Spend or save daily', icon: PiggyBank, color: 'bg-[hsl(150,40%,90%)]' },
  { id: 'assets', label: 'Gain exposure to financial assets', icon: TrendingUp, color: 'bg-[hsl(50,80%,90%)]' },
  { id: 'manage', label: 'Send and manage money', icon: Send, color: 'bg-[hsl(25,80%,92%)]' },
  { id: 'travel', label: 'Spend while travelling', icon: Plane, color: 'bg-[hsl(280,50%,92%)]' },
  { id: 'other', label: 'Other reasons', icon: MoreHorizontal, color: 'bg-muted' },
];

const genderOptions = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const CustomerRegister: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCodeFromUrl = searchParams.get('ref') || '';
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Persist referral code in localStorage so it survives auth round-trips
  useEffect(() => {
    if (refCodeFromUrl) {
      localStorage.setItem('pending_referral_code', refCodeFromUrl.toUpperCase().trim());
    }
  }, [refCodeFromUrl]);

  // Step 0 - Reasons
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);

  // Step 2 - Photo ID
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  // Step 3 - Selfie
  const [selfie, setSelfie] = useState<File | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Step 4 - User Details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState<Date>();
  const [gender, setGender] = useState('');

  // Step 5 - PIN
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStage, setPinStage] = useState<'create' | 'confirm'>('create');

  // Prefill phone from auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.phone) setContactNumber(user.phone);
    });
  }, []);

  const toggleReason = (id: string) => {
    setSelectedReasons(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const canContinue = (): boolean => {
    switch (step) {
      case 0: return selectedReasons.length > 0;
      case 1: return true; // Verify identity intro
      case 2: return !!idPhoto;
      case 3: return !!selfie;
      case 4: return fullName.trim().length > 0 && contactNumber.length >= 9;
      case 5: return pinStage === 'confirm' ? confirmPin.length === 6 : newPin.length === 6;
      case 6: return true; // Fingerprint skip
      case 7: return true; // Face recognition skip
      default: return false;
    }
  };

  const handleNext = async () => {
    if (step === 5 && pinStage === 'create') {
      setPinStage('confirm');
      return;
    }
    if (step === 5 && pinStage === 'confirm') {
      if (newPin !== confirmPin) {
        toast.error('PINs do not match. Please try again.');
        setConfirmPin('');
        return;
      }
    }
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      await handleComplete();
    }
  };

  const handleBack = () => {
    if (step === 5 && pinStage === 'confirm') {
      setPinStage('create');
      setConfirmPin('');
      return;
    }
    if (step > 0) {
      setStep(step - 1);
    } else {
      navigate('/app/auth');
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update profile
      await supabase.from('profiles').update({
        full_name: fullName,
        phone_number: contactNumber,
        email: email || null,
        date_of_birth: dob ? format(dob, 'yyyy-MM-dd') : null,
        gender: gender || null,
        address: address || null,
      } as any).eq('id', user.id);

      // Upload KYC documents to storage and create kyc_verifications record
      let documentFrontPath: string | null = null;
      let selfiePath: string | null = null;

      if (idPhoto) {
        const idPath = `${user.id}/kyc/id-front-${Date.now()}.${idPhoto.name.split('.').pop()}`;
        const { error: uploadErr } = await supabase.storage.from('kyc-documents').upload(idPath, idPhoto);
        if (!uploadErr) {
          documentFrontPath = idPath;
        }
      }

      if (selfie) {
        const uploadedSelfiePath = `${user.id}/kyc/selfie-${Date.now()}.${selfie.name.split('.').pop()}`;
        const { error: uploadErr } = await supabase.storage.from('kyc-documents').upload(uploadedSelfiePath, selfie);
        if (!uploadErr) {
          selfiePath = uploadedSelfiePath;
        }
      }

      // Insert KYC verification record (consumer app - no institution_id)
      const allowedDocTypes = ['national_id', 'passport', 'drivers_license'];
      const docType = 'national_id';
      if (!allowedDocTypes.includes(docType)) throw new Error('Invalid document type');

      await supabase.from('kyc_verifications').insert({
        user_id: user.id,
        verification_type: 'identity',
        status: 'pending',
        document_type: docType,
        document_front_url: documentFrontPath,
        selfie_url: selfiePath,
        source_app: 'customer_app',
        institution_id: null,
      } as any);

      // Set PIN via edge function
      if (newPin) {
        const { data: pinData, error: pinError } = await supabase.functions.invoke('pin-code-set', {
          body: { user_id: user.id, pin_code: newPin },
        });
        if (pinError) throw pinError;
        if (pinData?.error) throw new Error(pinData.error);
      }

      // Link referral if code was captured during signup
      const pendingRefCode = localStorage.getItem('pending_referral_code');
      if (pendingRefCode) {
        try {
          await supabase.functions.invoke('customer-rewards', {
            body: { action: 'link_referral', referral_code: pendingRefCode },
          });
          localStorage.removeItem('pending_referral_code');
        } catch (refErr) {
          console.error('Referral link failed (non-blocking):', refErr);
        }
      }

      toast.success('Registration complete!');
      navigate('/app/onboarding', { replace: true });
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const slideVariants = {
    enter: { x: 60, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -60, opacity: 0 },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-5">
        <button onClick={handleBack} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{step + 1}/{TOTAL_STEPS}</span>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={step + (step === 5 ? `-${pinStage}` : '')}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            {/* Step 0: Reasons */}
            {step === 0 && (
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Why Kang?</h2>
                <p className="text-sm text-muted-foreground mb-6">Select all the reasons you'd like to use Kang</p>
                <div className="space-y-3">
                  {reasonOptions.map(opt => {
                    const Icon = opt.icon;
                    const active = selectedReasons.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleReason(opt.id)}
                        className={`flex w-full items-center gap-4 rounded-3xl border p-4 text-left transition-all ${
                          active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${opt.color}`}>
                          <Icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                        </div>
                        <span className="flex-1 text-sm font-medium text-foreground">{opt.label}</span>
                        {active && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                            <Check className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 1: Verify Identity Intro */}
            {step === 1 && (
              <div className="flex flex-col items-center gap-6 pt-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(210,80%,93%)]">
                  <ShieldCheck className="h-10 w-10 text-foreground" strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-bold text-foreground text-center">Let's verify your identity</h2>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  We want to confirm your identity before you can use Kang. This helps keep your account safe and secure.
                </p>
              </div>
            )}

            {/* Step 2: Photo ID */}
            {step === 2 && (
              <div className="flex flex-col items-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(50,80%,90%)]">
                  <CreditCard className="h-8 w-8 text-foreground" strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-bold text-foreground text-center">Photo ID</h2>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Point the camera at your ID card or passport to take a clear photo
                </p>
                <button
                  onClick={() => idInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-muted-foreground/30 bg-muted p-8 transition-colors hover:border-primary/50"
                >
                  {idPhoto ? (
                    <img src={URL.createObjectURL(idPhoto)} alt="ID" className="h-40 w-full rounded-2xl object-cover" />
                  ) : (
                    <>
                      <Camera className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
                      <span className="text-sm font-medium text-muted-foreground">Tap to take photo or upload</span>
                    </>
                  )}
                </button>
                <input
                  ref={idInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setIdPhoto(e.target.files[0])}
                />
              </div>
            )}

            {/* Step 3: Selfie */}
            {step === 3 && (
              <div className="flex flex-col items-center gap-6">
                <h2 className="text-xl font-bold text-foreground text-center">Selfie to confirm your ID</h2>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Position your face within the circle. Make sure you're in a well-lit area.
                </p>
                <div className="relative">
                  <div className="flex h-48 w-48 items-center justify-center rounded-full border-4 border-dashed border-primary/40 bg-muted overflow-hidden">
                    {selfie ? (
                      <img src={URL.createObjectURL(selfie)} alt="Selfie" className="h-full w-full object-cover" />
                    ) : (
                      <ScanFace className="h-16 w-16 text-muted-foreground" strokeWidth={1} />
                    )}
                  </div>
                  {/* Corner guides */}
                  <div className="absolute -top-2 -left-2 h-6 w-6 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                  <div className="absolute -top-2 -right-2 h-6 w-6 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                  <div className="absolute -bottom-2 -left-2 h-6 w-6 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                  <div className="absolute -bottom-2 -right-2 h-6 w-6 border-b-4 border-r-4 border-primary rounded-br-xl" />
                </div>
                <Button
                  variant="outline"
                  onClick={() => selfieInputRef.current?.click()}
                  className="gap-2 rounded-2xl h-12 border-foreground"
                >
                  <Camera className="h-5 w-5" strokeWidth={1.5} />
                  {selfie ? 'Retake Selfie' : 'Take Selfie'}
                </Button>
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setSelfie(e.target.files[0])}
                />
              </div>
            )}

            {/* Step 4: User Details */}
            {step === 4 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-foreground mb-1">Your details</h2>
                <p className="text-sm text-muted-foreground mb-2">Tell us a bit about yourself</p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className="h-12 rounded-2xl pl-10 text-sm" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Email (Optional)</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" className="h-12 rounded-2xl pl-10 text-sm" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contact Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                    <Input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="+237 6XX XXX XXX" className="h-12 rounded-2xl pl-10 text-sm" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Address</label>
                    <Popover>
                      <PopoverTrigger>
                        <Info className="h-3.5 w-3.5 text-primary cursor-pointer" strokeWidth={1.5} />
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-sm p-4">
                        <p className="font-semibold mb-1">PostiQ Digital Address</p>
                        <p className="text-muted-foreground text-xs mb-2">
                          Create a verified digital address for your location using PostiQ, Cameroon's digital addressing system.
                        </p>
                        <a
                          href="https://postiq.cam"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                        >
                          <ExternalLink className="h-3 w-3" /> Create address on postiq.cam
                        </a>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="PostiQ code or address" className="h-12 rounded-2xl pl-10 text-sm" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Date of Birth</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-12 w-full rounded-2xl justify-start text-left font-normal pl-10 text-sm relative",
                          !dob && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                        {dob ? format(dob, 'dd MMM yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dob}
                        onSelect={setDob}
                        disabled={(date) => date > new Date() || date < new Date('1920-01-01')}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Gender</label>
                  <div className="grid grid-cols-2 gap-2">
                    {genderOptions.map(g => (
                      <button
                        key={g}
                        onClick={() => setGender(g)}
                        className={`rounded-2xl border px-3 py-2.5 text-xs font-medium transition-all ${
                          gender === g ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Create PIN */}
            {step === 5 && (
              <div className="flex flex-col items-center gap-6 pt-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
                  <Lock className="h-8 w-8 text-foreground" strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-bold text-foreground text-center">
                  {pinStage === 'create' ? 'Create New PIN' : 'Confirm Your PIN'}
                </h2>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  {pinStage === 'create'
                    ? 'Add a 6-digit PIN to make your account more secure'
                    : 'Re-enter your PIN to confirm'}
                </p>
                <InputOTP
                  maxLength={6}
                  value={pinStage === 'create' ? newPin : confirmPin}
                  onChange={pinStage === 'create' ? setNewPin : setConfirmPin}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="h-12 w-12 rounded-xl border-border text-lg" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            )}

            {/* Step 6: Fingerprint */}
            {step === 6 && (
              <div className="flex flex-col items-center gap-6 pt-8">
                <motion.div
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(25,80%,92%)]"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Fingerprint className="h-12 w-12 text-foreground" strokeWidth={1.5} />
                </motion.div>
                <h2 className="text-xl font-bold text-foreground text-center">Set your fingerprint</h2>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Add fingerprint to make your account more secure. You can use it for quick login and transaction approvals.
                </p>
                <p className="text-xs text-muted-foreground/60">Place your finger on the sensor</p>
              </div>
            )}

            {/* Step 7: Face Recognition */}
            {step === 7 && (
              <div className="flex flex-col items-center gap-6 pt-8">
                <motion.div
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(280,50%,92%)]"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <ScanFace className="h-12 w-12 text-foreground" strokeWidth={1.5} />
                </motion.div>
                <h2 className="text-xl font-bold text-foreground text-center">Set Face Recognition</h2>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Add face recognition to make your account more secure. You can unlock your account and approve transactions with just a look.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 inset-x-0 p-5 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="flex gap-3">
          {(step === 6 || step === 7) && (
            <Button
              variant="outline"
              onClick={handleNext}
              className="flex-1 h-14 rounded-2xl text-sm font-semibold border-border"
            >
              Skip
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canContinue() || loading}
            className={cn(
              "h-14 rounded-2xl text-base font-semibold gap-2",
              (step === 6 || step === 7) ? 'flex-1' : 'w-full'
            )}
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : step === TOTAL_STEPS - 1 ? (
              'Complete Setup'
            ) : step === 1 ? (
              'Verify Identity'
            ) : step === 6 ? (
              'Enable Fingerprint'
            ) : step === 7 ? (
              'Enable Face ID'
            ) : (
              <>Continue <ArrowRight className="h-4 w-4" strokeWidth={1.5} /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CustomerRegister;
