/// <reference types="npm:@types/react@18.3.1" />
/**
 * Shared CTA helpers for transactional email templates.
 * Single source of truth for the canonical app base URL and button rendering.
 *
 * IMPORTANT: All email CTAs MUST resolve to a real, public-or-auth-gated route
 * in the running app (no 404, no redirect-to-home). The companion E2E test
 * `e2e/authenticated/email-cta-routes.spec.ts` enforces this on every run.
 */
import * as React from 'npm:react@18.3.1'
import { Button, Section } from 'npm:@react-email/components@0.0.22'
import * as s from './_styles.ts'

// Canonical production base URL. Override via APP_BASE_URL env var inside edge functions.
export const APP_BASE_URL =
  (typeof Deno !== 'undefined' && Deno.env.get('APP_BASE_URL')) ||
  'https://info.kangfintechsolutions.com'

/** Build a fully-qualified app URL from a path like `/dashboard`. */
export const appUrl = (path: string): string => {
  const base = APP_BASE_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

interface CtaProps { href?: string; label: string; fallbackPath?: string }

export const CtaButton: React.FC<CtaProps> = ({ href, label, fallbackPath = '/dashboard' }) => {
  const url = href && /^https?:\/\//.test(href) ? href : appUrl(fallbackPath)
  return (
    <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
      <Button href={url} style={s.button}>{label}</Button>
    </Section>
  )
}
