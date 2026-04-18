import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

function useInstitutionId() {
  const { institutionId } = useParams();
  return institutionId;
}

// ─── Njangi Groups ───
export function useNjangiGroups() {
  const institutionId = useInstitutionId();
  return useQuery({
    queryKey: ['njangi-groups', institutionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get groups where user is a member
      const { data: memberships } = await supabase
        .from('njangi_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (!memberships || memberships.length === 0) return [];

      const groupIds = memberships.map(m => m.group_id);

      let query = supabase
        .from('njangi_groups')
        .select('*, njangi_members(*)')
        .in('id', groupIds)
        .order('created_at', { ascending: false });

      if (institutionId) query = query.eq('institution_id', institutionId);

      const { data, error } = await query;
      if (error) throw error;

      // Attach current user id for creator check
      return (data || []).map(g => ({ ...g, _currentUserId: user.id }));
    },
  });
}

// ─── Create Group ───
export function useCreateNjangiGroup() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await supabase.functions.invoke('njangi-ops', {
        body: { action: 'create', ...body },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['njangi-groups', institutionId] });
      toast.success('Njangi group created! Share the group ID to invite members.');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not create group. Please try again.')),
  });
}

// ─── Join Group ───
export function useJoinNjangiGroup() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { group_id: string }) => {
      const { data, error } = await supabase.functions.invoke('njangi-ops', {
        body: { action: 'join', ...body },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['njangi-groups', institutionId] });
      toast.success('You have joined the Njangi group successfully! 🤝');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not join group. It may be full or no longer active.')),
  });
}

// ─── Leave Group ───
export function useLeaveNjangiGroup() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { group_id: string }) => {
      const { data, error } = await supabase.functions.invoke('njangi-ops', {
        body: { action: 'leave', ...body },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['njangi-groups', institutionId] });
      toast.success(data?.deleted ? 'Group deleted.' : 'You have left the circle.');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not leave the group.')),
  });
}

// ─── Contribute ───
export function useNjangiContribute() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { group_id: string }) => {
      const idempotencyKey = `njangi_contrib_${body.group_id}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('njangi-ops', {
        body: { action: 'contribute', ...body, idempotency_key: idempotencyKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['njangi-groups', institutionId] });
      qc.invalidateQueries({ queryKey: ['credit-score'] });
      toast.success('Contribution recorded! Your credit score may be positively impacted. 📈');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Contribution failed. Please ensure you have sufficient funds.')),
  });
}

// ─── Payout ───
export function useNjangiPayout() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { group_id: string; recipient_member_id?: string }) => {
      const idempotencyKey = `njangi_payout_${body.group_id}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('njangi-ops', {
        body: { action: 'payout', ...body, idempotency_key: idempotencyKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['njangi-groups', institutionId] });
      qc.invalidateQueries({ queryKey: ['credit-score'] });
      toast.success('Payout processed! Funds have been transferred to the recipient.');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Payout failed. Please ensure the group has sufficient collected funds.')),
  });
}
