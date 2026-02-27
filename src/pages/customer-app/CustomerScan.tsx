import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ScanLine, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CustomerScan: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(0,0%,5%)]">
      {/* Header */}
      <div className="flex items-center justify-between p-5">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-6 w-6 text-[hsl(0,0%,100%)]" strokeWidth={1.5} />
        </button>
        <h1 className="text-lg font-bold text-[hsl(0,0%,100%)]">Scan QR Code</h1>
        <div className="w-6" />
      </div>

      {/* Scanner Area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
        <div className="relative flex h-64 w-64 items-center justify-center rounded-3xl border-2 border-dashed border-[hsl(0,0%,100%)]/30">
          <ScanLine className="h-16 w-16 text-primary" strokeWidth={1.5} />
          {/* Corner markers */}
          <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-3xl border-l-4 border-t-4 border-primary" />
          <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-3xl border-r-4 border-t-4 border-primary" />
          <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-3xl border-b-4 border-l-4 border-primary" />
          <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-3xl border-b-4 border-r-4 border-primary" />
        </div>
        <p className="text-center text-sm text-[hsl(0,0%,100%)]/60">
          Point your camera at a QR code to scan
        </p>
      </div>

      {/* Manual Entry */}
      <div className="p-5 pb-24">
        <Button
          variant="outline"
          className="w-full rounded-2xl border-[hsl(0,0%,100%)]/20 text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,100%)]/10"
          onClick={() => navigate(`/app/${institutionId}/transfer`)}
        >
          <Keyboard className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Enter Code Manually
        </Button>
      </div>
    </div>
  );
};

export default CustomerScan;
