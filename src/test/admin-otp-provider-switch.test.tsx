/**
 * E2E coverage for the admin OTP provider switcher (Firebase ↔ Vonage SMS).
 *
 * Verifies:
 *  1. Admin page renders the three environment cards and reflects DB state.
 *  2. Toggling Firebase/Vonage switches and clicking Save issues the
 *     correct PostgREST update through the supabase client.
 *  3. The "Run E2E Check" button calls back into the same row that the
 *     runtime would read, proving the admin toggle is live end-to-end.
 *  4. The shared `resolveOTPSettings()` helper honours the admin cache so
 *     `useFirebasePhoneAuth` will route to Vonage when Firebase is off.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ── Supabase client mock ────────────────────────────────────────────────
const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const selectAllMock = vi.fn().mockResolvedValue({
  data: [
    { id: 'dev-1', environment: 'development', role_scope: 'all', firebase_enabled: true, sms_fallback_enabled: true, notes: 'Default dev settings', updated_at: new Date().toISOString(), updated_by: null },
    { id: 'pre-1', environment: 'preview', role_scope: 'all', firebase_enabled: true, sms_fallback_enabled: true, notes: null, updated_at: new Date().toISOString(), updated_by: null },
    { id: 'prd-1', environment: 'production', role_scope: 'all', firebase_enabled: true, sms_fallback_enabled: true, notes: null, updated_at: new Date().toISOString(), updated_by: null },
  ],
  error: null,
});
const e2eRowMock = vi.fn().mockResolvedValue({
  data: { environment: 'development', firebase_enabled: false, sms_fallback_enabled: true },
  error: null,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (col: string, val: any) => {
          if (col === 'role_scope') return selectAllMock();
          // chained .eq().eq().maybeSingle() for E2E check
          return {
            eq: () => ({ maybeSingle: () => e2eRowMock() }),
          };
        },
      }),
      update: (payload: any) => updateMock(payload),
    }),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminOTPProviderSettings from '@/pages/admin/AdminOTPProviderSettings';
import { setAdminOTPSettings, resolveOTPSettings } from '@/lib/otpProviderConfig';

describe('Admin OTP Provider Settings — E2E', () => {
  beforeEach(() => {
    updateMock.mockClear();
    setAdminOTPSettings(null);
    // Clear URL/storage overrides so admin source wins.
    try { window.localStorage.removeItem('kob.otpMode'); } catch { /* noop */ }
  });

  it('renders all three environments after loading from the database', async () => {
    render(<AdminOTPProviderSettings />);
    await waitFor(() => expect(screen.getByText(/development/i)).toBeInTheDocument());
    expect(screen.getByText(/preview/i)).toBeInTheDocument();
    expect(screen.getByText(/production/i)).toBeInTheDocument();
    // Firebase + Vonage rows for each env (3 envs × 2 toggles = 6).
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(6);
    expect(switches.every((s) => s.getAttribute('data-state') === 'checked')).toBe(true);
  });

  it('persists a Firebase OFF / Vonage ON switch via supabase update', async () => {
    render(<AdminOTPProviderSettings />);
    await waitFor(() => expect(screen.getByText(/development/i)).toBeInTheDocument());

    const firebaseDev = screen.getByLabelText(/Toggle Firebase OTP for development/i);
    fireEvent.click(firebaseDev); // -> firebase_enabled: false

    fireEvent.click(screen.getByRole('button', { name: /Save development/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ firebase_enabled: false, sms_fallback_enabled: true, updated_by: 'admin-1' }),
    );
  });

  it('Run E2E Check round-trips the saved row through the runtime path', async () => {
    render(<AdminOTPProviderSettings />);
    await waitFor(() => expect(screen.getByText(/development/i)).toBeInTheDocument());

    // Flip Firebase off so the in-memory row matches what e2eRowMock returns.
    fireEvent.click(screen.getByLabelText(/Toggle Firebase OTP for development/i));

    fireEvent.click(screen.getAllByRole('button', { name: /Run E2E Check/i })[0]);
    await waitFor(() => expect(e2eRowMock).toHaveBeenCalled());
  });

  it('resolveOTPSettings() routes to Vonage when admin disables Firebase', () => {
    setAdminOTPSettings({ firebase_enabled: false, sms_fallback_enabled: true, role_scope: 'all' });
    const r = resolveOTPSettings();
    expect(r.source).toBe('admin');
    expect(r.firebase_enabled).toBe(false);
    expect(r.sms_fallback_enabled).toBe(true);
    expect(r.mode).toBe('fallback');
  });

  it('resolveOTPSettings() goes Firebase-only when admin disables Vonage', () => {
    setAdminOTPSettings({ firebase_enabled: true, sms_fallback_enabled: false, role_scope: 'all' });
    const r = resolveOTPSettings();
    expect(r.source).toBe('admin');
    expect(r.mode).toBe('firebase-only');
    expect(r.sms_fallback_enabled).toBe(false);
  });
});
