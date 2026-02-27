import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

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
      const { data, error } = await supabase.functions.invoke('njangi-create', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['njangi-groups', institutionId] }),
    onError: (err: any) => toast.error(err.message),
  });
}

// ─── Join Group ───
export function useJoinNjangiGroup() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { group_id: string }) => {
      const { data, error } = await supabase.functions.invoke('njangi-join', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['njangi-groups', institutionId] }),
    onError: (err: any) => toast.error(err.message),
  });
}

// ─── Contribute ───
export function useNjangiContribute() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { group_id: string }) => {
      const { data, error } = await supabase.functions.invoke('njangi-contribute', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['njangi-groups', institutionId] });
      qc.invalidateQueries({ queryKey: ['credit-score'] });
    },
    onError: (err: any) => toast.error(err.message),
  });
}

// ─── Payout ───
export function useNjangiPayout() {
  const qc = useQueryClient();
  const institutionId = useInstitutionId();
  return useMutation({
    mutationFn: async (body: { group_id: string; recipient_member_id?: string }) => {
      const { data, error } = await supabase.functions.invoke('njangi-payout', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['njangi-groups', institutionId] }),
    onError: (err: any) => toast.error(err.message),
  });
}
