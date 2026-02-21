import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, UserCheck, Shield, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionCustomers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kycVerifications, setKycVerifications] = useState<any[]>([]);
  const [dueDiligence, setDueDiligence] = useState<any[]>([]);
  const [sanctions, setSanctions] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      const { data: accounts } = await supabase.from("accounts").select("user_id").eq("institution_id", institution.id);
      const userIds = [...new Set((accounts || []).map(a => a.user_id))];
      if (userIds.length > 0) {
        const { data: kyc } = await supabase.from("kyc_verifications").select("*").in("user_id", userIds).order("created_at", { ascending: false }).limit(100);
        setKycVerifications(kyc || []);
        const { data: cdd } = await supabase.from("customer_due_diligence").select("*").in("user_id", userIds).order("created_at", { ascending: false }).limit(100);
        setDueDiligence(cdd || []);
        const { data: sanc } = await supabase.from("sanctions_screening").select("*").in("user_id", userIds).order("created_at", { ascending: false }).limit(100);
        setSanctions(sanc || []);
      }
    } catch (error) { console.error("Error loading customers:", error); }
    finally { setLoading(false); }
  };

  const kycStatusColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = { verified: "default", approved: "default", pending: "outline", rejected: "destructive" };
    return map[status] || "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><UserCheck className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Customers</h1>
            <p className="text-xs text-muted-foreground">KYC verifications, due diligence, and sanctions screening</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "KYC Verifications", value: kycVerifications.length, icon: UserCheck },
          { label: "Due Diligence", value: dueDiligence.length, icon: Shield },
          { label: "Sanctions Screenings", value: sanctions.length, icon: AlertTriangle },
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

      <Tabs defaultValue="kyc" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="kyc" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">KYC Verifications</TabsTrigger>
          <TabsTrigger value="cdd" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Due Diligence</TabsTrigger>
          <TabsTrigger value="sanctions" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Sanctions</TabsTrigger>
        </TabsList>

        <TabsContent value="kyc"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">KYC Verifications</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : kycVerifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No KYC verifications</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Document</TableHead><TableHead className="text-xs">Risk Level</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
              <TableBody>{kycVerifications.map(k => (<TableRow key={k.id}><TableCell className="text-sm">{k.verification_type}</TableCell><TableCell className="text-sm">{k.document_type || '--'}</TableCell><TableCell><Badge variant={k.risk_level === 'high' ? "destructive" : "outline"} className="text-[10px]">{k.risk_level || '--'}</Badge></TableCell><TableCell><Badge variant={kycStatusColor(k.status)} className="text-[10px]">{k.status}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{k.created_at ? format(new Date(k.created_at), 'PP') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="cdd"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Customer Due Diligence</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : dueDiligence.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Shield className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No due diligence records</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Risk Category</TableHead><TableHead className="text-xs">Risk Score</TableHead><TableHead className="text-xs">PEP Status</TableHead><TableHead className="text-xs">Occupation</TableHead><TableHead className="text-xs">Country</TableHead><TableHead className="text-xs">Next Review</TableHead></TableRow></TableHeader>
              <TableBody>{dueDiligence.map(d => (<TableRow key={d.id}><TableCell><Badge variant={d.risk_category === 'enhanced' ? "destructive" : d.risk_category === 'standard' ? "default" : "outline"} className="text-[10px]">{d.risk_category}</Badge></TableCell><TableCell className="text-sm">{d.risk_score ?? '--'}</TableCell><TableCell><Badge variant={d.pep_status ? "destructive" : "secondary"} className="text-[10px]">{d.pep_status ? "PEP" : "Non-PEP"}</Badge></TableCell><TableCell className="text-sm">{d.occupation || '--'}</TableCell><TableCell className="text-sm">{d.country_of_residence || '--'}</TableCell><TableCell className="text-xs text-muted-foreground">{d.next_review_date ? format(new Date(d.next_review_date), 'PP') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="sanctions"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Sanctions Screening</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : sanctions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No sanctions screenings</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Screening Type</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Match Score</TableHead><TableHead className="text-xs">Lists Checked</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
              <TableBody>{sanctions.map((s: any) => (<TableRow key={s.id}><TableCell className="text-sm">{s.screening_type || '--'}</TableCell><TableCell><Badge variant={s.screening_status === 'clear' ? "default" : "destructive"} className="text-[10px]">{s.screening_status}</Badge></TableCell><TableCell className="text-sm">{s.match_score ?? '--'}</TableCell><TableCell className="text-sm">{Array.isArray(s.lists_checked) ? s.lists_checked.join(', ') : '--'}</TableCell><TableCell className="text-xs text-muted-foreground">{s.created_at ? format(new Date(s.created_at), 'PP') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
