/**
 * useOTPTimers — small UX helper for OTP screens.
 *
 *  - codeExpiresAt: when the current OTP becomes invalid (default 5 min).
 *  - resendAvailableAt: when the user may request a new code (default 60 s).
 *
 * `start()` is called after a successful send; `tick` is recomputed every
 * second so consumers can render a live countdown without their own timer.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface OTPTimersOptions {
  expirySeconds?: number;
  resendCooldownSeconds?: number;
}

export interface OTPTimersState {
  expiresAt: number | null;
  resendAvailableAt: number | null;
  remainingExpiry: number;     // seconds until code expires (0 when expired)
  remainingResend: number;     // seconds until resend allowed (0 when ready)
  isExpired: boolean;
  canResend: boolean;
  start: () => void;
  reset: () => void;
}

export function useOTPTimers(opts: OTPTimersOptions = {}): OTPTimersState {
  const expirySeconds = opts.expirySeconds ?? 300;          // 5 minutes
  const resendCooldownSeconds = opts.resendCooldownSeconds ?? 60;

  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (expiresAt == null && resendAvailableAt == null) return;
    intervalRef.current = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [expiresAt, resendAvailableAt]);

  const start = useCallback(() => {
    const now = Date.now();
    setExpiresAt(now + expirySeconds * 1000);
    setResendAvailableAt(now + resendCooldownSeconds * 1000);
  }, [expirySeconds, resendCooldownSeconds]);

  const reset = useCallback(() => {
    setExpiresAt(null);
    setResendAvailableAt(null);
  }, []);

  const now = Date.now();
  const remainingExpiry = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const remainingResend = resendAvailableAt ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1000)) : 0;

  return {
    expiresAt,
    resendAvailableAt,
    remainingExpiry,
    remainingResend,
    isExpired: expiresAt != null && remainingExpiry === 0,
    canResend: resendAvailableAt == null || remainingResend === 0,
    start,
    reset,
  };
}

export function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
