import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile React hook.
 *
 * - Lazy-loads the Turnstile script (once per page) when a site key is configured.
 * - Returns { token, getToken, reset, ready, enabled, containerRef }.
 * - If VITE_TURNSTILE_SITE_KEY is unset, hook is a no-op: `enabled === false`, `token === null`,
 *   and `getToken()` resolves to null. Pages should call the backend regardless — backend runs
 *   in shadow mode until TURNSTILE_ENFORCE=true is set.
 *
 * Usage:
 *   const { containerRef, getToken, enabled } = useTurnstile();
 *   ...
 *   <TurnstileWidget /> // renders div with containerRef
 *   const token = await getToken();
 *   invoke('fn', { body: { ...payload, turnstile_token: token } });
 */

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_ID = 'cf-turnstile-script';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'flexible' | 'invisible';
          action?: string;
        },
      ) => string;
      reset: (id?: string) => void;
      getResponse: (id?: string) => string | undefined;
      remove: (id?: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('turnstile_script_failed')), {
        once: true,
      });
      return;
    }
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile_script_failed'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface UseTurnstileOptions {
  action?: string; // e.g. 'developer_register', 'sandbox_create_account'
  theme?: 'light' | 'dark' | 'auto';
}

export function useTurnstile(opts: UseTurnstileOptions = {}) {
  const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const enabled = !!siteKey;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const pendingResolversRef = useRef<Array<(t: string | null) => void>>([]);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(!enabled); // ready=true immediately when disabled

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        // Avoid double-render in StrictMode
        if (widgetIdRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey!,
          action: opts.action,
          theme: opts.theme ?? 'auto',
          size: 'flexible',
          callback: (t: string) => {
            tokenRef.current = t;
            setToken(t);
            const resolvers = pendingResolversRef.current.splice(0);
            resolvers.forEach((r) => r(t));
          },
          'expired-callback': () => {
            tokenRef.current = null;
            setToken(null);
          },
          'error-callback': () => {
            tokenRef.current = null;
            setToken(null);
          },
        });
        setReady(true);
      })
      .catch(() => {
        setReady(true); // unblock UI even if script failed
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_e) {
          /* noop */
        }
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, siteKey]);

  const reset = useCallback(() => {
    tokenRef.current = null;
    setToken(null);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch (_e) {
        /* noop */
      }
    }
  }, []);

  /** Resolve current token or wait up to `timeoutMs` for one. Resolves null when disabled or on timeout. */
  const getToken = useCallback(
    (timeoutMs = 4000): Promise<string | null> => {
      if (!enabled) return Promise.resolve(null);
      if (tokenRef.current) return Promise.resolve(tokenRef.current);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          const idx = pendingResolversRef.current.indexOf(resolve);
          if (idx >= 0) pendingResolversRef.current.splice(idx, 1);
          resolve(null);
        }, timeoutMs);
        pendingResolversRef.current.push((t) => {
          clearTimeout(timer);
          resolve(t);
        });
      });
    },
    [enabled],
  );

  return { containerRef, token, getToken, reset, ready, enabled };
}
