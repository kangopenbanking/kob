import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity
const WARNING_MS = 60 * 1000; // 1-minute warning before logout
const SESSION_CHECK_MS = 30 * 1000; // check session validity every 30s
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const;

interface Props {
  children: React.ReactNode;
  /** Where to redirect on forced logout (default: /auth) */
  logoutPath?: string;
  /** App label shown in the popup */
  appName?: string;
}

/**
 * Wraps any app section to enforce:
 *   1. Inactivity timeout with warning popup
 *   2. Single-device session — polls to detect remote sign-out
 */
export const SessionGuard: React.FC<Props> = ({
  children,
  logoutPath = '/auth',
  appName = 'Kang',
}) => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [showKicked, setShowKicked] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const warningTimerRef = useRef<ReturnType<typeof setInterval>>();
  const sessionCheckRef = useRef<ReturnType<typeof setInterval>>();
  const sessionIdRef = useRef<string>();

  // ---- session registration ----
  const registerSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const sid = session.access_token.slice(-16); // deterministic per session
      sessionIdRef.current = sid;

      const deviceInfo = `${navigator.userAgent.slice(0, 80)} | ${new Date().toISOString()}`;
      await supabase.functions.invoke('enforce-single-session', {
        body: { session_id: sid, device_info: deviceInfo },
      });
    } catch (e) {
      console.error('Session registration error:', e);
    }
  }, []);

  // ---- session validity poll ----
  const checkSessionValidity = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Session gone (signed out remotely)
        setShowKicked(true);
        return;
      }

      // Check if our session is still the active one
      const sid = sessionIdRef.current;
      if (!sid) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setShowKicked(true);
        return;
      }

      const { data: activeSessions } = await supabase
        .from('user_active_sessions')
        .select('session_id')
        .eq('user_id', user.id)
        .order('last_active_at', { ascending: false })
        .limit(1);

      if (activeSessions && activeSessions.length > 0 && activeSessions[0].session_id !== sid) {
        setShowKicked(true);
      }
    } catch {
      // network error — ignore, will retry
    }
  }, []);

  // ---- inactivity timeout ----
  const resetTimer = useCallback(() => {
    if (showWarning || showKicked) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(Math.floor(WARNING_MS / 1000));
    }, TIMEOUT_MS - WARNING_MS);
  }, [showWarning, showKicked]);

  // Register session on mount
  useEffect(() => {
    registerSession();
  }, [registerSession]);

  // Poll session validity
  useEffect(() => {
    sessionCheckRef.current = setInterval(checkSessionValidity, SESSION_CHECK_MS);
    return () => clearInterval(sessionCheckRef.current);
  }, [checkSessionValidity]);

  // Activity listeners
  useEffect(() => {
    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimer();
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handler));
      clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  // Warning countdown
  useEffect(() => {
    if (!showWarning) return;
    warningTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(warningTimerRef.current);
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(warningTimerRef.current);
  }, [showWarning]);

  const handleStayLoggedIn = () => {
    setShowWarning(false);
    clearInterval(warningTimerRef.current);
    resetTimer();
    // Update last_active so server knows we're still here
    if (sessionIdRef.current) {
      supabase.from('user_active_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('session_id', sessionIdRef.current)
        .then();
    }
  };

  const handleLogout = async () => {
    clearTimeout(timerRef.current);
    clearInterval(warningTimerRef.current);
    clearInterval(sessionCheckRef.current);
    await supabase.auth.signOut();
    navigate(logoutPath, { replace: true });
  };

  return (
    <>
      {children}

      {/* Inactivity Warning Popup */}
      <AnimatePresence>
        {showWarning && !showKicked && (
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
                  <Button
                    variant="outline"
                    className="flex-1 border-primary/30"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleStayLoggedIn}
                  >
                    Stay Logged In
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kicked / Another Device Popup */}
      <AnimatePresence>
        {showKicked && (
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
              className="w-full max-w-sm rounded-2xl border-2 border-destructive/30 bg-background p-6 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <img src="/kob-logo.png" alt={appName} className="h-12 w-12 rounded-xl object-contain opacity-80" />
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center">
                    <ShieldAlert className="h-3 w-3 text-destructive-foreground" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Signed In Elsewhere</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your account was accessed on another device. For security, only one active session is allowed at a time.
                  </p>
                </div>
                <Button className="w-full" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Return to Login
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
