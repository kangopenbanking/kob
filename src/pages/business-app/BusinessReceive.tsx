import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScanLine } from 'lucide-react';

const BusinessReceive: React.FC = () => {
  return (
    <div className="p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Receive Payment</h1>
        <p className="text-sm text-muted-foreground">Scan QR codes or generate payment links</p>
      </header>

      <Card className="border-0 shadow-md">
        <CardContent className="p-12 flex flex-col items-center justify-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ScanLine className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            QR code scanner coming in Sprint 3
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessReceive;
