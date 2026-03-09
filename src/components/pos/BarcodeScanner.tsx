import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, ScanBarcode, X, Keyboard } from 'lucide-react';
import { toast } from 'sonner';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, isOpen, onOpenChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState('');
  const scanningRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    scanningRef.current = false;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scanningRef.current = true;
      scanFrame();
    } catch {
      setCameraError('Camera access denied. Use manual entry instead.');
      setMode('manual');
    }
  }, []);

  // Simple barcode detection using BarcodeDetector API (available in Chrome/Edge)
  const scanFrame = useCallback(async () => {
    if (!scanningRef.current || !videoRef.current) return;

    if ('BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'] });
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          onScan(code);
          toast.success(`Scanned: ${code}`);
          onOpenChange(false);
          return;
        }
      } catch { /* continue scanning */ }
    }

    if (scanningRef.current) {
      requestAnimationFrame(scanFrame);
    }
  }, [onScan, onOpenChange]);

  useEffect(() => {
    if (isOpen && mode === 'camera') {
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen, mode, startCamera, stopCamera]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) stopCamera(); onOpenChange(open); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-primary" />
            Barcode / SKU Scanner
          </DialogTitle>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 px-4">
          <Button
            variant={mode === 'camera' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 gap-2"
            onClick={() => setMode('camera')}
          >
            <Camera className="h-4 w-4" /> Camera
          </Button>
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 gap-2"
            onClick={() => { stopCamera(); setMode('manual'); }}
          >
            <Keyboard className="h-4 w-4" /> Manual
          </Button>
        </div>

        {mode === 'camera' ? (
          <div className="relative mx-4 mb-4 mt-2 overflow-hidden rounded-xl bg-black">
            {cameraError ? (
              <div className="flex h-48 items-center justify-center text-center text-sm text-destructive p-4">
                {cameraError}
              </div>
            ) : (
              <>
                <video ref={videoRef} className="h-48 w-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-16 w-48 rounded-lg border-2 border-primary/60 shadow-[0_0_0_4000px_rgba(0,0,0,0.3)]" />
                </div>
                <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
                  Point camera at barcode
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-2 px-4 pb-4 pt-2">
            <Input
              placeholder="Enter barcode or SKU..."
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              autoFocus
              className="flex-1"
            />
            <Button onClick={handleManualSubmit} disabled={!manualCode.trim()}>
              Look Up
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
