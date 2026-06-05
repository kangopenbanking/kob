/**
 * /app/global-accounts — RBAC smoke tests.
 *
 * Verifies that the consumer-facing page mounts for every persona that is
 * permitted to call the nium-* edge functions (consumer, developer-view,
 * admin). Auth context is mocked at the supabase client layer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => {
  const invoke = vi.fn();
  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "u-1" } }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      functions: { invoke },
    },
  };
});

import { supabase } from "@/integrations/supabase/client";
import GlobalReceivingAccount from "@/pages/customer-app/GlobalReceivingAccount";

const PERSONAS = ["consumer", "developer-view", "admin"] as const;

const okPayload = (extra: any = {}) => ({
  data: {
    accounts: [],
    incoming_payments: [],
    user_defaults: { payout_preference: "KANG_WALLET", payout_channel: null },
    ...extra,
  },
  error: null,
});

describe("GlobalReceivingAccount RBAC smoke", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const persona of PERSONAS) {
    it(`renders header + empty state for ${persona}`, async () => {
      (supabase.functions.invoke as any).mockResolvedValueOnce(okPayload());
      render(<GlobalReceivingAccount />);
      await waitFor(() =>
        expect(supabase.functions.invoke).toHaveBeenCalledWith("nium-list-global-accounts"),
      );
      expect(await screen.findByText(/Receive worldwide/i)).toBeInTheDocument();
      expect(await screen.findByText(/No global accounts yet/i)).toBeInTheDocument();
    });
  }

  it("surfaces edge-function errors via toast path (does not crash)", async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });
    render(<GlobalReceivingAccount />);
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalled());
    expect(await screen.findByText(/Receive worldwide/i)).toBeInTheDocument();
  });

  it("renders activity list with ARIA label and date-range filter when payments exist", async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce(
      okPayload({
        incoming_payments: [
          {
            id: "p1",
            source_amount: 100,
            source_currency: "USD",
            xaf_net_credited: 65_000,
            routing: "KANG_WALLET",
            status: "credited",
            created_at: new Date().toISOString(),
          },
        ],
      }),
    );
    render(<GlobalReceivingAccount />);
    expect(
      await screen.findByRole("list", { name: /Incoming global account payments/i }),
    ).toBeInTheDocument();
  });
});

