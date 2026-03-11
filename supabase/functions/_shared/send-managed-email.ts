/**
 * Shared helper to send a managed email via the managed-send-email edge function.
 * Non-fatal: logs errors but never throws, so callers' main logic is never blocked.
 */
export async function sendManagedEmail(
  supabase: any,
  params: {
    email_key: string;
    recipient_email?: string;
    recipient_user_id?: string;
    institution_id?: string;
    variables?: Record<string, any>;
  }
) {
  try {
    const { error } = await supabase.functions.invoke('managed-send-email', {
      body: params,
    });
    if (error) {
      console.error(`sendManagedEmail(${params.email_key}) invoke error:`, error);
    }
  } catch (err) {
    console.error(`sendManagedEmail(${params.email_key}) exception:`, err);
  }
}

/**
 * Resolve account reference string for email display.
 */
export async function getAccountRef(supabase: any, accountId: string): Promise<string> {
  try {
    const { data } = await supabase.from('accounts').select('account_id, nickname').eq('id', accountId).single();
    if (data) return data.nickname || `****${(data.account_id || '').slice(-4)}`;
  } catch {}
  return accountId.slice(0, 8);
}

/**
 * Resolve user display name from profiles.
 */
export async function getUserName(supabase: any, userId: string): Promise<string> {
  try {
    const { data } = await supabase.from('profiles').select('full_name, email').eq('id', userId).single();
    if (data) return data.full_name || data.email || 'Customer';
  } catch {}
  return 'Customer';
}

/**
 * Resolve user email from profiles.
 */
export async function getUserEmail(supabase: any, userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('profiles').select('email').eq('id', userId).single();
    return data?.email || null;
  } catch {}
  return null;
}

/**
 * Get branch name.
 */
export async function getBranchName(supabase: any, branchId: string | null): Promise<string> {
  if (!branchId) return 'Head Office';
  try {
    const { data } = await supabase.from('branches').select('branch_name').eq('id', branchId).single();
    return data?.branch_name || 'Branch';
  } catch {}
  return 'Branch';
}

/**
 * Send email notifications to all managers with a specific operational role.
 */
export async function emailManagers(
  supabase: any,
  params: {
    institution_id: string;
    branch_id?: string | null;
    role_type: string;
    email_key: string;
    variables: Record<string, any>;
  }
) {
  try {
    let query = supabase
      .from('institution_operational_roles')
      .select('user_id')
      .eq('institution_id', params.institution_id)
      .eq('role_type', params.role_type)
      .eq('is_active', true);

    if (params.branch_id) {
      query = query.or(`branch_id.eq.${params.branch_id},branch_id.is.null`);
    }

    const { data: managers } = await query;
    if (!managers || managers.length === 0) return;

    for (const mgr of managers) {
      const mgrName = await getUserName(supabase, mgr.user_id);
      await sendManagedEmail(supabase, {
        email_key: params.email_key,
        recipient_user_id: mgr.user_id,
        institution_id: params.institution_id,
        variables: { ...params.variables, manager_name: mgrName },
      });
    }
  } catch (err) {
    console.error(`emailManagers(${params.email_key}) error:`, err);
  }
}
