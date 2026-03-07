import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { RefreshCw, UserCheck, Shield, AlertTriangle, Users, Plus, MoreHorizontal, Eye, ShieldCheck, Search, Download, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      let instId: string | null = null;
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (institution) { instId = institution.id; }
      else {
        const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
        if (staffInst) instId = staffInst;
      }
      if (!instId) { navigate('/register'); return; }

      const { data: accounts } = await supabase.from("accounts").select("*").eq("institution_id", instId);
      const userIds = [...new Set((accounts || []).map(a => a.user_id))];

      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
        const customerList = (profiles || []).map(p => {
          const accts = (accounts || []).filter(a => a.user_id === p.id);
          return { ...p, account_count: accts.length, accounts: accts };
        });
        setCustomers(customerList);

        const { data: kyc } = await supabase.from("kyc_verifications").select("*").in("user_id", userIds).eq("source_app", "banking_app").order("created_at", { ascending: false }).limit(200);
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

  const kycStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
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

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c => c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone_number?.includes(q));
  }, [customers, search]);

  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const verifiedCount = customers.filter(c => { const s = getCustomerKycStatus(c.id); return s === 'verified' || s === 'approved'; }).length;
  const pendingKycCount = kycVerifications.filter(k => k.status === 'pending').length;

  const exportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Accounts", "KYC Status", "Joined"];
    const rows = filtered.map(c => [c.full_name || '', c.email || '', c.phone_number || '', c.account_count, getCustomerKycStatus(c.id), c.created_at ? format(new Date(c.created_at), 'yyyy-MM-dd') : '']);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `customers-${format(new Date(), 'yyyy-MM-dd')}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }}>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20"><Users className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Customers</h1>
            <p className="text-xs text-muted-foreground">Manage customers, KYC, due diligence & sanctions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate('/fi-portal/customer-onboarding')}><Plus className="h-3.5 w-3.5 mr-1.5" />Register Customer</Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} variants={fadeUp} className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Customers" value={loading ? "..." : customers.length} icon={<Users className="h-4 w-4" />} />
        <StatCard title="KYC Verified" value={loading ? "..." : verifiedCount} icon={<UserCheck className="h-4 w-4" />} />
        <StatCard title="Pending KYC" value={loading ? "..." : pendingKycCount} icon={<Shield className="h-4 w-4" />} />
        <StatCard title="Sanctions Screenings" value={loading ? "..." : sanctions.length} icon={<AlertTriangle className="h-4 w-4" />} />
      </motion.div>

      {/* Search */}
      <motion.div custom={2} variants={fadeUp}>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search customers..." className="pl-9 h-9 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>

        <Tabs defaultValue="customers" className="space-y-4">
          <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
            <TabsTrigger value="customers" className="rounded-md px-3 text-xs font-medium">All Customers ({customers.length})</TabsTrigger>
            <TabsTrigger value="kyc" className="rounded-md px-3 text-xs font-medium">KYC ({kycVerifications.length})</TabsTrigger>
            <TabsTrigger value="cdd" className="rounded-md px-3 text-xs font-medium">Due Diligence ({dueDiligence.length})</TabsTrigger>
            <TabsTrigger value="sanctions" className="rounded-md px-3 text-xs font-medium">Sanctions ({sanctions.length})</TabsTrigger>
          </TabsList>

          {/* Customers Tab */}
          <TabsContent value="customers">
            <Card className="border-border/60"><CardContent className="p-0">
              {loading ? <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-20" /><p className="text-sm font-medium">No customers found</p></div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Accounts</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">KYC</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Joined</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>{paginated.map(c => {
                      const kycStatus = getCustomerKycStatus(c.id);
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => viewProfile(c)}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                                {(c.full_name || '?').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-sm">{c.full_name || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.email || '—'}</TableCell>
                          <TableCell className="text-sm">{c.phone_number || '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px] font-medium">{c.account_count}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={kycStatusColor(kycStatus)} className="text-[10px] capitalize">
                              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${kycStatus === 'approved' || kycStatus === 'verified' ? 'bg-emerald-400' : kycStatus === 'rejected' ? 'bg-destructive' : 'bg-muted-foreground/50'}`} />
                              {kycStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.created_at ? format(new Date(c.created_at), 'PP') : '—'}</TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => viewProfile(c)}><Eye className="h-3.5 w-3.5 mr-2" />View Profile</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate('/fi-portal/customer-onboarding')}><ShieldCheck className="h-3.5 w-3.5 mr-2" />Initiate KYC</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}</TableBody>
                  </Table>
                  <DataTablePagination page={page} pageSize={pageSize} totalCount={filtered.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
                </>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* KYC Tab */}
          <TabsContent value="kyc">
            <Card className="border-border/60"><CardContent className="p-0">
              {loading ? <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : kycVerifications.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground"><UserCheck className="h-12 w-12 mx-auto mb-4 opacity-20" /><p className="text-sm font-medium">No KYC verifications</p></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Document</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Risk Level</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>{kycVerifications.map(k => (
                    <TableRow key={k.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-sm font-medium capitalize">{k.verification_type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{k.document_type || '—'}</TableCell>
                      <TableCell><Badge variant={k.risk_level === 'high' ? "destructive" : "outline"} className="text-[10px]">{k.risk_level || '—'}</Badge></TableCell>
                      <TableCell><Badge variant={kycStatusColor(k.status)} className="text-[10px] capitalize">{k.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{k.created_at ? format(new Date(k.created_at), 'PP') : '—'}</TableCell>
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
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* CDD Tab */}
          <TabsContent value="cdd">
            <Card className="border-border/60"><CardContent className="p-0">
              {loading ? <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : dueDiligence.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground"><Shield className="h-12 w-12 mx-auto mb-4 opacity-20" /><p className="text-sm font-medium">No due diligence records</p></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Risk Category</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Risk Score</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PEP</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Occupation</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Country</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Next Review</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{dueDiligence.map(d => (
                    <TableRow key={d.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell><Badge variant={d.risk_category === 'enhanced' ? "destructive" : d.risk_category === 'standard' ? "default" : "outline"} className="text-[10px] capitalize">{d.risk_category}</Badge></TableCell>
                      <TableCell className="text-sm font-medium tabular-nums">{d.risk_score ?? '—'}</TableCell>
                      <TableCell><Badge variant={d.pep_status ? "destructive" : "secondary"} className="text-[10px]">{d.pep_status ? "PEP" : "Non-PEP"}</Badge></TableCell>
                      <TableCell className="text-sm">{d.occupation || '—'}</TableCell>
                      <TableCell className="text-sm">{d.country_of_residence || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.next_review_date ? format(new Date(d.next_review_date), 'PP') : '—'}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* Sanctions Tab */}
          <TabsContent value="sanctions">
            <Card className="border-border/60"><CardContent className="p-0">
              {loading ? <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : sanctions.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground"><AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-20" /><p className="text-sm font-medium">No sanctions screenings</p></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Match Score</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lists Checked</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{sanctions.map((s: any) => (
                    <TableRow key={s.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-sm font-medium">{s.screening_type || '—'}</TableCell>
                      <TableCell><Badge variant={s.screening_status === 'clear' ? "default" : "destructive"} className="text-[10px] capitalize">{s.screening_status}</Badge></TableCell>
                      <TableCell className="text-sm tabular-nums">{s.match_score ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{Array.isArray(s.lists_checked) ? s.lists_checked.join(', ') : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.created_at ? format(new Date(s.created_at), 'PP') : '—'}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Customer Profile Sheet */}
      <Sheet open={!!profileDetail} onOpenChange={o => { if (!o) setProfileDetail(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" />Customer Profile</SheetTitle></SheetHeader>
          {profileDetail && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
                  {(profileDetail.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-bold">{profileDetail.full_name || '—'}</p>
                  <p className="text-sm text-muted-foreground">{profileDetail.email || '—'}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-medium">{profileDetail.phone_number || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Country</p><p className="text-sm font-medium">{profileDetail.country_code || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Accounts</p><p className="text-sm font-bold">{profileDetail.account_count}</p></div>
                <div><p className="text-xs text-muted-foreground">Member Since</p><p className="text-sm font-medium">{profileDetail.created_at ? format(new Date(profileDetail.created_at), 'PP') : '—'}</p></div>
              </div>
              {profileAccounts.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Accounts</p>
                    <div className="space-y-2">{profileAccounts.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/20">
                        <div><p className="text-sm font-medium">{a.account_holder_name}</p><p className="text-xs text-muted-foreground font-mono">{a.account_id}</p></div>
                        <div className="flex gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{a.account_type}</Badge>
                          <Badge variant={a.is_active ? "default" : "secondary"} className="text-[10px]">{a.is_active ? "Active" : "Inactive"}</Badge>
                        </div>
                      </div>
                    ))}</div>
                  </div>
                </>
              )}
              {profileKyc.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">KYC History</p>
                    <div className="space-y-2">{profileKyc.map((k: any) => (
                      <div key={k.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/20">
                        <div><p className="text-sm capitalize">{k.verification_type} — {k.document_type || 'N/A'}</p><p className="text-xs text-muted-foreground">{k.created_at ? format(new Date(k.created_at), 'PP') : ''}</p></div>
                        <Badge variant={kycStatusColor(k.status)} className="text-[10px] capitalize">{k.status}</Badge>
                      </div>
                    ))}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
