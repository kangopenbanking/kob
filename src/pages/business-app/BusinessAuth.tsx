import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TenantProvider, useTenant } from '@/components/pwa/TenantProvider';
import { MobileAuthForm } from '@/components/pwa/MobileAuthForm';
import { StaffPinLogin } from '@/components/business-app/StaffPinLogin';
import { useSingleSession } from '@/hooks/useSingleSession';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Store, Users } from 'lucide-react';
import { toast } from 'sonner';
import kangLogo from '@/assets/kang-logo.png';

type AuthMode = 'select' | 'owner' | 'staff';

const BusinessAuthInner: React.FC = () => {
  const navigate = useNavigate();
  const tenant = useTenant();
  const [checkingRole, setCheckingRole] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('select');

  useSingleSession();

  const handleAuthSuccess = async () => {
    setCheckingRole(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const [{ data: isOwner }, { data: isStaff }] = await Promise.all([
        supabase.from('gateway_merchants').select('id').eq('user_id', user.id).limit(1),
        supabase.from('merchant_staff_roles').select('id').eq('user_id', user.id).eq('is_active', true).limit(1)
      ]);

      const hasAccess = (isOwner && isOwner.length > 0) || (isStaff && isStaff.length > 0);

      if (!hasAccess) {
        await supabase.auth.signOut();
        toast.error('You do not have access to the Business App');
        setCheckingRole(false);
        setAuthMode('select');
        return;
      }

      navigate('/biz/home', { replace: true });
    } catch (error) {
      toast.error('Authentication error');
      setCheckingRole(false);
    }
  };

  if (checkingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Role selection screen
  if (authMode === 'select') {
    const logoSrc = tenant.logoUrl || kangLogo;
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="relative overflow-hidden bg-primary px-6 pb-16 pt-12">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[hsl(0,0%,100%)]/[0.08]" />
          <div className="absolute -left-8 bottom-4 h-28 w-28 rounded-full bg-[hsl(0,0%,100%)]/[0.05]" />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 flex flex-col items-center text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(0,0%,100%)]/20 shadow-lg backdrop-blur-sm">
              <img src={logoSrc} alt={tenant.name} className="h-10 w-10 rounded-xl object-contain" />
            </div>
            <h1 className="text-xl font-bold text-primary-foreground">Kang Business</h1>
            <p className="mt-1 text-sm text-primary-foreground/70">Manage your business on the go</p>
          </motion.div>
        </div>

        <div className="relative z-10 -mt-8 flex flex-1 flex-col px-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border/50 bg-card p-6 shadow-xl shadow-black/5"
          >
            <p className="mb-5 text-center text-sm font-medium text-foreground">How are you signing in?</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setAuthMode('owner')}
                className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Store className="h-6 w-6 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Business Owner</p>
                  <p className="text-xs text-muted-foreground">Sign in with your phone, email or PIN</p>
                </div>
              </button>

              <button
                onClick={() => setAuthMode('staff')}
                className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent">
                  <Users className="h-6 w-6 text-accent-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Staff Member</p>
                  <p className="text-xs text-muted-foreground">Sign in with your staff phone &amp; PIN</p>
                </div>
              </button>
            </div>
          </motion.div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don't have an account?{' '}
            <button onClick={() => navigate('/biz/register')} className="font-medium text-primary hover:underline">
              Register your business
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Staff PIN login
  if (authMode === 'staff') {
    const logoSrc = tenant.logoUrl || kangLogo;
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="relative overflow-hidden bg-primary px-6 pb-16 pt-12">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[hsl(0,0%,100%)]/[0.08]" />
          <div className="absolute -left-8 bottom-4 h-28 w-28 rounded-full bg-[hsl(0,0%,100%)]/[0.05]" />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 flex flex-col items-center text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(0,0%,100%)]/20 shadow-lg backdrop-blur-sm">
              <img src={logoSrc} alt={tenant.name} className="h-10 w-10 rounded-xl object-contain" />
            </div>
            <h1 className="text-xl font-bold text-primary-foreground">Staff Login</h1>
            <p className="mt-1 text-sm text-primary-foreground/70">Sign in with your staff credentials</p>
          </motion.div>
        </div>

        <div className="relative z-10 -mt-8 flex flex-1 flex-col px-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border/50 bg-card p-6 shadow-xl shadow-black/5"
          >
            <StaffPinLogin onAuthSuccess={handleAuthSuccess} onBack={() => setAuthMode('select')} />
          </motion.div>
        </div>
      </div>
    );
  }

  // Owner login (existing MobileAuthForm)
  return (
    <MobileAuthForm
      onAuthSuccess={handleAuthSuccess}
      onApplyAccount={() => navigate('/biz/register')}
    />
  );
};

const BusinessAuth: React.FC = () => {
  return (
    <TenantProvider>
      <BusinessAuthInner />
    </TenantProvider>
  );
};

export default BusinessAuth;
