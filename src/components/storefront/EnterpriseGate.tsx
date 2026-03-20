import React from 'react';
import { Lock, Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface EnterpriseGateProps {
  isEnterprise: boolean;
  children: React.ReactNode;
  onUpgrade?: () => void;
}

export function EnterpriseGate({ isEnterprise, children, onUpgrade }: EnterpriseGateProps) {
  const { isAdmin } = useIsAdmin();

  if (isEnterprise || isAdmin) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-20 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
        <div className="text-center max-w-sm px-6 py-8">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Enterprise Feature</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Upgrade to the Enterprise plan to unlock this feature and supercharge your business.
          </p>
          <Button
            onClick={onUpgrade}
            className="bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white rounded-xl gap-2"
          >
            <Crown className="w-4 h-4" /> Upgrade to Enterprise <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
