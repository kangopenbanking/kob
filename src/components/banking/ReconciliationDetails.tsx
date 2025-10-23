import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReconciliationResult {
  reconciliation_id: string;
  summary: {
    total_bank_transactions: number;
    total_system_transactions: number;
    matched_count: number;
    unmatched_bank_count: number;
    unmatched_system_count: number;
    match_percentage: string;
  };
}

export function ReconciliationDetails() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [result, setResult] = useState<ReconciliationResult | null>(null);

  const handleReconciliation = async () => {
    if (!selectedBank || !dateFrom) {
      toast({
        title: "Missing Information",
        description: "Please select a bank and reconciliation date",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bank-reconcile', {
        body: {
          bank_connection_id: selectedBank,
          reconciliation_date: dateFrom,
        },
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "Reconciliation Complete",
        description: `${data.summary.matched_count} transactions matched (${data.summary.match_percentage}%)`,
      });
    } catch (error: any) {
      toast({
        title: "Reconciliation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Transaction Reconciliation</CardTitle>
          <CardDescription>
            Match and reconcile transactions across banking systems
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recon_bank">Select Bank Connection</Label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger id="recon_bank">
                  <SelectValue placeholder="Choose bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank1">Commercial Bank Cameroon</SelectItem>
                  <SelectItem value="bank2">Afriland First Bank</SelectItem>
                  <SelectItem value="bank3">Société Générale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recon_from">Reconciliation Date</Label>
              <Input
                id="recon_from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recon_to">End Date (Optional)</Label>
              <Input
                id="recon_to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleReconciliation} disabled={!selectedBank || !dateFrom || loading}>
              <Play className="h-4 w-4 mr-2" />
              {loading ? "Processing..." : "Start Reconciliation"}
            </Button>
            <Button variant="outline" disabled={!selectedBank}>
              <Download className="h-4 w-4 mr-2" />
              Download Bank Statement
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Alert>
                <AlertDescription>
                  <div className="text-sm font-medium">Bank Transactions</div>
                  <div className="text-2xl font-bold">{result.summary.total_bank_transactions}</div>
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertDescription>
                  <div className="text-sm font-medium">System Transactions</div>
                  <div className="text-2xl font-bold">{result.summary.total_system_transactions}</div>
                </AlertDescription>
              </Alert>

              <Alert className="border-green-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  <div className="text-sm font-medium">Matched</div>
                  <div className="text-2xl font-bold text-green-600">{result.summary.matched_count}</div>
                </AlertDescription>
              </Alert>

              <Alert className="border-orange-500">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <AlertDescription>
                  <div className="text-sm font-medium">Unmatched (Bank)</div>
                  <div className="text-2xl font-bold text-orange-600">{result.summary.unmatched_bank_count}</div>
                </AlertDescription>
              </Alert>

              <Alert className="border-orange-500">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <AlertDescription>
                  <div className="text-sm font-medium">Unmatched (System)</div>
                  <div className="text-2xl font-bold text-orange-600">{result.summary.unmatched_system_count}</div>
                </AlertDescription>
              </Alert>
            </div>

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold">Match Percentage</div>
                <div className="text-3xl font-bold">{result.summary.match_percentage}%</div>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Reconciliation ID</Label>
              <Input value={result.reconciliation_id} readOnly className="font-mono text-sm" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
