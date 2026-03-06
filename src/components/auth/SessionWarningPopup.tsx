import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  show: boolean;
  countdown: number;
  appName: string;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export const SessionWarningPopup: React.FC<Props> = ({
  show,
  countdown,
  appName,
  onStayLoggedIn,
  onLogout,
}) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="w-full max-w-sm rounded-2xl border-2 border-primary/30 bg-background p-6 shadow-2xl"
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div className="relative">
              <img src="/kob-logo.png" alt={appName} className="h-12 w-12 rounded-xl object-contain opacity-80" />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <Clock className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Session Timeout</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You've been inactive. For your security, you'll be signed out in
              </p>
            </div>
            <div className="text-3xl font-bold tabular-nums text-primary">
              {countdown}s
            </div>
            <div className="flex w-full gap-3">
              <Button variant="outline" className="flex-1 border-primary/30" onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
              <Button className="flex-1" onClick={onStayLoggedIn}>
                Stay Logged In
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
