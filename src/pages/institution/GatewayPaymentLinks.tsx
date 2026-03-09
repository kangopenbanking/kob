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
import { Link2, Copy, ExternalLink, Search, RefreshCw, Activity, Banknote } from "lucide-react";
import { toast } from "sonner";
import { API_CONFIG } from "@/config/api";
import { format } from "date-fns";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function GatewayPaymentLinks() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: links, isLoading, refetch } = useQuery({
    queryKey: ["gateway-payment-links"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("gateway_payment_links")
        .select("*, gateway_merchants!inner(user_id, business_name)")
        .order("created_at", { ascending: false });
      return (data || []).filter((l: any) => l.gateway_merchants?.user_id === user.id);
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return links || [];
    const q = search.toLowerCase();
    return (links || []).filter((l: any) => l.title?.toLowerCase().includes(q));
  }, [links, search]);

  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const activeLinks = (links || []).filter((l: any) => l.status === "active").length;
  const totalUses = (links || []).reduce((sum: number, l: any) => sum + (l.current_uses || 0), 0);

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${API_CONFIG.SITE_URL}/pay/${slug}`);
    toast.success("Payment link copied!");
  };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }}>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Payment Links</h1>
            <p className="text-xs text-muted-foreground">Create and manage shareable payment links</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} variants={fadeUp} className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Links" value={isLoading ? "..." : (links || []).length} icon={<Link2 className="h-4 w-4" />} />
        <StatCard title="Active Links" value={isLoading ? "..." : activeLinks} icon={<Activity className="h-4 w-4" />} />
        <StatCard title="Total Uses" value={isLoading ? "..." : totalUses} icon={<Banknote className="h-4 w-4" />} />
      </motion.div>

      {/* Search & Table */}
      <motion.div custom={2} variants={fadeUp}>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search payment links..." className="pl-9 h-9 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium">No payment links found</p>
                <p className="text-xs mt-1">Create payment links via the API to start collecting payments</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Title</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Currency</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Uses</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((link: any) => (
                      <TableRow key={link.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium text-sm">{link.title}</TableCell>
                        <TableCell className="text-sm font-semibold text-right tabular-nums">{link.amount?.toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] font-medium">{link.currency}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={link.status === "active" ? "default" : "secondary"} className="text-[10px]">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${link.status === 'active' ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`} />
                            {link.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{link.current_uses || 0}{link.max_uses ? `/${link.max_uses}` : ""}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(link.created_at), 'PP')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyLink(link.slug)}><Copy className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild><a href={`/pay/${link.slug}`} target="_blank"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                          </div>
                        </TableCell>
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
