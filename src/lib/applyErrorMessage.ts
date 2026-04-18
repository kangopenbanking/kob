// Centralised mapper for pre-approved loan application responses.
// Converts the structured envelope returned by credit-ops `apply-preapproved`
// into a sonner toast payload. Keeps consumer + banking apps consistent.

import { toast } from "sonner";

type ToastAction = { label: string; onClick: () => void };

interface ApplyResponse {
  success?: boolean;
  code?: string;
  message?: string;
  details?: string;
  application_id?: string;
  current_score?: number;
  required_score?: number;
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  product_name?: string;
  institution_name?: string;
  next_step?: { action: string; label: string };
  onboarding?: { apply_path?: string | null; institution_name?: string | null };
  status?: string;
}

interface RouteHelpers {
  navigate: (path: string) => void;
  onScoreCTA?: () => void;       // e.g. trigger free assessment
  onViewApplication?: (id: string) => void;
}

export function showApplyResult(res: ApplyResponse | null | undefined, helpers: RouteHelpers) {
  // Network / unexpected
  if (!res) {
    toast.error("We could not reach the loan service", {
      description: "Please check your connection and try again. No application has been submitted.",
    });
    return;
  }

  // Success
  if (res.success) {
    toast.success(res.message || "Application submitted", {
      description: res.details || `Reference: ${res.application_id?.slice(0, 8) ?? "—"}`,
      duration: 6000,
      action: res.application_id && helpers.onViewApplication
        ? { label: "View status", onClick: () => helpers.onViewApplication?.(res.application_id!) }
        : undefined,
    });
    return;
  }

  // Structured business errors
  switch (res.code) {
    case "ACCOUNT_REQUIRED": {
      const path = res.onboarding?.apply_path;
      toast.message(res.message || "Account required", {
        description: res.details || "Open an account with this bank to continue your loan application.",
        duration: 8000,
        action: path
          ? { label: "Open account", onClick: () => helpers.navigate(path!) }
          : undefined,
      });
      return;
    }

    case "NO_CREDIT_SCORE":
      toast.warning(res.message || "CrediQ score required", {
        description: res.details,
        duration: 8000,
        action: helpers.onScoreCTA
          ? { label: res.next_step?.label || "Start assessment", onClick: helpers.onScoreCTA }
          : undefined,
      });
      return;

    case "SCORE_TOO_LOW":
      toast.warning(res.message || "Your score no longer qualifies", {
        description: res.details,
        duration: 8000,
        action: { label: "View credit tips", onClick: () => helpers.navigate("/app/credit") },
      });
      return;

    case "AMOUNT_OUT_OF_RANGE":
      toast.error(res.message || "Amount out of range", {
        description: res.details,
        duration: 6000,
      });
      return;

    case "DUPLICATE_APPLICATION":
      toast.message(res.message || "Application already submitted", {
        description: res.details,
        duration: 8000,
        action: res.application_id && helpers.onViewApplication
          ? { label: "View status", onClick: () => helpers.onViewApplication!(res.application_id!) }
          : undefined,
      });
      return;

    case "OFFER_EXPIRED":
    case "OFFER_INACTIVE":
    case "OFFER_NOT_FOUND":
      toast.error(res.message || "Offer no longer available", {
        description: res.details || "Please refresh the offers list and pick a current offer.",
        duration: 7000,
      });
      return;

    case "UNAUTHENTICATED":
      toast.error(res.message || "Sign-in required", {
        description: res.details,
        action: { label: "Sign in", onClick: () => helpers.navigate("/app/auth") },
      });
      return;

    case "INVALID_INPUT":
    case "INQUIRY_FAILED":
    case "APPLICATION_FAILED":
    case "OFFER_LOOKUP_FAILED":
    default:
      toast.error(res.message || "Application could not be submitted", {
        description: res.details || "A temporary issue occurred. Please try again in a moment, or contact support if the problem persists.",
        duration: 7000,
      });
      return;
  }
}

// Helper to map a thrown FunctionsHttpError (when network fails altogether)
export function showNetworkApplyError(err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  toast.error("We could not submit your application", {
    description: `Please try again in a moment. (${message})`,
    duration: 7000,
  });
}
