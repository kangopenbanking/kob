import React, { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Allowed route prefixes for PWA standalone mode.
 * Users running the app as an installed PWA should only access these routes.
 * All other routes (website, admin, developer portal, etc.) are blocked.
 */
const PWA_ALLOWED_PREFIXES = [
  '/app',
  '/bank/',
  '/pay/',
  '/setup-pin',
  '/biz',
  // Post-login routing: DashboardRouter resolves the user's role and forwards
  // them to the correct portal. These destinations must remain reachable in
  // PWA standalone mode so role-based redirects do not get bounced back.
  '/dashboard',
  '/admin',
  '/merchant',
  '/fi-portal',
  '/developer',
  '/credit-score',
  '/pending-approval',
  '/auth',
  '/kyc-verification',
] as const;

/**
 * Detects whether the app is running in PWA standalone mode
 * (installed to home screen) on any platform.
 */
function isPWAStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((navigator as any).standalone === true) return true;
  if (document.referrer.includes('android-app://')) return true;
  return false;
}

/**
 * Determines which PWA app context the user installed based on session storage.
 */
function getDefaultPWAHome(): string {
  const bankContext = sessionStorage.getItem('pwa_bank_context');
  if (bankContext) return `/bank/${bankContext}/home`;
  return '/app/home';
}

function isAllowedInPWA(pathname: string): boolean {
  return PWA_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

interface Props {
  children: React.ReactNode;
}

/**
 * PWARouteGuard
 *
 * When the app is running in PWA standalone mode (installed on device),
 * this guard prevents navigation to website-only routes and redirects
 * users back to the appropriate app home page.
 *
 * In normal browser mode, this guard is transparent (no-op).
 */
export const PWARouteGuard: React.FC<Props> = ({ children }) => {
  const { pathname } = useLocation();
  const standalone = useMemo(() => isPWAStandalone(), []);

  // Track banking context in session storage for redirect purposes
  useEffect(() => {
    const bankMatch = pathname.match(/^\/bank\/([^/]+)/);
    if (bankMatch) {
      sessionStorage.setItem('pwa_bank_context', bankMatch[1]);
    }
  }, [pathname]);

  if (standalone && !isAllowedInPWA(pathname)) {
    return <Navigate to={getDefaultPWAHome()} replace />;
  }

  return <>{children}</>;
};
