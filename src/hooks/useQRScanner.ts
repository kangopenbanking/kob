import { useEffect, useRef, useCallback, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface UseQRScannerOptions {
  onScan: (rawValue: string) => void;
  enabled: boolean;
  /** ID of the container element for the html5-qrcode fallback */
  containerId?: string;
}

/**
 * Universal QR scanner hook.
 * Uses native BarcodeDetector when available (Chrome/Edge/Samsung),
 * falls back to html5-qrcode (works on iOS Safari, Firefox, etc).
 */
export function useQRScanner({ onScan, enabled, containerId = 'qr-scanner-region' }: UseQRScannerOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const scanCallbackRef = useRef(onScan);
  scanCallbackRef.current = onScan;

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerType, setScannerType] = useState<'native' | 'html5' | null>(null);

  const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const stopCamera = useCallback(() => {
    // Stop native stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    // Stop html5-qrcode
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {});
      html5QrRef.current.clear();
      html5QrRef.current = null;
    }
    setCameraActive(false);
    setScannerType(null);
  }, []);

  const startNativeScanner = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setScannerType('native');
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please allow camera permissions.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Could not start camera. Try manual entry instead.');
      }
    }
  }, []);

  const startHtml5Scanner = useCallback(async () => {
    try {
      setCameraError(null);
      const el = document.getElementById(containerId);
      if (!el) {
        setCameraError('Scanner container not found');
        return;
      }
      const scanner = new Html5Qrcode(containerId);
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => {
          scanCallbackRef.current(decodedText);
        },
        () => { /* ignore scan failures */ }
      );
      setCameraActive(true);
      setScannerType('html5');
    } catch (err: any) {
      if (err?.message?.includes('NotAllowedError') || err?.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please allow camera permissions.');
      } else {
        setCameraError('Could not start camera. Try manual entry instead.');
      }
    }
  }, [containerId]);

  // Native BarcodeDetector scanning loop
  useEffect(() => {
    if (!enabled || !cameraActive || scannerType !== 'native' || !videoRef.current) return;
    if (!hasNativeDetector) return;

    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    let cancelled = false;

    const scan = async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
        if (!cancelled) requestAnimationFrame(scan);
        return;
      }
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          scanCallbackRef.current(barcodes[0].rawValue);
          return;
        }
      } catch { /* continue */ }
      if (!cancelled) requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
    return () => { cancelled = true; };
  }, [enabled, cameraActive, scannerType, hasNativeDetector]);

  // Auto-start
  useEffect(() => {
    if (!enabled) {
      stopCamera();
      return;
    }
    if (hasNativeDetector) {
      startNativeScanner();
    } else {
      startHtml5Scanner();
    }
    return () => stopCamera();
  }, [enabled]);

  return {
    videoRef,
    cameraActive,
    cameraError,
    scannerType,
    stopCamera,
    /** True when using html5-qrcode (video rendered internally, not via videoRef) */
    isHtml5: scannerType === 'html5',
    /** True when native BarcodeDetector is NOT available — container div must be in DOM */
    needsHtml5Container: !hasNativeDetector,
  };
}
