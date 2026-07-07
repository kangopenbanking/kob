/**
 * Step-up MFA client helper.
 *
 * Bridges admin pages to the edge functions that enforce step-up:
 * `admin-kyc-review`, `admin-kyb-verify`, `admin-institution-approve`.
 *
 * Those functions return HTTP 401 with `{ code: "STEP_UP_REQUIRED" }` when
 * the caller's JWT has not reached AAL2 within the last 10 minutes.
 *
 * Usage:
 *   const { runWithStepUp, dialogProps } = useStepUp();
 *   ...
 *   <StepUpChallengeDialog {...dialogProps} />
 *   ...
 *   await runWithStepUp(() => supabase.functions.invoke("admin-kyc-review", { body }));
 */
import { useCallback, useState } from "react";

const STEP_UP_CODE = "STEP_UP_REQUIRED";

export interface StepUpDetectionResult {
  triggered: boolean;
  reason?: string;
  message?: string;
}

/**
 * Detects a STEP_UP_REQUIRED response from a Supabase edge function call.
 *
 * Supabase JS v2 exposes the raw `Response` (not the parsed body) on
 * `FunctionsHttpError.context`. The previous `error.context.body` lookup
 * was always `undefined`, so step-up challenges surfaced as a generic
 * "Edge Function returned a non-2xx status code" toast instead of opening
 * the MFA dialog. We now read the body from the Response directly.
 */
export async function detectStepUp(payload: { data?: any; error?: any } | unknown): Promise<StepUpDetectionResult> {
  const obj = payload as { data?: any; error?: any };
  const dataCode = obj?.data?.code ?? obj?.data?.error;
  if (dataCode === STEP_UP_CODE || obj?.data?.error === "step_up_required") {
    return { triggered: true, reason: obj.data?.reason, message: obj.data?.message };
  }
  const ctx = obj?.error?.context;
  if (!ctx) return { triggered: false };
  try {
    let parsed: any = null;
    if (typeof ctx === "string") {
      parsed = JSON.parse(ctx);
    } else if (typeof ctx?.clone === "function" && typeof ctx?.text === "function") {
      const txt = await ctx.clone().text();
      parsed = txt ? JSON.parse(txt) : null;
    } else if (ctx?.body) {
      parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
    }
    if (parsed?.code === STEP_UP_CODE || parsed?.error === "step_up_required") {
      return { triggered: true, reason: parsed?.reason, message: parsed?.message };
    }
  } catch {
    // ignore parse errors
  }
  return { triggered: false };
}

type Runner<T> = () => Promise<T>;

interface PendingChallenge<T> {
  resolve: (val: T) => void;
  reject: (err: unknown) => void;
  runner: Runner<T>;
  detection: StepUpDetectionResult;
}

export interface StepUpDialogProps {
  open: boolean;
  detection: StepUpDetectionResult | null;
  onResolved: () => void;
  onCancelled: () => void;
}

/**
 * React hook that wires the StepUpChallengeDialog into any mutation flow.
 * Call `runWithStepUp(() => supabase.functions.invoke(...))`. If the
 * function returns STEP_UP_REQUIRED, the dialog opens; once the user
 * completes MFA, the original runner is invoked once more.
 */
export function useStepUp() {
  const [pending, setPending] = useState<PendingChallenge<any> | null>(null);

  const runWithStepUp = useCallback(async <T,>(runner: Runner<T>): Promise<T> => {
    const first = await runner();
    const detection = await detectStepUp(first);
    if (!detection.triggered) return first;
    return await new Promise<T>((resolve, reject) => {
      setPending({ resolve, reject, runner: runner as Runner<any>, detection });
    });
  }, []);

  const onResolved = useCallback(async () => {
    if (!pending) return;
    try {
      const retry = await pending.runner();
      const stillBlocked = detectStepUp(retry);
      if (stillBlocked.triggered) {
        pending.reject(new Error(stillBlocked.message || "Step-up still required after MFA"));
      } else {
        pending.resolve(retry);
      }
    } catch (e) {
      pending.reject(e);
    } finally {
      setPending(null);
    }
  }, [pending]);

  const onCancelled = useCallback(() => {
    if (!pending) return;
    pending.reject(new Error("Step-up authentication cancelled"));
    setPending(null);
  }, [pending]);

  const dialogProps: StepUpDialogProps = {
    open: pending !== null,
    detection: pending?.detection ?? null,
    onResolved,
    onCancelled,
  };

  return { runWithStepUp, dialogProps };
}
