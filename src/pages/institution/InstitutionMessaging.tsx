import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Mail, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionMessaging() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [swiftMessages, setSwiftMessages] = useState<any[]>([]);
  const [isoMessages, setIsoMessages] = useState<any[]>([]);
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);
      const [swiftRes, isoRes] = await Promise.all([
        supabase.from("swift_messages").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("iso20022_messages").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      setSwiftMessages(swiftRes.data || []);
      setIsoMessages(isoRes.data || []);
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  const statusColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "validated" || s === "sent" || s === "received") return "default";
    if (s === "failed") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><Mail className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SWIFT & ISO 20022</h1>
            <p className="text-xs text-muted-foreground">International payment messaging</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: "SWIFT Messages", value: swiftMessages.length, icon: Mail },
          { label: "ISO 20022 Messages", value: isoMessages.length, icon: Mail },
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

      <Tabs defaultValue="swift" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="swift" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">SWIFT Messages</TabsTrigger>
          <TabsTrigger value="iso" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">ISO 20022</TabsTrigger>
        </TabsList>

        <TabsContent value="swift"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">SWIFT Messages</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : swiftMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Mail className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No SWIFT messages</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Direction</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Reference</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
              <TableBody>{swiftMessages.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{m.direction === 'outbound' ? <ArrowUpRight className="h-4 w-4 text-muted-foreground" /> : <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] font-mono">{m.message_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{m.transaction_reference || '--'}</TableCell>
                  <TableCell className="text-sm">{m.amount ? `${Number(m.amount).toLocaleString()} ${m.currency || ''}` : '--'}</TableCell>
                  <TableCell><Badge variant={statusColor(m.status)} className="text-[10px]">{m.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.created_at ? format(new Date(m.created_at), 'PP') : '--'}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="iso"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">ISO 20022 Messages</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : isoMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Mail className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No ISO 20022 messages</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Direction</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Message ID</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
              <TableBody>{isoMessages.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{m.direction === 'outbound' ? <ArrowUpRight className="h-4 w-4 text-muted-foreground" /> : <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] font-mono">{m.message_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">{m.message_id}</TableCell>
                  <TableCell className="text-sm">{m.amount ? `${Number(m.amount).toLocaleString()} ${m.currency || ''}` : '--'}</TableCell>
                  <TableCell><Badge variant={statusColor(m.status)} className="text-[10px]">{m.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.created_at ? format(new Date(m.created_at), 'PP') : '--'}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
