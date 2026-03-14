import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, Mail, Phone, Shield, ArrowRight, Lock, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthPageConfig } from '@/hooks/useAuthPageConfig';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const TRUST_FEATURES = [
  { icon: Shield, label: 'Secure Authentication' },
  { icon: Lock, label: 'Encrypted Sessions' },
  { icon: CheckCircle, label: 'Role-Based Access' },
];

const StaffLogin: React.FC = () => {
  const navigate = useNavigate();
  const { config: authConfig } = useAuthPageConfig();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('email');

  // Email + Password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone + PIN
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.error('Enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const { data: staffRecord } = await supabase
        .from('merchant_staff_roles')
        .select('id, role, permissions, is_active')
        .eq('user_id', data.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!staffRecord) {
        await supabase.auth.signOut();
        toast.error('No active staff account found for this email');
        setLoading(false);
        return;
      }

      toast.success('Welcome back!');
      navigate('/merchant/travel-services', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async () => {
    if (!phone || pin.length !== 6) {
      toast.error('Enter your phone number and 6-digit PIN');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('staff-pin-login', {
        body: { phone_number: phone.trim(), pin_code: pin },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast.success(`Welcome, ${data.staff?.name}!`);
        navigate('/merchant/travel-services', { replace: true });
      } else {
        throw new Error('No session returned');
      }
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Hero Panel */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-background/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-background/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 py-12 w-full">
          {/* Logo */}
          {authConfig.logo_url && (
            <motion.img
              src={authConfig.logo_url}
              alt="Logo"
              className="h-10 w-auto mb-10 brightness-0 invert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            />
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-6"
          >
            <h1 className="text-3xl xl:text-4xl font-bold text-primary-foreground leading-tight">
              Staff Portal
            </h1>
            <p className="text-primary-foreground/70 text-base leading-relaxed max-w-md">
              Access your merchant dashboard to manage travel services, bookings, and operations.
            </p>
          </motion.div>

          {/* Trust Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-10 space-y-3"
          >
            {TRUST_FEATURES.map((feature) => (
              <div key={feature.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center">
                  <feature.icon className="h-4 w-4 text-primary-foreground/80" />
                </div>
                <span className="text-sm text-primary-foreground/70">{feature.label}</span>
              </div>
            ))}
          </motion.div>

          {/* Glass card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-12 p-5 rounded-2xl bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10"
          >
            <p className="text-xs text-primary-foreground/50 leading-relaxed">
              This portal is for authorized merchant staff only. Your session is encrypted and monitored for security.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Login Form Panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <motion.div
          className="w-full max-w-md space-y-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Mobile Header */}
          <div className="lg:hidden text-center space-y-3">
            {authConfig.logo_url && (
              <img src={authConfig.logo_url} alt="Logo" className="h-10 w-auto mx-auto" />
            )}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Staff Portal</h1>
            <p className="text-muted-foreground text-sm">
              Sign in to access your merchant dashboard
            </p>
          </div>

          {/* Desktop Title (visible when hero is shown) */}
          <div className="hidden lg:block space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground">Choose your preferred authentication method</p>
          </div>

          <Card className="border border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6 pb-6">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} {...fadeSlide}>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
                    <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/60 rounded-xl p-1">
                      <TabsTrigger value="email" className="gap-2 text-sm rounded-lg data-[state=active]:shadow-sm">
                        <Mail className="h-4 w-4" />
                        Email
                      </TabsTrigger>
                      <TabsTrigger value="phone" className="gap-2 text-sm rounded-lg data-[state=active]:shadow-sm">
                        <Phone className="h-4 w-4" />
                        Phone + PIN
                      </TabsTrigger>
                    </TabsList>

                    {/* Email + Password */}
                    <TabsContent value="email" className="space-y-4 mt-0">
                      <div className="space-y-2">
                        <Label htmlFor="staff-email" className="text-sm font-medium">Email</Label>
                        <Input
                          id="staff-email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                          className="h-11 rounded-xl border-border/60"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-password" className="text-sm font-medium">Password</Label>
                        <Input
                          id="staff-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                          className="h-11 rounded-xl border-border/60"
                        />
                      </div>
                      <Button onClick={handleEmailLogin} disabled={loading} className="w-full h-11 rounded-xl">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                        Sign In
                      </Button>
                    </TabsContent>

                    {/* Phone + PIN */}
                    <TabsContent value="phone" className="space-y-4 mt-0">
                      <div className="space-y-2">
                        <Label htmlFor="staff-phone" className="text-sm font-medium">Phone Number</Label>
                        <Input
                          id="staff-phone"
                          type="tel"
                          placeholder="+237 6XX XXX XXX"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="h-11 rounded-xl border-border/60"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">6-Digit PIN</Label>
                        <div className="flex justify-center">
                          <InputOTP maxLength={6} value={pin} onChange={setPin}>
                            <InputOTPGroup className="gap-1.5">
                              {[0, 1, 2, 3, 4, 5].map(i => (
                                <InputOTPSlot
                                  key={i}
                                  index={i}
                                  className="h-11 w-10 rounded-xl border-border/60 text-base font-semibold"
                                />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          Enter the 6-digit PIN provided by your manager
                        </p>
                      </div>
                      <Button onClick={handlePinLogin} disabled={loading || pin.length !== 6} className="w-full h-11 rounded-xl">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                        Sign In with PIN
                      </Button>
                    </TabsContent>
                  </Tabs>
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Cross-link to personal auth */}
          <div className="text-center space-y-2">
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Personal account? Sign in here
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <p className="text-xs text-muted-foreground/60">
              Contact your manager if you don't have login credentials
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StaffLogin;
