import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, MapPin, ArrowRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenant } from './TenantProvider';
import { toast } from 'sonner';

interface AccountApplicationProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export const AccountApplication: React.FC<AccountApplicationProps> = ({ onComplete, onSkip }) => {
  const tenant = useTenant();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    accountType: 'savings' as 'savings' | 'current',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // In production, this would call the institution-customer-create edge function
      await new Promise((r) => setTimeout(r, 1500));
      toast.success('Application submitted successfully!');
      onComplete();
    } catch {
      toast.error('Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Open an Account</h1>
            <p className="text-sm text-muted-foreground">Apply for a {tenant.name} account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input
                placeholder="Full legal name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input
                placeholder="+237 6XX XXX XXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">City</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input
                placeholder="Douala, Yaoundé..."
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Account Type</Label>
            <div className="flex gap-3">
              {(['savings', 'current'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, accountType: type })}
                  className={`flex-1 rounded-xl border-2 p-3 text-center text-sm font-medium capitalize transition-colors ${
                    form.accountType === type
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="mt-4 w-full gap-2" size="lg" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Application'}
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Button>

          {onSkip && (
            <Button type="button" variant="ghost" onClick={onSkip} className="w-full text-muted-foreground">
              I already have an account
            </Button>
          )}
        </form>
      </motion.div>
    </div>
  );
};
