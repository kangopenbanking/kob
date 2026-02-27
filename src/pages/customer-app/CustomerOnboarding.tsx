import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, Landmark, Smartphone, Wallet, Ban } from 'lucide-react';

const accountTypes = [
  { id: 'bank_account', label: 'Bank Account', icon: Building2, color: 'bg-[hsl(210,80%,93%)]' },
  { id: 'credit_union', label: 'Credit Union', icon: Landmark, color: 'bg-[hsl(150,40%,90%)]' },
  { id: 'momo_orange', label: 'MoMo Orange', icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]' },
  { id: 'momo_mtn', label: 'MoMo MTN', icon: Wallet, color: 'bg-[hsl(50,80%,90%)]' },
  { id: 'none', label: 'No Bank Account', icon: Ban, color: 'bg-muted' },
];

const CustomerOnboarding: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();

  return (
    <div className="flex min-h-screen flex-col bg-background p-6">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Link Your Account</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Select how you manage your money
      </p>

      <div className="space-y-3">
        {accountTypes.map((type) => (
          <button
            key={type.id}
            className="flex w-full items-center gap-4 rounded-3xl border border-border p-4 text-left transition-colors hover:bg-muted/50"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${type.color}`}>
              <type.icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-semibold text-foreground">{type.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto pt-8">
        <Button className="w-full rounded-2xl" size="lg" asChild>
          <Link to={`/app/${institutionId}/home`}>Continue</Link>
        </Button>
      </div>
    </div>
  );
};

export default CustomerOnboarding;
