import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowUpDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TransactionFeesTableProps {
  fees: any[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-200",
  invoiced: "bg-blue-500/10 text-blue-700 border-blue-200",
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
};

export function TransactionFeesTable({ fees }: TransactionFeesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<"transaction_date" | "final_fee" | "transaction_amount">("transaction_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = fees
    .filter((f) => {
      if (statusFilter !== "all" && f.billing_status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          f.transaction_ref?.toLowerCase().includes(q) ||
          f.institutions?.institution_name?.toLowerCase().includes(q) ||
          f.transaction_type?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = sortField === "transaction_date" ? new Date(a[sortField]).getTime() : Number(a[sortField]);
      const bVal = sortField === "transaction_date" ? new Date(b[sortField]).getTime() : Number(b[sortField]);
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const totalFees = filtered.reduce((s, f) => s + Number(f.final_fee || 0), 0);
  const totalWaived = filtered.reduce((s, f) => s + Number(f.waived_amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex flex-wrap gap-4 rounded-xl border bg-gradient-to-r from-primary/5 to-transparent p-4">
        <div>
          <p className="text-xs text-muted-foreground">Total Fees</p>
          <p className="text-lg font-bold">{totalFees.toLocaleString()} XAF</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Waived</p>
          <p className="text-lg font-bold text-amber-600">{totalWaived.toLocaleString()} XAF</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Records</p>
          <p className="text-lg font-bold">{filtered.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search ref, institution, type…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-10">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-semibold">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("transaction_date")}>
                    Date <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left p-3 font-semibold">Institution</th>
                <th className="text-left p-3 font-semibold">Type</th>
                <th className="text-left p-3 font-semibold">Ref</th>
                <th className="text-right p-3 font-semibold">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("transaction_amount")}>
                    Amount <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-right p-3 font-semibold">Calculated</th>
                <th className="text-right p-3 font-semibold">Waived</th>
                <th className="text-right p-3 font-semibold">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("final_fee")}>
                    Final Fee <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-center p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No transaction fees found</td></tr>
              ) : (
                filtered.map((fee) => (
                  <tr key={fee.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-3">{new Date(fee.transaction_date).toLocaleDateString()}</td>
                    <td className="p-3 font-medium">{fee.institutions?.institution_name || '—'}</td>
                    <td className="p-3 capitalize">{fee.transaction_type?.replace(/_/g, ' ')}</td>
                    <td className="p-3 font-mono text-xs">{fee.transaction_ref?.substring(0, 12)}…</td>
                    <td className="p-3 text-right">{Number(fee.transaction_amount).toLocaleString()} {fee.transaction_currency || 'XAF'}</td>
                    <td className="p-3 text-right">{Number(fee.calculated_fee).toLocaleString()}</td>
                    <td className="p-3 text-right text-amber-600">{Number(fee.waived_amount || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-bold">{Number(fee.final_fee).toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[fee.billing_status] || ''}`}>
                        {fee.billing_status?.toUpperCase() || 'PENDING'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
