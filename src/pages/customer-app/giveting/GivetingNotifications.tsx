import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const GivetingNotifications: React.FC = () => {
  const nav = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Bell className="h-6 w-6 text-primary" strokeWidth={1.6} />
      </div>
      <h1 className="text-lg font-semibold">No notifications yet</h1>
      <p className="mt-1 text-sm text-muted-foreground">You'll see donations and updates here.</p>
      <Button variant="outline" onClick={() => nav('/app/giveting/discover')} className="mt-6 rounded-full">Discover fundraisers</Button>
    </div>
  );
};

export default GivetingNotifications;
