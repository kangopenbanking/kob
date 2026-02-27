import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Fingerprint, ShieldCheck, Bell, Globe, DollarSign, Info, FileText, LogOut, ChevronRight, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CustomerSettings: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('Jean Dupont');
  const [email, setEmail] = useState('jean.dupont@email.com');
  const [phone, setPhone] = useState('+237 6XX XXX XXX');
  const [editingProfile, setEditingProfile] = useState(false);
  const [biometric, setBiometric] = useState(true);
  const [twoFA, setTwoFA] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('English');

  const handleSaveProfile = () => {
    setEditingProfile(false);
    toast.success('Profile updated');
  };

  const handleChangePin = () => toast.info('PIN change flow would open here');
  const handleLogout = () => { toast.success('Logged out'); navigate('/'); };

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
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="rounded-xl border-border" />
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="rounded-xl border-border" />
            <div className="flex gap-2">
              <Button onClick={handleSaveProfile} className="flex-1 rounded-xl">Save</Button>
              <Button variant="outline" onClick={() => setEditingProfile(false)} className="rounded-xl">Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <Row icon={<User className="h-5 w-5" strokeWidth={1.5} />} label={name} onClick={() => setEditingProfile(true)} />
            <Row icon={<Mail className="h-5 w-5" strokeWidth={1.5} />} label={email} onClick={() => setEditingProfile(true)} />
            <Row icon={<Globe className="h-5 w-5" strokeWidth={1.5} />} label={phone} onClick={() => setEditingProfile(true)} />
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

      <Section title="App">
        <Row icon={<Info className="h-5 w-5" strokeWidth={1.5} />} label="App Version 2.1.0" right={<span />} />
        <Row icon={<FileText className="h-5 w-5" strokeWidth={1.5} />} label="Terms of Service" onClick={() => toast.info('Terms of Service')} />
        <Row icon={<FileText className="h-5 w-5" strokeWidth={1.5} />} label="Privacy Policy" onClick={() => toast.info('Privacy Policy')} />
        <Row icon={<LogOut className="h-5 w-5" strokeWidth={1.5} />} label="Log Out" onClick={handleLogout} destructive />
      </Section>
    </div>
  );
};

export default CustomerSettings;
