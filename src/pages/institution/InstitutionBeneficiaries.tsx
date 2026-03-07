import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { RefreshCw, Users, Clock, FileText, Search, Download, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function InstitutionBeneficiaries() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [standingOrders, setStandingOrders] = useState<any[]>([]);
  const [directDebits, setDirectDebits] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailType, setDetailType] = useState<"beneficiary" | "standing_order" | "direct_debit">("beneficiary");
  const [benPage, setBenPage] = useState(1);
  const pageSize = 25;

  useEffect(() => { loadData(); }, []);

  const resolveInstitutionId = async (userId: string): Promise<string | null> => {
    const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", userId).maybeSingle();
    if (inst) return inst.id;
    const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: userId });
    return staffInst || null;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const institutionId = await resolveInstitutionId(user.id);
      if (!institutionId) { navigate("/register"); return; }

      const { data: accounts } = await supabase.from("accounts").select("id").eq("institution_id", institutionId);
      const accountIds = (accounts || []).map((a) => a.id);
      if (accountIds.length > 0) {
        const [bensRes, sosRes, ddsRes] = await Promise.all([
          supabase.from("beneficiaries").select("*").in("account_id", accountIds).order("created_at", { ascending: false }),
          supabase.from("standing_orders").select("*").in("account_id", accountIds).order("created_at", { ascending: false }),
          supabase.from("direct_debits").select("*").in("account_id", accountIds).order("created_at", { ascending: false }),
        ]);
        setBeneficiaries(bensRes.data || []);
        setStandingOrders(sosRes.data || []);
        setDirectDebits(ddsRes.data || []);
      }
    } catch (error) {
      console.error("Error loading beneficiaries:", error);
    } finally {
      setLoading(false);
    }
  };

  const activeBens = beneficiaries.filter((b) => b.is_active);
  const activeSOs = standingOrders.filter((s) => s.status === "Active");
  const totalSOVolume = standingOrders.reduce((s, so) => s + Number(so.first_payment_amount || 0), 0);

  const filteredBens = beneficiaries.filter((b) =>
    b.beneficiary_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.identification_value?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredSOs = standingOrders.filter((s) =>
    s.creditor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredDDs = directDebits.filter((d) =>
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.mandate_identification?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedBens = filteredBens.slice((benPage - 1) * pageSize, benPage * pageSize);

  const exportCSV = () => {
    const rows = [
      ["Name", "Scheme", "Identification", "Reference", "Active", "Created"].join(","),
      ...beneficiaries.map((b) =>
        [b.beneficiary_name, b.identification_scheme, b.identification_value, b.reference || "", b.is_active, b.created_at].join(",")
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beneficiaries-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const openDetail = (item: any, type: "beneficiary" | "standing_order" | "direct_debit") => {
    setSelectedItem(item);
    setDetailType(type);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Beneficiaries & Payments</h1>
            <p className="text-muted-foreground text-sm">Beneficiaries, standing orders, and direct debits</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="grid gap-4 md:grid-cols-4">
        <StatCard title="Beneficiaries" value={`${activeBens.length} / ${beneficiaries.length}`} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Standing Orders" value={`${activeSOs.length} active`} icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Direct Debits" value={String(directDebits.length)} icon={<FileText className="h-5 w-5" />} />
        <StatCard title="SO Volume" value={new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", minimumFractionDigits: 0 }).format(totalSOVolume)} icon={<ArrowUpDown className="h-5 w-5" />} />
      </motion.div>

      {/* Search */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search beneficiaries, standing orders, direct debits..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <Tabs defaultValue="beneficiaries" className="space-y-4">
          <TabsList className="inline-flex h-10 items-center rounded-lg bg-muted p-1">
            <TabsTrigger value="beneficiaries" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Beneficiaries ({filteredBens.length})
            </TabsTrigger>
            <TabsTrigger value="standing-orders" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Standing Orders ({filteredSOs.length})
            </TabsTrigger>
            <TabsTrigger value="direct-debits" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Direct Debits ({filteredDDs.length})
            </TabsTrigger>
          </TabsList>

          {/* Beneficiaries Tab */}
          <TabsContent value="beneficiaries">
            <Card className="border-border/60 overflow-hidden">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : filteredBens.length === 0 ? (
                  <EmptyState icon={<Users className="h-6 w-6 text-muted-foreground" />} title="No beneficiaries" description="Beneficiaries linked to your accounts will appear here" />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-muted/40">
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Name</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Scheme</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Identification</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Reference</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedBens.map((b) => (
                          <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openDetail(b, "beneficiary")}>
                            <TableCell className="font-medium text-sm">{b.beneficiary_name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{b.identification_scheme}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{b.identification_value}</TableCell>
                            <TableCell className="text-xs">{b.reference || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={b.is_active ? "default" : "secondary"} className="text-[10px] uppercase tracking-wider font-semibold">
                                {b.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{b.created_at ? format(new Date(b.created_at), "PP") : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <DataTablePagination page={benPage} pageSize={pageSize} totalCount={filteredBens.length} onPageChange={setBenPage} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Standing Orders Tab */}
          <TabsContent value="standing-orders">
            <Card className="border-border/60 overflow-hidden">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : filteredSOs.length === 0 ? (
                  <EmptyState icon={<Clock className="h-6 w-6 text-muted-foreground" />} title="No standing orders" description="Recurring payment schedules will appear here" />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-muted/40">
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Creditor</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Frequency</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">Amount</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Next Payment</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSOs.map((so) => (
                          <TableRow key={so.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openDetail(so, "standing_order")}>
                            <TableCell className="font-medium text-sm">{so.creditor_name}</TableCell>
                            <TableCell className="text-sm">{so.frequency}</TableCell>
                            <TableCell className="text-sm font-bold text-right">{Number(so.first_payment_amount).toLocaleString()} {so.currency}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{so.next_payment_date ? format(new Date(so.next_payment_date), "PP") : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={so.status === "Active" ? "default" : "secondary"} className="text-[10px] uppercase tracking-wider font-semibold">{so.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Direct Debits Tab */}
          <TabsContent value="direct-debits">
            <Card className="border-border/60 overflow-hidden">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : filteredDDs.length === 0 ? (
                  <EmptyState icon={<FileText className="h-6 w-6 text-muted-foreground" />} title="No direct debits" description="Direct debit mandates will appear here" />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-muted/40">
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Name</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Mandate ID</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">Last Amount</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Last Payment</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDDs.map((dd) => (
                          <TableRow key={dd.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openDetail(dd, "direct_debit")}>
                            <TableCell className="font-medium text-sm">{dd.name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{dd.mandate_identification}</TableCell>
                            <TableCell className="text-sm text-right">{dd.previous_payment_amount ? `${Number(dd.previous_payment_amount).toLocaleString()} ${dd.currency}` : "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{dd.previous_payment_date ? format(new Date(dd.previous_payment_date), "PP") : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={dd.direct_debit_status === "Active" ? "default" : "secondary"} className="text-[10px] uppercase tracking-wider font-semibold">{dd.direct_debit_status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detailType === "beneficiary" && <Users className="h-5 w-5 text-primary" />}
                  {detailType === "standing_order" && <Clock className="h-5 w-5 text-primary" />}
                  {detailType === "direct_debit" && <FileText className="h-5 w-5 text-primary" />}
                  {detailType === "beneficiary" ? "Beneficiary Details" : detailType === "standing_order" ? "Standing Order Details" : "Direct Debit Details"}
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">{selectedItem.id}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3">
                {detailType === "beneficiary" && (
                  <>
                    {[
                      { label: "Name", value: selectedItem.beneficiary_name },
                      { label: "Scheme", value: selectedItem.identification_scheme },
                      { label: "Identification", value: selectedItem.identification_value },
                      { label: "Reference", value: selectedItem.reference || "—" },
                      { label: "Status", value: selectedItem.is_active ? "Active" : "Inactive" },
                      { label: "Created", value: selectedItem.created_at ? format(new Date(selectedItem.created_at), "PPp") : "—" },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-start py-1.5">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-medium text-right max-w-[55%] break-all">{row.value}</span>
                      </div>
                    ))}
                  </>
                )}
                {detailType === "standing_order" && (
                  <>
                    {[
                      { label: "Creditor", value: selectedItem.creditor_name },
                      { label: "Frequency", value: selectedItem.frequency },
                      { label: "Amount", value: `${Number(selectedItem.first_payment_amount).toLocaleString()} ${selectedItem.currency}` },
                      { label: "Next Payment", value: selectedItem.next_payment_date ? format(new Date(selectedItem.next_payment_date), "PP") : "—" },
                      { label: "Final Payment", value: selectedItem.final_payment_date ? format(new Date(selectedItem.final_payment_date), "PP") : "—" },
                      { label: "Status", value: selectedItem.status },
                      { label: "Created", value: selectedItem.created_at ? format(new Date(selectedItem.created_at), "PPp") : "—" },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-start py-1.5">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-medium text-right max-w-[55%] break-all">{row.value}</span>
                      </div>
                    ))}
                  </>
                )}
                {detailType === "direct_debit" && (
                  <>
                    {[
                      { label: "Name", value: selectedItem.name },
                      { label: "Mandate ID", value: selectedItem.mandate_identification },
                      { label: "Last Amount", value: selectedItem.previous_payment_amount ? `${Number(selectedItem.previous_payment_amount).toLocaleString()} ${selectedItem.currency}` : "—" },
                      { label: "Last Payment", value: selectedItem.previous_payment_date ? format(new Date(selectedItem.previous_payment_date), "PP") : "—" },
                      { label: "Status", value: selectedItem.direct_debit_status },
                      { label: "Created", value: selectedItem.created_at ? format(new Date(selectedItem.created_at), "PPp") : "—" },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-start py-1.5">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-medium text-right max-w-[55%] break-all">{row.value}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
