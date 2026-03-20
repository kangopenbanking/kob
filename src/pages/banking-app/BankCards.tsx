import React from 'react';
import { CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const BankCards: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
        <CreditCard className="h-10 w-10 text-primary" strokeWidth={1.5} />
      </div>
      <Badge variant="secondary" className="mb-4 text-xs font-semibold">
        Coming Soon
      </Badge>
      <h2 className="text-xl font-bold text-foreground mb-2">
        Virtual Cards
      </h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        USD virtual cards for online purchases worldwide. This feature is currently under development.
      </p>
    </div>
  );
};

export default BankCards;
