import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, ArrowLeft, Smartphone, Shield, User, Building2, Landmark, Code,
  CheckCircle, Lock, Globe, ArrowRight, Mail, Calendar, Hash, FileText, Briefcase, KeyRound
} from 'lucide-react';
import { z } from 'zod';
import { useFirebasePhoneAuth } from '@/hooks/useFirebasePhoneAuth';
import { useOTPProviderSettings } from '@/hooks/useOTPProviderSettings';
import { OTPProviderStatus } from '@/components/auth/OTPProviderStatus';
import { useAuthPageConfig } from '@/hooks/useAuthPageConfig';
import { MandatoryPinSetupStep } from '@/components/auth/MandatoryPinSetupStep';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupportedCountries } from '@/hooks/useSupportedCountries';
import { enforceSingleSession } from '@/hooks/useSingleSession';
import { sounds } from '@/lib/sounds';
import { SafeImage } from "@/components/common/SafeImage";


// ── Types ──────────────────────────────────────────────────────────
type AccountType = 'personal' | 'merchant' | 'institution' | 'developer';
type AuthMode = 'select' | 'login' | 'register';
type RegisterStep = 'account-type' | 'identity' | 'details' | 'pin-setup' | 'success';
type LoginStep = 'captcha' | 'phone' | 'pin' | 'otp' | 'firebase-otp' | 'complete' | 'forgot-password' | 'reset-pin' | 'setup-pin';
type AuthMethod = 'standard' | 'firebase';
type DeliveryMethod = 'sms' | 'whatsapp' | 'both' | 'email' | 'pin';

// ── Schemas ────────────────────────────────────────────────────────
const phoneSchema = z.string().regex(/^\d{6,15}$/, 'Invalid phone number');
const pinSchema = z.string().regex(/^\d{6}$/, 'PIN must be 6 digits');
const otpSchema = z.string().regex(/^\d{6}$/, 'OTP must be 6 digits');

// ── Account Type Config ────────────────────────────────────────────
const ACCOUNT_TYPES: {
  type: AccountType;
  label: string;
  subtitle: string;
  icon: typeof User;
  color: string;
  borderColor: string;
  bgColor: string;
  iconBg: string;
  requirements: string[];
  description: string;
}[] = [
  {
    type: 'personal',
    label: 'Personal Account',
    subtitle: 'Banking & Payments',
    icon: User,
    color: 'text-blue-600',
    borderColor: 'border-blue-200 hover:border-blue-400',
    bgColor: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    requirements: ['KYC verification required', 'Link mobile money accounts', 'Access credit scoring'],
    description: 'Send & receive money, track spending, build your credit score, and access financial services.',
  },
  {
    type: 'merchant',
    label: 'Business Account',
    subtitle: 'Accept Payments',
    icon: Building2,
    color: 'text-emerald-600',
    borderColor: 'border-emerald-200 hover:border-emerald-400',
    bgColor: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    requirements: ['KYB documents needed', 'Business registration required', 'Settlement configuration'],
    description: 'Accept payments via mobile money, manage staff, track revenue, and configure settlement.',
  },
  {
    type: 'institution',
    label: 'Financial Institution',
    subtitle: 'Open Banking APIs',
    icon: Landmark,
    color: 'text-amber-600',
    borderColor: 'border-amber-200 hover:border-amber-400',
    bgColor: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    requirements: ['Regulatory licence required', 'Admin approval process', 'KYB verification mandatory'],
    description: 'Banks, microfinance & fintechs — manage accounts, issue loans, and connect via Open Banking.',
  },
  {
    type: 'developer',
    label: 'Developer Account',
    subtitle: 'Build & Integrate',
    icon: Code,
    color: 'text-violet-600',
    borderColor: 'border-violet-200 hover:border-violet-400',
    bgColor: 'bg-violet-50',
    iconBg: 'bg-violet-100',
    requirements: ['Sandbox access on signup', 'Production requires approval', 'API documentation available'],
    description: 'Access sandbox APIs, build fintech products, test integrations, and request production access.',
  },
];

const INSTITUTION_TYPES = [
  { value: 'bank', label: 'Commercial Bank' },
  { value: 'credit_union', label: 'Credit Union / Microfinance' },
  { value: 'fintech', label: 'Fintech Institution' },
  { value: 'developer', label: 'Developer / API Provider' },
];

const BUSINESS_TYPES = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'limited_company', label: 'Limited Company' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'ngo', label: 'NGO / Non-Profit' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'e_commerce', label: 'E-Commerce' },
  { value: 'saas', label: 'SaaS' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'other', label: 'Other' },
];

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

// ── Progress Steps Config ──────────────────────────────────────────
const REGISTER_STEPS: { key: RegisterStep; label: string }[] = [
  { key: 'account-type', label: 'Account Type' },
  { key: 'identity', label: 'Identity' },
  { key: 'details', label: 'Details' },
  { key: 'pin-setup', label: 'Security' },
  { key: 'success', label: 'Complete' },
];

// ════════════════════════════════════════════════════════════════════
// ── Captcha auto-solver ──
const solveCaptcha = (q: string): number => {
  const match = q.match(/(\d+)\s*([+\-*])\s*(\d+)/);
  if (!match) return 0;
  const [, a, op, b] = match;
  if (op === '+') return parseInt(a) + parseInt(b);
  if (op === '-') return parseInt(a) - parseInt(b);
  if (op === '*') return parseInt(a) * parseInt(b);
  return 0;
};

// ════════════════════════════════════════════════════════════════════
export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config: authConfig } = useAuthPageConfig();
  const { data: supportedCountries = [], isLoading: countriesLoading } = useSupportedCountries('desktop');

  // Only show countries enabled by admin — deduplicate by country+code
  const countryList = (() => {
    const raw = supportedCountries.map(sc => ({ country: sc.country, code: sc.dial_code, flag: sc.flag }));
    const seen = new Set<string>();
    return raw.filter(c => {
      const k = `${c.country}-${c.code}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  })();

  // ── Top-level state ──
  const [authMode, setAuthMode] = useState<AuthMode>('select');
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType>('personal');

  // ── Registration state ──
  const [registerStep, setRegisterStep] = useState<RegisterStep>('account-type');
  const [regLoading, setRegLoading] = useState(false);

  // Identity fields
  const [selectedCountry, setSelectedCountry] = useState('Cameroon');
  const countryCode = countryList.find(c => c.country === selectedCountry)?.code || '+237';
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // OTP verification (registration)
  const firebasePhone = useFirebasePhoneAuth({ otpType: 'login' });
  useOTPProviderSettings();
  const [regOtpCode, setRegOtpCode] = useState('');
  const [regOtpSent, setRegOtpSent] = useState(false);
  const [regOtpVerified, setRegOtpVerified] = useState(false);

  // Account-specific detail fields
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessContactPerson, setBusinessContactPerson] = useState('');
  const [businessCurrency, setBusinessCurrency] = useState('XAF');
  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [orgName, setOrgName] = useState('');
  const [useCase, setUseCase] = useState('');
  const [detailCountry, setDetailCountry] = useState('Cameroon');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // ── Login state ──
  const [loginStep, setLoginStep] = useState<LoginStep>('captcha');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('firebase');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [userHasPIN, setUserHasPIN] = useState(false);
  const [usesPINLogin, setUsesPINLogin] = useState(false);
  const [pinLoginAttempts, setPinLoginAttempts] = useState(3);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginCountry, setLoginCountry] = useState('Cameroon');
  const loginCountryCode = countryList.find(c => c.country === loginCountry)?.code || '+237';
  const [loginPinCode, setLoginPinCode] = useState('');
  const [loginOtpCode, setLoginOtpCode] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pin');
  const [loginEmail, setLoginEmail] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState('');
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaSessionId, setCaptchaSessionId] = useState('');
  const [firebaseOtpCode, setFirebaseOtpCode] = useState('');

  // Forgot password / reset PIN state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [resetPinLoading, setResetPinLoading] = useState(false);

  const isCameroonLogin = loginCountryCode === '+237';

  // ── Auth check ──
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) navigate('/dashboard');
    };
    check();
  }, [navigate]);

  // ── Captcha effects ──
  useEffect(() => {
    if (authMode === 'login' && loginStep === 'captcha') generateCaptcha();
  }, [authMode, loginStep]);

  useEffect(() => {
    if (authMode !== 'login' || loginStep !== 'captcha') return;
    const iv = setInterval(() => { generateCaptcha(); }, 4 * 60 * 1000);
    return () => clearInterval(iv);
  }, [authMode, loginStep]);

  // ── Captcha ──
  const generateCaptcha = async (retryCount = 0) => {
    try {
      const { data, error } = await supabase.functions.invoke('captcha-generate');
      if (error) throw error;
      if (!data?.question || !data?.session_id) throw new Error('Invalid captcha');
      setCaptchaQuestion(data.question);
      setCaptchaSessionId(data.session_id);
      setCaptchaAnswer('');
    } catch (err) {
      if (retryCount < 2) setTimeout(() => generateCaptcha(retryCount + 1), 1500 * (retryCount + 1));
      else toast({ title: 'Error', description: 'Failed to load security check. Please refresh.', variant: 'destructive' });
    }
  };

  const handleVerifyCaptcha = async () => {
    if (!captchaAnswer) { toast({ title: 'Required', description: 'Please solve the math problem', variant: 'destructive' }); return; }
    setLoginLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('captcha-verify', {
        body: { session_id: captchaSessionId, answer: parseInt(captchaAnswer) },
      });
      if (error || !data?.verified) throw new Error(data?.error || 'Captcha failed');
      setLoginStep(authMethod === 'firebase' ? 'firebase-otp' : 'phone');
    } catch (err: any) {
      const msg = err.message || 'Please try again';
      toast({ title: msg.includes('expired') ? 'Expired' : 'Incorrect', description: msg, variant: 'destructive' });
      generateCaptcha();
    } finally { setLoginLoading(false); }
  };

  // ── Login handlers ──
  const checkIfUserHasPIN = async () => {
    try {
      const fullPhone = `${loginCountryCode}${loginPhone}`;
      const { data, error } = await supabase.functions.invoke('phone-auth-check-pin', { body: { phone_number: fullPhone } });
      if (error || !data) { setUserHasPIN(false); return { exists: null, hasPIN: false }; }
      const exists = data.check_complete === true;
      const hasPIN = data.has_pin === true;
      setUserHasPIN(hasPIN);
      return { exists, hasPIN };
    } catch { setUserHasPIN(false); return { exists: null, hasPIN: false }; }
  };

  const handleLoginPhoneSubmit = async () => {
    try { phoneSchema.parse(loginPhone); } catch {
      toast({ title: 'Invalid phone', description: 'Enter a valid phone number', variant: 'destructive' }); return;
    }
    setLoginLoading(true);
    try {
      if (deliveryMethod === 'pin') {
        const { exists, hasPIN } = await checkIfUserHasPIN();
        if (exists === null) { setLoginLoading(false); return; }
        if (!exists) { toast({ title: 'Not Found', description: 'No account found. Please sign up.', variant: 'destructive' }); setLoginLoading(false); return; }
        if (!hasPIN) { toast({ title: 'No PIN Set', description: 'No PIN is set for this account. Please use SMS or Email to log in.', variant: 'destructive' }); setLoginLoading(false); return; }
        setUsesPINLogin(true); setLoginStep('pin'); setLoginLoading(false); return;
      }
      setUsesPINLogin(false);
      await handleLoginSendOTP();
    } finally { setLoginLoading(false); }
  };

  const handleLoginSendOTP = async () => {
    const fullPhone = `${loginCountryCode}${loginPhone}`;
    const body: Record<string, any> = {
      otp_type: 'login',
      delivery_method: deliveryMethod,
      captcha_session_id: captchaSessionId,
    };
    if (deliveryMethod === 'email') {
      body.email_address = loginEmail;
    } else {
      body.phone_number = fullPhone;
    }
    const { data, error } = await supabase.functions.invoke('phone-auth-send-otp', { body });
    if (error) throw error;
    setOtpExpiresAt(data.expires_at);
    setLoginStep('otp');
  };

  const handlePINLogin = async () => {
    try { pinSchema.parse(loginPinCode); } catch { toast({ title: 'Invalid PIN', description: 'PIN must be 6 digits', variant: 'destructive' }); return; }
    setLoginLoading(true);
    try {
      // Auto-generate and solve captcha for PIN login (matching mobile behavior)
      let captchaSid = captchaSessionId;
      if (!captchaSid) {
        const { data: captchaData, error: captchaError } = await supabase.functions.invoke('captcha-generate', { body: {} });
        if (captchaError) throw captchaError;
        const answer = solveCaptcha(captchaData.question);
        await supabase.functions.invoke('captcha-verify', { body: { session_id: captchaData.session_id, answer } });
        captchaSid = captchaData.session_id;
      }

      const fullPhone = `${loginCountryCode}${loginPhone}`;
      const { data, error } = await supabase.functions.invoke('phone-auth-pin-login', {
        body: { phone_number: fullPhone, pin_code: loginPinCode, captcha_session_id: captchaSid },
      });
      if (error) {
        try { const p = JSON.parse(typeof error === 'object' && error.message ? error.message : String(error)); if (p.locked) throw new Error(p.error); if (p.remaining_attempts !== undefined) setPinLoginAttempts(p.remaining_attempts); throw new Error(p.error || 'Invalid PIN'); } catch (pe) { if (pe instanceof SyntaxError) throw new Error(String(error)); throw pe; }
      }
      if (!data?.success) { if (data?.locked) throw new Error(data.error); sounds.error(); setPinLoginAttempts(data?.remaining_attempts || 0); throw new Error(data?.error || 'Invalid PIN'); }
      if (data.session) {
        await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
        await enforceSingleSession(data.session.access_token);
      }
      sounds.success();
      toast({ title: 'Welcome back!', description: 'Signed in successfully' });
      setLoginStep('complete');
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err: any) {
      sounds.error();
      toast({ title: 'Login Failed', description: err.message || 'Invalid PIN', variant: 'destructive' });
    } finally { setLoginLoading(false); }
  };

  const handleLoginVerifyOTP = async () => {
    try { otpSchema.parse(loginOtpCode); } catch { toast({ title: 'Invalid OTP', description: '6 digits required', variant: 'destructive' }); return; }
    setLoginLoading(true);
    try {
      const identifier = deliveryMethod === 'email' ? loginEmail : `${loginCountryCode}${loginPhone}`;
      const { data, error } = await supabase.functions.invoke('phone-auth-verify-otp', {
        body: { phone_number: identifier, otp_code: loginOtpCode, otp_type: 'login', country_code: loginCountryCode },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Failed');
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await enforceSingleSession(session.access_token);
      // Check if user needs PIN setup
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('pin_code_hash').eq('id', session.user.id).maybeSingle();
        if (!profile?.pin_code_hash) {
          setLoginStep('setup-pin');
          return;
        }
      }
      sounds.success();
      setLoginStep('complete');
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err: any) { sounds.error(); toast({ title: 'Failed', description: err.message, variant: 'destructive' }); }
    finally { setLoginLoading(false); }
  };

  const handleFirebaseSendOTP = async () => {
    try { phoneSchema.parse(loginPhone); } catch { toast({ title: 'Invalid phone', description: 'Enter a valid number', variant: 'destructive' }); return; }
    await firebasePhone.sendOTP(`${loginCountryCode}${loginPhone}`);
  };

  const handleFirebaseVerifyOTP = async () => {
    if (firebaseOtpCode.length !== 6) return;
    const ok = await firebasePhone.verifyOTP(firebaseOtpCode);
    if (ok) {
      // Retry session retrieval to handle propagation delay
      let session = null;
      for (let i = 0; i < 3; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) { session = data.session; break; }
        await new Promise(r => setTimeout(r, 500));
      }
      if (session) await enforceSingleSession(session.access_token);
      // Check if user needs PIN setup
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('pin_code_hash').eq('id', session.user.id).maybeSingle();
        if (!profile?.pin_code_hash) {
          setLoginStep('setup-pin');
          return;
        }
      }
      sounds.success();
      setLoginStep('complete');
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  };

  // ── Forgot password handler ──
  const handleForgotPassword = async () => {
    if (!forgotEmail) { toast({ title: 'Required', description: 'Please enter your email', variant: 'destructive' }); return; }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
      toast({ title: 'Email sent', description: 'Check your inbox for the reset link' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message || 'Failed to send reset email', variant: 'destructive' });
    } finally { setForgotLoading(false); }
  };

  // ── Reset PIN handler ──
  const handleResetPin = async () => {
    if (newPin.length !== 6 || confirmNewPin.length !== 6) { toast({ title: 'Invalid', description: 'PIN must be 6 digits', variant: 'destructive' }); return; }
    if (newPin !== confirmNewPin) { toast({ title: 'Mismatch', description: 'PINs do not match', variant: 'destructive' }); return; }
    setResetPinLoading(true);
    try {
      const fullPhone = `${loginCountryCode}${loginPhone}`;
      const { data, error } = await supabase.functions.invoke('pin-code-reset', {
        body: { phone_number: fullPhone, new_pin_code: newPin },
      });
      if (error) throw error;
      if (data?.success) {
        sounds.success();
        toast({ title: 'PIN Reset', description: 'PIN reset successfully! Please sign in.' });
        setNewPin(''); setConfirmNewPin(''); setLoginStep('captcha'); generateCaptcha();
      } else { throw new Error(data?.error || 'Failed to reset PIN'); }
    } catch (err: any) {
      sounds.error();
      toast({ title: 'Failed', description: err.message || 'Failed to reset PIN', variant: 'destructive' });
    } finally { setResetPinLoading(false); }
  };

  // ── Login PIN setup complete handler ──
  const handleLoginPinSetupComplete = () => {
    sounds.success();
    toast({ title: 'PIN Set', description: 'Your security PIN has been set successfully' });
    setLoginStep('complete');
    setTimeout(() => navigate('/dashboard'), 1000);
  };

  // ── Registration handlers ──
  const handleRegSendOTP = async () => {
    try { phoneSchema.parse(phoneNumber); } catch { toast({ title: 'Invalid phone', description: 'Enter a valid number', variant: 'destructive' }); return; }
    if (!fullName.trim()) { toast({ title: 'Required', description: 'Full name is required', variant: 'destructive' }); return; }
    if (['merchant', 'institution', 'developer'].includes(selectedAccountType) && !email.trim()) {
      toast({ title: 'Required', description: 'Email is required for this account type', variant: 'destructive' }); return;
    }
    setRegLoading(true);
    try {
      await firebasePhone.sendOTP(`${countryCode}${phoneNumber}`);
      setRegOtpSent(true);
    } finally { setRegLoading(false); }
  };

  const handleRegVerifyOTP = async () => {
    if (regOtpCode.length !== 6) return;
    setRegLoading(true);
    try {
      const ok = await firebasePhone.verifyOTP(regOtpCode);
      if (ok) { setRegOtpVerified(true); setRegisterStep('details'); }
    } finally { setRegLoading(false); }
  };

  const validateDetails = (): boolean => {
    switch (selectedAccountType) {
      case 'merchant':
        if (!businessName.trim()) { toast({ title: 'Required', description: 'Business name is required', variant: 'destructive' }); return false; }
        if (!businessType) { toast({ title: 'Required', description: 'Select business type', variant: 'destructive' }); return false; }
        return true;
      case 'institution':
        if (!institutionName.trim()) { toast({ title: 'Required', description: 'Institution name is required', variant: 'destructive' }); return false; }
        if (!institutionType) { toast({ title: 'Required', description: 'Select institution type', variant: 'destructive' }); return false; }
        if (!registrationNumber.trim()) { toast({ title: 'Required', description: 'Registration number is required', variant: 'destructive' }); return false; }
        return true;
      case 'developer':
        if (!orgName.trim()) { toast({ title: 'Required', description: 'Organization name is required', variant: 'destructive' }); return false; }
        return true;
      case 'personal':
      default:
        return true;
    }
  };

  const handleSubmitRegistration = async () => {
    if (!validateDetails()) return;
    setRegLoading(true);
    try {
      const body: Record<string, any> = {
        account_type: selectedAccountType,
        phone: `${countryCode}${phoneNumber}`,
        full_name: fullName,
        email: email || undefined,
      };
      if (selectedAccountType === 'merchant') {
        body.business_name = businessName;
        body.org_name = businessName;
        body.business_description = businessDescription || undefined;
        body.contact_person = businessContactPerson || undefined;
        body.default_currency = businessCurrency || undefined;
        body.business_email = businessEmail || undefined;
        body.business_phone = businessPhone || undefined;
        body.business_type = businessType || undefined;
      }
      if (selectedAccountType === 'institution') {
        body.institution_name = institutionName;
        body.institution_type = institutionType;
        body.org_name = institutionName;
        body.registration_number = registrationNumber || undefined;
      }
      if (selectedAccountType === 'developer') {
        body.org_name = orgName;
      }
      const { data, error } = await supabase.functions.invoke('identity-register', { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      sounds.success();
      toast({ title: 'Account created', description: 'Now set your security PIN' });
      setRegisterStep('pin-setup');
    } catch (err: any) {
      sounds.error();
      toast({ title: 'Registration failed', description: err.message || 'Please try again', variant: 'destructive' });
    } finally { setRegLoading(false); }
  };

  const handlePinComplete = () => {
    setRegisterStep('success');
    setTimeout(() => navigate('/dashboard'), 2500);
  };

  // ── Reset helpers ──
  const resetToSelect = () => {
    setAuthMode('select');
    setRegisterStep('account-type');
    setLoginStep('captcha');
    setPhoneNumber(''); setFullName(''); setEmail('');
    setRegOtpCode(''); setRegOtpSent(false); setRegOtpVerified(false);
    setLoginPhone(''); setLoginPinCode(''); setLoginOtpCode('');
    setFirebaseOtpCode(''); setCaptchaAnswer('');
    firebasePhone.reset();
  };

  const loginGoBack = () => {
    const previousStep = authMethod === 'firebase' ? 'firebase-otp' : 'phone';
    if (loginStep === 'otp') { setLoginStep('phone'); setLoginOtpCode(''); }
    else if (loginStep === 'pin') { setLoginStep(previousStep); setLoginPinCode(''); setUsesPINLogin(false); }
    else if (loginStep === 'phone') { setLoginStep('captcha'); generateCaptcha(); }
    else if (loginStep === 'firebase-otp') { firebasePhone.reset(); setFirebaseOtpCode(''); setLoginStep('captcha'); generateCaptcha(); }
    else if (loginStep === 'forgot-password') { setLoginStep(previousStep); setForgotSent(false); }
    else if (loginStep === 'reset-pin') { setLoginStep(previousStep); setNewPin(''); setConfirmNewPin(''); }
  };

  // ── Computed ──
  const activeAccountConfig = ACCOUNT_TYPES.find(a => a.type === selectedAccountType)!;
  const registerStepIndex = REGISTER_STEPS.findIndex(s => s.key === registerStep);

  // ── Right panel hero content based on context ──
  const getHeroContent = () => {
    if (authMode === 'register' && registerStep !== 'account-type') {
      const cfg = activeAccountConfig;
      return {
        title: cfg.label,
        subtitle: cfg.description,
        features: cfg.requirements,
      };
    }
    return {
      title: authConfig.hero_title,
      subtitle: authConfig.hero_subtitle,
      features: ['Open Banking', 'Mobile Money', 'Payments', 'Credit Score', 'Banking & Payments', 'Accept Payments', 'Open Banking APIs', 'Build & Integrate'],
    };
  };

  const hero = getHeroContent();

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* ──── LEFT PANEL ──── */}
      <div className="flex flex-col items-center justify-center px-4 py-8 bg-background relative">
        <div id="recaptcha-container" className="absolute" />

        <div className="w-full max-w-[480px] space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            {authMode !== 'select' && (
              <Button variant="ghost" size="icon" onClick={resetToSelect} className="shrink-0 -ml-1">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <SafeImage src={authConfig.logo_url} alt="KOB" className="h-10 w-10 rounded-xl" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                {authMode === 'select' ? 'Welcome to KOB' : authMode === 'login' ? authConfig.login_title : activeAccountConfig.label}
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                {authMode === 'select' ? 'Secure Open Banking Platform' : authMode === 'login' ? authConfig.login_subtitle : activeAccountConfig.subtitle}
              </p>
            </div>
          </div>

          {/* ═══ MODE: SELECT ═══ */}
          {authMode === 'select' && (
            <motion.div {...fadeSlide} className="space-y-5">
              <div className="grid grid-cols-1 gap-3">
                <Button onClick={() => setAuthMode('login')} className="h-12 text-base font-semibold w-full">
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button onClick={() => setAuthMode('register')} variant="outline" className="h-12 text-base font-semibold w-full">
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {ACCOUNT_TYPES.map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <div key={acc.type} className={`flex items-start gap-3 p-3.5 rounded-2xl border ${acc.borderColor} transition-all`}>
                      <div className={`w-9 h-9 rounded-xl ${acc.iconBg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4.5 w-4.5 ${acc.color}`} strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{acc.label.replace(' Account', '').replace('Financial ', '')}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{acc.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Trust */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> 256-bit SSL</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Shield className="h-3 w-3" /> COBAC</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Globe className="h-3 w-3" /> CEMAC</div>
              </div>
            </motion.div>
          )}

          {/* ═══ MODE: LOGIN ═══ */}
          {authMode === 'login' && (
            <AnimatePresence mode="wait">
              {/* Login Progress */}
              {!(['complete'] as string[]).includes(loginStep) && (
                <div className="flex items-center gap-1">
                  {['Security', 'Verify', 'Complete'].map((label, i) => {
                    const active = i === 0 ? loginStep === 'captcha' : i === 1 ? ['phone', 'firebase-otp', 'pin', 'otp'].includes(loginStep) : false;
                    const done = i === 0 ? loginStep !== 'captcha' : i === 1 ? (['complete'] as string[]).includes(loginStep) : false;
                    return <div key={label} className="flex-1"><div className={`h-1.5 rounded-full transition-colors ${done ? 'bg-primary' : active ? 'bg-primary/60' : 'bg-muted'}`} /></div>;
                  })}
                </div>
              )}

              <Card className="border-border/50 shadow-sm">
                <CardContent className="pt-6 space-y-5">
                  {/* CAPTCHA */}
                  {loginStep === 'captcha' && (
                    <motion.div key="l-captcha" {...fadeSlide} className="space-y-5">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Authentication Method</Label>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { key: 'firebase' as AuthMethod, icon: Smartphone, label: 'One Time Code', desc: 'SMS verification code', badge: null, borderColor: 'border-primary', iconBg: 'bg-primary/10', iconColor: 'text-primary', badgeBg: 'bg-primary/10', badgeColor: 'text-primary' },
                            { key: 'standard' as AuthMethod, icon: Shield, label: 'PIN / WhatsApp OTP', desc: 'Login with PIN or receive code via SMS/WhatsApp', badge: 'Recommended', borderColor: 'border-emerald-500', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600', badgeBg: 'bg-emerald-500/10', badgeColor: 'text-emerald-600' },
                          ].map((m) => (
                            <button key={m.key} type="button" onClick={() => setAuthMethod(m.key)}
                              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${authMethod === m.key ? `${m.borderColor} ${m.iconBg}` : 'border-border hover:border-primary/40'}`}>
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${authMethod === m.key ? m.iconBg : 'bg-muted'}`}>
                                <m.icon className={`h-4 w-4 ${authMethod === m.key ? m.iconColor : 'text-muted-foreground'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground">{m.label}</span>
                                  {m.badge && <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${m.badgeBg} ${m.badgeColor} border-0`}>{m.badge}</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Security Check</Label>
                        <div className="text-center py-5 bg-muted/60 rounded-xl border border-border/50">
                          <p className="text-2xl font-bold tracking-wide text-foreground">{captchaQuestion} = ?</p>
                        </div>
                        <Input type="number" placeholder="Your answer" value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyCaptcha()} className="h-11" />
                      </div>
                      <Button onClick={handleVerifyCaptcha} className="w-full h-11" disabled={loginLoading}>
                        {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continue
                      </Button>
                    </motion.div>
                  )}

                  {/* FIREBASE OTP */}
                  {loginStep === 'firebase-otp' && (
                    <motion.div key="l-firebase" {...fadeSlide} className="space-y-4">
                      <Button variant="ghost" size="sm" onClick={loginGoBack} className="gap-1 -ml-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>
                      {firebasePhone.step === 'phone' && (
                        <>
                          <div className="space-y-2">
                            <Label>Phone Number</Label>
                            <div className="flex gap-2">
                              <Select value={loginCountry} onValueChange={setLoginCountry}>
                                <SelectTrigger className="w-[130px] h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>{countryList.map(cc => <SelectItem key={`${cc.country}-${cc.code}`} value={cc.country}><span className="inline-flex items-center gap-1.5"><span>{cc.flag}</span> <span>{cc.code}</span></span></SelectItem>)}</SelectContent>
                              </Select>
                              <Input type="tel" placeholder="6 XX XX XX XX" value={loginPhone} onChange={e => setLoginPhone(e.target.value.replace(/\D/g, ''))} className="h-11" />
                            </div>
                          </div>
                          <Button onClick={handleFirebaseSendOTP} className="w-full h-11" disabled={firebasePhone.loading}>
                            {firebasePhone.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Code
                          </Button>
                          <div className="relative my-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
                          </div>
                          <Button variant="outline" className="w-full h-11" disabled={loginLoading} onClick={async () => {
                            if (!loginPhone || loginPhone.length < 5) { toast({ title: 'Enter phone number', description: 'Please enter your phone number first.', variant: 'destructive' }); return; }
                            setLoginLoading(true);
                            try {
                              const { exists, hasPIN } = await checkIfUserHasPIN();
                              if (!exists) { toast({ title: 'Not Found', description: 'No account found with this phone number.', variant: 'destructive' }); return; }
                              if (!hasPIN) { toast({ title: 'No PIN Set', description: 'No PIN is set for this account. Please use OTP to log in.', variant: 'destructive' }); return; }
                              setUsesPINLogin(true);
                              setLoginStep('pin');
                            } catch (err) {
                              console.error('PIN check error:', err);
                              toast({ title: 'Error', description: 'Could not check PIN status. Please try OTP.', variant: 'destructive' });
                            } finally { setLoginLoading(false); }
                          }}>
                            {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Login with PIN
                          </Button>
                          <div className="flex justify-between">
                            <Button variant="link" size="sm" className="text-xs text-muted-foreground px-0" onClick={() => setLoginStep('forgot-password')}>Forgot Password?</Button>
                            <Button variant="link" size="sm" className="text-xs text-muted-foreground px-0" onClick={() => setLoginStep('reset-pin')}>Reset PIN?</Button>
                          </div>
                        </>
                      )}
                      {(firebasePhone.step === 'otp' || firebasePhone.step === 'verifying') && (
                        <>
                          <OTPProviderStatus
                            provider={firebasePhone.provider}
                            autoResendCount={firebasePhone.autoResendCount}
                            errorCategory={firebasePhone.errorCategory}
                            hint={firebasePhone.errorHint}
                          />
                          <div className="space-y-2 text-center">
                            <Label>Enter 6-Digit Code</Label>
                            <p className="text-sm text-muted-foreground">Code sent to {loginCountryCode}{loginPhone}</p>
                            <div className="flex justify-center py-2">
                              <InputOTP maxLength={6} value={firebaseOtpCode} onChange={setFirebaseOtpCode}>
                                <InputOTPGroup>{[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
                              </InputOTP>
                            </div>
                          </div>
                          <Button onClick={handleFirebaseVerifyOTP} className="w-full h-11" disabled={firebasePhone.loading || firebaseOtpCode.length !== 6}>
                            {firebasePhone.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify
                          </Button>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { firebasePhone.reset(); setFirebaseOtpCode(''); }}>Change Number</Button>
                            <Button variant="ghost" size="sm" onClick={handleFirebaseSendOTP} disabled={firebasePhone.loading}>Resend</Button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* STANDARD PHONE */}
                  {loginStep === 'phone' && (
                    <motion.div key="l-phone" {...fadeSlide} className="space-y-4">
                      <Button variant="ghost" size="sm" onClick={loginGoBack} className="gap-1 -ml-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <div className="flex gap-2">
                          <Select value={loginCountry} onValueChange={setLoginCountry}>
                            <SelectTrigger className="w-[130px] h-11"><SelectValue /></SelectTrigger>
                            <SelectContent>{countryList.map(cc => <SelectItem key={`${cc.country}-${cc.code}`} value={cc.country}><span className="inline-flex items-center gap-1.5"><span>{cc.flag}</span> <span>{cc.code}</span></span></SelectItem>)}</SelectContent>
                          </Select>
                          <Input type="tel" placeholder="6 XX XX XX XX" value={loginPhone} onChange={e => setLoginPhone(e.target.value.replace(/\D/g, ''))} className="h-11" />
                        </div>
                      </div>

                      {/* Delivery Method Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Sign in with</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {([
                            { key: 'pin' as DeliveryMethod, icon: KeyRound, label: 'PIN', badge: 'Recommended', colorActive: 'border-primary bg-primary/10 ring-1 ring-primary/30', colorIcon: 'text-primary', disabled: false },
                            { key: 'sms' as DeliveryMethod, icon: Smartphone, label: 'SMS', badge: null, colorActive: 'border-secondary bg-secondary/10 ring-1 ring-secondary/30', colorIcon: 'text-secondary', disabled: false },
                            { key: 'whatsapp' as DeliveryMethod, icon: Shield, label: 'WhatsApp', badge: 'Soon', colorActive: '', colorIcon: 'text-muted-foreground', disabled: true },
                            { key: 'email' as DeliveryMethod, icon: Mail, label: 'Email', badge: null, colorActive: 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30', colorIcon: 'text-amber-600', disabled: false },
                          ] as const).map((dm) => (
                            <button key={dm.key} type="button" onClick={() => !dm.disabled && setDeliveryMethod(dm.key)} disabled={dm.disabled}
                              className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all ${dm.disabled ? 'opacity-50 cursor-not-allowed border-border bg-muted/30' : deliveryMethod === dm.key ? dm.colorActive : 'border-border hover:border-primary/40'}`}>
                              {dm.badge && (
                                <span className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${dm.badge === 'Recommended' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                  {dm.badge}
                                </span>
                              )}
                              <dm.icon className={`h-4 w-4 ${dm.disabled ? 'text-muted-foreground' : deliveryMethod === dm.key ? dm.colorIcon : 'text-muted-foreground'}`} />
                              <span className={`text-xs font-medium ${dm.disabled ? 'text-muted-foreground' : deliveryMethod === dm.key ? dm.colorIcon : 'text-muted-foreground'}`}>{dm.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Email input for email delivery */}
                      {deliveryMethod === 'email' && (
                        <div className="space-y-2">
                          <Label>Email Address</Label>
                          <Input type="email" placeholder="you@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="h-11" />
                        </div>
                      )}

                      <Button onClick={handleLoginPhoneSubmit} className="w-full h-11" disabled={loginLoading}>
                        {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continue
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="link" className="flex-1 text-sm" onClick={() => setLoginStep('forgot-password')}>Forgot Password?</Button>
                        <Button variant="link" className="flex-1 text-sm" onClick={() => setLoginStep('reset-pin')}>Reset PIN?</Button>
                      </div>
                    </motion.div>
                  )}

                  {/* PIN */}
                  {loginStep === 'pin' && (
                    <motion.div key="l-pin" {...fadeSlide} className="space-y-4">
                      <Button variant="ghost" size="sm" onClick={loginGoBack} className="gap-1 -ml-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>
                      <div className="text-center space-y-1">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3"><Lock className="h-5 w-5 text-primary" /></div>
                        <h3 className="text-lg font-semibold text-foreground">Enter Your PIN</h3>
                        <p className="text-sm text-muted-foreground">6-digit PIN for {loginCountryCode}{loginPhone}</p>
                      </div>
                      <div className="flex justify-center py-2">
                        <InputOTP maxLength={6} value={loginPinCode} onChange={setLoginPinCode}>
                          <InputOTPGroup>{[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
                        </InputOTP>
                      </div>
                      {pinLoginAttempts < 3 && <p className="text-xs text-destructive text-center">{pinLoginAttempts} attempts remaining</p>}
                      <Button onClick={handlePINLogin} className="w-full h-11" disabled={loginLoading || loginPinCode.length !== 6}>
                        {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Login with PIN
                      </Button>
                      <Button variant="ghost" className="w-full text-sm" onClick={() => { setUsesPINLogin(false); setLoginStep('phone'); setLoginPinCode(''); }}>Use OTP instead</Button>
                    </motion.div>
                  )}

                  {/* OTP */}
                  {loginStep === 'otp' && (
                    <motion.div key="l-otp" {...fadeSlide} className="space-y-4">
                      <Button variant="ghost" size="sm" onClick={loginGoBack} className="gap-1 -ml-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>
                      <div className="text-center space-y-1">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">{deliveryMethod === 'email' ? <Mail className="h-5 w-5 text-primary" /> : <Smartphone className="h-5 w-5 text-primary" />}</div>
                        <h3 className="text-lg font-semibold">Verify Your Code</h3>
                        <p className="text-sm text-muted-foreground">Code sent to {deliveryMethod === 'email' ? loginEmail : `${loginCountryCode}${loginPhone}`}</p>
                      </div>
                      <div className="flex justify-center py-2">
                        <InputOTP maxLength={6} value={loginOtpCode} onChange={setLoginOtpCode}>
                          <InputOTPGroup>{[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
                        </InputOTP>
                      </div>
                      <Button onClick={handleLoginVerifyOTP} className="w-full h-11" disabled={loginLoading || loginOtpCode.length !== 6}>
                        {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify
                      </Button>
                      <Button variant="ghost" className="w-full text-sm" onClick={() => { setLoginOtpCode(''); handleLoginSendOTP(); }} disabled={loginLoading}>Resend Code</Button>
                    </motion.div>
                  )}

                  {/* FORGOT PASSWORD */}
                  {loginStep === 'forgot-password' && (
                    <motion.div key="l-forgot" {...fadeSlide} className="space-y-4">
                      <Button variant="ghost" size="sm" onClick={loginGoBack} className="gap-1 -ml-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>
                      <div className="text-center space-y-1">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3"><Mail className="h-5 w-5 text-primary" /></div>
                        <h3 className="text-lg font-semibold text-foreground">Reset Password</h3>
                        <p className="text-sm text-muted-foreground">We'll send a reset link to your email</p>
                      </div>
                      {forgotSent ? (
                        <div className="text-center space-y-3">
                          <p className="text-sm font-medium text-foreground">Reset link sent!</p>
                          <p className="text-sm font-bold text-primary">{forgotEmail}</p>
                          <p className="text-xs text-muted-foreground">Check your inbox for the password reset link.</p>
                          <Button onClick={() => { setLoginStep('phone'); setForgotSent(false); }} variant="outline" className="w-full h-11">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sign In
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>Email Address</Label>
                            <Input type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="h-11" />
                          </div>
                          <Button onClick={handleForgotPassword} disabled={forgotLoading || !forgotEmail} className="w-full h-11">
                            {forgotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Reset Link
                          </Button>
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* RESET PIN */}
                  {loginStep === 'reset-pin' && (
                    <motion.div key="l-reset-pin" {...fadeSlide} className="space-y-4">
                      <Button variant="ghost" size="sm" onClick={loginGoBack} className="gap-1 -ml-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>
                      <div className="text-center space-y-1">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3"><KeyRound className="h-5 w-5 text-primary" /></div>
                        <h3 className="text-lg font-semibold text-foreground">Reset Your PIN</h3>
                        <p className="text-sm text-muted-foreground">Set a new 6-digit PIN for {loginCountryCode}{loginPhone}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm">New PIN</Label>
                          <div className="flex justify-center">
                            <InputOTP maxLength={6} value={newPin} onChange={setNewPin}>
                              <InputOTPGroup>{[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
                            </InputOTP>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Confirm New PIN</Label>
                          <div className="flex justify-center">
                            <InputOTP maxLength={6} value={confirmNewPin} onChange={setConfirmNewPin}>
                              <InputOTPGroup>{[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
                            </InputOTP>
                          </div>
                        </div>
                      </div>
                      <Button onClick={handleResetPin} disabled={resetPinLoading || newPin.length !== 6 || confirmNewPin.length !== 6} className="w-full h-11">
                        {resetPinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reset PIN
                      </Button>
                    </motion.div>
                  )}

                  {/* SETUP PIN (after OTP login for users without PIN) */}
                  {loginStep === 'setup-pin' && (
                    <motion.div key="l-setup-pin" {...fadeSlide}>
                      <MandatoryPinSetupStep
                        onComplete={handleLoginPinSetupComplete}
                        title="Set Your Security PIN"
                        subtitle="Required for secure login and transactions"
                      />
                    </motion.div>
                  )}

                  {/* COMPLETE */}
                  {loginStep === 'complete' && (
                    <motion.div key="l-done" {...fadeSlide} className="text-center py-10">
                      <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4"><CheckCircle className="h-8 w-8 text-secondary" /></div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">Welcome back!</h3>
                      <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
                    </motion.div>
                  )}

                  {/* Toggle to Register */}
                  {!(['complete'] as string[]).includes(loginStep) && (
                    <div className="text-center pt-4 border-t border-border/50">
                      <Button variant="link" onClick={() => { setAuthMode('register'); setRegisterStep('account-type'); }} className="text-sm text-muted-foreground hover:text-foreground">
                        Don't have an account? Create one
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </AnimatePresence>
          )}

          {/* ═══ MODE: REGISTER ═══ */}
          {authMode === 'register' && (
            <AnimatePresence mode="wait">
              {/* Progress bar */}
              {registerStep !== 'success' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    {REGISTER_STEPS.filter(s => s.key !== 'success').map((s, i) => {
                      const done = i < registerStepIndex;
                      const active = i === registerStepIndex;
                      const accentColor = activeAccountConfig.color.replace('text-', '');
                      return (
                        <div key={s.key} className="flex-1">
                          <div className={`h-1.5 rounded-full transition-colors ${
                            done ? `bg-${accentColor}` : active ? `bg-${accentColor}/60` : 'bg-muted'
                          }`} style={done ? { backgroundColor: `var(--${accentColor}, hsl(var(--primary)))` } : active ? { backgroundColor: `var(--${accentColor}, hsl(var(--primary) / 0.6))` } : undefined} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between">
                    {REGISTER_STEPS.filter(s => s.key !== 'success').map((s, i) => (
                      <span key={s.key} className={`text-[10px] font-medium ${i <= registerStepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP 1: Account Type Selection ── */}
              {registerStep === 'account-type' && (
                <motion.div key="r-type" {...fadeSlide} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Choose Account Type</h2>
                    <p className="text-sm text-muted-foreground">Select the type of account that best fits your needs</p>
                  </div>

                  <div className="space-y-3">
                    {ACCOUNT_TYPES.map((acc) => {
                      const Icon = acc.icon;
                      const selected = selectedAccountType === acc.type;
                      return (
                        <button
                          key={acc.type}
                          type="button"
                          onClick={() => setSelectedAccountType(acc.type)}
                          className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                            selected ? `${acc.borderColor.split(' ')[0].replace('border-', 'border-').replace('200', '500')} ${acc.bgColor} shadow-sm` : `border-border/60 hover:border-border`
                          }`}
                        >
                          <div className="flex items-start gap-3.5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected ? acc.iconBg : 'bg-muted'}`}>
                              <Icon className={`h-5 w-5 ${selected ? acc.color : 'text-muted-foreground'}`} strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">{acc.label}</span>
                                {selected && (
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${acc.iconBg}`}>
                                    <CheckCircle className={`h-3.5 w-3.5 ${acc.color}`} strokeWidth={2} />
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{acc.description}</p>
                              {selected && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2.5 space-y-1">
                                  {acc.requirements.map((req, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <div className={`w-1 h-1 rounded-full ${acc.color.replace('text-', 'bg-')}`} />
                                      <span className="text-[11px] text-muted-foreground">{req}</span>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <Button onClick={() => setRegisterStep('identity')} className="w-full h-11">
                    Continue as {activeAccountConfig.label.replace(' Account', '').replace('Financial ', '')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <div className="text-center pt-2 border-t border-border/50">
                    <Button variant="link" onClick={() => { setAuthMode('login'); setLoginStep('captcha'); generateCaptcha(); }} className="text-sm text-muted-foreground">
                      Already have an account? Sign in
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: Identity ── */}
              {registerStep === 'identity' && (
                <motion.div key="r-identity" {...fadeSlide}>
                  <Card className="border-border/50 shadow-sm">
                    <CardContent className="pt-6 space-y-4">
                      <Button variant="ghost" size="sm" onClick={() => setRegisterStep('account-type')} className="gap-1 -ml-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>

                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeAccountConfig.iconBg}`}>
                          <activeAccountConfig.icon className={`h-4 w-4 ${activeAccountConfig.color}`} strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">Verify Your Identity</h3>
                          <p className="text-xs text-muted-foreground">We'll send a code to verify your phone</p>
                        </div>
                      </div>

                      {!regOtpSent ? (
                        <>
                          <div className="space-y-2">
                            <Label>Full Name <span className="text-destructive">*</span></Label>
                            <Input placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Phone Number <span className="text-destructive">*</span></Label>
                            <div className="flex gap-2">
                              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                                <SelectTrigger className="w-[130px] h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>{countryList.map(cc => <SelectItem key={`${cc.country}-${cc.code}`} value={cc.country}><span className="inline-flex items-center gap-1.5"><span>{cc.flag}</span> <span>{cc.code}</span></span></SelectItem>)}</SelectContent>
                              </Select>
                              <Input type="tel" placeholder="6 XX XX XX XX" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))} className="h-11" />
                            </div>
                          </div>
                          {['merchant', 'institution', 'developer'].includes(selectedAccountType) && (
                            <div className="space-y-2">
                              <Label>Email Address <span className="text-destructive">*</span></Label>
                              <Input type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11" />
                              <p className="text-xs text-muted-foreground">Required for {selectedAccountType === 'merchant' ? 'business' : selectedAccountType} accounts</p>
                            </div>
                          )}
                          {selectedAccountType === 'personal' && (
                            <div className="space-y-2">
                              <Label>Email Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
                              <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11" />
                            </div>
                          )}
                          <Button onClick={handleRegSendOTP} className="w-full h-11" disabled={regLoading || firebasePhone.loading}>
                            {(regLoading || firebasePhone.loading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Verification Code
                          </Button>
                        </>
                      ) : !regOtpVerified ? (
                        <>
                          <div className="text-center space-y-1">
                            <p className="text-sm text-muted-foreground">Code sent to {countryCode}{phoneNumber}</p>
                          </div>
                          <div className="flex justify-center py-2">
                            <InputOTP maxLength={6} value={regOtpCode} onChange={setRegOtpCode}>
                              <InputOTPGroup>{[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
                            </InputOTP>
                          </div>
                          <Button onClick={handleRegVerifyOTP} className="w-full h-11" disabled={regLoading || firebasePhone.loading || regOtpCode.length !== 6}>
                            {(regLoading || firebasePhone.loading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify Code
                          </Button>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setRegOtpSent(false); setRegOtpCode(''); firebasePhone.reset(); }}>Change Number</Button>
                            <Button variant="ghost" size="sm" onClick={handleRegSendOTP} disabled={firebasePhone.loading}>Resend</Button>
                          </div>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ── STEP 3: Account Details ── */}
              {registerStep === 'details' && (
                <motion.div key="r-details" {...fadeSlide}>
                  <Card className="border-border/50 shadow-sm">
                    <CardContent className="pt-6 space-y-4">
                      <Button variant="ghost" size="sm" onClick={() => setRegisterStep('identity')} className="gap-1 -ml-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>

                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeAccountConfig.iconBg}`}>
                          <activeAccountConfig.icon className={`h-4 w-4 ${activeAccountConfig.color}`} strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">
                            {selectedAccountType === 'personal' ? 'Personal Details' :
                             selectedAccountType === 'merchant' ? 'Business Details' :
                             selectedAccountType === 'institution' ? 'Institution Details' : 'Organization Details'}
                          </h3>
                          <p className="text-xs text-muted-foreground">Complete your profile to continue</p>
                        </div>
                      </div>

                      {/* Personal */}
                      {selectedAccountType === 'personal' && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Date of Birth <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <Select value={detailCountry} onValueChange={setDetailCountry}>
                              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                              <SelectContent>{countryList.map(cc => <SelectItem key={`${cc.country}-${cc.code}`} value={cc.country}>{cc.flag} {cc.country}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-1.5">
                            <p className="text-xs font-medium text-blue-700">What happens next</p>
                            <p className="text-xs text-blue-600 leading-relaxed">After registration, you'll need to complete KYC verification to access all features including transfers and mobile money linking.</p>
                          </div>
                        </div>
                      )}

                      {/* Merchant */}
                      {selectedAccountType === 'merchant' && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Business Name <span className="text-destructive">*</span></Label>
                            <Input placeholder="Acme Ltd" value={businessName} onChange={e => setBusinessName(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Business Type <span className="text-destructive">*</span></Label>
                            <Select value={businessType} onValueChange={setBusinessType}>
                              <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
                              <SelectContent>{BUSINESS_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input placeholder="Describe your business" value={businessDescription} onChange={e => setBusinessDescription(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Contact Person <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input placeholder="John Doe" value={businessContactPerson} onChange={e => setBusinessContactPerson(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Business Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input type="email" placeholder="info@acme.com" value={businessEmail} onChange={e => setBusinessEmail(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Business Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input type="tel" placeholder="+237 6XX XXX XXX" value={businessPhone} onChange={e => setBusinessPhone(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <Select value={detailCountry} onValueChange={setDetailCountry}>
                              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                              <SelectContent>{countryList.map(cc => <SelectItem key={`${cc.country}-${cc.code}`} value={cc.country}>{cc.flag} {cc.country}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Default Currency</Label>
                            <Select value={businessCurrency} onValueChange={setBusinessCurrency}>
                              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="XAF">XAF (CFA Franc BEAC)</SelectItem>
                                <SelectItem value="XOF">XOF (CFA Franc BCEAO)</SelectItem>
                                <SelectItem value="NGN">NGN (Nigerian Naira)</SelectItem>
                                <SelectItem value="USD">USD (US Dollar)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-1.5">
                            <p className="text-xs font-medium text-emerald-700">What happens next</p>
                            <p className="text-xs text-emerald-600 leading-relaxed">You'll need to complete KYB verification with business registration documents before accepting payments. Settlement configuration will be done in your merchant portal.</p>
                          </div>
                        </div>
                      )}

                      {/* Institution */}
                      {selectedAccountType === 'institution' && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Institution Name <span className="text-destructive">*</span></Label>
                            <Input placeholder="First National Bank" value={institutionName} onChange={e => setInstitutionName(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Institution Type <span className="text-destructive">*</span></Label>
                            <Select value={institutionType} onValueChange={setInstitutionType}>
                              <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
                              <SelectContent>{INSTITUTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Registration Number <span className="text-destructive">*</span></Label>
                            <Input placeholder="RC/DJA/2024/B/XXX" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <Select value={detailCountry} onValueChange={setDetailCountry}>
                              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                              <SelectContent>{countryList.map(cc => <SelectItem key={`${cc.country}-${cc.code}`} value={cc.country}>{cc.flag} {cc.country}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1.5">
                            <p className="text-xs font-medium text-amber-700">Regulatory Notice</p>
                            <p className="text-xs text-amber-600 leading-relaxed">Institution registration requires COBAC regulatory licence verification and admin approval. KYB documents including operating licence and board resolution are mandatory.</p>
                          </div>
                        </div>
                      )}

                      {/* Developer */}
                      {selectedAccountType === 'developer' && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Organization Name <span className="text-destructive">*</span></Label>
                            <Input placeholder="My Fintech Startup" value={orgName} onChange={e => setOrgName(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Use Case <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input placeholder="e.g. Payment integration for e-commerce" value={useCase} onChange={e => setUseCase(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <Select value={detailCountry} onValueChange={setDetailCountry}>
                              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                              <SelectContent>{countryList.map(cc => <SelectItem key={`${cc.country}-${cc.code}`} value={cc.country}>{cc.flag} {cc.country}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 space-y-1.5">
                            <p className="text-xs font-medium text-violet-700">Sandbox Access</p>
                            <p className="text-xs text-violet-600 leading-relaxed">You'll get immediate sandbox access to test API integrations. Production access requires approval and KYB documentation.</p>
                          </div>
                        </div>
                      )}

                      <Button onClick={handleSubmitRegistration} className="w-full h-11" disabled={regLoading}>
                        {regLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create {activeAccountConfig.label}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ── STEP 4: PIN Setup ── */}
              {registerStep === 'pin-setup' && (
                <motion.div key="r-pin" {...fadeSlide}>
                  <Card className="border-border/50 shadow-sm">
                    <CardContent className="pt-6">
                      <MandatoryPinSetupStep
                        onComplete={handlePinComplete}
                        title="Set Your Security PIN"
                        subtitle="Create a 6-digit PIN for secure login and transactions"
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ── STEP 5: Success ── */}
              {registerStep === 'success' && (
                <motion.div key="r-success" {...fadeSlide}>
                  <Card className="border-border/50 shadow-sm">
                    <CardContent className="pt-8 pb-8">
                      <div className="text-center space-y-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${activeAccountConfig.iconBg}`}>
                          <CheckCircle className={`h-8 w-8 ${activeAccountConfig.color}`} strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-foreground">{activeAccountConfig.label} Created</h3>
                          <p className="text-sm text-muted-foreground mt-1">Your account is set up and ready to go</p>
                        </div>

                        <div className="rounded-xl bg-muted/50 p-4 text-left space-y-2">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Next Steps</p>
                          {activeAccountConfig.requirements.map((req, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${activeAccountConfig.iconBg}`}>
                                <span className={`text-[10px] font-bold ${activeAccountConfig.color}`}>{i + 1}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{req}</span>
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-muted-foreground">Redirecting to your dashboard...</p>
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ──── RIGHT PANEL — Hero ──── */}
      <div
        className="hidden lg:flex relative overflow-hidden items-center justify-center"
        style={{
          backgroundImage: authConfig.hero_image_url ? `url(${authConfig.hero_image_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: authConfig.hero_image_url ? undefined : 'hsl(var(--primary))',
        }}
      >
        {authConfig.hero_image_url && <div className="absolute inset-0 bg-black/40" />}
        <div className="relative text-center space-y-6 px-12 z-10 max-w-lg">
          {/* Dynamic account type badge */}
          {authMode === 'register' && registerStep !== 'account-type' && (
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
                <activeAccountConfig.icon className="h-4 w-4 text-white/90" strokeWidth={1.5} />
                <span className="text-sm font-medium text-white/90">{activeAccountConfig.label}</span>
              </div>
            </div>
          )}

          <h2 className="text-5xl font-bold text-white drop-shadow-lg leading-tight">{hero.title}</h2>
          <p className="text-xl text-white/90 drop-shadow leading-relaxed">{hero.subtitle}</p>

          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {hero.features.map((f) => (
              <span key={f} className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-sm text-white/90 border border-white/20">{f}</span>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
