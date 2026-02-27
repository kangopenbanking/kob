import React from 'react';
import { CreditCard, Plus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CustomerCards: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-5">
      <h1 className="text-xl font-bold text-foreground">Cards</h1>

      {/* Card Preview */}
      <div className="rounded-3xl bg-[hsl(225,50%,22%)] p-6">
        <div className="flex items-center justify-between">
          <CreditCard className="h-8 w-8 text-[hsl(0,0%,100%)]" strokeWidth={1.5} />
          <Lock className="h-4 w-4 text-[hsl(0,0%,100%)]/60" strokeWidth={1.5} />
        </div>
        <p className="mt-6 text-lg font-mono tracking-widest text-[hsl(0,0%,100%)]">
          **** **** **** 4582
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase text-[hsl(0,0%,100%)]/50">Card Holder</p>
            <p className="text-sm font-semibold text-[hsl(0,0%,100%)]">John Doe</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[hsl(0,0%,100%)]/50">Expires</p>
            <p className="text-sm font-semibold text-[hsl(0,0%,100%)]">12/28</p>
          </div>
        </div>
      </div>

      {/* Add Card */}
      <Button variant="outline" className="w-full rounded-2xl">
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
        Add New Card
      </Button>
    </div>
  );
};

export default CustomerCards;
