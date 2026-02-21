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
import { RefreshCw, Search, Shield, Activity } from "lucide-react";
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

      const { data: audit } = await supabase
        .from("audit_logs").select("*").eq("performed_by", user.id).order("created_at", { ascending: false }).limit(200);
      setAuditLogs(audit || []);

      const { data: security } = await supabase
        .from("security_audit_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
      setSecurityLogs(security || []);
    } catch (error) {
      console.error("Error loading audit logs:", error);
    } finally { setLoading(false); }
  };

  const filteredAudit = auditLogs.filter(l =>
    !searchTerm || l.action_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.entity_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSecurity = securityLogs.filter(l =>
    !searchTerm || l.event_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.event_category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Trail</h1>
          <p className="text-muted-foreground">Activity logs and security events</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search logs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Audit Events</CardTitle><Activity className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : auditLogs.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Security Events</CardTitle><Shield className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : securityLogs.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="security">Security Events</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <Card><CardHeader><CardTitle>Audit Logs</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : filteredAudit.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Activity className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No audit logs</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Entity Type</TableHead><TableHead>Entity ID</TableHead><TableHead>IP Address</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>{filteredAudit.map(l => (
                  <TableRow key={l.id}>
                    <TableCell><Badge variant="outline">{l.action_type}</Badge></TableCell>
                    <TableCell>{l.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[150px] truncate">{l.entity_id}</TableCell>
                    <TableCell>{l.ip_address || '—'}</TableCell>
                    <TableCell>{format(new Date(l.created_at), 'PPp')}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="security">
          <Card><CardHeader><CardTitle>Security Events</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : filteredSecurity.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Shield className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No security events</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Category</TableHead><TableHead>Risk Score</TableHead><TableHead>Blocked</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>{filteredSecurity.map(l => (
                  <TableRow key={l.id}>
                    <TableCell><Badge variant="outline">{l.event_type}</Badge></TableCell>
                    <TableCell>{l.event_category}</TableCell>
                    <TableCell><Badge variant={l.risk_score > 50 ? "destructive" : l.risk_score > 20 ? "secondary" : "outline"}>{l.risk_score ?? 0}</Badge></TableCell>
                    <TableCell>{l.blocked ? <Badge variant="destructive">Blocked</Badge> : <Badge variant="secondary">Allowed</Badge>}</TableCell>
                    <TableCell>{l.created_at ? format(new Date(l.created_at), 'PPp') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
