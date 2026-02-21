import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RefreshCw, UserCheck, Shield, AlertTriangle, Users, Plus, MoreHorizontal, Eye, ShieldCheck, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function InstitutionCustomers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [kycVerifications, setKycVerifications] = useState<any[]>([]);
  const [dueDiligence, setDueDiligence] = useState<any[]>([]);
  const [sanctions, setSanctions] = useState<any[]>([]);
  const [profileDetail, setProfileDetail] = useState<any>(null);
  const [profileKyc, setProfileKyc] = useState<any[]>([]);
  const [profileAccounts, setProfileAccounts] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }

      // Get all accounts for this institution to find customer user_ids
      const { data: accounts } = await supabase.from("accounts").select("*").eq("institution_id", institution.id);
      const userIds = [...new Set((accounts || []).map(a => a.user_id))];

      if (userIds.length > 0) {
        // Load profiles for all customers
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);

        // Build customer list with account counts and KYC status
        const customerList = (profiles || []).map(p => {
          const accts = (accounts || []).filter(a => a.user_id === p.id);
          return { ...p, account_count: accts.length, accounts: accts };
        });
        setCustomers(customerList);

        const { data: kyc } = await supabase.from("kyc_verifications").select("*").in("user_id", userIds).order("created_at", { ascending: false }).limit(200);
        setKycVerifications(kyc || []);
        const { data: cdd } = await supabase.from("customer_due_diligence").select("*").in("user_id", userIds).order("created_at", { ascending: false }).limit(200);
        setDueDiligence(cdd || []);
        const { data: sanc } = await supabase.from("sanctions_screening").select("*").in("user_id", userIds).order("created_at", { ascending: false }).limit(200);
        setSanctions(sanc || []);
      }
    } catch (error) { console.error("Error loading customers:", error); }
    finally { setLoading(false); }
  };

  const getCustomerKycStatus = (userId: string) => {
    const kyc = kycVerifications.find(k => k.user_id === userId);
    return kyc?.status || "none";
  };

  const kycStatusColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = { verified: "default", approved: "default", pending: "outline", rejected: "destructive", none: "secondary" };
    return map[status] || "outline";
  };

  const viewProfile = (customer: any) => {
    setProfileDetail(customer);
    setProfileKyc(kycVerifications.filter(k => k.user_id === customer.id));
    setProfileAccounts(customer.accounts || []);
  };

  const handleKycAction = async (kycId: string, action: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.from("kyc_verifications").update({ status: action, verified_at: new Date().toISOString() }).eq("id", kycId);
      if (error) throw error;
      toast({ title: `KYC ${action}` });
      loadData();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><Users className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Customers</h1>
            <p className="text-xs text-muted-foreground">Manage customers, KYC, due diligence, and sanctions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate('/fi-portal/customer-onboarding')}><Plus className="h-3.5 w-3.5 mr-1.5" />Register Customer</Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total Customers", value: customers.length, icon: Users },
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

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="customers" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">All Customers</TabsTrigger>
          <TabsTrigger value="kyc" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">KYC Verifications</TabsTrigger>
          <TabsTrigger value="cdd" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Due Diligence</TabsTrigger>
          <TabsTrigger value="sanctions" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Sanctions</TabsTrigger>
        </TabsList>

        {/* Unified Customer List */}
        <TabsContent value="customers"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">All Customers</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : customers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No customers found</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">Email</TableHead><TableHead className="text-xs">Phone</TableHead><TableHead className="text-xs">Accounts</TableHead><TableHead className="text-xs">KYC Status</TableHead><TableHead className="text-xs">Joined</TableHead><TableHead className="text-xs w-10"></TableHead></TableRow></TableHeader>
              <TableBody>{customers.map(c => {
                const kycStatus = getCustomerKycStatus(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.full_name || '--'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email || '--'}</TableCell>
                    <TableCell className="text-sm">{c.phone_number || '--'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.account_count}</Badge></TableCell>
                    <TableCell><Badge variant={kycStatusColor(kycStatus)} className="text-[10px]">{kycStatus}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.created_at ? format(new Date(c.created_at), 'PP') : '--'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewProfile(c)}><Eye className="h-3.5 w-3.5 mr-2" />View Profile</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/fi-portal/customer-onboarding')}><ShieldCheck className="h-3.5 w-3.5 mr-2" />Initiate KYC</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/fi-portal/customer-onboarding')}><Search className="h-3.5 w-3.5 mr-2" />Run Screening</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          )}
        </CardContent></Card></TabsContent>

        {/* KYC Tab */}
        <TabsContent value="kyc"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">KYC Verifications</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : kycVerifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No KYC verifications</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Document</TableHead><TableHead className="text-xs">Risk Level</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Date</TableHead><TableHead className="text-xs w-10"></TableHead></TableRow></TableHeader>
              <TableBody>{kycVerifications.map(k => (<TableRow key={k.id}>
                <TableCell className="text-sm">{k.verification_type}</TableCell>
                <TableCell className="text-sm">{k.document_type || '--'}</TableCell>
                <TableCell><Badge variant={k.risk_level === 'high' ? "destructive" : "outline"} className="text-[10px]">{k.risk_level || '--'}</Badge></TableCell>
                <TableCell><Badge variant={kycStatusColor(k.status)} className="text-[10px]">{k.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{k.created_at ? format(new Date(k.created_at), 'PP') : '--'}</TableCell>
                <TableCell>
                  {k.status === 'pending' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleKycAction(k.id, 'approved')}>Approve</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleKycAction(k.id, 'rejected')} className="text-destructive">Reject</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        {/* CDD Tab */}
        <TabsContent value="cdd"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Customer Due Diligence</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : dueDiligence.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Shield className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No due diligence records</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Risk Category</TableHead><TableHead className="text-xs">Risk Score</TableHead><TableHead className="text-xs">PEP Status</TableHead><TableHead className="text-xs">Occupation</TableHead><TableHead className="text-xs">Country</TableHead><TableHead className="text-xs">Next Review</TableHead></TableRow></TableHeader>
              <TableBody>{dueDiligence.map(d => (<TableRow key={d.id}><TableCell><Badge variant={d.risk_category === 'enhanced' ? "destructive" : d.risk_category === 'standard' ? "default" : "outline"} className="text-[10px]">{d.risk_category}</Badge></TableCell><TableCell className="text-sm">{d.risk_score ?? '--'}</TableCell><TableCell><Badge variant={d.pep_status ? "destructive" : "secondary"} className="text-[10px]">{d.pep_status ? "PEP" : "Non-PEP"}</Badge></TableCell><TableCell className="text-sm">{d.occupation || '--'}</TableCell><TableCell className="text-sm">{d.country_of_residence || '--'}</TableCell><TableCell className="text-xs text-muted-foreground">{d.next_review_date ? format(new Date(d.next_review_date), 'PP') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        {/* Sanctions Tab */}
        <TabsContent value="sanctions"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Sanctions Screening</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : sanctions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No sanctions screenings</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Screening Type</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Match Score</TableHead><TableHead className="text-xs">Lists Checked</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
              <TableBody>{sanctions.map((s: any) => (<TableRow key={s.id}><TableCell className="text-sm">{s.screening_type || '--'}</TableCell><TableCell><Badge variant={s.screening_status === 'clear' ? "default" : "destructive"} className="text-[10px]">{s.screening_status}</Badge></TableCell><TableCell className="text-sm">{s.match_score ?? '--'}</TableCell><TableCell className="text-sm">{Array.isArray(s.lists_checked) ? s.lists_checked.join(', ') : '--'}</TableCell><TableCell className="text-xs text-muted-foreground">{s.created_at ? format(new Date(s.created_at), 'PP') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>
      </Tabs>

      {/* Customer Profile Dialog */}
      <Dialog open={!!profileDetail} onOpenChange={o => { if (!o) setProfileDetail(null); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader><DialogTitle>Customer Profile</DialogTitle></DialogHeader>
          {profileDetail && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Full Name</p><p className="text-sm font-medium">{profileDetail.full_name || '--'}</p></div>
                <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm">{profileDetail.email || '--'}</p></div>
                <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm">{profileDetail.phone_number || '--'}</p></div>
                <div><p className="text-xs text-muted-foreground">Country</p><p className="text-sm">{profileDetail.country_code || '--'}</p></div>
                <div><p className="text-xs text-muted-foreground">Accounts</p><p className="text-sm font-medium">{profileDetail.account_count}</p></div>
                <div><p className="text-xs text-muted-foreground">Member Since</p><p className="text-sm">{profileDetail.created_at ? format(new Date(profileDetail.created_at), 'PP') : '--'}</p></div>
              </div>
              {profileAccounts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Accounts</p>
                  <div className="space-y-2">{profileAccounts.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div><p className="text-sm font-medium">{a.account_holder_name}</p><p className="text-xs text-muted-foreground">{a.account_id}</p></div>
                      <div className="flex gap-2 items-center">
                        <Badge variant="outline" className="text-[10px]">{a.account_type}</Badge>
                        <Badge variant={a.is_active ? "default" : "secondary"} className="text-[10px]">{a.is_active ? "Active" : "Inactive"}</Badge>
                      </div>
                    </div>
                  ))}</div>
                </div>
              )}
              {profileKyc.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">KYC History</p>
                  <div className="space-y-2">{profileKyc.map((k: any) => (
                    <div key={k.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div><p className="text-sm">{k.verification_type} — {k.document_type || 'N/A'}</p><p className="text-xs text-muted-foreground">{k.created_at ? format(new Date(k.created_at), 'PP') : ''}</p></div>
                      <Badge variant={kycStatusColor(k.status)} className="text-[10px]">{k.status}</Badge>
                    </div>
                  ))}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
