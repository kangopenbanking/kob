import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, BarChart3 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function BankReports() {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);

  const generateReport = async (reportType: string) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("banking-api-router", {
        body: {
          action: "generate_report",
          institution_id: "current",
          report_type: reportType,
        },
      });
      if (error) throw error;
      setReport(data?.data);
      toast.success("Report generated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const reportTypes = [
    { id: "transaction_summary", title: "Transaction Summary", desc: "Aggregate transaction volumes and values", icon: BarChart3 },
    { id: "cobac_regulatory", title: "COBAC Regulatory Report", desc: "Compliance report for CEMAC regulatory submission", icon: FileText },
    { id: "balance_sheet", title: "Balance Sheet", desc: "Account balances and positions across all connected banks", icon: FileText },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">Generate COBAC-compliant reports and download statements</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {reportTypes.map((rt) => (
          <Card key={rt.id} className="border border-border/50">
            <CardHeader>
              <rt.icon className="h-8 w-8 text-primary" />
              <CardTitle className="text-base mt-2">{rt.title}</CardTitle>
              <CardDescription className="text-xs">{rt.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => generateReport(rt.id)}
                disabled={generating}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                Generate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {report && (
        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generated Report
              <Badge variant="outline" className="ml-2 text-xs">
                {report.cobac_compliant ? "COBAC Compliant" : "Standard"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Transactions</p>
                <p className="text-lg font-bold">{report.summary?.total_transactions?.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Credits</p>
                <p className="text-lg font-bold">{report.summary?.total_credits?.toLocaleString()} {report.summary?.currency}</p>
              </div>
              <div className="rounded-lg border border-border/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Debits</p>
                <p className="text-lg font-bold">{report.summary?.total_debits?.toLocaleString()} {report.summary?.currency}</p>
              </div>
              <div className="rounded-lg border border-border/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Net Position</p>
                <p className="text-lg font-bold">{report.summary?.net_position?.toLocaleString()} {report.summary?.currency}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Generated: {report.generated_at}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
