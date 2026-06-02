import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MerchantDailyNeedsOrders from "@/pages/merchant/MerchantDailyNeedsOrders";

// In-memory fixture mutated by the mock to simulate state transitions.
const ORDERS: any[] = [];

const updateMock = vi.fn(async (patch: any) => {
  for (const o of ORDERS) if (o.__match) o.status = patch.status;
  return { error: null };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "merchant-1" } } }) },
    channel: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
    from: (table: string) => {
      if (table === "daily_needs_stores") {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [{ id: "store-1" }], error: null }) }),
        };
      }
      if (table === "daily_needs_orders") {
        const builder: any = {
          select: () => builder,
          in: () => builder,
          order: () => Promise.resolve({ data: ORDERS, error: null }),
          update: (patch: any) => ({ eq: (_c: string, id: string) => {
            for (const o of ORDERS) o.__match = o.id === id;
            return updateMock(patch);
          }}),
        };
        return builder;
      }
      return { select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) };
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><MerchantDailyNeedsOrders /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MerchantDailyNeedsOrders (KDS state transitions)", () => {
  beforeEach(() => {
    ORDERS.length = 0;
    updateMock.mockClear();
  });

  it("renders empty state when no orders", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/no new orders/i)).toBeInTheDocument());
  });

  it("groups orders into the correct lane based on status", async () => {
    ORDERS.push({
      id: "o-ready", status: "ready", total_xaf: 5000,
      delivery_address: "Rue 1", delivery_phone: "+237", created_at: new Date().toISOString(),
      daily_needs_stores: { name: "Store A" }, daily_needs_order_items: [{ id: "i1", quantity: 2, name_snapshot: "Pizza" }],
    });
    renderPage();
    // The lane count badge proves the grouping logic placed the order in "Ready".
    await waitFor(() => expect(screen.getByText(/Ready \(1\)/)).toBeInTheDocument());
    expect(screen.queryByText(/^New \(/)).not.toBeInTheDocument();
  });

  it("dispatches an UPDATE with the next status when the lane action is clicked", async () => {
    ORDERS.push({
      id: "o-new", status: "received", total_xaf: 1000,
      delivery_address: "Rue 2", delivery_phone: null, created_at: new Date().toISOString(),
      daily_needs_stores: { name: "Store B" }, daily_needs_order_items: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/Accept/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/^Accept$/i));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ status: "accepted" }));
  });
});
