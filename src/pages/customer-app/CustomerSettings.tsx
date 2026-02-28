import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Fingerprint, ShieldCheck, Bell, Globe, DollarSign, Info, FileText, LogOut, ChevronRight, Mail, Scale } from 'lucide-react';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import AppLegalPagesList from '@/components/pwa/AppLegalPagesList';
import AppLegalPageViewer from '@/components/pwa/AppLegalPageViewer';

const CustomerSettings: React.FC = () => {
  const navigate = useNavigate();
  const [legalSlug, setLegalSlug] = useState('');
  const [showLegalList, setShowLegalList] = useState(false);
  const [showLegalPage, setShowLegalPage] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [biometric, setBiometric] = useState(true);
  const [twoFA, setTwoFA] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(true);

  // Load profile from backend
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
      setLoading(false);
    };
    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name, phone_number: phone } as any)
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      setEditingProfile(false);
      toast.success('Profile updated');
    }
  };

  const handleChangePin = () => toast.info('PIN change flow would open here');
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/');
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">{children}</div>
    </motion.div>
  );

  const Row = ({ icon, label, right, onClick, destructive }: { icon: React.ReactNode; label: string; right?: React.ReactNode; onClick?: () => void; destructive?: boolean }) => (
    <button onClick={onClick} className="flex w-full items-center justify-between border-b border-border/50 px-4 py-3.5 last:border-0">
      <div className="flex items-center gap-3">
        <span className={destructive ? 'text-destructive' : 'text-muted-foreground'}>{icon}</span>
        <span className={`text-sm font-medium ${destructive ? 'text-destructive' : 'text-foreground'}`}>{label}</span>
      </div>
      {right || (!destructive && <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />)}
    </button>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </div>

      <Section title="Profile">
        {editingProfile ? (
          <div className="flex flex-col gap-3 p-4">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="rounded-xl border-border" />
            <Input value={email} disabled placeholder="Email" className="rounded-xl border-border opacity-60" />
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="rounded-xl border-border" />
            <div className="flex gap-2">
              <Button onClick={handleSaveProfile} className="flex-1 rounded-xl">Save</Button>
              <Button variant="outline" onClick={() => setEditingProfile(false)} className="rounded-xl">Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <Row icon={<User className="h-5 w-5" strokeWidth={1.5} />} label={name || 'Set your name'} onClick={() => setEditingProfile(true)} />
            <Row icon={<Mail className="h-5 w-5" strokeWidth={1.5} />} label={email || 'No email'} onClick={() => setEditingProfile(true)} />
            <Row icon={<Globe className="h-5 w-5" strokeWidth={1.5} />} label={phone || 'Add phone number'} onClick={() => setEditingProfile(true)} />
          </>
        )}
      </Section>

      <Section title="Security">
        <Row icon={<Lock className="h-5 w-5" strokeWidth={1.5} />} label="Change PIN" onClick={handleChangePin} />
        <Row icon={<Fingerprint className="h-5 w-5" strokeWidth={1.5} />} label="Biometric Login"
          right={<Switch checked={biometric} onCheckedChange={v => { setBiometric(v); toast.success(v ? 'Biometric enabled' : 'Biometric disabled'); }} />} />
        <Row icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.5} />} label="Two-Factor Auth"
          right={<Switch checked={twoFA} onCheckedChange={v => { setTwoFA(v); toast.success(v ? '2FA enabled' : '2FA disabled'); }} />} />
      </Section>

      <Section title="Preferences">
        <Row icon={<Bell className="h-5 w-5" strokeWidth={1.5} />} label="Push Notifications"
          right={<Switch checked={notifications} onCheckedChange={v => { setNotifications(v); toast.success(v ? 'Notifications on' : 'Notifications off'); }} />} />
        <Row icon={<Globe className="h-5 w-5" strokeWidth={1.5} />} label={`Language: ${language}`}
          right={
            <select value={language} onChange={e => { setLanguage(e.target.value); toast.success(`Language set to ${e.target.value}`); }}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground" onClick={e => e.stopPropagation()}>
              <option>English</option><option>Français</option>
            </select>
          } />
        <Row icon={<DollarSign className="h-5 w-5" strokeWidth={1.5} />} label="Currency: XAF" />
      </Section>

      <Section title="Legal & Policies">
        <Row icon={<Scale className="h-5 w-5" strokeWidth={1.5} />} label="Legal & Policies" onClick={() => setShowLegalList(true)} />
      </Section>

      <Section title="App">
        <Row icon={<Info className="h-5 w-5" strokeWidth={1.5} />} label="App Version 2.1.0" right={<span />} />
        <Row icon={<LogOut className="h-5 w-5" strokeWidth={1.5} />} label="Log Out" onClick={handleLogout} destructive />
      </Section>

      {/* Legal pages list overlay */}
      {showLegalList && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setShowLegalList(false)}>
                <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
              </button>
              <h1 className="text-lg font-bold text-foreground">Legal & Policies</h1>
            </div>
            <AppLegalPagesList onSelect={(slug) => { setLegalSlug(slug); setShowLegalList(false); setShowLegalPage(true); }} />
          </div>
        </motion.div>
      )}

      {/* Legal page viewer overlay */}
      {showLegalPage && legalSlug && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <AppLegalPageViewer slug={legalSlug} backPath="" />
          <button
            onClick={() => { setShowLegalPage(false); setShowLegalList(true); }}
            className="fixed top-5 left-5 z-60 flex items-center gap-1 text-sm font-semibold text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default CustomerSettings;
