import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Lock, Fingerprint, ShieldCheck, Bell, Globe, DollarSign,
  Info, FileText, LogOut, ChevronRight, Mail, Scale, Moon, KeyRound, Save,
  Check, Loader2, Phone, Trash2, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import AppLegalPagesList from '@/components/pwa/AppLegalPagesList';
import AppLegalPageViewer from '@/components/pwa/AppLegalPageViewer';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';
import { useLanguage } from '@/lib/i18n/LanguageContext';

type SettingsSection = null | 'personal' | 'security' | 'notifications' | 'language' | 'legal' | 'legal-view' | 'about';

const CustomerSettings: React.FC = () => {
  const tr = useHarvestedT('customer');
  const { setLanguage: setAppLanguage } = useLanguage();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SettingsSection>(null);
  const [legalSlug, setLegalSlug] = useState('');
  const [loading, setLoading] = useState(true);

  // Profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [twoFA, setTwoFA] = useState(false);

  // Notifications
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);
  const [txAlerts, setTxAlerts] = useState(true);
  const [promoAlerts, setPromoAlerts] = useState(false);

  // Language
  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('XAF');

  // Dark mode
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setEmail(user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        const p = profile as any;
        setName(p.full_name || user.user_metadata?.full_name || '');
        setPhone(p.phone_number || '');
      } else {
        setName(user.user_metadata?.full_name || '');
      }

      // Load preferences
      const { data: prefsRaw } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      const prefs = prefsRaw as any;
      if (prefs) {
        setLanguage(prefs.language || 'en');
        setCurrency(prefs.default_currency || 'XAF');
        setPushEnabled(prefs.push_notifications ?? true);
        setEmailNotifs(prefs.email_notifications ?? true);
        setSmsNotifs(prefs.sms_notifications ?? false);
        setTxAlerts(prefs.transaction_alerts ?? true);
        setBiometric(prefs.biometric_enabled ?? false);
        setTwoFA(prefs.two_factor_enabled ?? false);
      }

      setDarkMode(document.documentElement.classList.contains('dark'));
      setLoading(false);
    };
    loadProfile();
  }, []);

  const handleSavePersonal = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.auth.updateUser({ data: { full_name: name, phone } });
      if (error) throw error;
      await supabase.from('profiles').update({ full_name: name, phone_number: phone } as any).eq('id', user.id);
      toast.success('Profile updated');
      setActiveSection(null);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to update'));
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) { toast.error('Please enter your current password'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      // Verify current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Unable to verify identity');
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (signInError) throw new Error('Current password is incorrect');
      
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setActiveSection(null);
    } catch (err: any) { toast.error(extractEdgeFunctionError(err)); }
    finally { setSaving(false); }
  };

  const handleSetPin = async () => {
    if (newPin.length !== 6) { toast.error('PIN must be 6 digits'); return; }
    if (newPin !== confirmPin) { toast.error('PINs do not match'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('pin-code-set', { body: { pin_code: newPin } });
      if (error) throw error;
      toast.success('PIN set successfully');
      setNewPin(''); setConfirmPin('');
      setShowPinDialog(false);
    } catch (err: any) { toast.error(extractEdgeFunctionError(err)); }
    finally { setSaving(false); }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await (supabase.from('user_preferences') as any).upsert({
        user_id: user.id, push_notifications: pushEnabled, email_notifications: emailNotifs,
        sms_notifications: smsNotifs, transaction_alerts: txAlerts, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
      toast.success('Notification preferences saved');
      setActiveSection(null);
    } catch (err: any) { toast.error(extractEdgeFunctionError(err)); }
    finally { setSaving(false); }
  };

  const handleSaveLanguage = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await (supabase.from('user_preferences') as any).upsert({
        user_id: user.id, language, default_currency: currency, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
      toast.success('Language & region saved');
      setActiveSection(null);
      // Trigger global language switch: persists, broadcasts to other tabs/apps,
      // and seamlessly refreshes so all in-memory strings re-render in the new locale.
      await setAppLanguage(language as 'en' | 'fr');
    } catch (err: any) { toast.error(extractEdgeFunctionError(err)); }
    finally { setSaving(false); }
  };

  const toggleDarkMode = () => {
    const html = document.documentElement;
    const newDark = !html.classList.contains('dark');
    html.classList.toggle('dark', newDark);
    setDarkMode(newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    toast.success(newDark ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/app/auth', { replace: true });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const settingsItems = [
    { id: 'personal' as const, icon: User, label: tr('Personal Information'), description: name || email, color: 'bg-[hsl(210,60%,92%)]', iconColor: 'text-[hsl(210,60%,40%)]' },
    { id: 'security' as const, icon: Lock, label: tr('Security'), description: tr('Password, PIN, biometrics'), color: 'bg-[hsl(0,65%,93%)]', iconColor: 'text-[hsl(0,60%,45%)]' },
    { id: 'notifications' as const, icon: Bell, label: tr('Notifications'), description: tr('Push, email, SMS alerts'), color: 'bg-[hsl(45,80%,90%)]', iconColor: 'text-[hsl(35,70%,40%)]' },
    { id: 'language' as const, icon: Globe, label: tr('Language & Region'), description: `${language === 'en' ? tr('English') : tr('Français')} · ${currency}`, color: 'bg-[hsl(150,45%,90%)]', iconColor: 'text-[hsl(150,50%,35%)]' },
    { id: 'legal' as const, icon: FileText, label: tr('Legal & Policies'), description: tr('Terms, Privacy, KYC, AML'), color: 'bg-[hsl(270,40%,92%)]', iconColor: 'text-[hsl(270,40%,45%)]' },
    { id: 'about' as const, icon: Info, label: tr('About'), description: tr('App version & info'), color: 'bg-[hsl(200,30%,92%)]', iconColor: 'text-[hsl(200,30%,40%)]' },
  ];

  const BackButton = ({ onBack }: { onBack: () => void }) => (
    <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-primary">
      <ArrowLeft className="h-4 w-4" strokeWidth={2} /> {tr('Back')}
    </button>
  );

  const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="mb-5">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );

  const SettingCard = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">{children}</div>
  );

  const SettingRow = ({ icon, label, description, right, onClick, destructive }: {
    icon: React.ReactNode; label: string; description?: string; right?: React.ReactNode; onClick?: () => void; destructive?: boolean;
  }) => (
    <button onClick={onClick} className="flex w-full items-center justify-between border-b border-border/40 px-4 py-3.5 last:border-0 text-left transition-colors active:bg-muted/30">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className={destructive ? 'text-destructive' : 'text-muted-foreground'}>{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${destructive ? 'text-destructive' : 'text-foreground'}`}>{label}</p>
          {description && <p className="text-[11px] text-muted-foreground truncate">{description}</p>}
        </div>
      </div>
      {right || (!destructive && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />)}
    </button>
  );

  return (
    <div className="flex flex-col p-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => activeSection ? setActiveSection(null) : navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold text-foreground">{tr('Settings')}</h1>
      </div>

      <AnimatePresence mode="wait">
        {/* Main Menu */}
        {activeSection === null && (
          <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
            {/* User avatar card */}
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{name || tr('Set your name')}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
              <button onClick={() => setActiveSection('personal')}>
                <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </button>
            </div>

            {/* Settings list */}
            <div className="flex flex-col gap-1.5">
              {settingsItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveSection(item.id)}
                    className="flex items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors active:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color}`}>
                        <Icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </motion.button>
                );
              })}
            </div>

            {/* Dark mode toggle */}
            <SettingCard>
              <SettingRow
                icon={<Moon className="h-5 w-5" strokeWidth={1.5} />}
                label={tr('Dark Mode')}
                description={darkMode ? tr('On') : tr('Off')}
                right={<Switch checked={darkMode} onCheckedChange={toggleDarkMode} />}
              />
            </SettingCard>

            {/* Help & Logout & Delete */}
            <SettingCard>
              <SettingRow icon={<HelpCircle className="h-5 w-5" strokeWidth={1.5} />} label={tr('Help & Support')} onClick={() => navigate('/app/help')} />
              <SettingRow icon={<LogOut className="h-5 w-5" strokeWidth={1.5} />} label={tr('Log Out')} onClick={handleLogout} destructive />
              <SettingRow icon={<Trash2 className="h-5 w-5" strokeWidth={1.5} />} label={tr('Delete Account')} description={tr('Permanently delete your account and data')} onClick={() => {
                if (window.confirm('Are you sure you want to delete your account? This action is irreversible and all your data will be permanently removed.')) {
                  toast.info('Please contact support@kangconsultancy.com to process your account deletion request.');
                }
              }} destructive />
            </SettingCard>

            <p className="text-center text-[10px] text-muted-foreground mt-2">
              {tr('Kang Open Banking · v2.1.0')}
            </p>
          </motion.div>
        )}

        {/* Personal Information */}
        {activeSection === 'personal' && (
          <motion.div key="personal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
            <BackButton onBack={() => setActiveSection(null)} />
            <SectionTitle title={tr('Personal Information')} subtitle={tr('Update your profile details')} />
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">{tr('Full Name')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={tr('Your full name')} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">{tr('Email')}</Label>
              <Input value={email} disabled className="rounded-xl bg-muted opacity-60" />
              <p className="text-[11px] text-muted-foreground">{tr('Email cannot be changed here')}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">{tr('Phone Number')}</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder={tr('+237 6XX XXX XXX')} className="rounded-xl" />
            </div>
            <Button onClick={handleSavePersonal} disabled={saving} className="mt-2 gap-2 rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? tr('Saving...') : tr('Save Changes')}
            </Button>
          </motion.div>
        )}

        {/* Security */}
        {activeSection === 'security' && (
          <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
            <BackButton onBack={() => setActiveSection(null)} />
            <SectionTitle title={tr('Security')} subtitle={tr('Manage your account security')} />

            <SettingCard>
              <SettingRow
                icon={<Fingerprint className="h-5 w-5" strokeWidth={1.5} />}
                label={tr('Biometric Login')}
                description={tr('Use fingerprint or Face ID')}
                right={<Switch checked={biometric} onCheckedChange={async (v) => {
                  setBiometric(v);
                  const { data: { user: u } } = await supabase.auth.getUser();
                  if (u) await (supabase.from('user_preferences') as any).upsert({ user_id: u.id, biometric_enabled: v, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
                  toast.success(v ? 'Biometric enabled' : 'Biometric disabled');
                }} />}
              />
              <SettingRow
                icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.5} />}
                label={tr('Two-Factor Auth')}
                description={twoFA ? tr('Enabled — manage') : tr('Set up SMS-OTP 2FA')}
                onClick={() => navigate('/app/settings/two-factor')}
              />
              <SettingRow
                icon={<Phone className="h-5 w-5" strokeWidth={1.5} />}
                label={tr('Active Devices & Sessions')}
                description={tr('Review and revoke sign-ins')}
                onClick={() => navigate('/app/settings/sessions')}
              />
            </SettingCard>

            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-bold text-foreground">{tr('Change Password')}</h3>
              <div className="flex flex-col gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{tr('Current Password')}</Label>
                  <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder={tr('Enter current password')} className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{tr('New Password')}</Label>
                  <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={tr('Min. 8 characters')} className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{tr('Confirm Password')}</Label>
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded-xl" />
                </div>
                <Button onClick={handleChangePassword} disabled={saving || !currentPassword || !newPassword} size="sm" variant="outline" className="gap-2 rounded-xl">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {tr('Update Password')}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{tr('Transaction PIN')}</h3>
                  <p className="text-[11px] text-muted-foreground">{tr('6-digit PIN for payments')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowPinDialog(true)} className="gap-1.5 rounded-xl">
                  <KeyRound className="h-4 w-4" /> {tr('Set PIN')}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Notifications */}
        {activeSection === 'notifications' && (
          <motion.div key="notifications" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
            <BackButton onBack={() => setActiveSection(null)} />
            <SectionTitle title={tr('Notifications')} subtitle={tr('Choose what alerts you receive')} />

            <SettingCard>
              {[
                { label: tr('Push Notifications'), desc: tr('Receive push alerts on your device'), checked: pushEnabled, set: setPushEnabled },
                { label: tr('Email Notifications'), desc: tr('Receive email alerts'), checked: emailNotifs, set: setEmailNotifs },
                { label: tr('SMS Notifications'), desc: tr('Receive SMS alerts'), checked: smsNotifs, set: setSmsNotifs },
                { label: tr('Transaction Alerts'), desc: tr('Get notified on every transaction'), checked: txAlerts, set: setTxAlerts },
                { label: tr('Promotions'), desc: tr('Offers & product updates'), checked: promoAlerts, set: setPromoAlerts },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b border-border/40 px-4 py-3.5 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={item.checked} onCheckedChange={item.set} />
                </div>
              ))}
            </SettingCard>

            <Button onClick={handleSaveNotifications} disabled={saving} className="gap-2 rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? tr('Saving...') : tr('Save Preferences')}
            </Button>
          </motion.div>
        )}

        {/* Language & Region */}
        {activeSection === 'language' && (
          <motion.div key="language" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
            <BackButton onBack={() => setActiveSection(null)} />
            <SectionTitle title={tr('Language & Region')} subtitle={tr('Set your preferred language and currency')} />

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">{tr('Language')}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{tr('English')}</SelectItem>
                  <SelectItem value="fr">{tr('Français')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">{tr('Default Currency')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="XAF">{tr('XAF (CFA Franc)')}</SelectItem>
                  <SelectItem value="EUR">{tr('EUR (Euro)')}</SelectItem>
                  <SelectItem value="USD">{tr('USD (US Dollar)')}</SelectItem>
                  <SelectItem value="GBP">{tr('GBP (British Pound)')}</SelectItem>
                  <SelectItem value="NGN">{tr('NGN (Nigerian Naira)')}</SelectItem>
                  <SelectItem value="GHS">{tr('GHS (Ghanaian Cedi)')}</SelectItem>
                  <SelectItem value="KES">{tr('KES (Kenyan Shilling)')}</SelectItem>
                  <SelectItem value="ZAR">{tr('ZAR (South African Rand)')}</SelectItem>
                  <SelectItem value="CAD">{tr('CAD (Canadian Dollar)')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveLanguage} disabled={saving} className="mt-2 gap-2 rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? tr('Saving...') : tr('Save')}
            </Button>
          </motion.div>
        )}

        {/* Legal & Policies */}
        {activeSection === 'legal' && (
          <motion.div key="legal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-2">
            <BackButton onBack={() => setActiveSection(null)} />
            <SectionTitle title={tr('Legal & Policies')} subtitle={tr('Terms, privacy, compliance documents')} />
            <AppLegalPagesList onSelect={(slug) => { setLegalSlug(slug); setActiveSection('legal-view'); }} />
          </motion.div>
        )}

        {/* Legal page viewer */}
        {activeSection === 'legal-view' && legalSlug && (
          <motion.div key="legal-view" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <BackButton onBack={() => setActiveSection('legal')} />
            <AppLegalPageViewer slug={legalSlug} />
          </motion.div>
        )}

        {/* About */}
        {activeSection === 'about' && (
          <motion.div key="about" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
            <BackButton onBack={() => setActiveSection(null)} />
            <SectionTitle title={tr('About')} subtitle={tr('App information')} />

            <SettingCard>
              <SettingRow icon={<Info className="h-5 w-5" strokeWidth={1.5} />} label={tr('App Version')} description="2.1.0" right={<span className="text-xs text-muted-foreground">{tr('Latest')}</span>} />
              <SettingRow icon={<Globe className="h-5 w-5" strokeWidth={1.5} />} label={tr('Platform')} description={tr('Kang Open Banking')} right={<span />} />
              <SettingRow icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.5} />} label={tr('Compliance')} description={tr('COBAC · PCI-DSS · ISO 27001')} right={<span />} />
            </SettingCard>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {tr('Kang Open Banking (KOB) is a product of Kang Consultancy Co Ltd, registered under the Canada Business Corporations Act (CBCA) (Reg. No. 1381210-3) with offices in Port Dover, ON, Canada. In Cameroon, registered under Reg. No. RCBDA2021B000451, regulated by the Ministry of Small and Medium-Sized Enterprises.')}
              </p>
            </div>

            <p className="text-center text-[10px] text-muted-foreground mt-2">
              {tr('© 2026 Kang Open Banking. All rights reserved.')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">{tr('Set Transaction PIN')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-muted-foreground text-center">{tr('Enter a 6-digit PIN for securing transactions')}</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">{tr('New PIN')}</Label>
                <InputOTP maxLength={6} value={newPin} onChange={setNewPin}>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{tr('Confirm PIN')}</Label>
                <InputOTP maxLength={6} value={confirmPin} onChange={setConfirmPin}>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <Button onClick={handleSetPin} disabled={saving} className="w-full gap-2 rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {saving ? tr('Setting...') : tr('Set PIN')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerSettings;
