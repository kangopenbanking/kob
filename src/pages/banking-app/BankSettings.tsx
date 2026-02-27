import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Bell, Globe, Moon, ChevronRight, Loader2, Save, Check, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BankBackButton } from '@/components/banking-app/BankBackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type SettingsSection = null | 'personal' | 'security' | 'notifications' | 'language' | 'appearance';

const BankSettings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SettingsSection>(null);

  // Personal info
  const [fullName, setFullName] = useState('');
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

  // Notifications
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);
  const [txAlerts, setTxAlerts] = useState(true);
  const [promoAlerts, setPromoAlerts] = useState(false);

  // Language
  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('XAF');

  // Appearance
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setEmail(user.email || '');
    setFullName(user.user_metadata?.full_name || '');
    setPhone(user.user_metadata?.phone || '');

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
    }

    // Check dark mode
    setDarkMode(document.documentElement.classList.contains('dark'));
    setLoading(false);
  };

  const handleSavePersonal = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, phone },
      });
      if (error) throw error;

      // Update profiles table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({
          full_name: fullName,
          phone,
        }).eq('id', user.id);
      }

      toast.success('Personal information updated');
      setActiveSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPin = async () => {
    if (newPin.length !== 6) {
      toast.error('PIN must be 6 digits');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('pin-code-set', {
        body: { pin_code: newPin },
      });
      if (error) throw error;
      toast.success('PIN set successfully');
      setNewPin('');
      setConfirmPin('');
      setShowPinDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to set PIN');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await (supabase.from('user_preferences') as any).upsert({
        user_id: user.id,
        push_notifications: pushEnabled,
        email_notifications: emailNotifs,
        sms_notifications: smsNotifs,
        transaction_alerts: txAlerts,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Notification preferences saved');
      setActiveSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLanguage = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await (supabase.from('user_preferences') as any).upsert({
        user_id: user.id,
        language,
        default_currency: currency,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Language & region saved');
      setActiveSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleDarkMode = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      setDarkMode(false);
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.add('dark');
      setDarkMode(true);
      localStorage.setItem('theme', 'dark');
    }
    toast.success(darkMode ? 'Light mode enabled' : 'Dark mode enabled');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const settingsItems = [
    { id: 'personal' as const, icon: User, label: 'Personal Information', description: `${fullName || 'Not set'} · ${email}` },
    { id: 'security' as const, icon: Lock, label: 'Security', description: 'Password, PIN, biometrics' },
    { id: 'notifications' as const, icon: Bell, label: 'Notifications', description: 'Push, email, SMS preferences' },
    { id: 'language' as const, icon: Globe, label: 'Language & Region', description: `${language === 'en' ? 'English' : language === 'fr' ? 'Français' : language} · ${currency}` },
    { id: 'appearance' as const, icon: Moon, label: 'Appearance', description: darkMode ? 'Dark mode' : 'Light mode' },
  ];

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <BankBackButton />
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Settings</h1>
      <p className="mb-6 text-sm font-medium text-muted-foreground">Account & security preferences</p>

      {/* Main menu */}
      {activeSection === null && (
        <div className="flex flex-col gap-1">
          {settingsItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (item.id === 'appearance') {
                    toggleDarkMode();
                  } else {
                    setActiveSection(item.id);
                  }
                }}
                className="flex items-center justify-between rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                {item.id === 'appearance' ? (
                  <Switch checked={darkMode} />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Personal Information */}
      {activeSection === 'personal' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
          <button onClick={() => setActiveSection(null)} className="mb-2 text-left text-sm font-semibold text-primary">← Back to Settings</button>
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+237 6XX XXX XXX" />
          </div>
          <Button onClick={handleSavePersonal} disabled={saving} className="mt-2 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </motion.div>
      )}

      {/* Security */}
      {activeSection === 'security' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
          <button onClick={() => setActiveSection(null)} className="mb-2 text-left text-sm font-semibold text-primary">← Back to Settings</button>

          <div className="rounded-2xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold text-foreground">Change Password</h3>
            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <Label className="text-xs">New Password</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 characters" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              <Button onClick={handleChangePassword} disabled={saving || !newPassword} size="sm" className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Update Password
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Transaction PIN</h3>
                <p className="text-xs text-muted-foreground">6-digit PIN for payments</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPinDialog(true)} className="gap-1.5">
                <KeyRound className="h-4 w-4" />
                Set PIN
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notifications */}
      {activeSection === 'notifications' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
          <button onClick={() => setActiveSection(null)} className="mb-2 text-left text-sm font-semibold text-primary">← Back to Settings</button>

          <div className="flex flex-col gap-1">
            {[
              { label: 'Push Notifications', desc: 'Receive push alerts', checked: pushEnabled, set: setPushEnabled },
              { label: 'Email Notifications', desc: 'Receive email alerts', checked: emailNotifs, set: setEmailNotifs },
              { label: 'SMS Notifications', desc: 'Receive SMS alerts', checked: smsNotifs, set: setSmsNotifs },
              { label: 'Transaction Alerts', desc: 'Get notified on every transaction', checked: txAlerts, set: setTxAlerts },
              { label: 'Promotions', desc: 'Offers & product updates', checked: promoAlerts, set: setPromoAlerts },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl px-3 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={item.checked} onCheckedChange={item.set} />
              </div>
            ))}
          </div>

          <Button onClick={handleSaveNotifications} disabled={saving} className="mt-2 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </motion.div>
      )}

      {/* Language & Region */}
      {activeSection === 'language' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
          <button onClick={() => setActiveSection(null)} className="mb-2 text-left text-sm font-semibold text-primary">← Back to Settings</button>

          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Default Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="XAF">XAF (CFA Franc)</SelectItem>
                <SelectItem value="EUR">EUR (Euro)</SelectItem>
                <SelectItem value="USD">USD (US Dollar)</SelectItem>
                <SelectItem value="GBP">GBP (British Pound)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSaveLanguage} disabled={saving} className="mt-2 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </motion.div>
      )}

      {/* PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Transaction PIN</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm">Enter 6-digit PIN</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={newPin} onChange={setNewPin}>
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
                <InputOTP maxLength={6} value={confirmPin} onChange={setConfirmPin}>
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
              {confirmPin.length === 6 && newPin !== confirmPin && (
                <p className="text-xs text-destructive text-center">PINs do not match</p>
              )}
            </div>
            <Button onClick={handleSetPin} disabled={saving || newPin.length !== 6 || newPin !== confirmPin}>
              {saving ? 'Setting...' : 'Confirm PIN'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankSettings;
