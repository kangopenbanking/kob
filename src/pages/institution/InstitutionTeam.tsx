import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, Shield, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  permissions: any;
  created_at: string;
  activated_at: string | null;
  email?: string;
  full_name?: string;
}

export default function InstitutionTeam() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }

      // Get all accounts for this institution then their signatories
      const { data: accounts } = await supabase
        .from("accounts").select("id").eq("institution_id", institution.id);

      const accountIds = (accounts || []).map(a => a.id);

      if (accountIds.length > 0) {
        const { data: signatories } = await supabase
          .from("business_account_signatories").select("*").in("account_id", accountIds);

        // Fetch profile info for each
        const userIds = (signatories || []).map(s => s.user_id);
        const { data: profiles } = await supabase
          .from("profiles").select("id, email, full_name").in("id", userIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        const mapped: TeamMember[] = (signatories || []).map(s => ({
          id: s.id,
          user_id: s.user_id,
          role: s.role,
          status: s.status,
          permissions: s.permissions,
          created_at: s.created_at,
          activated_at: s.activated_at,
          email: profileMap.get(s.user_id)?.email || '',
          full_name: profileMap.get(s.user_id)?.full_name || '',
        }));

        setMembers(mapped);
      } else {
        // Show the owner at minimum
        const { data: profile } = await supabase
          .from("profiles").select("id, email, full_name").eq("id", user.id).maybeSingle();

        setMembers([{
          id: 'owner',
          user_id: user.id,
          role: 'owner',
          status: 'active',
          permissions: { all: true },
          created_at: institution ? new Date().toISOString() : '',
          activated_at: new Date().toISOString(),
          email: profile?.email || user.email || '',
          full_name: profile?.full_name || '',
        }]);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner': return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"><Shield className="h-3 w-3 mr-1" />Owner</Badge>;
      case 'admin': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><UserCheck className="h-3 w-3 mr-1" />Admin</Badge>;
      default: return <Badge variant="secondary">{role}</Badge>;
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Team Members</h1>
            <p className="text-muted-foreground">Manage authorized signatories and team access</p>
          </div>
          <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Team ({members.length})</CardTitle>
            <CardDescription>Authorized users with access to this institution</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : members.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {(member.full_name || member.email || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{member.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getRoleBadge(member.role)}
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                        {member.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
