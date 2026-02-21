import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, KeyRound, Send, Clock } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionConsents() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [aispConsents, setAispConsents] = useState<any[]>([]);
  const [pispConsents, setPispConsents] = useState<any[]>([]);
  const [consentEvents, setConsentEvents] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }

      // Get API clients for this institution to find relevant consents
      const { data: clients } = await supabase
        .from("api_clients").select("client_id").eq("institution_id", institution.id);
      const clientIds = (clients || []).map(c => c.client_id);

      if (clientIds.length > 0) {
        const { data: aisp } = await supabase
          .from("aisp_consents").select("*").in("client_id", clientIds).order("created_at", { ascending: false }).limit(100);
        setAispConsents(aisp || []);

        const { data: pisp } = await supabase
          .from("pisp_consents").select("*").in("client_id", clientIds).order("created_at", { ascending: false }).limit(100);
        setPispConsents(pisp || []);

        const { data: events } = await supabase
          .from("consent_events").select("*").in("client_id", clientIds).order("created_at", { ascending: false }).limit(100);
        setConsentEvents(events || []);
      }
    } catch (error) {
      console.error("Error loading consents:", error);
    } finally { setLoading(false); }
  };

  const consentStatusColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Authorised: "default", Revoked: "destructive", Expired: "secondary", AwaitingAuthorisation: "outline"
    };
    return map[status] || "outline";
  };

  const activeAisp = aispConsents.filter(c => c.status === 'Authorised').length;
  const activePisp = pispConsents.filter(c => c.status === 'Authorised').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Consents</h1>
          <p className="text-muted-foreground">AISP and PISP consent management</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">AISP Consents</CardTitle><KeyRound className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : aispConsents.length}</div><p className="text-xs text-muted-foreground">{activeAisp} active</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">PISP Consents</CardTitle><Send className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : pispConsents.length}</div><p className="text-xs text-muted-foreground">{activePisp} active</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Consent Events</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : consentEvents.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Revoked</CardTitle><KeyRound className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : aispConsents.filter(c => c.status === 'Revoked').length + pispConsents.filter(c => c.status === 'Revoked').length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="aisp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="aisp">AISP Consents</TabsTrigger>
          <TabsTrigger value="pisp">PISP Consents</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="aisp">
          <Card><CardHeader><CardTitle>AISP Consents</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : aispConsents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><KeyRound className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No AISP consents</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Consent ID</TableHead><TableHead>Client</TableHead><TableHead>Status</TableHead><TableHead>Expires</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                <TableBody>{aispConsents.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.consent_id}</TableCell>
                    <TableCell className="font-mono text-xs">{c.client_id}</TableCell>
                    <TableCell><Badge variant={consentStatusColor(c.status)}>{c.status}</Badge></TableCell>
                    <TableCell>{format(new Date(c.expiration_date), 'PP')}</TableCell>
                    <TableCell>{c.created_at ? format(new Date(c.created_at), 'PP') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pisp">
          <Card><CardHeader><CardTitle>PISP Consents</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : pispConsents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Send className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No PISP consents</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Consent ID</TableHead><TableHead>Client</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                <TableBody>{pispConsents.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.consent_id}</TableCell>
                    <TableCell className="font-mono text-xs">{c.client_id}</TableCell>
                    <TableCell>{c.amount ? `${Number(c.amount).toLocaleString()} ${c.currency || 'XAF'}` : '—'}</TableCell>
                    <TableCell><Badge variant={consentStatusColor(c.status)}>{c.status}</Badge></TableCell>
                    <TableCell>{c.created_at ? format(new Date(c.created_at), 'PP') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="events">
          <Card><CardHeader><CardTitle>Consent Events</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : consentEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Clock className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No consent events</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Consent ID</TableHead><TableHead>Type</TableHead><TableHead>Event</TableHead><TableHead>Client</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>{consentEvents.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.consent_id}</TableCell>
                    <TableCell><Badge variant="outline">{e.consent_type}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{e.event_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{e.client_id || '—'}</TableCell>
                    <TableCell>{e.created_at ? format(new Date(e.created_at), 'PPp') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
