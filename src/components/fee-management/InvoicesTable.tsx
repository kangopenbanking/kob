import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, AlertTriangle, FileText, Send, MoreHorizontal, DollarSign } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface InvoicesTableProps {
  invoices: any[];
  institutions: any[];
  onGenerateInvoice: (institutionId: string, billingCycle: string) => void;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: "bg-amber-500/10 text-amber-700 border-amber-200", label: "PENDING" },
  sent: { icon: Send, color: "bg-blue-500/10 text-blue-700 border-blue-200", label: "SENT" },
  paid: { icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", label: "PAID" },
  overdue: { icon: AlertTriangle, color: "bg-red-500/10 text-red-700 border-red-200", label: "OVERDUE" },
  cancelled: { icon: AlertTriangle, color: "bg-muted text-muted-foreground", label: "CANCELLED" },
};

export function InvoicesTable({ invoices, institutions, onGenerateInvoice, onRefresh }: InvoicesTableProps) {
  const { toast } = useToast();
  const [selectedInst, setSelectedInst] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [markPaidDialog, setMarkPaidDialog] = useState<any | null>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [adminNotes, setAdminNotes] = useState('');

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    const { error } = await supabase.from("institution_invoices").update({ status }).eq("id", invoiceId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Invoice marked as ${status}` });
      onRefresh();
    }
  };

  const handleMarkPaid = async () => {
    if (!markPaidDialog) return;
    const { error } = await supabase.from("institution_invoices").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_reference: paymentRef || null,
      payment_method: paymentMethod,
      admin_notes: adminNotes || null,
    }).eq("id", markPaidDialog.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Also update associated transaction_fees to paid
      await supabase.from("transaction_fees").update({
        billing_status: "paid",
        paid_at: new Date().toISOString(),
      }).eq("invoice_id", markPaidDialog.id);

      toast({ title: "Invoice Paid", description: `Payment recorded for ${markPaidDialog.invoice_number}` });
      setMarkPaidDialog(null);
      setPaymentRef('');
      setAdminNotes('');
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate invoice bar */}
      <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-transparent p-4">
        <h4 className="text-sm font-bold mb-3">Generate New Invoice</h4>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <Select value={selectedInst} onValueChange={setSelectedInst}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select institution" /></SelectTrigger>
              <SelectContent>
                {institutions.map((inst: any) => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.institution_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[150px]">
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="on_demand">On-Demand</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => selectedInst && onGenerateInvoice(selectedInst, billingCycle)} disabled={!selectedInst} className="h-10">
            <FileText className="h-4 w-4 mr-1.5" /> Generate
          </Button>
        </div>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">No invoices yet. Generate one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const isOverdue = inv.status === 'pending' && new Date(inv.due_date) < new Date();

            return (
              <div key={inv.id} className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${isOverdue ? 'bg-red-500/10' : cfg.color.split(' ')[0]}`}>
                      <StatusIcon className={`h-4 w-4 ${isOverdue ? 'text-red-600' : ''}`} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{inv.institutions?.institution_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${isOverdue ? STATUS_CONFIG.overdue.color : cfg.color}`}>
                      {isOverdue ? 'OVERDUE' : cfg.label}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {inv.status !== 'paid' && (
                          <DropdownMenuItem onClick={() => setMarkPaidDialog(inv)}>
                            <DollarSign className="h-3 w-3 mr-2" /> Mark as Paid
                          </DropdownMenuItem>
                        )}
                        {inv.status === 'pending' && (
                          <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'sent')}>
                            <Send className="h-3 w-3 mr-2" /> Mark as Sent
                          </DropdownMenuItem>
                        )}
                        {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                          <DropdownMenuItem className="text-destructive" onClick={() => updateInvoiceStatus(inv.id, 'cancelled')}>
                            Cancel Invoice
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Period</p>
                    <p className="font-medium">{new Date(inv.period_start).toLocaleDateString()} — {new Date(inv.period_end).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transactions</p>
                    <p className="font-medium">{inv.total_transactions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due</p>
                    <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>{new Date(inv.due_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Waivers</p>
                    <p className="font-medium text-amber-600">{Number(inv.total_waivers || 0).toLocaleString()} {inv.currency || 'XAF'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{Number(inv.total_amount).toLocaleString()} {inv.currency || 'XAF'}</p>
                  </div>
                </div>

                {inv.paid_at && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Paid on {new Date(inv.paid_at).toLocaleDateString()} • {inv.payment_method?.replace(/_/g, ' ')} • Ref: {inv.payment_reference || '—'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mark as Paid Dialog */}
      <Dialog open={!!markPaidDialog} onOpenChange={(open) => !open && setMarkPaidDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Mark invoice <strong>{markPaidDialog?.invoice_number}</strong> as paid
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="card">Card Payment</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="offset">Offset / Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Reference</Label>
              <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="e.g. TXN-2026-001" />
            </div>
            <div className="space-y-2">
              <Label>Admin Notes (optional)</Label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Any notes about this payment" rows={2} />
            </div>
            <Button onClick={handleMarkPaid} className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" /> Confirm Payment — {Number(markPaidDialog?.total_amount || 0).toLocaleString()} {markPaidDialog?.currency || 'XAF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
