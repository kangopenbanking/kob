import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FeeStructuresTableProps {
  structures: any[];
  onRefresh: () => void;
}

export function FeeStructuresTable({ structures }: FeeStructuresTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Fee Structures</CardTitle>
        <CardDescription>Current fee configurations for all institutions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {structures.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No fee structures configured yet</p>
          ) : (
            structures.map((structure: any) => (
              <div key={structure.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">{structure.institutions?.institution_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {structure.transaction_type.replace(/_/g, ' ').toUpperCase()}
                    </p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    {structure.fee_model.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {structure.fixed_amount > 0 && (
                    <div>
                      <span className="text-muted-foreground">Fixed:</span>
                      <p className="font-medium">{structure.fixed_amount} XAF</p>
                    </div>
                  )}
                  {structure.percentage_rate > 0 && (
                    <div>
                      <span className="text-muted-foreground">Percentage:</span>
                      <p className="font-medium">{structure.percentage_rate}%</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Effective From:</span>
                    <p className="font-medium">{new Date(structure.effective_from).toLocaleDateString()}</p>
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
