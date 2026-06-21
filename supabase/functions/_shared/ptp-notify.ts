// Shared PTP notification + email helper. Inserts an app_notifications row
// and invokes send-transactional-email respecting user preferences.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Admin = ReturnType<typeof createClient>;

const NOTIF_META: Record<string, { title: string; template: string; icon: string }> = {
  created: { title: 'Promise to Pay scheduled', template: 'ptp-created', icon: 'loan' },
  partial: { title: 'Partial payment received', template: 'ptp-partial', icon: 'payment' },
  rescheduled: { title: 'Promise to Pay rescheduled', template: 'ptp-rescheduled', icon: 'loan' },
  kept: { title: 'Promise to Pay kept', template: 'ptp-kept', icon: 'loan' },
  broken: { title: 'Promise to Pay not kept', template: 'ptp-broken', icon: 'loan' },
  swept: { title: 'Promise to Pay overdue', template: 'ptp-broken', icon: 'loan' },
};

export async function notifyPtpEvent(
  admin: Admin,
  event: keyof typeof NOTIF_META,
  promiseId: string,
  userId: string,
  message: string,
  templateData: Record<string, unknown> = {},
) {
  const meta = NOTIF_META[event];
  if (!meta) return;

  // 1. In-app notification (idempotent on promise_id + event)
  try {
    const { data: existing } = await admin
      .from('app_notifications')
      .select('id')
      .eq('user_id', userId)
      .filter('metadata->>promise_id', 'eq', promiseId)
      .filter('metadata->>ptp_event', 'eq', event)
      .limit(1)
      .maybeSingle();
    if (!existing) {
      await admin.from('app_notifications').insert({
        user_id: userId,
        type: event === 'broken' || event === 'swept' ? 'warning' : 'info',
        title: meta.title,
        message,
        icon: meta.icon,
        metadata: { promise_id: promiseId, ptp_event: event, ...templateData },
      });
    }
  } catch (_) { /* non-fatal */ }

  // 2. Email (respect user preferences)
  try {
    const { data: prefs } = await admin
      .from('notification_preferences')
      .select('email_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    if (prefs && prefs.email_enabled === false) return;

    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name, first_name')
      .eq('id', userId)
      .maybeSingle();
    const email = (profile as any)?.email;
    if (!email) return;
    const name = (profile as any)?.first_name || (profile as any)?.full_name || undefined;

    await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: meta.template,
        recipientEmail: email,
        idempotencyKey: `ptp-${event}-${promiseId}`,
        templateData: { name, ...templateData },
      },
    });
  } catch (_) { /* non-fatal */ }
}
