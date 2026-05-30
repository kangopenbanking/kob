import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

// --- Mocks ------------------------------------------------------------
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn(async () => ({ data: null, error: null })) } },
}));

const summaryFixture = {
  budget: { id: "b1" },
  summary: {
    total_limit: 300000,
    total_spent: 120000,
    total_remaining: 180000,
    percentage_used: 40,
    days_remaining: 18,
    period_start: "2026-05-01",
    period_end: "2026-05-30",
    categories: [
      { id: "groceries", name: "Groceries", spent: 50000, limit: 80000, percentage_used: 62 },
      { id: "transport", name: "Transport", spent: 40000, limit: 40000, percentage_used: 100 },
      { id: "mobile", name: "Mobile", spent: 5000, limit: 20000, percentage_used: 25 },
      { id: "education", name: "Education", spent: 18000, limit: 20000, percentage_used: 90 },
      { id: "health", name: "Health", spent: 2000, limit: 15000, percentage_used: 13 },
      { id: "utilities", name: "Utilities", spent: 5000, limit: 25000, percentage_used: 20 },
    ],
  },
};

vi.mock("@/hooks/budget/useBudgetApi", () => ({
  useBudget: () => ({ data: summaryFixture, isLoading: false, refetch: vi.fn() }),
  useInsight: () => ({ data: { answer: "Stay on track." }, refetch: vi.fn(), isFetching: false }),
  useGoals: () => ({ data: { goals: [] } }),
  useBudgetAlerts: () => ({ data: { alerts: [] } }),
  useDismissAlert: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/components/budget/SpendingChart", () => ({ SpendingChart: () => <div /> }));
vi.mock("@/components/budget/NjangiWidget", () => ({ NjangiWidget: () => <div /> }));
vi.mock("@/components/budget/RoundupCard", () => ({ RoundupCard: () => <div /> }));
vi.mock("@/components/budget/RoundupSettingsSheet", () => ({ RoundupSettingsSheet: () => null }));
vi.mock("@/components/budget/BudgetSetupSheet", () => ({ BudgetSetupSheet: () => null }));
vi.mock("@/components/budget/GoalCreateSheet", () => ({ GoalCreateSheet: () => null }));
vi.mock("@/components/budget/CategoryEditSheet", () => ({ CategoryEditSheet: () => null }));
vi.mock("@/components/budget/LanguageSelector", () => ({ LanguageSelector: () => <div /> }));
vi.mock("@/components/budget/AnimatedAmount", () => ({
  AnimatedAmount: ({ value }: { value: number }) => <span>{value}</span>,
}));

import CustomerBudget from "../CustomerBudget";

function renderAt(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <CustomerBudget />
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

const VIEWPORTS: Array<[string, number, number]> = [
  ["iPhone SE", 320, 568],
  ["iPhone 12", 390, 844],
  ["Pixel 7", 412, 915],
];

describe("CustomerBudget mobile regression", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  VIEWPORTS.forEach(([name, w, h]) => {
    it(`renders all three mini-donuts on ${name} (${w}x${h})`, () => {
      renderAt(w, h);
      expect(screen.getByTestId("mini-donut-left")).toBeInTheDocument();
      expect(screen.getByTestId("mini-donut-daily")).toBeInTheDocument();
      expect(screen.getByTestId("mini-donut-days")).toBeInTheDocument();
    });

    it(`renders the categories filter and grid on ${name}`, () => {
      renderAt(w, h);
      expect(screen.getByTestId("categories-section")).toBeInTheDocument();
      expect(screen.getByTestId("categories-filter")).toBeInTheDocument();
      expect(screen.getByTestId("categories-grid")).toBeInTheDocument();
    });
  });

  it("uses the corrected strings (Kang Adviser, no PERSONAL INSIGHT)", () => {
    renderAt(390, 844);
    expect(screen.getByText("Kang Adviser")).toBeInTheDocument();
    expect(screen.queryByText(/PERSONAL INSIGHT/i)).not.toBeInTheDocument();
    expect(screen.queryByText("AI Adviser")).not.toBeInTheDocument();
  });

  it("opens the bottom sheet with exact value when a mini-donut is tapped", () => {
    renderAt(390, 844);
    fireEvent.click(screen.getByTestId("mini-donut-left"));
    const sheet = screen.getByTestId("stat-sheet");
    expect(within(sheet).getByText("Remaining this month")).toBeInTheDocument();
    expect(within(sheet).getByTestId("stat-sheet-value")).toBeInTheDocument();
  });

  it("toggles View all / Show less and persists across remounts", () => {
    const first = renderAt(390, 844);
    const toggle = screen.getByTestId("categories-toggle");
    expect(toggle).toHaveTextContent(/View all/i);
    fireEvent.click(toggle);
    expect(screen.getByTestId("categories-toggle")).toHaveTextContent(/Show less/i);
    first.unmount();
    renderAt(390, 844);
    expect(screen.getByTestId("categories-toggle")).toHaveTextContent(/Show less/i);
  });

  // ---- Bottom sheet ARIA + keyboard ---------------------------------
  it("bottom sheet exposes dialog role, aria-modal, and labelled/described ids", () => {
    renderAt(390, 844);
    fireEvent.click(screen.getByTestId("mini-donut-daily"));
    const sheet = screen.getByTestId("stat-sheet");
    expect(sheet.getAttribute("role")).toBe("dialog");
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(sheet.getAttribute("aria-labelledby")).toBe("stat-sheet-title");
    expect(sheet.getAttribute("aria-describedby")).toBe("stat-sheet-desc");
    expect(document.getElementById("stat-sheet-title")).toBeInTheDocument();
    expect(document.getElementById("stat-sheet-desc")).toBeInTheDocument();
  });

  it("closes the bottom sheet when Escape is pressed", () => {
    renderAt(390, 844);
    fireEvent.click(screen.getByTestId("mini-donut-left"));
    expect(screen.getByTestId("stat-sheet")).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement || document.body, { key: "Escape", code: "Escape" });
    // Radix removes the content from the DOM after close animation; assert
    // it is either gone or marked as closed.
    const stillThere = screen.queryByTestId("stat-sheet");
    if (stillThere) {
      expect(stillThere.getAttribute("data-state")).toBe("closed");
    }
  });

  // ---- Analytics events ---------------------------------------------
  it("emits analytics events for tap + open + close of each mini-donut", () => {
    const events: any[] = [];
    const handler = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("kob:analytics", handler);
    renderAt(390, 844);

    (["left", "daily", "days"] as const).forEach((stat) => {
      events.length = 0;
      fireEvent.click(screen.getByTestId(`mini-donut-${stat}`));
      const names = events.map((e) => e.event);
      expect(names).toContain("budget.mini_donut.tap");
      expect(names).toContain("budget.stat_sheet.open");
      expect(events.find((e) => e.event === "budget.mini_donut.tap").stat).toBe(stat);

      events.length = 0;
      fireEvent.keyDown(document.activeElement || document.body, { key: "Escape" });
      // Close fires either via onOpenChange(false) or onEscapeKeyDown — accept either.
      expect(events.some((e) => e.event === "budget.stat_sheet.close")).toBe(true);
    });

    window.removeEventListener("kob:analytics", handler);
  });

  // ---- Filter / view-all persistence across screens + navigation ----
  VIEWPORTS.forEach(([name, w, h]) => {
    it(`persists "Show less / View all" toggle across ${name} viewport unmounts`, () => {
      const first = renderAt(w, h);
      fireEvent.click(screen.getByTestId("categories-toggle"));
      expect(screen.getByTestId("categories-toggle")).toHaveTextContent(/Show less/i);
      first.unmount();
      // Simulate a navigation away + back by remounting at the same size.
      const second = renderAt(w, h);
      expect(screen.getByTestId("categories-toggle")).toHaveTextContent(/Show less/i);
      second.unmount();
    });

    it(`persists category filter selection across ${name} viewport unmounts`, () => {
      localStorage.setItem("kob_budget_cat_filter", "over");
      renderAt(w, h);
      const filter = screen.getByTestId("categories-filter");
      // "Over budget" copy is rendered on the trigger when filter === "over".
      expect(filter.textContent || "").toMatch(/Over/i);
    });
  });

  it("retains filter + view-all state when navigating away and returning", () => {
    const first = renderAt(390, 844);
    fireEvent.click(screen.getByTestId("categories-toggle"));
    expect(screen.getByTestId("categories-toggle")).toHaveTextContent(/Show less/i);
    first.unmount();

    // Render a different screen in between (simulated by an unrelated DOM mount).
    const stub = render(<div data-testid="other-screen">other</div>);
    expect(screen.getByTestId("other-screen")).toBeInTheDocument();
    stub.unmount();

    renderAt(390, 844);
    expect(screen.getByTestId("categories-toggle")).toHaveTextContent(/Show less/i);
  });
});
