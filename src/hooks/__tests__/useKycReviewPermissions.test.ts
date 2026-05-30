import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockIn = vi.fn();
const mockEq = vi.fn(() => ({ in: mockIn }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockGetUser = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import {
  useKycReviewPermissions,
  KYC_REVIEWER_ROLES,
} from "@/hooks/useKycReviewPermissions";

describe("useKycReviewPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns canReview=false when there is no signed-in user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { result } = renderHook(() => useKycReviewPermissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canReview).toBe(false);
    expect(result.current.roles).toEqual([]);
  });

  it("returns canReview=true for admin role", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-admin" } } });
    mockIn.mockResolvedValueOnce({ data: [{ role: "admin" }], error: null });
    const { result } = renderHook(() => useKycReviewPermissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canReview).toBe(true);
    expect(result.current.roles).toContain("admin");
  });

  it("returns canReview=true for compliance_officer", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-co" } } });
    mockIn.mockResolvedValueOnce({ data: [{ role: "compliance_officer" }], error: null });
    const { result } = renderHook(() => useKycReviewPermissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canReview).toBe(true);
  });

  it("returns canReview=false when the user has no reviewer role", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-personal" } } });
    mockIn.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(() => useKycReviewPermissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canReview).toBe(false);
  });

  it("KYC_REVIEWER_ROLES matches the server-side allowlist", () => {
    // Mirrors the PLATFORM_REVIEWER_ROLES + 'institution' set in
    // supabase/functions/admin-kyc-review/index.ts. If this drifts, the UI
    // and the edge function will disagree about who can review.
    expect([...KYC_REVIEWER_ROLES].sort()).toEqual(
      ["admin", "compliance_officer", "institution", "moderator"].sort(),
    );
  });
});
