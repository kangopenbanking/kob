import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ChevronRight, X, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PWAInstallPromptProps {
  onContinue: () => void;
  /** App display name from admin config */
  appName?: string;
  /** App logo from admin config */
  logoUrl?: string | null;
  /** Accent/brand color from admin config */
  accentColor?: string;
  /** Short description or tagline from admin config */
  tagline?: string;
  /** Unique key to track install state per app (e.g. 'kang' or institutionId) */
  appKey?: string;
}

const INSTALL_STORAGE_PREFIX = 'pwa_installed_';

/** Check if the app is running in standalone / installed mode */
function isStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/** Persist that the user has installed or dismissed the prompt */
function markAsInstalled(appKey: string) {
  try {
    localStorage.setItem(`${INSTALL_STORAGE_PREFIX}${appKey}`, 'true');
  } catch {}
}

/** Check if the user previously installed or dismissed */
function wasInstalled(appKey: string): boolean {
  try {
    return localStorage.getItem(`${INSTALL_STORAGE_PREFIX}${appKey}`) === 'true';
  } catch {
    return false;
  }
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onContinue,
  appName = 'App',
  logoUrl,
  accentColor,
  tagline,
  appKey = 'default',
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installing, setInstalling] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = isStandaloneMode();
  const alreadyInstalled = standalone || wasInstalled(appKey);

  // If already installed or previously acknowledged, skip entirely
  useEffect(() => {
    if (alreadyInstalled) {
      onContinue();
    }
  }, [alreadyInstalled, onContinue]);

  // Capture beforeinstallprompt for Android/Chrome
  useEffect(() => {
    if (standalone) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => {
      markAsInstalled(appKey);
      onContinue();
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [standalone, appKey, onContinue]);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      setInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        markAsInstalled(appKey);
        onContinue();
      }
      setDeferredPrompt(null);
      setInstalling(false);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  }, [deferredPrompt, appKey, isIOS, onContinue]);

  const handleSkip = useCallback(() => {
    markAsInstalled(appKey);
    onContinue();
  }, [appKey, onContinue]);

  const accentBg = accentColor || 'hsl(var(--primary))';
  const accentStyle = { backgroundColor: accentBg };

  // Don't render while auto-skipping
  if (alreadyInstalled) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl"
      >
        {/* Close / Skip */}
        <div className="flex justify-end -mt-1 -mr-1">
          <button
            onClick={handleSkip}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Skip installation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* App identity */}
        <div className="flex flex-col items-center text-center gap-3 mt-1">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={appName}
              className="h-16 w-16 rounded-2xl object-contain shadow-md"
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-md"
              style={accentStyle}
            >
              <Download className="h-7 w-7 text-white" />
            </div>
          )}

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">
              Get {appName}
            </h2>
            {tagline && (
              <p className="text-sm text-muted-foreground leading-snug max-w-[260px]">
                {tagline}
              </p>
            )}
            {!tagline && (
              <p className="text-sm text-muted-foreground leading-snug max-w-[260px]">
                Install on your device for quick access, offline support &amp; real-time alerts.
              </p>
            )}
          </div>
        </div>

        {/* iOS Instructions (slide-in) */}
        <AnimatePresence>
          {showIOSGuide && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-2xl bg-muted/60 p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">Add to Home Screen</p>
                <div className="flex items-start gap-3 text-xs text-muted-foreground">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Share className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span>Tap the <strong>Share</strong> button at the bottom of Safari</span>
                </div>
                <div className="flex items-start gap-3 text-xs text-muted-foreground">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span>Select <strong>"Add to Home Screen"</strong>, then tap <strong>Add</strong></span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="mt-5 space-y-2.5">
          <Button
            onClick={handleInstall}
            className="w-full gap-2 rounded-xl font-semibold"
            size="lg"
            disabled={installing}
            style={accentStyle}
          >
            <Download className="h-4 w-4" />
            {installing
              ? 'Installing…'
              : deferredPrompt
                ? 'Install App'
                : isIOS
                  ? 'How to Install'
                  : 'Install App'}
          </Button>
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="w-full text-muted-foreground hover:text-foreground rounded-xl"
            size="sm"
          >
            Continue in browser
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
