import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, Users, UserCheck, Mail, Phone, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function MerchantCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data } = await supabase.from("gateway_customers").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setCustomers(data || []);
    }
    setLoading(false);
  };

  const filtered = customers.filter(c =>
    !search || c.email?.toLowerCase().includes(search.toLowerCase()) || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  const withEmail = customers.filter(c => c.email).length;
  const withPhone = customers.filter(c => c.phone).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Created"];
    const rows = filtered.map(c => [c.name || "", c.email || "", c.phone || "", c.created_at || ""]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `customers-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{customers.length} tokenized customers across your business</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" />Export
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Customers" value={customers.length.toLocaleString()} icon={<Users className="h-5 w-5" />} />
        <StatCard title="With Email" value={withEmail.toLocaleString()} icon={<Mail className="h-5 w-5" />} />
        <StatCard title="With Phone" value={withPhone.toLocaleString()} icon={<Phone className="h-5 w-5" />} />
        <StatCard title="Identified" value={customers.filter(c => c.name).length.toLocaleString()} icon={<UserCheck className="h-5 w-5" />} />
      </motion.div>

      {/* Search */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or phone..." className="pl-9 h-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <Card className="border-border/60">
          <CardContent className="p-0">
            {paged.length === 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6 text-muted-foreground" />}
                title={search ? "No matching customers" : "No customers yet"}
                description="Customers are automatically created when they make payments"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedCustomer(c)}>
                        <td className="py-3 px-4 font-medium">{c.name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-3 px-4 text-muted-foreground truncate max-w-[200px]">{c.email || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground">{c.phone || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{c.created_at ? format(new Date(c.created_at), "MMM d, yyyy") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <DataTablePagination page={page} pageSize={pageSize} totalCount={filtered.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={o => !o && setSelectedCustomer(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selectedCustomer && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Customer Details
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">{selectedCustomer.id}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {(selectedCustomer.name || selectedCustomer.email || "?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{selectedCustomer.name || "Unnamed"}</p>
                    <p className="text-sm text-muted-foreground">{selectedCustomer.email || "No email"}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  {[
                    ["Email", selectedCustomer.email],
                    ["Phone", selectedCustomer.phone],
                    ["Name", selectedCustomer.name],
                    ["Customer ID", selectedCustomer.customer_id || selectedCustomer.id],
                    ["Created", selectedCustomer.created_at ? format(new Date(selectedCustomer.created_at), "MMM d, yyyy HH:mm") : null],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex justify-between items-start py-1.5">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium text-right max-w-[60%] break-all">{value}</span>
                    </div>
                  ))}
                </div>
                {selectedCustomer.metadata && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold mb-2">Metadata</p>
                      <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                        {JSON.stringify(selectedCustomer.metadata, null, 2)}
                      </pre>
                    </div>
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
