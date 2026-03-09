import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { FileText, Mail, CheckCircle2, Download, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function InvoiceManagement() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["institution-invoices", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("institution_invoices")
        .select(`
          *,
          institutions (institution_name)
        `)
        .order("created_at", { ascending: false });
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["invoice-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institution_invoices")
        .select("total_amount, status");
      
      if (error) throw error;
      
      const totalInvoiced = data?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;
      const outstanding = data?.filter(inv => inv.status === "pending" || inv.status === "sent")
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;
      const paid = data?.filter(inv => inv.status === "paid").length || 0;
      const total = data?.length || 0;
      
      return {
        totalInvoiced,
        outstanding,
        collectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
      };
    },
  });

  const invoiceAction = useMutation({
    mutationFn: async ({ id, action, metadata }: { id: string; action: string; metadata?: any }) => {
      const { data, error } = await supabase.functions.invoke("admin-invoice-actions", {
        body: { invoice_id: id, action, metadata },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["institution-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      const actionLabel = variables.action === "mark_paid" ? "marked as paid" : 
                          variables.action === "send_reminder" ? "reminder sent" : "voided";
      toast({ title: "Success", description: `Invoice ${actionLabel}` });
    },
    onError: (error: any) => {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: "secondary",
      sent: "default",
      paid: "default",
      overdue: "destructive",
      voided: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Invoice Management</h1>
          <p className="text-muted-foreground">Manage institutional invoices and billing</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invoice Management</h1>
        <p className="text-muted-foreground">Manage institutional invoices and billing</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalInvoiced?.toLocaleString() || 0} XAF</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.outstanding?.toLocaleString() || 0} XAF</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.collectionRate || 0}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Invoices</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoice List */}
      <div className="space-y-4">
        {invoices?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No invoices found
            </CardContent>
          </Card>
        )}

        {invoices?.map((invoice) => (
          <Card key={invoice.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {invoice.invoice_number}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {invoice.institutions?.institution_name || "Unknown Institution"}
                  </CardDescription>
                </div>
                {getStatusBadge(invoice.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Billing Period</span>
                  <span className="font-medium">
                    {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Transactions</span>
                  <span className="font-medium">{invoice.total_transactions || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{Number(invoice.subtotal_amount || 0).toLocaleString()} XAF</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Waivers</span>
                  <span className="font-medium">-{Number(invoice.total_waivers || 0).toLocaleString()} XAF</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span>Total Amount</span>
                  <span>{Number(invoice.total_amount || 0).toLocaleString()} XAF</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Due Date</span>
                  <span className="font-medium">{new Date(invoice.due_date).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => invoiceAction.mutate({ id: invoice.id, action: "mark_paid" })}
                  disabled={invoice.status === "paid" || invoiceAction.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Mark Paid
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => invoiceAction.mutate({ id: invoice.id, action: "send_reminder" })}
                  disabled={invoice.status === "paid" || invoiceAction.isPending}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Send Reminder
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => invoiceAction.mutate({ id: invoice.id, action: "void" })}
                  disabled={invoice.status === "voided" || invoiceAction.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Void
                </Button>
                <Button size="sm" variant="ghost">
                  <Download className="h-4 w-4 mr-1" />
                  Export PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
