export function FeeCalculationDiagram() {
  return (
    <div className="my-8 bg-muted p-6 rounded-lg overflow-x-auto">
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
{`Fee Calculation Workflow

Transaction Initiated
    ↓
Fee Structure Exists?
    ├─ Yes → Calculate Base Fee
    └─ No → Use Default Pricing
    ↓
Determine Fee Type:
    ├─ Fixed → Apply Fixed Amount
    ├─ Percentage → Calculate % of Amount
    ├─ Hybrid → Fixed + Percentage
    └─ Tiered → Volume-based Calculation
    ↓
Waiver Applicable?
    ├─ Yes → Apply Waiver (Reduce/Remove Fee)
    └─ No → Full Fee Applied
    ↓
Record Transaction Fee
    ↓
Add to Monthly Invoice
    ↓
Generate Invoice at Month End`}
      </pre>
    </div>
  );
}
