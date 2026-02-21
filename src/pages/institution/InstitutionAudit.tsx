import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Shield, Activity, ScrollText } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionAudit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: audit } = await supabase.from("audit_logs").select("*").eq("performed_by", user.id).order("created_at", { ascending: false }).limit(200);
      setAuditLogs(audit || []);
      const { data: security } = await supabase.from("security_audit_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
      setSecurityLogs(security || []);
    } catch (error) { console.error("Error loading audit logs:", error); }
    finally { setLoading(false); }
  };

  const filteredAudit = auditLogs.filter(l => !searchTerm || l.action_type?.toLowerCase().includes(searchTerm.toLowerCase()) || l.entity_type?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSecurity = securityLogs.filter(l => !searchTerm || l.event_type?.toLowerCase().includes(searchTerm.toLowerCase()) || l.event_category?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><ScrollText className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Audit Trail</h1>
            <p className="text-xs text-muted-foreground">Activity logs and security events</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search logs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: "Audit Events", value: auditLogs.length, icon: Activity },
          { label: "Security Events", value: securityLogs.length, icon: Shield },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted"><s.icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="audit" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Audit Logs</TabsTrigger>
          <TabsTrigger value="security" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Security Events</TabsTrigger>
        </TabsList>

        <TabsContent value="audit"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Audit Logs</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : filteredAudit.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Activity className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No audit logs</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Action</TableHead><TableHead className="text-xs">Entity Type</TableHead><TableHead className="text-xs">Entity ID</TableHead><TableHead className="text-xs">IP Address</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
              <TableBody>{filteredAudit.map(l => (<TableRow key={l.id}><TableCell><Badge variant="outline" className="text-[10px]">{l.action_type}</Badge></TableCell><TableCell className="text-sm">{l.entity_type}</TableCell><TableCell className="font-mono text-xs max-w-[150px] truncate text-muted-foreground">{l.entity_id}</TableCell><TableCell className="text-sm">{l.ip_address || '--'}</TableCell><TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), 'PPp')}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="security"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Security Events</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : filteredSecurity.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Shield className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No security events</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Event</TableHead><TableHead className="text-xs">Category</TableHead><TableHead className="text-xs">Risk Score</TableHead><TableHead className="text-xs">Blocked</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
              <TableBody>{filteredSecurity.map(l => (<TableRow key={l.id}><TableCell><Badge variant="outline" className="text-[10px]">{l.event_type}</Badge></TableCell><TableCell className="text-sm">{l.event_category}</TableCell><TableCell><Badge variant={l.risk_score > 50 ? "destructive" : l.risk_score > 20 ? "secondary" : "outline"} className="text-[10px]">{l.risk_score ?? 0}</Badge></TableCell><TableCell>{l.blocked ? <Badge variant="destructive" className="text-[10px]">Blocked</Badge> : <Badge variant="secondary" className="text-[10px]">Allowed</Badge>}</TableCell><TableCell className="text-xs text-muted-foreground">{l.created_at ? format(new Date(l.created_at), 'PPp') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
