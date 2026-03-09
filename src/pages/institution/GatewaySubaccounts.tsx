import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Building2, Search, RefreshCw, Power, Percent, Banknote } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function GatewaySubaccounts() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: subaccounts, isLoading, refetch } = useQuery({
    queryKey: ["gateway-subaccounts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("gateway_subaccounts")
        .select("*, gateway_merchants!inner(user_id, business_name)")
        .order("created_at", { ascending: false });
      return (data || []).filter((s: any) => s.gateway_merchants?.user_id === user.id);
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return subaccounts || [];
    const q = search.toLowerCase();
    return (subaccounts || []).filter((s: any) =>
      s.subaccount_name?.toLowerCase().includes(q) || s.account_number?.includes(q)
    );
  }, [subaccounts, search]);

  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const active = (subaccounts || []).filter((s: any) => s.is_active).length;
  const percentageSplits = (subaccounts || []).filter((s: any) => s.split_type === 'percentage').length;

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }}>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Subaccounts</h1>
            <p className="text-xs text-muted-foreground">Manage split payment subaccounts for marketplace distribution</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} variants={fadeUp} className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Subaccounts" value={isLoading ? "..." : (subaccounts || []).length} icon={<Building2 className="h-4 w-4" />} />
        <StatCard title="Active" value={isLoading ? "..." : active} icon={<Power className="h-4 w-4" />} />
        <StatCard title="Percentage Splits" value={isLoading ? "..." : percentageSplits} icon={<Percent className="h-4 w-4" />} />
      </motion.div>

      {/* Search & Table */}
      <motion.div custom={2} variants={fadeUp}>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search subaccounts..." className="pl-9 h-9 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium">No subaccounts found</p>
                <p className="text-xs mt-1">Create subaccounts to enable split payments</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bank</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Account</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Split</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((sub: any) => (
                      <TableRow key={sub.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium text-sm">{sub.subaccount_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{sub.settlement_bank || "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{sub.account_number || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-medium capitalize">
                            {sub.split_value}{sub.split_type === "percentage" ? "%" : ` ${sub.currency || "XAF"}`} · {sub.split_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sub.is_active ? "default" : "secondary"} className="text-[10px]">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${sub.is_active ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`} />
                            {sub.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(sub.created_at), 'PP')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DataTablePagination page={page} pageSize={pageSize} totalCount={filtered.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
