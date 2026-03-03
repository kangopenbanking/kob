import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock supabase before importing components
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user" } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock auth guards
vi.mock("@/components/auth/BankingAppAuthGuard", () => ({
  BankingAppAuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/auth/SessionGuard", () => ({
  SessionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/pwa/BottomNavigation", () => ({
  BottomNavigation: () => <div data-testid="bottom-nav" />,
}));
vi.mock("@/components/pwa/PullToRefresh", () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { TenantProvider, useTenant } from "@/components/pwa/TenantProvider";
import { supabase } from "@/integrations/supabase/client";

// Test helper component that reads the tenant context and renders font multiplier
function FontMultiplierDisplay() {
  const tenant = useTenant();
  return (
    <div data-testid="font-multiplier">{tenant.fontSizeMultiplier}</div>
  );
}

function renderWithTenant(institutionId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/bank/${institutionId}/home`]}>
        <Routes>
          <Route
            path="/bank/:institutionId/home"
            element={
              <TenantProvider>
                <FontMultiplierDisplay />
              </TenantProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Banking App Font Size Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to 0.7 when no app_config is set", async () => {
    const mockFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "inst-1",
          institution_name: "Test Bank",
          logo_url: null,
          primary_color: null,
          tagline: null,
          app_config: null,
        },
        error: null,
      }),
    }));
    (supabase.from as any) = mockFrom;

    const { findByTestId } = renderWithTenant("inst-1");

    const el = await findByTestId("font-multiplier");
    expect(el.textContent).toBe("0.7");
  });

  it("reads font_size_multiplier from app_config when set", async () => {
    const mockFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "inst-2",
          institution_name: "Custom Bank",
          logo_url: null,
          primary_color: null,
          tagline: null,
          app_config: { font_size_multiplier: 1.2 },
        },
        error: null,
      }),
    }));
    (supabase.from as any) = mockFrom;

    const { findByTestId } = renderWithTenant("inst-2");

    const el = await findByTestId("font-multiplier");
    expect(el.textContent).toBe("1.2");
  });

  it("falls back to 0.7 when font_size_multiplier is missing from app_config", async () => {
    const mockFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "inst-3",
          institution_name: "Partial Config Bank",
          logo_url: null,
          primary_color: null,
          tagline: null,
          app_config: { features: { cards: true } },
        },
        error: null,
      }),
    }));
    (supabase.from as any) = mockFrom;

    const { findByTestId } = renderWithTenant("inst-3");

    const el = await findByTestId("font-multiplier");
    expect(el.textContent).toBe("0.7");
  });
});
