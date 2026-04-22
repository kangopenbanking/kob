// Lightweight analytics for the Live Support flow.
// Routes events to window.dataLayer / posthog / plausible if present, and always logs to console
// so the flow can be debugged from devtools without any vendor configured.

export type SupportEvent =
  | 'support_widget_opened'
  | 'support_dept_selected'
  | 'support_start_chat_clicked'
  | 'support_validation_failed'
  | 'support_health_check_failed'
  | 'support_conversation_created'
  | 'support_conversation_error';

export function trackSupport(event: SupportEvent, props: Record<string, unknown> = {}) {
  const payload = { event, ts: Date.now(), ...props };
  // eslint-disable-next-line no-console
  console.info('[support.analytics]', payload);
  try {
    const w = window as any;
    if (Array.isArray(w?.dataLayer)) w.dataLayer.push(payload);
    if (typeof w?.posthog?.capture === 'function') w.posthog.capture(event, props);
    if (typeof w?.plausible === 'function') w.plausible(event, { props });
  } catch {
    /* no-op: analytics must never break UX */
  }
}
