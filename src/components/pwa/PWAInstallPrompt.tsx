import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Smartphone, Wifi, WifiOff, Zap, Shield, Bell, ChevronRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PWAInstallPromptProps {
  onContinue: () => void;
  appName?: string;
  logoUrl?: string | null;
  accentColor?: string;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onContinue,
  appName = 'App',
  logoUrl,
  accentColor,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;

  useEffect(() => {
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => setIsInstalled(true);
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, [isStandalone]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      setInstalling(false);
    } else {
      setShowInstructions(true);
    }
  };

  const advantages = [
    { icon: Zap, title: 'Lightning Fast', desc: 'Loads instantly, no app store delays' },
    { icon: WifiOff, title: 'Works Offline', desc: 'Access your account even without internet' },
    { icon: Shield, title: 'Secure & Private', desc: 'Same bank-grade security as web' },
    { icon: Bell, title: 'Push Notifications', desc: 'Real-time alerts for transactions' },
  ];

  const accentStyle = accentColor ? { backgroundColor: accentColor } : undefined;

  if (isStandalone || isInstalled) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-12"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
        >
          <Check className="h-10 w-10 text-primary" />
        </motion.div>
        <h2 className="text-xl font-semibold text-foreground">App Installed!</h2>
        <p className="text-center text-sm text-muted-foreground">
          {appName} is ready on your device.
        </p>
        <Button onClick={onContinue} className="mt-4 w-full gap-2" size="lg" style={accentStyle}>
          Continue <ChevronRight className="h-4 w-4" />
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      {/* Skip */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onContinue} className="text-muted-foreground">
          Skip for now
        </Button>
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 flex flex-col items-center gap-4"
      >
        {logoUrl ? (
          <img src={logoUrl} alt={appName} className="h-16 w-16 rounded-2xl object-contain" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
        )}
        <h1 className="text-center text-2xl font-bold tracking-tight text-foreground">
          Install {appName}
        </h1>
        <p className="max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
          Add {appName} to your home screen for the best experience — no app store needed.
        </p>
      </motion.div>

      {/* Advantages */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-8 space-y-3"
      >
        {advantages.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Install Instructions (iOS manual) */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">How to Install</p>
              <button onClick={() => setShowInstructions(false)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            {isIOS ? (
              <ol className="space-y-2 text-xs text-muted-foreground">
                <li className="flex gap-2"><span className="font-bold text-foreground">1.</span> Tap the <strong>Share</strong> button (box with arrow) at the bottom of Safari</li>
                <li className="flex gap-2"><span className="font-bold text-foreground">2.</span> Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                <li className="flex gap-2"><span className="font-bold text-foreground">3.</span> Tap <strong>"Add"</strong> to confirm</li>
              </ol>
            ) : (
              <ol className="space-y-2 text-xs text-muted-foreground">
                <li className="flex gap-2"><span className="font-bold text-foreground">1.</span> Tap the <strong>⋮ menu</strong> button in your browser</li>
                <li className="flex gap-2"><span className="font-bold text-foreground">2.</span> Select <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong></li>
                <li className="flex gap-2"><span className="font-bold text-foreground">3.</span> Tap <strong>"Install"</strong> to confirm</li>
              </ol>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-3 pb-4"
      >
        <Button
          onClick={handleInstall}
          className="w-full gap-2"
          size="lg"
          disabled={installing}
          style={accentStyle}
        >
          <Download className="h-4 w-4" />
          {installing ? 'Installing…' : deferredPrompt ? 'Install App' : 'How to Install'}
        </Button>
        <Button
          variant="outline"
          onClick={onContinue}
          className="w-full gap-2"
          size="lg"
        >
          Continue in Browser
          <ChevronRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
};
