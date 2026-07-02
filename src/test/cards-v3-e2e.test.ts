/**
 * cards-v3 — E2E contract test (Virtual, Digital, Physical).
 *
 * These are static-source contract checks that guarantee the consumer
 * card issuance surface stays intact across refactors:
 *   - action router handles issue/list/freeze/unfreeze/terminate/update_limits
 *   - idempotency short-circuit is wired via metadata->>idempotency_key
 *   - structured issuance timeline is persisted + emitted
 *   - customer-facing error copy contains no provider brand names
 *   - customer-facing UI files contain no Nium / Kora references
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fn = fs.readFileSync(
  path.join(root, "supabase/functions/cards-v3/index.ts"),
  "utf8",
);

describe("cards-v3 edge function", () => {
  it("routes every consumer action", () => {
    for (const a of ["issue", "list", "freeze", "unfreeze", "terminate", "update_limits"]) {
      expect(fn).toContain(`case "${a}"`);
    }
  });

  it("supports Virtual, Digital, and Physical form factors", () => {
    expect(fn).toMatch(/\["virtual",\s*"digital",\s*"physical"\]/);
  });

  it("enforces idempotency by matching metadata->>idempotency_key", () => {
    expect(fn).toMatch(/metadata->>idempotency_key/);
    expect(fn).toMatch(/idempotent_replay/);
    expect(fn).toMatch(/X-Idempotent-Replay/);
  });

  it("emits a structured status timeline for tracing", () => {
    expect(fn).toMatch(/card_issue_step/);
    for (const step of [
      "requested",
      "cardholder_ready",
      "provider_issued",
      "persisted",
    ]) {
      expect(fn).toContain(`"${step}"`);
    }
  });

  it("returns consumer-safe error copy (no provider brand names)", () => {
    // Grab all `err(` messages
    const errs = [...fn.matchAll(/err\("[^"]+",\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(errs.length).toBeGreaterThan(0);
    for (const msg of errs) {
      expect(msg.toLowerCase()).not.toContain("nium");
      expect(msg.toLowerCase()).not.toContain("kora");
    }
  });

  it("requires a full shipping address for Physical cards", () => {
    expect(fn).toMatch(/full shipping address is required/i);
  });
});

describe("Customer Cards UI — no provider branding", () => {
  const files = [
    "src/pages/customer-app/CustomerCards.tsx",
    "src/pages/customer-app/CustomerCardOrderPhysical.tsx",
    "src/pages/customer-app/CustomerCardSettings.tsx",
  ];

  for (const f of files) {
    it(`${f} has no user-visible Nium / Kora mentions`, () => {
      const p = path.join(root, f);
      if (!fs.existsSync(p)) return;
      const src = fs.readFileSync(p, "utf8");
      expect(src.toLowerCase()).not.toContain("nium");
      expect(src.toLowerCase()).not.toContain("kora");
    });
  }
});

describe("Customer Cards UI — resilience UX", () => {
  const cards = fs.readFileSync(
    path.join(root, "src/pages/customer-app/CustomerCards.tsx"),
    "utf8",
  );
  const physical = fs.readFileSync(
    path.join(root, "src/pages/customer-app/CustomerCardOrderPhysical.tsx"),
    "utf8",
  );

  it("preserves the idempotency key on retry (CustomerCards)", () => {
    expect(cards).toMatch(/issueAttemptKeys/);
    expect(cards).toMatch(/action:\s*\{\s*label:\s*'Retry'/);
  });

  it("preserves the idempotency key on retry (Physical order)", () => {
    expect(physical).toMatch(/idemKey/);
    expect(physical).toMatch(/action:\s*\{\s*label:\s*'Retry'/);
  });

  it("renders the issuance timeline", () => {
    expect(cards).toMatch(/Last issuance timeline/);
  });
});

describe("cards-v3 — category cap & approval workflow", () => {
  it("enforces a per-category cap constant of 2", () => {
    expect(fn).toMatch(/CARDS_PER_CATEGORY_CAP\s*=\s*2/);
  });

  it("emits card_cap_reached when the cap is hit", () => {
    expect(fn).toContain('"card_cap_reached"');
    expect(fn).toMatch(/eligibility\.reason === "cap_reached"/);
  });

  it("creates an issuance request and returns 202 when re-issuing after deactivation", () => {
    expect(fn).toMatch(/card_issuance_requests/);
    expect(fn).toMatch(/pending_approval:\s*true/);
    expect(fn).toMatch(/"approval_required"/);
  });

  it("honors an approved request on next issue attempt and marks it fulfilled", () => {
    expect(fn).toMatch(/approval_honored/);
    expect(fn).toMatch(/status:\s*"fulfilled"/);
    expect(fn).toMatch(/fulfilled_card_id/);
  });

  it("routes the deactivate action to terminate lifecycle", () => {
    expect(fn).toMatch(/case "deactivate"/);
    expect(fn).toMatch(/actionLifecycle\(sb, ctx, body, "terminate"\)/);
  });

  it("exposes admin approval endpoints", () => {
    for (const a of ["list_requests", "cancel_request", "admin_list_requests", "admin_decide_request"]) {
      expect(fn).toContain(`case "${a}"`);
    }
  });

  it("only lets admins decide requests", () => {
    expect(fn).toMatch(/actionAdminDecideRequest[\s\S]{0,120}!ctx\.isAdmin/);
  });
});

describe("Customer Cards UI — deactivate + approval banners", () => {
  const src = fs.readFileSync(
    path.join(root, "src/pages/customer-app/CustomerCards.tsx"),
    "utf8",
  );

  it("exposes a permanent Deactivate CTA", () => {
    expect(src).toMatch(/Deactivate card permanently/);
    expect(src).toMatch(/handleDeactivate/);
    expect(src).toMatch(/action:\s*pendingAction/);
  });

  it("renders pending and approved request banners", () => {
    expect(src).toMatch(/Awaiting admin approval/);
    expect(src).toMatch(/Request approved/);
    expect(src).toMatch(/list_requests/);
  });

  it("handles pending_approval issue responses without a success toast", () => {
    expect(src).toMatch(/pending_approval/);
    expect(src).toMatch(/awaiting admin approval/i);
  });
});

describe("Customer Cards UI — reveal PIN gating & backgrounds", () => {
  const src = fs.readFileSync(
    path.join(root, "src/pages/customer-app/CustomerCards.tsx"),
    "utf8",
  );
  const picker = fs.readFileSync(
    path.join(root, "src/components/customer-app/CardBackgroundPicker.tsx"),
    "utf8",
  );

  it("checks whether the customer has a transaction PIN before revealing", () => {
    expect(src).toMatch(/customer-has-pin/);
    expect(src).toMatch(/pin_code_hash/);
    expect(src).toMatch(/handleRevealToggle/);
  });

  it("blocks reveal and points to PIN setup when no PIN is set", () => {
    expect(src).toMatch(/Set your transaction PIN to reveal card details/);
    expect(src).toMatch(/\/setup-pin/);
  });

  it("routes reveal through PinConfirmDialog with a reveal-specific title", () => {
    expect(src).toMatch(/pendingAction === 'reveal'/);
    expect(src).toMatch(/Confirm PIN to reveal card/);
  });

  it("wires the top-right lock icon to the reveal toggle (not freeze)", () => {
    expect(src).toMatch(/onClick=\{handleRevealToggle\}/);
    expect(src).toMatch(/aria-label=\{showNumber \? 'Hide card details' : 'Reveal card details'\}/);
  });

  it("exposes a background picker with preset + upload options", () => {
    expect(src).toMatch(/CardBackgroundPicker/);
    expect(src).toMatch(/setBgPickerOpen/);
    expect(picker).toMatch(/PRESET_BACKGROUNDS/);
    expect(picker).toMatch(/Upload image/);
    expect(picker).toMatch(/readAsDataURL/);
  });

  it("renders the selected background as a full-cover image with a legibility overlay", () => {
    expect(src).toMatch(/object-cover/);
    expect(src).toMatch(/bg-\[hsl\(0,0%,0%\)\]\/35/);
  });
});

