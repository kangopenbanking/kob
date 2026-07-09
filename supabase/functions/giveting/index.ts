// Giveting — fundraising module edge function
// Handles: campaign CRUD, discover, get, donations, updates, comments, withdrawals
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

// Fixed reference FX rates to XAF. XAF/XOF are pegged EUR 1 = 655.957 by BEAC.
const FX_TO_XAF: Record<string, number> = {
  XAF: 1,
  XOF: 1,          // XOF and XAF are 1:1 (both pegged to EUR at same rate)
  EUR: 655.957,
  USD: 605.0,
  GBP: 760.0,
};

function toXAF(amountMinor: number, currency: string): { converted: number; rate: number } {
  const rate = FX_TO_XAF[currency] ?? 1;
  return { converted: Math.round(amountMinor * rate), rate };
}

function convertBetween(amountMinor: number, from: string, to: string): { converted: number; rate: number } {
  if (from === to) return { converted: amountMinor, rate: 1 };
  const fromRate = FX_TO_XAF[from] ?? 1;
  const toRate = FX_TO_XAF[to] ?? 1;
  const rate = fromRate / toRate;
  return { converted: Math.round(amountMinor * rate), rate };
}

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'fundraiser';
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

function svcClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');
  const supabase = svcClient();
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !user) throw new Error('Unauthorized');
  return { user, supabase };
}

// ─────────── Handlers ───────────

async function handleDiscover(body: any) {
  const supabase = svcClient();
  const { search, category, country, limit = 20, offset = 0 } = body;
  let q = supabase
    .from('giveting_campaigns')
    .select('id, slug, title, story, category_slug, currency, goal_amount_minor, total_raised_minor, donor_count, cover_media_url, location_country, location_city, verified_badge, published_at, owner_user_id')
    .eq('status', 'active')
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + Math.min(limit, 50) - 1);
  if (search) q = q.ilike('title', `%${search}%`);
  if (category) q = q.eq('category_slug', category);
  if (country) q = q.eq('location_country', country);
  const { data, error } = await q;
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { campaigns: data ?? [] });
}

async function handleGet(body: any) {
  const supabase = svcClient();
  const { slug } = body;
  if (!slug) return jsonRes(400, { error: 'slug required' });
  const { data: c, error } = await supabase
    .from('giveting_campaigns')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !c) return jsonRes(404, { error: 'not_found' });
  // Owner display name
  const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', c.owner_user_id).maybeSingle();
  return jsonRes(200, { campaign: c, organiser: profile ?? null });
}

async function handleListMine(req: Request) {
  const { user, supabase } = await getAuthUser(req);
  const { data, error } = await supabase
    .from('giveting_campaigns')
    .select('*')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { campaigns: data ?? [] });
}

async function handleCreate(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { title, story, category_slug, currency, goal_amount_minor, cover_media_url, beneficiary_type, beneficiary_name, beneficiary_relation, location_country, location_city } = body;

  if (!title || !category_slug || !goal_amount_minor) {
    return jsonRes(400, { error: 'title, category_slug and goal_amount_minor are required' });
  }
  if (!['XAF', 'XOF', 'EUR', 'USD', 'GBP'].includes(currency)) {
    return jsonRes(400, { error: 'invalid currency' });
  }

  // Verify KYC — approved creators get auto-published live; others go to pending until KYC completes.
  const { data: kyc } = await supabase
    .from('kyc_verifications')
    .select('status')
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .limit(1);
  const kycOk = (kyc?.length ?? 0) > 0;

  const slug = slugify(title);
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('giveting_campaigns')
    .insert({
      owner_user_id: user.id,
      slug,
      title,
      story: story ?? '',
      category_slug,
      currency,
      goal_amount_minor,
      cover_media_url: cover_media_url ?? null,
      beneficiary_type: beneficiary_type ?? 'self',
      beneficiary_name: beneficiary_name ?? null,
      beneficiary_relation: beneficiary_relation ?? null,
      location_country: location_country ?? null,
      location_city: location_city ?? null,
      status: kycOk ? 'active' : 'pending',
      published_at: kycOk ? nowIso : null,
    })
    .select('*')
    .single();
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { campaign: data, kyc_required: !kycOk });
}

async function handleUpdateCampaign(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { id, patch } = body;
  if (!id || !patch) return jsonRes(400, { error: 'id and patch required' });
  // Only allow updating specific fields
  const allowed = ['title', 'story', 'goal_amount_minor', 'cover_media_url', 'gallery', 'location_country', 'location_city', 'beneficiary_name', 'beneficiary_relation'];
  const clean: any = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  const { data, error } = await supabase
    .from('giveting_campaigns')
    .update(clean)
    .eq('id', id)
    .eq('owner_user_id', user.id)
    .select('*')
    .single();
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { campaign: data });
}

async function handlePublish(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { id, idempotency_key } = body;
  if (!id) return jsonRes(400, { error: 'id_required', message: 'Campaign id is required.' });

  // Load & lock the campaign, verify ownership
  const { data: campaign, error: cErr } = await supabase
    .from('giveting_campaigns')
    .select('id, status, owner_user_id, title')
    .eq('id', id)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (cErr) return jsonRes(500, { error: 'lookup_failed', message: cErr.message });
  if (!campaign) return jsonRes(404, { error: 'not_found', message: 'Fundraiser not found.' });

  // Idempotency: if already active, replay the same success
  if (campaign.status === 'active') {
    return jsonRes(200, { campaign, kyc_required: false, replayed: true, message: 'Fundraiser is already live.' });
  }
  if (['archived', 'blocked', 'completed'].includes(campaign.status)) {
    return jsonRes(409, { error: 'invalid_state', message: `This fundraiser is ${campaign.status} and cannot be published.` });
  }

  // Re-verify KYC at the moment of publish (approval may have arrived mid-request)
  const { data: kyc } = await supabase
    .from('kyc_verifications')
    .select('status')
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .limit(1);
  const kycOk = (kyc?.length ?? 0) > 0;

  if (!kycOk) {
    return jsonRes(200, {
      campaign,
      kyc_required: true,
      message: 'Verify your identity to make this fundraiser live.',
    });
  }

  const { data, error } = await supabase
    .from('giveting_campaigns')
    .update({ status: 'active', published_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_user_id', user.id)
    .eq('status', 'pending') // guarded update — no-op if state already changed
    .select('*')
    .maybeSingle();
  if (error) return jsonRes(500, { error: 'publish_failed', message: error.message });

  // Guarded update returned nothing → another writer beat us. Return current state idempotently.
  if (!data) {
    const { data: latest } = await supabase.from('giveting_campaigns').select('*').eq('id', id).maybeSingle();
    return jsonRes(200, { campaign: latest, kyc_required: false, replayed: true, message: 'Fundraiser is already live.' });
  }

  // Reason attribution (surfaces on the audit trail via metadata)
  try {
    await supabase.from('giveting_campaign_events').insert({
      campaign_id: id,
      owner_user_id: user.id,
      event_type: 'status_changed',
      from_status: 'pending',
      to_status: 'active',
      actor_user_id: user.id,
      actor_role: 'owner',
      reason: 'Manual publish',
      metadata: { idempotency_key: idempotency_key ?? null },
    });
  } catch { /* audit is best effort; DB trigger also logs */ }

  return jsonRes(200, { campaign: data, kyc_required: false, message: 'Fundraiser is now live.' });
}

async function handleListEvents(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { campaign_id, limit = 50 } = body;
  if (!campaign_id) return jsonRes(400, { error: 'campaign_id_required' });

  // Ownership check (admin bypass via has_role would apply on the client via RLS if using anon key)
  const { data: c } = await supabase
    .from('giveting_campaigns')
    .select('id, owner_user_id')
    .eq('id', campaign_id)
    .maybeSingle();
  if (!c) return jsonRes(404, { error: 'not_found' });
  if (c.owner_user_id !== user.id) {
    const { data: role } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!role) return jsonRes(403, { error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('giveting_campaign_events')
    .select('*')
    .eq('campaign_id', campaign_id)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 200));
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { events: data ?? [] });
}

async function handleArchive(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { id, status, reason } = body;
  const allowed = ['paused', 'archived', 'active', 'completed'];
  if (!id || !allowed.includes(status)) return jsonRes(400, { error: 'invalid_status' });

  // Closing and reopening both require an auditable reason from the owner.
  const reasonTrimmed = typeof reason === 'string' ? reason.trim() : '';
  if (status === 'completed' && reasonTrimmed.length < 3) {
    return jsonRes(400, {
      error: 'reason_required',
      message: 'Please provide a reason for closing this fundraiser (at least 3 characters).',
    });
  }
  if (status === 'active' && reasonTrimmed.length < 3) {
    return jsonRes(400, {
      error: 'reason_required',
      message: 'Please provide a reason for reopening this fundraiser (at least 3 characters).',
    });
  }

  // Ownership check (explicit, not silent no-op via .eq filter)
  const { data: current, error: loadErr } = await supabase
    .from('giveting_campaigns')
    .select('id, status, owner_user_id, total_raised_minor, currency, published_at')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) return jsonRes(500, { error: 'load_failed', message: loadErr.message });
  if (!current) return jsonRes(404, { error: 'not_found' });
  if (current.owner_user_id !== user.id) return jsonRes(403, { error: 'forbidden', message: 'Only the fundraiser owner can change its status.' });

  // Guard: closing (completed) requires no in-flight withdrawals and zero
  // unwithdrawn balance. This protects donors and prevents accidental
  // close-with-funds-stranded.
  if (status === 'completed') {
    const { count: pendingCount } = await supabase
      .from('giveting_withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id)
      .in('status', ['pending', 'processing']);
    if ((pendingCount ?? 0) > 0) {
      return jsonRes(409, {
        error: 'withdrawals_in_flight',
        message: 'Wait for pending withdrawals to settle before closing this fundraiser.',
      });
    }

    // Sum of settled-and-in-flight withdrawal gross amounts must equal total raised
    const { data: wds } = await supabase
      .from('giveting_withdrawals')
      .select('amount_minor, status')
      .eq('campaign_id', id)
      .in('status', ['settled', 'processing']);
    const withdrawn = (wds ?? []).reduce((acc: number, w: any) => acc + Number(w.amount_minor || 0), 0);
    const raised = Number(current.total_raised_minor || 0);
    if (raised - withdrawn > 0) {
      return jsonRes(409, {
        error: 'unwithdrawn_balance',
        message: 'Withdraw the remaining balance before closing this fundraiser.',
      });
    }
  }

  // Guard: reopen (→ active) is only valid from a non-active terminal-ish state
  if (status === 'active' && !['paused', 'completed', 'archived'].includes(current.status)) {
    return jsonRes(409, { error: 'invalid_transition', message: 'This fundraiser is already active.' });
  }

  const patch: any = { status };
  // On reopen, refresh published_at if it was never set
  if (status === 'active' && !current.published_at) patch.published_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('giveting_campaigns')
    .update(patch)
    .eq('id', id)
    .eq('owner_user_id', user.id) // defence in depth
    .select('*')
    .single();
  if (error) return jsonRes(500, { error: error.message });

  const isCloseEvent = status === 'completed';
  const isReopenEvent = status === 'active' && current.status !== 'active';
  const nowIso = new Date().toISOString();

  // Audit trail — best-effort, non-blocking
  try {
    const reasonText = reasonTrimmed
      || (isReopenEvent ? 'Fundraiser reopened by owner'
        : status === 'paused' ? 'Fundraiser paused by owner'
        : status === 'archived' ? 'Fundraiser archived by owner'
        : 'Status changed by owner');
    await supabase.from('giveting_campaign_events').insert({
      campaign_id: id,
      owner_user_id: current.owner_user_id,
      event_type: 'status_changed',
      from_status: current.status,
      to_status: status,
      actor_user_id: user.id,
      actor_role: 'owner',
      reason: reasonText,
      metadata: {
        reason: reasonText,
        close_reason: isCloseEvent ? reasonTrimmed : undefined,
        reopen_reason: isReopenEvent ? reasonTrimmed : undefined,
        closed_by: isCloseEvent ? user.id : undefined,
        closed_at: isCloseEvent ? nowIso : undefined,
        reopened_by: isReopenEvent ? user.id : undefined,
        reopened_at: isReopenEvent ? nowIso : undefined,
      },
    });
  } catch (_) { /* audit is best effort */ }

  // Notify followers and recent donors on close / reopen — best-effort.
  if (isCloseEvent || isReopenEvent) {
    try {
      const { data: camp } = await supabase
        .from('giveting_campaigns')
        .select('title, slug')
        .eq('id', id)
        .maybeSingle();
      const title = camp?.title ?? 'A fundraiser you follow';
      const slug = camp?.slug ?? '';

      const recipients = new Set<string>();

      const { data: followers } = await supabase
        .from('giveting_followers')
        .select('user_id')
        .eq('campaign_id', id);
      (followers ?? []).forEach((f: any) => f.user_id && recipients.add(f.user_id));

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentDonors } = await supabase
        .from('giveting_donations')
        .select('donor_user_id')
        .eq('campaign_id', id)
        .eq('status', 'succeeded')
        .gte('created_at', ninetyDaysAgo);
      (recentDonors ?? []).forEach((d: any) => d.donor_user_id && recipients.add(d.donor_user_id));

      recipients.delete(user.id);

      if (recipients.size > 0) {
        const notifTitle = isCloseEvent ? 'Fundraiser closed' : 'Fundraiser reopened';
        const notifMessage = isCloseEvent
          ? `"${title}" is no longer accepting donations. Reason: ${reasonTrimmed}`
          : `"${title}" is accepting donations again. ${reasonTrimmed}`;
        const rows = Array.from(recipients).map((uid) => ({
          user_id: uid,
          type: isCloseEvent ? 'warning' : 'info',
          title: notifTitle,
          message: notifMessage,
          icon: 'giveting',
          metadata: {
            campaign_id: id,
            slug,
            event: isCloseEvent ? 'campaign_closed' : 'campaign_reopened',
            reason: reasonTrimmed,
          },
        }));
        for (let i = 0; i < rows.length; i += 500) {
          await supabase.from('app_notifications').insert(rows.slice(i, i + 500));
        }
      }
    } catch (_) { /* notifications are best effort */ }
  }

  return jsonRes(200, { campaign: data });
}


// ─── Donations ───

async function handleDonate(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { campaign_id, amount_minor, currency, tip_minor = 0, comment, is_anonymous = false, idempotency_key } = body;

  if (!campaign_id || !amount_minor || !currency || !idempotency_key) {
    return jsonRes(400, { error: 'campaign_id, amount_minor, currency, idempotency_key required' });
  }
  if (amount_minor < 100) return jsonRes(400, { error: 'amount_too_low' });

  // Idempotency check
  const { data: dupe } = await supabase
    .from('giveting_donations')
    .select('id')
    .eq('idempotency_key', idempotency_key)
    .maybeSingle();
  if (dupe) return jsonRes(200, { donation: dupe, replayed: true });

  // Load campaign
  const { data: campaign, error: cErr } = await supabase
    .from('giveting_campaigns')
    .select('id, currency, status, total_raised_minor, donor_count, owner_user_id')
    .eq('id', campaign_id)
    .maybeSingle();
  if (cErr || !campaign) return jsonRes(404, { error: 'campaign_not_found' });
  if (campaign.status !== 'active') return jsonRes(400, { error: 'campaign_not_active' });

  // Donor wallet (in XAF)
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!account) return jsonRes(400, { error: 'no_wallet' });

  // Convert donation amount to donor wallet currency (XAF for debit)
  const totalDonor = amount_minor + tip_minor;
  const { converted: debitXAFMinor } = convertBetween(totalDonor, currency, 'XAF');
  const debitXAF = debitXAFMinor / 100;

  // Atomic debit
  const { error: debitErr } = await supabase.rpc('atomic_debit_balance', {
    _account_id: account.id,
    _amount: debitXAF,
    _currency: 'XAF',
  });
  if (debitErr) {
    const msg = debitErr.message || 'debit_failed';
    if (msg.includes('Insufficient')) return jsonRes(400, { error: 'insufficient_funds' });
    return jsonRes(500, { error: 'debit_failed', message: msg });
  }

  // Convert amount to campaign currency for cached totals
  const { converted: convertedToCampaign, rate: fxRate } = convertBetween(amount_minor, currency, campaign.currency);

  // Donor display name
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();

  // Record donation
  const { data: donation, error: dErr } = await supabase
    .from('giveting_donations')
    .insert({
      campaign_id,
      donor_user_id: user.id,
      donor_display_name: is_anonymous ? 'Anonymous' : (profile?.full_name ?? null),
      is_anonymous,
      amount_minor,
      currency,
      fx_rate_to_campaign: fxRate,
      converted_amount_minor: convertedToCampaign,
      tip_minor,
      comment: comment ?? null,
      status: 'succeeded',
      source: 'wallet',
      idempotency_key,
    })
    .select('*')
    .single();

  if (dErr) {
    // Best-effort refund
    try {
      await supabase.rpc('atomic_credit_balance', {
        _account_id: account.id,
        _amount: debitXAF,
        _currency: 'XAF',
      });
    } catch (_) { /* best-effort */ }
    return jsonRes(500, { error: 'record_failed', message: dErr.message });
  }

  // Update campaign cached totals
  await supabase
    .from('giveting_campaigns')
    .update({
      total_raised_minor: (campaign.total_raised_minor || 0) + convertedToCampaign,
      donor_count: (campaign.donor_count || 0) + 1,
    })
    .eq('id', campaign_id);

  // Log wallet transaction
  try {
    const { error: txErr } = await supabase.from('transactions').insert({
      account_id: account.id,
      amount: debitXAF,
      currency: 'XAF',
      credit_debit_indicator: 'Debit',
      status: 'Booked',
      booking_datetime: new Date().toISOString(),
      transaction_information: `Giveting donation`,
      transaction_reference: `GIVE-${donation.id.slice(0, 8).toUpperCase()}`,
    });
    if (txErr) console.error('tx log failed', txErr);
  } catch (err) {
    console.error('tx log threw', err);
  }

  return jsonRes(200, { donation });
}

async function handleAddOfflineDonation(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { campaign_id, amount_minor, donor_name, donor_email, comment, is_anonymous = false, idempotency_key } = body;
  if (!campaign_id || !amount_minor || !idempotency_key) return jsonRes(400, { error: 'missing fields' });

  const { data: dupe } = await supabase.from('giveting_donations').select('id').eq('idempotency_key', idempotency_key).maybeSingle();
  if (dupe) return jsonRes(200, { donation: dupe, replayed: true });

  const { data: campaign } = await supabase
    .from('giveting_campaigns')
    .select('id, currency, total_raised_minor, donor_count, owner_user_id')
    .eq('id', campaign_id)
    .maybeSingle();
  if (!campaign) return jsonRes(404, { error: 'campaign_not_found' });
  if (campaign.owner_user_id !== user.id) return jsonRes(403, { error: 'not_owner' });

  const { data: donation, error } = await supabase.from('giveting_donations').insert({
    campaign_id,
    donor_user_id: null,
    donor_display_name: is_anonymous ? 'Anonymous' : (donor_name ?? 'Offline donor'),
    is_anonymous,
    amount_minor,
    currency: campaign.currency,
    fx_rate_to_campaign: 1,
    converted_amount_minor: amount_minor,
    tip_minor: 0,
    comment: comment ?? null,
    status: 'succeeded',
    source: 'offline',
    idempotency_key,
  }).select('*').single();
  if (error) return jsonRes(500, { error: error.message });

  await supabase.from('giveting_campaigns').update({
    total_raised_minor: (campaign.total_raised_minor || 0) + amount_minor,
    donor_count: (campaign.donor_count || 0) + 1,
  }).eq('id', campaign_id);

  return jsonRes(200, { donation });
}

async function handleListDonations(body: any) {
  const supabase = svcClient();
  const { campaign_id, limit = 50, offset = 0 } = body;
  if (!campaign_id) return jsonRes(400, { error: 'campaign_id required' });
  const { data, error } = await supabase
    .from('giveting_donations')
    .select('id, donor_display_name, is_anonymous, amount_minor, currency, converted_amount_minor, comment, created_at, source')
    .eq('campaign_id', campaign_id)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .range(offset, offset + Math.min(limit, 100) - 1);
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { donations: data ?? [] });
}

// ─── Updates ───

async function handlePostUpdate(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { campaign_id, title, body: text, media_url } = body;
  if (!campaign_id || !title || !text) return jsonRes(400, { error: 'missing fields' });
  // Verify ownership
  const { data: c } = await supabase.from('giveting_campaigns').select('owner_user_id').eq('id', campaign_id).maybeSingle();
  if (!c || c.owner_user_id !== user.id) return jsonRes(403, { error: 'not_owner' });
  const { data, error } = await supabase.from('giveting_updates').insert({
    campaign_id, author_user_id: user.id, title, body: text, media_url: media_url ?? null,
  }).select('*').single();
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { update: data });
}

async function handleListUpdates(body: any) {
  const supabase = svcClient();
  const { campaign_id } = body;
  const { data } = await supabase.from('giveting_updates').select('*').eq('campaign_id', campaign_id).order('created_at', { ascending: false });
  return jsonRes(200, { updates: data ?? [] });
}

// ─── Comments ───

async function handlePostComment(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { campaign_id, body: text, donation_id } = body;
  if (!campaign_id || !text) return jsonRes(400, { error: 'missing fields' });
  const { data, error } = await supabase.from('giveting_comments').insert({
    campaign_id, author_user_id: user.id, body: text, donation_id: donation_id ?? null,
  }).select('*').single();
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { comment: data });
}

async function handleListComments(body: any) {
  const supabase = svcClient();
  const { campaign_id } = body;
  const { data } = await supabase.from('giveting_comments').select('*').eq('campaign_id', campaign_id).order('created_at', { ascending: false }).limit(200);
  return jsonRes(200, { comments: data ?? [] });
}

// ─── Withdrawals ───

async function handleWithdraw(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { campaign_id, amount_minor, destination_type = 'wallet', destination_ref, idempotency_key } = body;
  if (!campaign_id || !amount_minor || !idempotency_key) return jsonRes(400, { error: 'missing fields' });

  const { data: dupe } = await supabase.from('giveting_withdrawals').select('*').eq('idempotency_key', idempotency_key).maybeSingle();
  if (dupe) return jsonRes(200, { withdrawal: dupe, replayed: true });

  const { data: campaign } = await supabase.from('giveting_campaigns').select('*').eq('id', campaign_id).maybeSingle();
  if (!campaign || campaign.owner_user_id !== user.id) return jsonRes(403, { error: 'not_owner' });

  // Available balance = total_raised_minor - already withdrawn
  const { data: prior } = await supabase.from('giveting_withdrawals').select('net_minor, fee_minor').eq('campaign_id', campaign_id).in('status', ['pending', 'processing', 'settled']);
  const alreadyOut = (prior ?? []).reduce((sum: number, w: any) => sum + Number(w.net_minor) + Number(w.fee_minor), 0);
  const available = Number(campaign.total_raised_minor) - alreadyOut;
  if (amount_minor > available) return jsonRes(400, { error: 'exceeds_available', available });

  // Fee resolution: unified admin-managed fee_structures via resolveFee.
  // Priority: fee_structures[giveting_platform_fee] → legacy system_config → default.
  const { resolveFee } = await import('../_shared/resolve-fee.ts');
  const legacyCfg = await getWithdrawalFeeConfig();
  const quote = await resolveFee(svcClient(), {
    transaction_type: 'giveting_platform_fee',
    amount: amount_minor,
    fallback: {
      percentage_rate: (legacyCfg.pct_bps ?? 0) / 100, // bps → percent
      fixed_amount: 0,
    },
  });
  const { converted: fixedFeeMinor } = convertBetween(legacyCfg.fixed_minor_xaf ?? 0, 'XAF', campaign.currency);
  const fee_minor = Math.round(quote.final_fee) + fixedFeeMinor;
  const net_minor = amount_minor - fee_minor;
  if (net_minor <= 0) return jsonRes(400, { error: 'amount_below_fee' });

  // Use service client for financial writes so RLS/perm issues on
  // accounts/account_balances/transactions cannot silently fail. The user
  // client above was only used for ownership checks.
  const svc = svcClient();

  const { data: wd, error } = await svc.from('giveting_withdrawals').insert({
    campaign_id,
    requested_by: user.id,
    destination_type,
    destination_ref: destination_ref ?? null,
    amount_minor,
    currency: campaign.currency,
    fee_minor,
    net_minor,
    status: destination_type === 'wallet' ? 'processing' : 'pending',
    idempotency_key,
  }).select('*').single();
  if (error) return jsonRes(500, { error: error.message });

  // If destination is wallet: credit user wallet in XAF. This MUST succeed
  // or we mark the withdrawal as failed so the user can retry — a "settled"
  // withdrawal with no wallet credit is the exact bug we're fixing.
  if (destination_type === 'wallet') {
    const { converted: netXAFMinor } = convertBetween(net_minor, campaign.currency, 'XAF');
    const netXAF = netXAFMinor / 100;

    // Prefer an active account; fall back to the newest account so users
    // whose accounts don't carry an is_active flag still receive funds.
    let { data: account } = await svc
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!account) {
      const { data: any_account } = await svc
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      account = any_account;
    }

    if (!account) {
      await svc.from('giveting_withdrawals').update({
        status: 'failed',
        failure_reason: 'no_wallet_account',
      }).eq('id', wd.id);
      return jsonRes(422, { error: 'no_wallet_account', message: 'No wallet account found for this user.' });
    }

    const { data: creditRes, error: creditErr } = await svc.rpc('atomic_credit_balance', {
      _account_id: account.id,
      _amount: netXAF,
      _currency: 'XAF',
    });
    if (creditErr || !(creditRes as any)?.success) {
      console.error('[giveting.withdraw] wallet credit failed', { creditErr, creditRes, wd_id: wd.id });
      await svc.from('giveting_withdrawals').update({
        status: 'failed',
        failure_reason: creditErr?.message ?? 'credit_failed',
      }).eq('id', wd.id);
      return jsonRes(502, { error: 'wallet_credit_failed', message: creditErr?.message ?? 'Could not credit wallet.' });
    }

    const { error: txErr } = await svc.from('transactions').insert({
      account_id: account.id,
      amount: netXAF,
      currency: 'XAF',
      credit_debit_indicator: 'Credit',
      status: 'Booked',
      booking_datetime: new Date().toISOString(),
      transaction_information: `Giveting withdrawal — ${campaign.title}`,
      transaction_reference: `GIVE-WD-${wd.id.slice(0, 8).toUpperCase()}`,
    });
    if (txErr) console.error('[giveting.withdraw] transaction log failed (non-fatal)', txErr);

    const { data: settled } = await svc.from('giveting_withdrawals').update({
      status: 'settled',
      processed_at: new Date().toISOString(),
    }).eq('id', wd.id).select('*').single();

    return jsonRes(200, { withdrawal: settled ?? wd });
  }

  return jsonRes(200, { withdrawal: wd });
}

async function handleListWithdrawals(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { campaign_id } = body;
  const { data: c } = await supabase.from('giveting_campaigns').select('owner_user_id').eq('id', campaign_id).maybeSingle();
  if (!c || c.owner_user_id !== user.id) return jsonRes(403, { error: 'not_owner' });
  const { data } = await supabase.from('giveting_withdrawals').select('*').eq('campaign_id', campaign_id).order('created_at', { ascending: false });
  return jsonRes(200, { withdrawals: data ?? [] });
}

async function handleCategories() {
  const supabase = svcClient();
  const { data } = await supabase.from('giveting_categories').select('*').eq('active', true).order('sort_order');
  return jsonRes(200, { categories: data ?? [] });
}

// ─── Fee configuration ───

type FeeConfig = { pct_bps: number; fixed_minor_xaf: number };

const DEFAULT_FEE: FeeConfig = { pct_bps: 290, fixed_minor_xaf: 10000 };

async function getWithdrawalFeeConfig(): Promise<FeeConfig> {
  try {
    const supabase = svcClient();
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'giveting.withdrawal_fee')
      .maybeSingle();
    const v = (data?.value ?? {}) as Partial<FeeConfig>;
    const pct = Number.isFinite(v.pct_bps as number) ? Math.max(0, Math.min(5000, Number(v.pct_bps))) : DEFAULT_FEE.pct_bps;
    const fx = Number.isFinite(v.fixed_minor_xaf as number) ? Math.max(0, Math.min(10_000_000, Number(v.fixed_minor_xaf))) : DEFAULT_FEE.fixed_minor_xaf;
    return { pct_bps: pct, fixed_minor_xaf: fx };
  } catch {
    return DEFAULT_FEE;
  }
}

async function handleGetFeeConfig() {
  const cfg = await getWithdrawalFeeConfig();
  return jsonRes(200, { config: cfg });
}

async function handleAdminSetFeeConfig(req: Request, body: any) {
  await assertAdmin(req);
  const supabase = svcClient();
  const pct = Number(body?.pct_bps);
  const fx = Number(body?.fixed_minor_xaf);
  if (!Number.isFinite(pct) || pct < 0 || pct > 5000) return jsonRes(400, { error: 'invalid_pct_bps' });
  if (!Number.isFinite(fx) || fx < 0 || fx > 10_000_000) return jsonRes(400, { error: 'invalid_fixed_minor_xaf' });
  const value = { pct_bps: Math.round(pct), fixed_minor_xaf: Math.round(fx) };
  const { error } = await supabase
    .from('system_config')
    .upsert({ key: 'giveting.withdrawal_fee', value, category: 'giveting', description: 'Withdrawal fee for Giveting fundraisers.' }, { onConflict: 'key' });
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { config: value });
}

// ─── Admin management ───



async function assertAdmin(req: Request) {
  const { user, supabase } = await getAuthUser(req);
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();
  if (!roleRow) throw new Error('forbidden');
  return { user, supabase };
}

async function handleAdminList(req: Request, body: any) {
  await assertAdmin(req);
  const supabase = svcClient();
  const { search, status, category, limit = 50, offset = 0 } = body ?? {};
  let q = supabase
    .from('giveting_campaigns')
    .select('id, slug, title, category_slug, currency, goal_amount_minor, total_raised_minor, donor_count, cover_media_url, location_country, location_city, status, owner_user_id, created_at, published_at, moderation_notes, moderated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Math.min(Number(limit) || 50, 200) - 1);
  if (search) q = q.ilike('title', `%${search}%`);
  if (status) q = q.eq('status', status);
  if (category) q = q.eq('category_slug', category);
  const { data, count, error } = await q;
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { campaigns: data ?? [], total: count ?? 0 });
}

async function handleAdminUpdate(req: Request, body: any) {
  const { user } = await assertAdmin(req);
  const supabase = svcClient();
  const { id, patch } = body ?? {};
  if (!id || !patch || typeof patch !== 'object') return jsonRes(400, { error: 'id and patch required' });
  const allowed = [
    'title', 'story', 'category_slug', 'currency', 'goal_amount_minor',
    'cover_media_url', 'gallery', 'location_country', 'location_city',
    'beneficiary_type', 'beneficiary_name', 'beneficiary_relation',
    'verified_badge', 'moderation_notes',
  ];
  const clean: any = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  if (Object.keys(clean).length === 0) return jsonRes(400, { error: 'no_valid_fields' });
  if ('currency' in clean && !['XAF','XOF','EUR','USD','GBP'].includes(clean.currency)) {
    return jsonRes(400, { error: 'invalid_currency' });
  }
  clean.moderated_by = user.id;
  clean.moderated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('giveting_campaigns')
    .update(clean)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { campaign: data });
}

async function handleAdminSetStatus(req: Request, body: any) {
  const { user } = await assertAdmin(req);
  const supabase = svcClient();
  const { id, status, notes } = body ?? {};
  const allowedStatuses = ['draft','pending','active','paused','blocked','completed','archived'];
  if (!id || !allowedStatuses.includes(status)) return jsonRes(400, { error: 'invalid_status' });
  const patch: any = {
    status,
    moderated_by: user.id,
    moderated_at: new Date().toISOString(),
  };
  if (notes !== undefined) patch.moderation_notes = notes;
  if (status === 'active') {
    const { data: existing } = await supabase
      .from('giveting_campaigns')
      .select('published_at')
      .eq('id', id)
      .maybeSingle();
    if (existing && !existing.published_at) patch.published_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('giveting_campaigns')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return jsonRes(500, { error: error.message });
  return jsonRes(200, { campaign: data });
}

// ─────────── Router ───────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* GET */ }
    const action = body.action;
    if (!action) return jsonRes(400, { error: 'action_required' });

    switch (action) {
      case 'categories': return handleCategories();
      case 'discover': return handleDiscover(body);
      case 'get': return handleGet(body);
      case 'list-mine': return handleListMine(req);
      case 'create': return handleCreate(req, body);
      case 'update': return handleUpdateCampaign(req, body);
      case 'publish': return handlePublish(req, body);
      case 'set-status': return handleArchive(req, body);
      case 'donate': return handleDonate(req, body);
      case 'add-offline-donation': return handleAddOfflineDonation(req, body);
      case 'list-donations': return handleListDonations(body);
      case 'post-update': return handlePostUpdate(req, body);
      case 'list-updates': return handleListUpdates(body);
      case 'post-comment': return handlePostComment(req, body);
      case 'list-comments': return handleListComments(body);
      case 'withdraw': return handleWithdraw(req, body);
      case 'list-withdrawals': return handleListWithdrawals(req, body);
      case 'list-events': return handleListEvents(req, body);
      case 'admin-list': return handleAdminList(req, body);
      case 'admin-update': return handleAdminUpdate(req, body);
      case 'admin-set-status': return handleAdminSetStatus(req, body);
      case 'get-fee-config': return handleGetFeeConfig();
      case 'admin-set-fee-config': return handleAdminSetFeeConfig(req, body);
      default: return jsonRes(400, { error: `unknown_action: ${action}` });
    }
  } catch (err: any) {
    console.error('giveting error:', err?.message);
    const msg = err?.message ?? 'internal_error';
    const status = msg === 'Unauthorized' || msg === 'Missing authorization' ? 401 : 500;
    return jsonRes(status, { error: msg });
  }
});
