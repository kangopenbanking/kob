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

  /** Prevents duplicate scan callbacks (html5-qrcode .stop() is async) */
  const processedRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerType, setScannerType] = useState<'native' | 'html5' | null>(null);

  const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach(t => t.stop()); } catch {}
      streamRef.current = null;
    }
    const scanner = html5QrRef.current;
    if (scanner) {
      html5QrRef.current = null;
      // html5-qrcode throws synchronously if the scanner is not SCANNING/PAUSED.
      // Guard with getState() and swallow both sync + async failures.
      try {
        const state = typeof scanner.getState === 'function' ? scanner.getState() : 2;
        // States: NOT_STARTED=1, SCANNING=2, PAUSED=3
        if (state === 2 || state === 3) {
          Promise.resolve(scanner.stop()).catch(() => {}).finally(() => {
            try { scanner.clear(); } catch {}
          });
        } else {
          try { scanner.clear(); } catch {}
        }
      } catch {
        try { scanner.clear(); } catch {}
      }
    }
    setCameraActive(false);
    setScannerType(null);
  }, []);

  /** Reset the processed guard so a new scan can be handled */
  const resetProcessed = useCallback(() => {
    processedRef.current = false;
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
      // Clear any previous children left by a prior instance
      el.innerHTML = '';

      const scanner = new Html5Qrcode(containerId);
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText) => {
          // Guard: only fire once per scan session
          if (processedRef.current) return;
          processedRef.current = true;
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
        if (barcodes.length > 0 && !processedRef.current) {
          processedRef.current = true;
          scanCallbackRef.current(barcodes[0].rawValue);
          return; // stop loop
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
    // Reset processed flag when (re-)enabling
    processedRef.current = false;
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
    resetProcessed,
    /** True when using html5-qrcode (video rendered internally, not via videoRef) */
    isHtml5: scannerType === 'html5',
    /** True when native BarcodeDetector is NOT available — container div must be in DOM */
    needsHtml5Container: !hasNativeDetector,
  };
}
