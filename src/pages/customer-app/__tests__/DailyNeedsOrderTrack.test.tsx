import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DailyNeedsOrderTrack from "@/pages/customer-app/DailyNeedsOrderTrack";

// Capture realtime callbacks so the test can fire fake DB change events.
const realtimeCallbacks: Record<string, (p: any) => void> = {};

const orderRef = { current: {
  id: "o-1", status: "accepted", total_xaf: 12000, delivery_code: "1234",
  daily_needs_stores: { name: "Mini-Market" },
} as any };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "daily_needs_orders") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: orderRef.current, error: null }) }) }) };
      }
      if (table === "ddn_assignments") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { id: "a-1", status: "accepted", driver_id: "d-1", pickup_lat: 4, pickup_lng: 9, drop_lat: 4.1, drop_lng: 9.1, eta_min: 12, distance_km: 3 },
          error: null,
        }) }) }) };
      }
      if (table === "ddn_driver_locations") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { lat: 4.05, lng: 9.05 }, error: null }) }) }) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
    channel: (name: string) => {
      const obj: any = {
        on: (_evt: string, cfg: any, cb: (p: any) => void) => {
          realtimeCallbacks[`${name}:${cfg.table}`] = cb;
          return obj;
        },
        subscribe: () => obj,
      };
      return obj;
    },
    removeChannel: () => {},
  },
}));

vi.mock("@/components/daily-needs/LiveDeliveryMap", () => ({
  LiveDeliveryMap: (p: any) => <div data-testid="live-map" data-driver={`${p.driverLat ?? ""},${p.driverLng ?? ""}`} />,
}));
vi.mock("@/components/daily-needs/DeliveryCodeCard", () => ({ DeliveryCodeCard: (p: any) => <div>code:{p.code}</div> }));
vi.mock("@/components/daily-needs/OrderStatusTimeline", () => ({ OrderStatusTimeline: (p: any) => <div>tl:{p.status}</div> }));
vi.mock("@/hooks/useSmoothedEta", () => ({ useSmoothedEta: () => ({ etaMin: 10, distanceKm: 2.5 }) }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/daily-needs/track/o-1"]}>
      <Routes>
        <Route path="/app/daily-needs/track/:id" element={<DailyNeedsOrderTrack />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DailyNeedsOrderTrack (realtime updates)", () => {
  beforeEach(() => {
    for (const k of Object.keys(realtimeCallbacks)) delete realtimeCallbacks[k];
    orderRef.current = { id: "o-1", status: "accepted", total_xaf: 12000, delivery_code: "1234", daily_needs_stores: { name: "Mini-Market" } };
  });

  it("renders order details and the smoothed ETA", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Mini-Market/)).toBeInTheDocument());
    expect(screen.getByText(/ETA ~10 min/)).toBeInTheDocument();
    expect(screen.getByText(/tl:accepted/)).toBeInTheDocument();
  });

  it("re-reads order when realtime fires for daily_needs_orders", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/tl:accepted/)).toBeInTheDocument());

    // Simulate the order moving to "ready" in the database.
    orderRef.current = { ...orderRef.current, status: "ready" };
    await act(async () => {
      realtimeCallbacks["dn-track-o-1:daily_needs_orders"]?.({ new: orderRef.current });
    });

    await waitFor(() => expect(screen.getByText(/tl:ready/)).toBeInTheDocument());
  });

  it("updates the live driver location when ddn_driver_locations changes", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("live-map")).toBeInTheDocument());

    await act(async () => {
      realtimeCallbacks["dn-driver-d-1:ddn_driver_locations"]?.({ new: { lat: 4.2, lng: 9.2 } });
    });

    await waitFor(() => {
      expect(screen.getByTestId("live-map").getAttribute("data-driver")).toBe("4.2,9.2");
    });
  });
});
