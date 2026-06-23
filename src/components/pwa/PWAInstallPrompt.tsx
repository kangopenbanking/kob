import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  ChevronRight,
  X,
  Share,
  Plus,
  MoreVertical,
  Smartphone,
  Zap,
  Bell,
  WifiOff,
  CheckCircle2,
} from 'lucide-react';
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
  /** Default install URL for sharing/fallback */
  defaultInstallUrl?: string;
}

const INSTALL_STORAGE_PREFIX = 'pwa_installed_';

type Platform = 'ios-safari' | 'android-chrome' | 'android-other' | 'desktop' | 'other';

/** Check if the app is running in standalone / installed mode */
function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  if (isIOS) return 'ios-safari';
  const isAndroid = /Android/i.test(ua);
  if (isAndroid) {
    if (/Chrome|CriOS/i.test(ua) && !/SamsungBrowser|EdgA|FxiOS|Firefox/i.test(ua)) {
      return 'android-chrome';
    }
    return 'android-other';
  }
  const isMobile = /Mobi|Tablet/i.test(ua);
  if (!isMobile) return 'desktop';
  return 'other';
}

function markAsInstalled(appKey: string) {
  try {
    localStorage.setItem(`${INSTALL_STORAGE_PREFIX}${appKey}`, 'true');
  } catch {}
}

function wasInstalled(appKey: string): boolean {
  try {
    return localStorage.getItem(`${INSTALL_STORAGE_PREFIX}${appKey}`) === 'true';
  } catch {
    return false;
  }
}

interface StepProps {
  index: number;
  icon: React.ReactNode;
  text: React.ReactNode;
  accent: string;
}

const Step: React.FC<StepProps> = ({ index, icon, text, accent }) => (
  <div className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3">
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: accent }}
    >
      {index}
    </div>
    <div className="flex flex-1 items-start gap-2 text-[13px] leading-snug text-foreground">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <span>{text}</span>
    </div>
  </div>
);

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onContinue,
  appName = 'App',
  logoUrl,
  accentColor,
  tagline,
  appKey = 'default',
  defaultInstallUrl,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installing, setInstalling] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const platform = useMemo(detectPlatform, []);
  const standalone = isStandaloneMode();
  const alreadyInstalled = standalone || wasInstalled(appKey);

  // Auto-expand step-by-step guide on iOS (no beforeinstallprompt available)
  useEffect(() => {
    if (platform === 'ios-safari' || platform === 'android-other') {
      setShowSteps(true);
    }
  }, [platform]);

  // If already installed or previously acknowledged, skip entirely
  useEffect(() => {
    if (alreadyInstalled) onContinue();
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
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          markAsInstalled(appKey);
          onContinue();
        }
      } catch {
        // user cancelled or browser blocked
      }
      setDeferredPrompt(null);
      setInstalling(false);
      return;
    }
    // No native prompt available — reveal the step-by-step guide
    setShowSteps(true);
  }, [deferredPrompt, appKey, onContinue]);

  const handleSkip = useCallback(() => {
    markAsInstalled(appKey);
    onContinue();
  }, [appKey, onContinue]);

  const accent = accentColor || 'hsl(var(--primary))';
  const accentStyle = { backgroundColor: accent };

  if (alreadyInstalled) return null;

  const primaryLabel =
    installing
      ? 'Installing…'
      : deferredPrompt
        ? `Install ${appName}`
        : platform === 'ios-safari'
          ? 'Show me how'
          : platform === 'android-other' || platform === 'desktop' || platform === 'other'
            ? 'Show me how'
            : `Install ${appName}`;

  const renderSteps = () => {
    if (platform === 'ios-safari') {
      return (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Add to your iPhone in 3 steps
          </p>
          <Step
            index={1}
            accent={accent}
            icon={<Share className="h-4 w-4" />}
            text={<>Tap the <strong>Share</strong> button at the bottom of Safari.</>}
          />
          <Step
            index={2}
            accent={accent}
            icon={<Plus className="h-4 w-4" />}
            text={<>Scroll and tap <strong>Add to Home Screen</strong>.</>}
          />
          <Step
            index={3}
            accent={accent}
            icon={<CheckCircle2 className="h-4 w-4" />}
            text={<>Tap <strong>Add</strong> — the {appName} icon appears on your home screen.</>}
          />
        </div>
      );
    }
    if (platform === 'android-other') {
      return (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Add to your phone in 3 steps
          </p>
          <Step
            index={1}
            accent={accent}
            icon={<MoreVertical className="h-4 w-4" />}
            text={<>Open the browser <strong>menu</strong> (three dots, top right).</>}
          />
          <Step
            index={2}
            accent={accent}
            icon={<Plus className="h-4 w-4" />}
            text={<>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.</>}
          />
          <Step
            index={3}
            accent={accent}
            icon={<CheckCircle2 className="h-4 w-4" />}
            text={<>Confirm — the {appName} icon appears on your home screen.</>}
          />
        </div>
      );
    }
    if (platform === 'desktop') {
      return (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Add {appName} to your computer
          </p>
          <Step
            index={1}
            accent={accent}
            icon={<Download className="h-4 w-4" />}
            text={<>Look for the <strong>install icon</strong> on the right of the address bar.</>}
          />
          <Step
            index={2}
            accent={accent}
            icon={<CheckCircle2 className="h-4 w-4" />}
            text={<>Click <strong>Install</strong> — the app opens in its own window.</>}
          />
        </div>
      );
    }
    return (
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Add {appName} to your device
        </p>
        <Step
          index={1}
          accent={accent}
          icon={<MoreVertical className="h-4 w-4" />}
          text={<>Open your browser menu.</>}
        />
        <Step
          index={2}
          accent={accent}
          icon={<Plus className="h-4 w-4" />}
          text={<>Choose <strong>Install</strong> or <strong>Add to Home Screen</strong>.</>}
        />
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl"
      >
        {/* Close / Skip */}
        <div className="-mr-1 -mt-1 flex justify-end">
          <button
            onClick={handleSkip}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Skip installation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* App identity */}
        <div className="mt-1 flex flex-col items-center gap-3 text-center">
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
              <Smartphone className="h-7 w-7 text-white" />
            </div>
          )}

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Install {appName}</h2>
            <p className="max-w-[260px] text-sm leading-snug text-muted-foreground">
              {tagline || `Get the full ${appName} experience on your device.`}
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2 py-3 text-center">
            <Zap className="h-4 w-4 text-foreground" />
            <span className="text-[11px] font-medium leading-tight text-muted-foreground">
              Opens<br />faster
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2 py-3 text-center">
            <Bell className="h-4 w-4 text-foreground" />
            <span className="text-[11px] font-medium leading-tight text-muted-foreground">
              Real-time<br />alerts
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2 py-3 text-center">
            <WifiOff className="h-4 w-4 text-foreground" />
            <span className="text-[11px] font-medium leading-tight text-muted-foreground">
              Works<br />offline
            </span>
          </div>
        </div>

        {/* Step-by-step guide */}
        <AnimatePresence initial={false}>
          {showSteps && (
            <motion.div
              key="steps"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {renderSteps()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="mt-5 space-y-2.5">
          <Button
            onClick={handleInstall}
            className="w-full gap-2 rounded-xl font-semibold text-white hover:opacity-95"
            size="lg"
            disabled={installing}
            style={accentStyle}
          >
            <Download className="h-4 w-4" />
            {primaryLabel}
          </Button>
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="w-full rounded-xl text-muted-foreground hover:text-foreground"
            size="sm"
          >
            Continue in browser
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.div>

      {defaultInstallUrl ? (
        <p className="mt-4 max-w-sm text-center text-[11px] text-muted-foreground">
          Tip: open <span className="font-mono text-foreground">{defaultInstallUrl}</span> in your mobile browser to install.
        </p>
      ) : null}
    </div>
  );
};
