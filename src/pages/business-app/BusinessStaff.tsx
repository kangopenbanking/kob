import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Mail, Shield, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const STAFF_ROLES = [
  { value: 'merchant_admin', label: 'Admin', description: 'Full access to all features' },
  { value: 'merchant_manager', label: 'Manager', description: 'Can manage products and orders' },
  { value: 'cashier', label: 'Cashier', description: 'Can process sales only' },
];

export default function BusinessStaff() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('cashier');
  const [invitePin, setInvitePin] = useState('');

  // Get merchant ID
  useEffect(() => {
    const getMerchantId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: merchant } = await supabase
        .from('gateway_merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (merchant) setMerchantId(merchant.id);
    };
    getMerchantId();
  }, []);

  // Fetch staff
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

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!merchantId) throw new Error('Merchant not found');
      if (!inviteEmail || !invitePin) throw new Error('Email and PIN required');

      // Create staff record with role
      const { data: staffData, error: staffError } = await supabase
        .from('merchant_pos_staff')
        .insert({
          merchant_id: merchantId,
          user_id: (await supabase.auth.getUser()).data.user?.id || merchantId,
          role: inviteRole as any,
          pin_hash: invitePin, // In production, hash this properly
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
    onError: (error: any) => {
      toast.error(error.message || 'Failed to invite staff');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (staffId: string) => {
      // Delete staff
      const { error } = await supabase
        .from('merchant_pos_staff')
        .delete()
        .eq('id', staffId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Staff member removed');
      queryClient.invalidateQueries({ queryKey: ['business-staff'] });
    },
    onError: () => {
      toast.error('Failed to remove staff');
    },
  });

  const handleDelete = (staffId: string) => {
    if (confirm('Remove this staff member?')) {
      deleteMutation.mutate(staffId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}>
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Staff</h1>
              <p className="text-primary-foreground/80 text-sm">Manage team access</p>
            </div>
          </div>
          <Button
            onClick={() => setShowInvite(true)}
            className="bg-white text-primary hover:bg-white/90"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 bg-white/10 border-white/20">
            <p className="text-xs text-primary-foreground/70 mb-1">Total</p>
            <p className="text-2xl font-bold">{staff?.length || 0}</p>
          </Card>
          <Card className="p-3 bg-white/10 border-white/20">
            <p className="text-xs text-primary-foreground/70 mb-1">Active</p>
            <p className="text-2xl font-bold">
              {staff?.filter(s => s.is_active).length || 0}
            </p>
          </Card>
          <Card className="p-3 bg-white/10 border-white/20">
            <p className="text-xs text-primary-foreground/70 mb-1">Roles</p>
            <p className="text-2xl font-bold">3</p>
          </Card>
        </div>
      </div>

      {/* Staff List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : staff?.length === 0 ? (
          <Card className="p-12 text-center">
            <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No staff members yet</h3>
            <p className="text-muted-foreground mb-6">Invite your first team member</p>
            <Button onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Staff
            </Button>
          </Card>
        ) : (
          staff?.map((member: any) => {
            const role = STAFF_ROLES.find(r => r.value === member.merchant_staff_roles?.role);
            return (
              <Card key={member.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{member.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {role?.label || 'Staff'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      member.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {role && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {role.description}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(member.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Email Address</label>
              <Input
                type="email"
                placeholder="staff@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Role</label>
              <div className="space-y-2">
                {STAFF_ROLES.map(role => (
                  <label
                    key={role.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      inviteRole === role.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role.value}
                      checked={inviteRole === role.value}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{role.label}</p>
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">PIN Code (4-6 digits)</label>
              <Input
                type="password"
                placeholder="1234"
                value={invitePin}
                onChange={(e) => setInvitePin(e.target.value)}
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Staff will use this PIN to access the POS
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail || !invitePin || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? 'Inviting...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
