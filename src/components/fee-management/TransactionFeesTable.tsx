import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface TransactionFeesTableProps {
  fees: any[];
}

export function TransactionFeesTable({ fees }: TransactionFeesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transaction Fees</CardTitle>
        <CardDescription>Latest fees charged to institutions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {fees.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transaction fees recorded yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Institution</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Transaction Ref</th>
                  <th className="text-right p-2">Amount</th>
                  <th className="text-right p-2">Fee</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee: any) => (
                  <tr key={fee.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{new Date(fee.transaction_date).toLocaleDateString()}</td>
                    <td className="p-2">{fee.institutions?.institution_name}</td>
                    <td className="p-2">{fee.transaction_type.replace(/_/g, ' ')}</td>
                    <td className="p-2 font-mono text-xs">{fee.transaction_ref.substring(0, 16)}...</td>
                    <td className="p-2 text-right">{fee.transaction_amount.toLocaleString()} {fee.transaction_currency}</td>
                    <td className="p-2 text-right font-semibold">{fee.final_fee.toLocaleString()} {fee.transaction_currency}</td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        fee.billing_status === 'paid' ? 'bg-green-100 text-green-800' :
                        fee.billing_status === 'invoiced' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {fee.billing_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
