import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, Mail, Phone, Shield, Bus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const StaffLogin: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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

      // Verify this user is actually a staff member
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
      navigate('/merchant/travel-services');
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
        navigate('/merchant/travel-services');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mx-auto">
            <Bus className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Portal</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to access your travel management dashboard
          </p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardContent className="pt-6">
            <Tabs defaultValue="email" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 h-12">
                <TabsTrigger value="email" className="gap-2 text-sm">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="phone" className="gap-2 text-sm">
                  <Phone className="h-4 w-4" />
                  Phone + PIN
                </TabsTrigger>
              </TabsList>

              {/* Email + Password Tab */}
              <TabsContent value="email" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-password">Password</Label>
                  <Input
                    id="staff-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                  />
                </div>
                <Button onClick={handleEmailLogin} disabled={loading} className="w-full h-11">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Sign In with Email
                </Button>
              </TabsContent>

              {/* Phone + PIN Tab */}
              <TabsContent value="phone" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="staff-phone">Phone Number</Label>
                  <Input
                    id="staff-phone"
                    type="tel"
                    placeholder="+237 6XX XXX XXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label>6-Digit PIN</Label>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={pin} onChange={setPin}>
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
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the 6-digit PIN provided by your manager
                  </p>
                </div>
                <Button onClick={handlePinLogin} disabled={loading || pin.length !== 6} className="w-full h-11">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                  Sign In with PIN
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Contact your manager if you don't have login credentials
        </p>
      </div>
    </div>
  );
};

export default StaffLogin;
