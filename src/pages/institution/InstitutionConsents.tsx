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
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      const { data: clients } = await supabase.from("api_clients").select("client_id").eq("institution_id", institution.id);
      const clientIds = (clients || []).map(c => c.client_id);
      if (clientIds.length > 0) {
        const { data: aisp } = await supabase.from("aisp_consents").select("*").in("client_id", clientIds).order("created_at", { ascending: false }).limit(100);
        setAispConsents(aisp || []);
        const { data: pisp } = await supabase.from("pisp_consents").select("*").in("client_id", clientIds).order("created_at", { ascending: false }).limit(100);
        setPispConsents(pisp || []);
        const { data: events } = await supabase.from("consent_events").select("*").in("client_id", clientIds).order("created_at", { ascending: false }).limit(100);
        setConsentEvents(events || []);
      }
    } catch (error) { console.error("Error loading consents:", error); }
    finally { setLoading(false); }
  };

  const consentStatusColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = { Authorised: "default", Revoked: "destructive", Expired: "secondary", AwaitingAuthorisation: "outline" };
    return map[status] || "outline";
  };

  const activeAisp = aispConsents.filter(c => c.status === 'Authorised').length;
  const activePisp = pispConsents.filter(c => c.status === 'Authorised').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><KeyRound className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Consents</h1>
            <p className="text-xs text-muted-foreground">AISP and PISP consent management</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "AISP Consents", value: aispConsents.length, sub: `${activeAisp} active`, icon: KeyRound },
          { label: "PISP Consents", value: pispConsents.length, sub: `${activePisp} active`, icon: Send },
          { label: "Consent Events", value: consentEvents.length, icon: Clock },
          { label: "Revoked", value: aispConsents.filter(c => c.status === 'Revoked').length + pispConsents.filter(c => c.status === 'Revoked').length, icon: KeyRound },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted"><s.icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div>
              {'sub' in s && s.sub && <p className="text-[11px] text-muted-foreground">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="aisp" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="aisp" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">AISP Consents</TabsTrigger>
          <TabsTrigger value="pisp" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">PISP Consents</TabsTrigger>
          <TabsTrigger value="events" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="aisp"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">AISP Consents</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : aispConsents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><KeyRound className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No AISP consents</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Consent ID</TableHead><TableHead className="text-xs">Client</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Expires</TableHead><TableHead className="text-xs">Created</TableHead></TableRow></TableHeader>
              <TableBody>{aispConsents.map(c => (<TableRow key={c.id}><TableCell className="font-mono text-xs text-muted-foreground">{c.consent_id}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{c.client_id}</TableCell><TableCell><Badge variant={consentStatusColor(c.status)} className="text-[10px]">{c.status}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{format(new Date(c.expiration_date), 'PP')}</TableCell><TableCell className="text-xs text-muted-foreground">{c.created_at ? format(new Date(c.created_at), 'PP') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="pisp"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">PISP Consents</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : pispConsents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Send className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No PISP consents</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Consent ID</TableHead><TableHead className="text-xs">Client</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Created</TableHead></TableRow></TableHeader>
              <TableBody>{pispConsents.map((c: any) => (<TableRow key={c.id}><TableCell className="font-mono text-xs text-muted-foreground">{c.consent_id}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{c.client_id}</TableCell><TableCell className="text-sm">{c.amount ? `${Number(c.amount).toLocaleString()} ${c.currency || 'XAF'}` : '--'}</TableCell><TableCell><Badge variant={consentStatusColor(c.status)} className="text-[10px]">{c.status}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{c.created_at ? format(new Date(c.created_at), 'PP') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="events"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Consent Events</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : consentEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Clock className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No consent events</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Consent ID</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Event</TableHead><TableHead className="text-xs">Client</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
              <TableBody>{consentEvents.map(e => (<TableRow key={e.id}><TableCell className="font-mono text-xs text-muted-foreground">{e.consent_id}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{e.consent_type}</Badge></TableCell><TableCell><Badge variant="secondary" className="text-[10px]">{e.event_type}</Badge></TableCell><TableCell className="font-mono text-xs text-muted-foreground">{e.client_id || '--'}</TableCell><TableCell className="text-xs text-muted-foreground">{e.created_at ? format(new Date(e.created_at), 'PPp') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
