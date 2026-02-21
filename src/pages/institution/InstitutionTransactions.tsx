import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowUpDown, 
  Download, 
  Search, 
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  credit_debit_indicator: string;
  booking_datetime: string;
  transaction_information: string;
  account_id: string;
  transaction_type: string;
}

export default function InstitutionTransactions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  useEffect(() => {
    loadData();
  }, [pagination.page, statusFilter, typeFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Get institution
      const { data: institution } = await supabase
        .from("institutions")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!institution) {
        navigate('/register');
        return;
      }

      setInstitutionId(institution.id);

      // Build query - query by institution_id directly
      let query = supabase
        .from("transactions")
        .select("*", { count: "exact" })
        .eq("institution_id", institution.id);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (typeFilter !== "all") {
        query = query.eq("credit_debit_indicator", typeFilter === "credit" ? "Credit" : "Debit");
      }

      const from = (pagination.page - 1) * pagination.limit;
      const to = from + pagination.limit - 1;

      const { data, count, error } = await query
        .order("booking_datetime", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Map to our interface
      const mapped: Transaction[] = (data || []).map((t: any) => ({
        id: t.id,
        amount: Number(t.amount) || 0,
        currency: t.currency || 'XAF',
        status: t.status || 'unknown',
        credit_debit_indicator: t.credit_debit_indicator || 'Debit',
        booking_datetime: t.booking_datetime || t.created_at,
        transaction_information: t.transaction_information || '',
        account_id: t.account_id || '',
        transaction_type: t.transaction_type || ''
      }));

      setTransactions(mapped);
      setPagination(prev => ({ ...prev, total: count || 0 }));
    } catch (error: any) {
      toast({
        title: "Error loading transactions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t =>
    t.transaction_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.transaction_information?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportTransactions = () => {
    const csv = [
      ["ID", "Amount", "Currency", "Type", "Status", "Date", "Description"].join(","),
      ...filteredTransactions.map(t => [
        t.id,
        t.amount,
        t.currency,
        t.credit_debit_indicator,
        t.status,
        t.booking_datetime,
        `"${t.transaction_information || ''}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Transactions</h1>
            <p className="text-muted-foreground">Monitor and manage all transaction activity</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportTransactions}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <CardDescription>
              {pagination.total} total transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ArrowUpDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map(transaction => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        transaction.credit_debit_indicator === "Credit" 
                          ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                          : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {transaction.credit_debit_indicator === "Credit" 
                          ? <ArrowDownLeft className="h-5 w-5" />
                          : <ArrowUpRight className="h-5 w-5" />
                        }
                      </div>
                      <div>
                        <p className="font-medium">{transaction.transaction_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.transaction_information || "No description"}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {transaction.booking_datetime ? format(new Date(transaction.booking_datetime), "PPp") : "N/A"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        transaction.credit_debit_indicator === "Credit" 
                          ? "text-green-600 dark:text-green-400" 
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {transaction.credit_debit_indicator === "Credit" ? "+" : "-"}
                        {transaction.amount.toLocaleString()} {transaction.currency}
                      </p>
                      <Badge variant={
                        transaction.status === "completed" ? "default" :
                        transaction.status === "pending" ? "secondary" : "destructive"
                      }>
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
