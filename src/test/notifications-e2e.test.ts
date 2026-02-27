import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { pusher_key: "", pusher_cluster: "eu" }, error: null }),
    },
  },
}));

describe("useOneSignal hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).OneSignalDeferred = [];
  });

  it("should set up OneSignalDeferred array on window", async () => {
    const { useOneSignal } = await import("@/hooks/useOneSignal");
    renderHook(() => useOneSignal("test-institution"));
    expect(window.OneSignalDeferred).toBeDefined();
    expect(Array.isArray(window.OneSignalDeferred)).toBe(true);
  });

  it("should push a callback to OneSignalDeferred", async () => {
    const { useOneSignal } = await import("@/hooks/useOneSignal");
    renderHook(() => useOneSignal("inst-123"));

    // Allow async register() to run
    await new Promise((r) => setTimeout(r, 100));
    expect(window.OneSignalDeferred!.length).toBeGreaterThan(0);
  });

  it("should call OneSignal.login and addTags in the deferred callback", async () => {
    const { useOneSignal } = await import("@/hooks/useOneSignal");
    renderHook(() => useOneSignal("inst-abc"));

    await new Promise((r) => setTimeout(r, 100));

    const mockOneSignal = {
      login: vi.fn(),
      User: { addTags: vi.fn() },
    };

    const callback = window.OneSignalDeferred![window.OneSignalDeferred!.length - 1];
    await callback(mockOneSignal);

    expect(mockOneSignal.login).toHaveBeenCalledWith("test-user-id");
    expect(mockOneSignal.User.addTags).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "test-user-id",
        institution_id: "inst-abc",
      })
    );
  });
});

describe("useNotifications hook exports", () => {
  it("should export useNotifications function", async () => {
    const mod = await import("@/hooks/useNotifications");
    expect(mod.useNotifications).toBeDefined();
    expect(typeof mod.useNotifications).toBe("function");
  });
});

describe("NotificationCenter component exports", () => {
  it("should export NotificationCenter", async () => {
    const mod = await import("@/components/NotificationCenter");
    expect(mod.NotificationCenter).toBeDefined();
  });
});
