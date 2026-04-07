import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Database, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';


export default function SandboxDataGenerator() {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Form state
  const [dataType, setDataType] = useState("all");
  const [count, setCount] = useState("3");

  const generateData = async () => {
    setGenerating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('sandbox-generate-data', {
        body: {
          data_type: dataType,
          count: parseInt(count),
        }
      });

      if (error) throw error;

      setResult(data);
      toast.success('Test data generated successfully!');
    } catch (error: any) {
      console.error('Error generating data:', error);
      toast.error(extractEdgeFunctionError(error, 'Failed to generate test data'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Sandbox Data Generator</h1>
          <p className="text-muted-foreground">
            Populate your sandbox with realistic test data
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Generate Test Data</CardTitle>
              <CardDescription>
                Create accounts, transactions, and balances for testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Data Type</Label>
                <Select value={dataType} onValueChange={setDataType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      Complete Dataset (Accounts + Transactions + Balances)
                    </SelectItem>
                    <SelectItem value="accounts">Accounts Only</SelectItem>
                    <SelectItem value="transactions">Transactions Only</SelectItem>
                    <SelectItem value="balances">Balances Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">
                  {dataType === 'all' ? 'Number of Accounts' : 'Number of Records'}
                </Label>
                <Input
                  id="count"
                  type="number"
                  min="1"
                  max="50"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {dataType === 'all' 
                    ? 'Each account will have 5-10 random transactions and a balance'
                    : `Generate up to 50 ${dataType}`
                  }
                </p>
              </div>

              <Button
                onClick={generateData}
                disabled={generating || !count || parseInt(count) < 1}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Generate Test Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle>Generation Results</CardTitle>
              <CardDescription>
                Summary of created test data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Successfully Generated</span>
                  </div>

                  <div className="space-y-3">
                    {result.accounts_created > 0 && (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="text-sm text-muted-foreground">Accounts Created</span>
                        <Badge variant="default">{result.accounts_created}</Badge>
                      </div>
                    )}

                    {result.transactions_created > 0 && (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="text-sm text-muted-foreground">Transactions Created</span>
                        <Badge variant="default">{result.transactions_created}</Badge>
                      </div>
                    )}

                    {result.balances_created > 0 && (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="text-sm text-muted-foreground">Balances Created</span>
                        <Badge variant="default">{result.balances_created}</Badge>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 space-y-2">
                    <Button
                      variant="outline"
                      onClick={() => navigate('/dashboard')}
                      className="w-full"
                    >
                      View in Dashboard
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/developer/api-playground')}
                      className="w-full"
                    >
                      Test with API Playground
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Generate data to see results</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Accounts</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Random account types (Current, Savings, Business) with unique IDs and holder names
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transactions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Mix of credits and debits with realistic descriptions and amounts (1,000-50,000 XAF)
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Balances</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Account balances with timestamps, supporting multiple currencies
            </CardContent>
          </Card>
        </div>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>Use "Complete Dataset" to quickly set up a full testing environment</li>
              <li>Generated data appears immediately in your dashboard and API responses</li>
              <li>All test data is isolated to your sandbox account</li>
              <li>Use the API Playground to test endpoints with your generated data</li>
              <li>Transaction dates are randomly distributed over the past 30 days</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}