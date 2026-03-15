/**
 * Shared helper to notify all admin users via in-app notifications.
 * Non-fatal: logs errors but never throws.
 */

const iconMap: Record<string, string> = {
  'kyb_submitted': 'kyc',
  'kyc_submitted': 'kyc',
  'onboarding_submitted': 'onboarding',
  'merchant_kyb_submitted': 'storefront',
  'tpp_review': 'key',
  'kyb_approved': 'kyc',
  'kyb_rejected': 'kyc',
};

export async function notifyAdmins(
  supabase: any,
  params: {
    event_type: string;
    entity_type: string;
    entity_id: string;
    title: string;
    message: string;
    institution_id?: string;
    metadata?: Record<string, any>;
  }
) {
  try {
    // Get all admin user IDs
    const { data: admins, error: adminError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminError || !admins || admins.length === 0) {
      console.warn('notifyAdmins: No admin users found or query error:', adminError);
      return;
    }

    const icon = iconMap[params.event_type] || 'info';

    const notifications = admins.map((admin: { user_id: string }) => ({
      user_id: admin.user_id,
      type: 'info',
      title: params.title,
      message: params.message,
      icon,
      institution_id: params.institution_id || null,
      metadata: {
        event_type: params.event_type,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        ...(params.metadata || {}),
      },
    }));

    const { error: insertError } = await supabase
      .from('app_notifications')
      .insert(notifications);

    if (insertError) {
      console.error('notifyAdmins: Failed to insert notifications:', insertError);
    }
  } catch (err) {
    console.error('notifyAdmins: Exception:', err);
  }
}

/**
 * Notify a specific user via in-app notification.
 */
export async function notifyUser(
  supabase: any,
  params: {
    user_id: string;
    type: 'success' | 'info' | 'warning';
    title: string;
    message: string;
    icon?: string;
    institution_id?: string;
    metadata?: Record<string, any>;
  }
) {
  try {
    const { error } = await supabase
      .from('app_notifications')
      .insert({
        user_id: params.user_id,
        type: params.type,
        title: params.title,
        message: params.message,
        icon: params.icon || 'info',
        institution_id: params.institution_id || null,
        metadata: params.metadata || {},
      });

    if (error) {
      console.error('notifyUser: Failed to insert notification:', error);
    }
  } catch (err) {
    console.error('notifyUser: Exception:', err);
  }
}
