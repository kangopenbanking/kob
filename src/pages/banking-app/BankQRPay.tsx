import React from 'react';
import { ArrowLeft, QrCode, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const BankQRPay: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">QR Pay</h1>
      <p className="mb-6 text-sm text-muted-foreground">Scan or share your QR code</p>

      <div className="flex flex-col items-center gap-8">
        {/* QR Display */}
        <div className="flex h-56 w-56 items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted">
          <QrCode className="h-24 w-24 text-muted-foreground/40" strokeWidth={1} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Share this QR code to receive payments
        </p>

        <div className="flex w-full flex-col gap-3">
          <Button variant="outline" className="w-full gap-2">
            <Camera className="h-4 w-4" strokeWidth={1.5} />
            Scan QR Code
          </Button>
          <Button className="w-full gap-2">
            <QrCode className="h-4 w-4" strokeWidth={1.5} />
            Generate Payment QR
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BankQRPay;
