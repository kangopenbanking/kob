import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Users, UserCheck, Shield, Clock, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

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

const resolveInstitutionId = async (userId: string): Promise<string | null> => {
  const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", userId).maybeSingle();
  if (inst) return inst.id;
  const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: userId });
  return staffInst || null;
};

export default function InstitutionTeam() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const institutionId = await resolveInstitutionId(user.id);
      if (!institutionId) { navigate('/register'); return; }

      const { data: accounts } = await supabase
        .from("accounts").select("id").eq("institution_id", institutionId);
      const accountIds = (accounts || []).map(a => a.id);

      if (accountIds.length > 0) {
        const { data: signatories } = await supabase
          .from("business_account_signatories").select("*").in("account_id", accountIds);
        const userIds = (signatories || []).map(s => s.user_id);
        const { data: profiles } = await supabase
          .from("profiles").select("id, email, full_name").in("id", userIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        setMembers((signatories || []).map(s => ({
          id: s.id, user_id: s.user_id, role: s.role, status: s.status,
          permissions: s.permissions, created_at: s.created_at, activated_at: s.activated_at,
          email: profileMap.get(s.user_id)?.email || '', full_name: profileMap.get(s.user_id)?.full_name || '',
        })));
      } else {
        const { data: profile } = await supabase
          .from("profiles").select("id, email, full_name").eq("id", user.id).maybeSingle();
        setMembers([{
          id: 'owner', user_id: user.id, role: 'owner', status: 'active',
          permissions: { all: true }, created_at: new Date().toISOString(), activated_at: new Date().toISOString(),
          email: profile?.email || user.email || '', full_name: profile?.full_name || '',
        }]);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const filtered = members.filter(m =>
    !search || `${m.full_name} ${m.email} ${m.role}`.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner': return <Badge className="bg-primary/10 text-primary border-primary/20"><Shield className="h-3 w-3 mr-1" />Owner</Badge>;
      case 'admin': return <Badge className="bg-secondary/10 text-secondary border-secondary/20"><UserCheck className="h-3 w-3 mr-1" />Admin</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-purple/10 border border-fi-purple/20">
            <Users className="h-5 w-5 text-fi-purple" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
            <p className="text-sm text-muted-foreground">Authorized signatories and team access</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Members", value: members.length, icon: Users, color: "text-fi-purple bg-fi-purple/10 border-fi-purple/20" },
          { label: "Active", value: members.filter(m => m.status === 'active').length, icon: UserCheck, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: "Roles", value: new Set(members.map(m => m.role)).size, icon: Shield, color: "text-fi-blue bg-fi-blue/10 border-fi-blue/20" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Card className="border-border/60">
          <CardContent className="p-0">
            {loading ? <div className="p-6 space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div> : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No team members found</p></div>
            ) : (
              <div className="divide-y divide-border/60">
                {filtered.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {(member.full_name || member.email || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRoleBadge(member.role)}
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                        {member.status}
                      </Badge>
                      {member.activated_at && (
                        <span className="text-[11px] text-muted-foreground hidden md:inline">
                          <Clock className="h-3 w-3 inline mr-1" />{format(new Date(member.activated_at), 'PP')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
