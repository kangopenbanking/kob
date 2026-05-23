import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerBottomNav } from "@/components/customer-app/CustomerBottomNav";
import { DEFAULT_NAV_ITEMS } from "@/hooks/useBottomNavItems";
import { resolveLucideIcon } from "@/lib/lucideIconMap";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/i18n/useHarvestedT", () => ({
  useHarvestedT: () => (s: string) => s,
}));

function renderNav() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/app/home"]}>
        <CustomerBottomNav basePath="/app" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CustomerBottomNav (DB-driven with fallback)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders default nav items when DB returns empty", async () => {
    renderNav();
    // Defaults include Home, Activity, Budget, Scan (center), Accounts, More
    expect(await screen.findByLabelText("Home")).toBeInTheDocument();
    expect(screen.getByLabelText("Activity")).toBeInTheDocument();
    expect(screen.getByLabelText("Budget")).toBeInTheDocument();
    expect(screen.getByLabelText("Scan")).toBeInTheDocument();
    expect(screen.getByLabelText("Accounts")).toBeInTheDocument();
    expect(screen.getByLabelText("More")).toBeInTheDocument();
  });

  it("has exactly one center item by default", () => {
    const centers = DEFAULT_NAV_ITEMS.customer.filter((i) => i.is_center);
    expect(centers).toHaveLength(1);
    expect(centers[0].label).toBe("Scan");
  });

  it("resolves all default icons via lucide map", () => {
    for (const item of DEFAULT_NAV_ITEMS.customer) {
      expect(resolveLucideIcon(item.icon)).toBeDefined();
    }
  });

  it("falls back to Circle for unknown icons", () => {
    const Unknown = resolveLucideIcon("ThisIconDoesNotExist");
    expect(Unknown).toBeDefined();
    expect(Unknown.displayName || Unknown.name).toBe("Circle");
  });
});

describe("Bottom nav reorder logic", () => {
  it("swaps adjacent items and recomputes positions", () => {
    const items = [...DEFAULT_NAV_ITEMS.customer];
    const move = (arr: typeof items, idx: number, dir: -1 | 1) => {
      const next = [...arr];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return next;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((it, i) => ({ ...it, position: i }));
    };
    const moved = move(items, 0, 1);
    expect(moved[0].label).toBe("Activity");
    expect(moved[1].label).toBe("Home");
    expect(moved[0].position).toBe(0);
    expect(moved[1].position).toBe(1);
  });
});
