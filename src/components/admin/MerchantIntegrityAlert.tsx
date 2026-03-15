import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface OrphanedMerchantRole {
  user_id: string;
  email?: string;
  full_name?: string;
  phone_number?: string;
}

export function MerchantIntegrityAlert() {
  const [orphans, setOrphans] = useState<OrphanedMerchantRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);

  const checkIntegrity = async () => {
    setLoading(true);
    try {
      // Get all users with merchant role
      const { data: merchantRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'merchant' as any);

      if (!merchantRoles?.length) {
        setOrphans([]);
        return;
      }

      // Get all gateway_merchants user_ids
      const { data: merchants } = await supabase
        .from('gateway_merchants')
        .select('user_id');

      const merchantUserIds = new Set(merchants?.map(m => m.user_id) || []);

      // Find orphans: have role but no merchant record
      const orphanedUserIds = merchantRoles
        .filter(r => !merchantUserIds.has(r.user_id))
        .map(r => r.user_id);

      if (orphanedUserIds.length === 0) {
        setOrphans([]);
        return;
      }

      // Get profile info for orphans
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone_number')
        .in('id', orphanedUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      setOrphans(orphanedUserIds.map(uid => ({
        user_id: uid,
        ...(profileMap.get(uid) || {}),
      })));
    } catch (err) {
      console.error('Integrity check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkIntegrity();
  }, []);

  const removeOrphanedRole = async (userId: string) => {
    setFixing(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'merchant' as any);

      if (error) throw error;
      toast.success('Orphaned merchant role removed');
      setOrphans(prev => prev.filter(o => o.user_id !== userId));
    } catch (err) {
      toast.error('Failed to remove role');
    } finally {
      setFixing(null);
    }
  };

  if (loading || orphans.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Data Integrity Issue
        <Badge variant="destructive">{orphans.length}</Badge>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3 text-sm">
          {orphans.length} user(s) have the <strong>merchant</strong> role but no matching merchant record.
          These are likely from failed registrations and should be cleaned up.
        </p>
        <div className="space-y-2">
          {orphans.map(o => (
            <div key={o.user_id} className="flex items-center justify-between bg-background/50 rounded-md p-2 text-sm">
              <div>
                <span className="font-mono text-xs">{o.user_id.substring(0, 8)}…</span>
                {o.email && <span className="ml-2">{o.email}</span>}
                {o.full_name && <span className="ml-2 text-muted-foreground">({o.full_name})</span>}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => removeOrphanedRole(o.user_id)}
                disabled={fixing === o.user_id}
              >
                {fixing === o.user_id ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1" />
                )}
                Remove Role
              </Button>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
