import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InvoicesTableProps {
  invoices: any[];
  institutions: any[];
  onGenerateInvoice: (institutionId: string, billingCycle: string) => void;
  onRefresh: () => void;
}

export function InvoicesTable({ invoices, institutions, onGenerateInvoice }: InvoicesTableProps) {
  const [selectedInst, setSelectedInst] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Institution Invoices</CardTitle>
        <CardDescription>Generate and manage billing invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-4">Generate New Invoice</h4>
          <div className="grid grid-cols-3 gap-4">
            <Select value={selectedInst} onValueChange={setSelectedInst}>
              <SelectTrigger>
                <SelectValue placeholder="Select institution" />
              </SelectTrigger>
              <SelectContent>
                {institutions.map((inst: any) => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.institution_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="on_demand">On-Demand (Last 30 Days)</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              onClick={() => selectedInst && onGenerateInvoice(selectedInst, billingCycle)}
              disabled={!selectedInst}
            >
              Generate Invoice
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No invoices generated yet</p>
          ) : (
            invoices.map((invoice: any) => (
              <div key={invoice.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold">{invoice.invoice_number}</h4>
                    <p className="text-sm text-muted-foreground">{invoice.institutions?.institution_name}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                    invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                    invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {invoice.status.toUpperCase()}
                  </span>
                </div>
                
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Period:</span>
                    <p className="font-medium">
                      {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transactions:</span>
                    <p className="font-medium">{invoice.total_transactions}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Due Date:</span>
                    <p className="font-medium">{new Date(invoice.due_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>
                    <p className="font-semibold text-lg">{invoice.total_amount.toLocaleString()} {invoice.currency}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
