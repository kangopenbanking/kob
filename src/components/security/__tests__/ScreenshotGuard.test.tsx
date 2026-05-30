/**
 * Vitest unit tests for the screenshot deterrent layer:
 *   - ScreenshotGuard activates on financial routes and renders the
 *     forensic watermark.
 *   - PrintScreen / Cmd+P intercepted, contextmenu blocked, clipboard
 *     cleared.
 *   - Body is blurred on visibility hide / window blur.
 *   - SecureField subtree disables contextmenu/copy/drag.
 *   - BalanceReveal masks by default and re-masks after the configured
 *     timeout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ---- Mocks ----------------------------------------------------------
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "abcd-1234-5678-90ef", user_metadata: { full_name: "Test Holder" } } } })),
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: "Test Holder", phone_number: "+237600000412" } }) }) }),
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: { warning: vi.fn() },
}));

vi.mock("@/lib/security/recordCaptureEvent", () => ({
  recordCaptureEvent: vi.fn(),
}));

vi.mock("@/lib/security/secureView", () => ({
  SecureView: {
    enable: vi.fn(async () => ({ ok: true })),
    disable: vi.fn(async () => ({ ok: true })),
    addListener: vi.fn(async () => ({ remove: async () => {} })),
  },
  isNativeShell: () => false,
}));

import { ScreenshotGuard } from "@/components/security/ScreenshotGuard";
import { SecureField } from "@/components/security/SecureField";
import { BalanceReveal } from "@/components/security/BalanceReveal";
import { recordCaptureEvent } from "@/lib/security/recordCaptureEvent";
import { toast } from "sonner";

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ScreenshotGuard />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-kob-secure");
  document.documentElement.removeAttribute("data-kob-secure-hide");
  vi.clearAllMocks();
});

describe("ScreenshotGuard", () => {
  it("does NOT activate on a non-financial route", () => {
    renderAtPath("/app/more/help");
    expect(screen.queryByTestId("screenshot-watermark")).not.toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-kob-secure")).toBeNull();
  });

  it("activates and renders the forensic watermark on a financial route", async () => {
    renderAtPath("/app/home");
    // Identity hook is async — wait a microtask for it to resolve.
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("screenshot-watermark")).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-kob-secure")).toBe("1");
  });

  it("respects SCREENSHOT_GUARD_OPT_OUT for help/support routes", () => {
    renderAtPath("/app/more/help");
    expect(screen.queryByTestId("screenshot-watermark")).not.toBeInTheDocument();
  });

  it("intercepts PrintScreen, warns the user, and logs an event", () => {
    renderAtPath("/app/home");
    const evt = new KeyboardEvent("keydown", { key: "PrintScreen", bubbles: true, cancelable: true });
    window.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    expect(toast.warning).toHaveBeenCalled();
    expect(recordCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "key:PrintScreen", appContext: "consumer" }),
    );
  });

  it("blocks contextmenu and copy on protected routes", () => {
    renderAtPath("/app/transfer");
    const ctx = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    window.dispatchEvent(ctx);
    expect(ctx.defaultPrevented).toBe(true);
    expect(recordCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "contextmenu" }),
    );
  });

  it("blurs the body when the document visibility changes to hidden", () => {
    renderAtPath("/app/home");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(document.documentElement.getAttribute("data-kob-secure-hide")).toBe("1");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(document.documentElement.getAttribute("data-kob-secure-hide")).toBeNull();
  });

  it("activates for banking PWA routes with the correct app context", () => {
    renderAtPath("/bank/inst-123/home");
    const evt = new KeyboardEvent("keydown", { key: "PrintScreen", bubbles: true, cancelable: true });
    window.dispatchEvent(evt);
    expect(recordCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ appContext: "banking" }),
    );
  });
});

describe("SecureField", () => {
  it("renders mask when revealed=false", () => {
    render(
      <SecureField field="acct" revealed={false} mask={<span data-testid="m">hidden</span>}>
        <span data-testid="v">12345</span>
      </SecureField>,
    );
    expect(screen.getByTestId("m")).toBeInTheDocument();
    expect(screen.queryByTestId("v")).not.toBeInTheDocument();
  });

  it("blocks contextmenu, copy and drag at the subtree level", () => {
    render(
      <SecureField field="acct">
        <span data-testid="v">12345</span>
      </SecureField>,
    );
    const span = screen.getByTestId("v");
    const ctx = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    span.dispatchEvent(ctx);
    expect(ctx.defaultPrevented).toBe(true);
  });
});

describe("BalanceReveal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("masks the value by default", () => {
    render(<BalanceReveal value="1 250 000 XAF" field="balance" />);
    expect(screen.getByTestId("balance-reveal-mask-balance")).toBeInTheDocument();
    expect(screen.queryByTestId("balance-reveal-value-balance")).not.toBeInTheDocument();
  });

  it("reveals on tap and auto re-masks after the timeout", () => {
    render(<BalanceReveal value="1 250 000 XAF" field="balance" revealMs={3000} />);
    fireEvent.click(screen.getByTestId("balance-reveal-mask-balance"));
    expect(screen.getByTestId("balance-reveal-value-balance")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3100); });
    expect(screen.getByTestId("balance-reveal-mask-balance")).toBeInTheDocument();
  });

  it("re-masks when the document visibility changes to hidden", () => {
    render(<BalanceReveal value="1 250 000 XAF" field="balance" />);
    fireEvent.click(screen.getByTestId("balance-reveal-mask-balance"));
    expect(screen.getByTestId("balance-reveal-value-balance")).toBeInTheDocument();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.getByTestId("balance-reveal-mask-balance")).toBeInTheDocument();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });
});
