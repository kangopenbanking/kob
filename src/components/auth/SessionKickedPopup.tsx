import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, ShieldAlert, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import kangLogo from '@/assets/kang-logo.png';

interface Props {
  show: boolean;
  appName: string;
  deviceInfo?: string | null;
  onLogout: () => void;
}

export const SessionKickedPopup: React.FC<Props> = ({
  show,
  appName,
  deviceInfo,
  onLogout,
}) => {
  // Extract a human-readable device hint from user-agent
  const deviceHint = React.useMemo(() => {
    if (!deviceInfo) return null;
    const ua = deviceInfo.split(' | ')[0] || deviceInfo;
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android device';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Linux PC';
    return 'another device';
  }, [deviceInfo]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            {/* Header gradient bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-destructive via-destructive/60 to-destructive/30" />

            <div className="p-6">
              <div className="flex flex-col items-center text-center gap-5">
                {/* Logo with shield badge */}
                <div className="relative">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 p-2 ring-2 ring-destructive/20">
                    <img src={kangLogo} alt={appName} className="h-full w-full rounded-xl object-contain" />
                  </div>
                  <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-destructive flex items-center justify-center ring-2 ring-background">
                    <ShieldAlert className="h-4 w-4 text-destructive-foreground" />
                  </div>
                </div>

                {/* Title & description */}
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground">Session Ended</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Your account was signed in on{' '}
                    <span className="font-medium text-foreground">
                      {deviceHint || 'another device'}
                    </span>
                    . For your security, only one active session is allowed at a time.
                  </p>
                </div>

                {/* Device info card */}
                {deviceHint && (
                  <div className="w-full rounded-xl bg-muted/40 border border-border p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                      <Smartphone className="h-4.5 w-4.5 text-destructive" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-medium text-foreground">New session detected</p>
                      <p className="text-xs text-muted-foreground truncate">{deviceHint}</p>
                    </div>
                  </div>
                )}

                {/* Security note */}
                <p className="text-[11px] text-muted-foreground/70 leading-snug">
                  If this wasn't you, please sign in and change your PIN immediately.
                </p>

                {/* CTA */}
                <Button
                  className="w-full h-12 text-base font-semibold"
                  onClick={onLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Return to Login
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
