import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMerchantContext } from '@/hooks/useMerchantContext';

interface BusinessTopBarProps {
  isDesktop?: boolean;
}

export const BusinessTopBar: React.FC<BusinessTopBarProps> = ({ isDesktop }) => {
  const navigate = useNavigate();
  const { isOwner, isStaff } = useMerchantContext();

  if (isDesktop) {
    return (
      <div className="flex flex-1 items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground">
            <Search className="h-4.5 w-4.5" strokeWidth={1.6} />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground relative">
            <Bell className="h-4.5 w-4.5" strokeWidth={1.6} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  // Mobile top bar
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <p className="text-base font-bold text-foreground tracking-tight">
        Kang Business
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground">
          <Search className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.6} />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground relative">
          <Bell className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.6} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>
      </div>
    </div>
  );
};
