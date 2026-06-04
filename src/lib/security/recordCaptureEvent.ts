/**
 * recordCaptureEvent — fire-and-forget POST to the record-capture-event
 * edge function. Failures are swallowed so the security log never breaks
 * the user experience.
 *
 * Per the project's Direct Backend Mandate, this hits the Supabase
 * function URL directly rather than going through a relative path.
 */
import { supabase } from "@/integrations/supabase/client";

const ENDPOINT = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/record-capture-event";

export type CaptureKind =
  | `key:${string}`
  | "contextmenu"
  | "copy"
  | "visibility:hidden"
  | "blur"
  | "native:capture_detected"
  | "native:secured"
  | "native:unsecured"
  | "guard:render";

export interface CaptureEventInput {
  kind: CaptureKind;
  pathname: string;
  appContext: "consumer" | "banking";
  metadata?: Record<string, unknown>;
}

// Coalesce bursts (e.g. PrintScreen autorepeat) into one POST per 1500ms
// per (kind, pathname).
const lastSent = new Map<string, number>();

export function recordCaptureEvent(input: CaptureEventInput): void {
  const key = `${input.kind}|${input.pathname}`;
  const now = Date.now();
  if (now - (lastSent.get(key) ?? 0) < 1500) return;
  lastSent.set(key, now);

  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-trace-id": crypto.randomUUID().replace(/-/g, ""),
      };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      await fetch(ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({
          kind: input.kind,
          pathname: input.pathname,
          app_context: input.appContext,
          metadata: input.metadata ?? {},
        }),
        keepalive: true,
      });
    } catch {
      /* swallow — security telemetry must never break UX */
    }
  })();
}
