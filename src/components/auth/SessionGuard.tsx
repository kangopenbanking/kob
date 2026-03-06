import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SessionWarningPopup } from './SessionWarningPopup';
import { SessionKickedPopup } from './SessionKickedPopup';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity
const WARNING_MS = 60 * 1000; // 1-minute warning before logout
const SESSION_CHECK_MS = 30 * 1000; // fallback poll every 30s
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const;

interface Props {
  children: React.ReactNode;
  logoutPath?: string;
  appName?: string;
  appContext?: string;
}

export const SessionGuard: React.FC<Props> = ({
  children,
  logoutPath = '/auth',
  appName = 'Kang',
  appContext = 'customer',
}) => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [showKicked, setShowKicked] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [kickedDevice, setKickedDevice] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const warningTimerRef = useRef<ReturnType<typeof setInterval>>();
  const sessionCheckRef = useRef<ReturnType<typeof setInterval>>();
  const sessionIdRef = useRef<string>();
  const userIdRef = useRef<string>();

  // ---- session registration ----
  const registerSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const sid = session.access_token.slice(-16);
      sessionIdRef.current = sid;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) userIdRef.current = user.id;

      const deviceInfo = `${navigator.userAgent.slice(0, 80)} | ${new Date().toISOString()}`;
      await supabase.functions.invoke('enforce-single-session', {
        body: { session_id: sid, device_info: deviceInfo, app_context: appContext },
      });
    } catch (e) {
      console.error('Session registration error:', e);
    }
  }, [appContext]);

  // ---- handle being kicked ----
  const handleKicked = useCallback((deviceInfo?: string) => {
    if (showKicked) return; // already showing
    setKickedDevice(deviceInfo || null);
    setShowKicked(true);
  }, [showKicked]);

  // ---- session validity poll (fallback) ----
  const checkSessionValidity = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        handleKicked();
        return;
      }

      const sid = sessionIdRef.current;
      if (!sid) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        handleKicked();
        return;
      }

      const { data: activeSessions } = await supabase
        .from('user_active_sessions')
        .select('session_id, device_info')
        .eq('user_id', user.id)
        .eq('app_context', appContext)
        .order('last_active_at', { ascending: false })
        .limit(1);

      if (activeSessions && activeSessions.length > 0 && activeSessions[0].session_id !== sid) {
        handleKicked(activeSessions[0].device_info || undefined);
      }
    } catch {
      // network error — ignore, will retry
    }
  }, [appContext, handleKicked]);

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

  // ---- Realtime subscription for instant detection ----
  useEffect(() => {
    const uid = userIdRef.current;
    if (!uid) return;

    const channel = supabase
      .channel(`session-guard-${appContext}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_active_sessions',
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          const newRow = payload.new as { session_id: string; app_context: string; device_info?: string };
          if (
            newRow.app_context === appContext &&
            newRow.session_id !== sessionIdRef.current
          ) {
            handleKicked(newRow.device_info || undefined);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appContext, handleKicked]);

  // Also subscribe after registerSession sets userIdRef
  useEffect(() => {
    if (!userIdRef.current) {
      // Re-check after a short delay for the async registerSession
      const t = setTimeout(() => {
        // force re-render to pick up userIdRef
        setCountdown((c) => c);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, []);

  // Fallback poll session validity
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
    try {
      await supabase.auth.signOut();
    } catch {
      // Session may already be invalidated remotely — safe to ignore
    }
    navigate(logoutPath, { replace: true });
  };

  return (
    <>
      {children}
      <SessionWarningPopup
        show={showWarning && !showKicked}
        countdown={countdown}
        appName={appName}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={handleLogout}
      />
      <SessionKickedPopup
        show={showKicked}
        appName={appName}
        deviceInfo={kickedDevice}
        onLogout={handleLogout}
      />
    </>
  );
};
