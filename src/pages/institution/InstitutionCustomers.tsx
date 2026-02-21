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
      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }

      // Get accounts for this institution to find user_ids
      const { data: accounts } = await supabase
        .from("accounts").select("user_id").eq("institution_id", institution.id);
      const userIds = [...new Set((accounts || []).map(a => a.user_id))];

      if (userIds.length > 0) {
        const { data: kyc } = await supabase
          .from("kyc_verifications").select("*").in("user_id", userIds).order("created_at", { ascending: false }).limit(100);
        setKycVerifications(kyc || []);

        const { data: cdd } = await supabase
          .from("customer_due_diligence").select("*").in("user_id", userIds).order("created_at", { ascending: false }).limit(100);
        setDueDiligence(cdd || []);

        const { data: sanc } = await supabase
          .from("sanctions_screening").select("*").in("user_id", userIds).order("created_at", { ascending: false }).limit(100);
        setSanctions(sanc || []);
      }
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally { setLoading(false); }
  };

  const kycStatusColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      verified: "default", approved: "default", pending: "outline", rejected: "destructive"
    };
    return map[status] || "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">KYC verifications, due diligence, and sanctions screening</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">KYC Verifications</CardTitle><UserCheck className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : kycVerifications.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Due Diligence</CardTitle><Shield className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : dueDiligence.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Sanctions Screenings</CardTitle><AlertTriangle className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : sanctions.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="kyc" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kyc">KYC Verifications</TabsTrigger>
          <TabsTrigger value="cdd">Due Diligence</TabsTrigger>
          <TabsTrigger value="sanctions">Sanctions</TabsTrigger>
        </TabsList>

        <TabsContent value="kyc">
          <Card><CardHeader><CardTitle>KYC Verifications</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : kycVerifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No KYC verifications</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Document</TableHead><TableHead>Risk Level</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>{kycVerifications.map(k => (
                  <TableRow key={k.id}>
                    <TableCell>{k.verification_type}</TableCell>
                    <TableCell>{k.document_type || '—'}</TableCell>
                    <TableCell><Badge variant={k.risk_level === 'high' ? "destructive" : "outline"}>{k.risk_level || '—'}</Badge></TableCell>
                    <TableCell><Badge variant={kycStatusColor(k.status)}>{k.status}</Badge></TableCell>
                    <TableCell>{k.created_at ? format(new Date(k.created_at), 'PP') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cdd">
          <Card><CardHeader><CardTitle>Customer Due Diligence</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : dueDiligence.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Shield className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No due diligence records</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Risk Category</TableHead><TableHead>Risk Score</TableHead><TableHead>PEP Status</TableHead><TableHead>Occupation</TableHead><TableHead>Country</TableHead><TableHead>Next Review</TableHead></TableRow></TableHeader>
                <TableBody>{dueDiligence.map(d => (
                  <TableRow key={d.id}>
                    <TableCell><Badge variant={d.risk_category === 'enhanced' ? "destructive" : d.risk_category === 'standard' ? "default" : "outline"}>{d.risk_category}</Badge></TableCell>
                    <TableCell>{d.risk_score ?? '—'}</TableCell>
                    <TableCell><Badge variant={d.pep_status ? "destructive" : "secondary"}>{d.pep_status ? "PEP" : "Non-PEP"}</Badge></TableCell>
                    <TableCell>{d.occupation || '—'}</TableCell>
                    <TableCell>{d.country_of_residence || '—'}</TableCell>
                    <TableCell>{d.next_review_date ? format(new Date(d.next_review_date), 'PP') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="sanctions">
          <Card><CardHeader><CardTitle>Sanctions Screening</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : sanctions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No sanctions screenings</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Screening Type</TableHead><TableHead>Status</TableHead><TableHead>Match Score</TableHead><TableHead>Lists Checked</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>{sanctions.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.screening_type || '—'}</TableCell>
                    <TableCell><Badge variant={s.screening_status === 'clear' ? "default" : "destructive"}>{s.screening_status}</Badge></TableCell>
                    <TableCell>{s.match_score ?? '—'}</TableCell>
                    <TableCell>{Array.isArray(s.lists_checked) ? s.lists_checked.join(', ') : '—'}</TableCell>
                    <TableCell>{s.created_at ? format(new Date(s.created_at), 'PP') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
