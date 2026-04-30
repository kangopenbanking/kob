import "@testing-library/jest-dom";
import { vi } from "vitest";
import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Browser env shims
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

if (!(globalThis as any).IntersectionObserver) {
  (globalThis as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Centralized chainable Supabase client mock
//
// Eliminates the recurring "supabase.from(...).select(...).eq(...).eq(...)..."
// failures by returning a Proxy-based builder where every method returns the
// same builder (so arbitrarily long chains work) and every terminal awaited
// call resolves to { data: [] | null, error: null }. Individual tests can
// still override @/integrations/supabase/client with vi.mock(...) when they
// need specific data — this mock is the safe global default.
// ─────────────────────────────────────────────────────────────────────────────

export function createChainableSupabaseMock(overrides: Record<string, any> = {}) {
  const terminalResolved = { data: null, error: null, count: null, status: 200, statusText: "OK" };
  const arrayResolved = { data: [], error: null, count: 0, status: 200, statusText: "OK" };

  const makeBuilder = (resolveValue: any = arrayResolved): any => {
    const builder: any = new Proxy(function () {}, {
      get(_t, prop: string) {
        if (prop === "then") {
          return (resolve: any, reject: any) => Promise.resolve(resolveValue).then(resolve, reject);
        }
        if (prop === "catch") return (cb: any) => Promise.resolve(resolveValue).catch(cb);
        if (prop === "finally") return (cb: any) => Promise.resolve(resolveValue).finally(cb);
        if (prop === "single" || prop === "maybeSingle") {
          return () => Promise.resolve(terminalResolved);
        }
        if (prop === "csv") return () => Promise.resolve({ data: "", error: null });
        return () => builder;
      },
      apply() {
        return builder;
      },
    });
    return builder;
  };

  const channel: any = {
    on: () => channel,
    subscribe: (cb?: any) => { cb?.("SUBSCRIBED"); return channel; },
    unsubscribe: () => Promise.resolve("ok"),
    send: () => Promise.resolve("ok"),
  };

  return {
    from: vi.fn(() => makeBuilder()),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signInWithPassword: vi.fn(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
      signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signUp: vi.fn(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
      verifyOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      updateUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: { path: "x" }, error: null })),
        download: vi.fn(() => Promise.resolve({ data: new Blob(), error: null })),
        remove: vi.fn(() => Promise.resolve({ data: [], error: null })),
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.test/x" } })),
        createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: "https://example.test/x" }, error: null })),
      })),
    },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    removeAllChannels: vi.fn(),
    ...overrides,
  };
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: createChainableSupabaseMock(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Global TenantProvider mock — exposes BOTH TenantProvider and useTenant so
// individual banking-app tests don't need to repeat the boilerplate.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock("@/components/pwa/TenantProvider", () => {
  const features = {
    cards: true, savings: true, loans: true, credit_score: true,
    mobile_money: true, qr_payments: true, bill_payments: true,
  };
  const tenant = {
    institutionId: "test-institution",
    name: "Test Bank",
    logoUrl: null,
    primaryColor: "#1a73e8",
    secondaryColor: "#34a853",
    supportPhone: "+237600000000",
    supportEmail: "support@test.bank",
    features,
    homeLayout: {
      show_balance_card: true,
      show_account_carousel: true,
      show_financial_services: true,
      show_recent_transactions: true,
    },
    sectionOrder: [
      "balance_card", "account_carousel", "quick_actions",
      "financial_services", "media_banner", "recent_transactions",
    ],
    layoutStyle: "modern",
    sectionStyles: {},
    mediaSections: [],
    cardColors: { primary: "#1a73e8", secondary: "#34a853" },
  };
  return {
    TenantProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useTenant: () => tenant,
    defaultSectionOrder: tenant.sectionOrder,
  };
});
