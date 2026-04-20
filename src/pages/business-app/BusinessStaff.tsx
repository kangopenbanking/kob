import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Shield, Edit, Trash2, Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PageGuide } from '@/components/business-app/PageGuide';

const STAFF_ROLES = [
  { value: 'merchant_admin', label: 'Admin', description: 'Full access to all features', color: 'text-violet-600 bg-violet-500/10' },
  { value: 'merchant_manager', label: 'Manager', description: 'Can manage products and orders', color: 'text-sky-600 bg-sky-500/10' },
  { value: 'cashier', label: 'Cashier', description: 'Can process sales only', color: 'text-emerald-600 bg-emerald-500/10' },
];

export default function BusinessStaff() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { merchantId } = useMerchantContext();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('cashier');
  const [invitePin, setInvitePin] = useState('');

  const { data: staff, isLoading } = useQuery({
    queryKey: ['business-staff', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from('merchant_pos_staff')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!merchantId,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!merchantId) throw new Error('Merchant not found');
      if (!inviteEmail || !invitePin) throw new Error('Email and PIN required');
      const { data: staffData, error: staffError } = await supabase
        .from('merchant_pos_staff')
        .insert({
          merchant_id: merchantId,
          user_id: (await supabase.auth.getUser()).data.user?.id || merchantId,
          role: inviteRole as any,
          pin_hash: invitePin,
          status: 'active',
        })
        .select()
        .single();
      if (staffError) throw staffError;
      return staffData;
    },
    onSuccess: () => {
      toast.success('Staff member invited');
      setShowInvite(false);
      setInviteEmail('');
      setInvitePin('');
      queryClient.invalidateQueries({ queryKey: ['business-staff'] });
    },
    onError: (error: any) => toast.error(extractEdgeFunctionError(error, 'Failed to invite staff')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase.from('merchant_pos_staff').delete().eq('id', staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Staff member removed');
      queryClient.invalidateQueries({ queryKey: ['business-staff'] });
    },
    onError: () => toast.error('Failed to remove staff'),
  });

  const handleDelete = (staffId: string) => {
    if (confirm('Remove this staff member?')) deleteMutation.mutate(staffId);
  };

  const activeCount = staff?.filter(s => s.status === 'active').length || 0;

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <PageGuide
        title="Staff Management"
        summary="Invite teammates, assign roles, and control who can sell, manage, or administer your business."
        steps={[
          { title: 'Invite a teammate', description: 'Send an email invite and choose Admin, Manager, or Cashier permissions.' },
          { title: 'Set a secure PIN', description: 'Each staff member receives a PIN used at the till and for sensitive actions.' },
          { title: 'Edit or remove access', description: 'Update roles or revoke access instantly when teammates change or leave.' },
        ]}
      />
      {/* Header */}
      <header className="pt-4 md:pt-0 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Staff</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Manage team access & roles</p>
          </div>
          <Button size="sm" className="rounded-full h-9 px-4 gap-1.5 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-3.5 w-3.5" strokeWidth={2.5} /> Invite
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl border border-border/40 bg-card p-3.5 text-center">
          <p className="text-lg font-bold text-foreground">{staff?.length || 0}</p>
          <p className="text-[11px] text-muted-foreground font-medium">Total</p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3.5 text-center">
          <p className="text-lg font-bold text-emerald-600">{activeCount}</p>
          <p className="text-[11px] text-muted-foreground font-medium">Active</p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-3.5 text-center">
          <p className="text-lg font-bold text-foreground">3</p>
          <p className="text-[11px] text-muted-foreground font-medium">Roles</p>
        </div>
      </div>

      {/* Staff List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : !staff?.length ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
            <Users className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold mb-1">No staff members yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Invite your first team member</p>
          <Button className="rounded-full h-10 px-6 font-semibold bg-foreground text-background hover:bg-foreground/90" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" strokeWidth={2.5} /> Invite Staff
          </Button>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {staff.map((member: any, i: number) => {
              const role = STAFF_ROLES.find(r => r.value === member.role) || STAFF_ROLES[2];
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-2xl border border-border/40 bg-card p-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', role.color.split(' ')[1])}>
                      <Shield className={cn('h-5 w-5', role.color.split(' ')[0])} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-foreground truncate">
                          {member.user_id.substring(0, 8)}...
                        </p>
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                          {member.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {role.label} · {role.description}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
                        <Edit className="h-3.5 w-3.5" strokeWidth={2} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => handleDelete(member.id)}>
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* Invite Sheet */}
      <Sheet open={showInvite} onOpenChange={setShowInvite}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={cn(
          isMobile ? 'max-h-[85vh] rounded-t-[2rem] border-t-0' : 'w-[420px]',
          'overflow-y-auto px-5 pb-10',
        )}>
          <SheetHeader className="pb-2">
            {isMobile && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />}
            <SheetTitle className="text-left text-lg">Invite Staff Member</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email Address</label>
              <Input type="email" placeholder="staff@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="rounded-xl" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role</label>
              <div className="space-y-2">
                {STAFF_ROLES.map(role => (
                  <button
                    key={role.value}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
                      inviteRole === role.value ? 'border-foreground bg-foreground/5' : 'border-border/50 hover:border-border/80'
                    )}
                    onClick={() => setInviteRole(role.value)}
                  >
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', role.color.split(' ')[1])}>
                      <Shield className={cn('h-4 w-4', role.color.split(' ')[0])} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-foreground">{role.label}</p>
                      <p className="text-[11px] text-muted-foreground">{role.description}</p>
                    </div>
                    <div className={cn('h-4 w-4 rounded-full border-2 shrink-0', inviteRole === role.value ? 'border-foreground bg-foreground' : 'border-border')} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">PIN Code (4-6 digits)</label>
              <Input type="password" placeholder="1234" value={invitePin} onChange={(e) => setInvitePin(e.target.value)} maxLength={6} className="rounded-xl" />
              <p className="text-[11px] text-muted-foreground mt-1.5">Staff will use this PIN to access the POS</p>
            </div>

            <Button
              className="w-full rounded-xl h-12 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90"
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail || !invitePin || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? 'Inviting...' : 'Send Invite'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
