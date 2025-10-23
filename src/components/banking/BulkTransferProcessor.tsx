import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProcessingResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; error: string; data: any }>;
}

export function BulkTransferProcessor() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [csvPreview, setCsvPreview] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      
      // Read file for preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').slice(0, 6); // Preview first 5 rows + header
        setCsvPreview(lines.join('\n'));
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to process",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const csvData = event.target?.result as string;

        const { data, error } = await supabase.functions.invoke('bulk-transfers', {
          body: { csv_data: csvData },
        });

        if (error) throw error;

        setResult(data.results);

        toast({
          title: "Processing Complete",
          description: `${data.results.successful} successful, ${data.results.failed} failed`,
        });
      };

      reader.readAsText(file);
    } catch (error: any) {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Upload a CSV file containing bulk transfer data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <div className="text-sm text-muted-foreground mb-4">
                {file ? file.name : 'Drop CSV file here or click to browse'}
              </div>
            </Label>
            <Input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="max-w-xs mx-auto"
            />
          </div>

          {csvPreview && (
            <div className="space-y-2">
              <Label>File Preview (first 5 rows)</Label>
              <div className="bg-muted p-4 rounded-lg overflow-auto">
                <pre className="text-xs font-mono">{csvPreview}</pre>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>CSV Format Requirements</Label>
            <div className="bg-muted p-4 rounded-lg">
              <code className="text-sm">
                source_account,destination_account,amount,description,currency
                <br />
                ACC001,ACC002,10000.00,Salary Payment,XAF
                <br />
                ACC001,ACC003,5000.00,Vendor Payment,XAF
              </code>
            </div>
          </div>

          <Button
            onClick={handleProcess}
            disabled={!file || processing}
            className="w-full"
          >
            {processing ? "Processing..." : "Process Bulk Transfers"}
          </Button>

          {processing && (
            <div className="space-y-2">
              <Progress value={50} />
              <p className="text-sm text-center text-muted-foreground">
                Processing transfers...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold">Total</div>
                  <div className="text-2xl">{result.total}</div>
                </AlertDescription>
              </Alert>

              <Alert className="border-green-500">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  <div className="font-semibold">Successful</div>
                  <div className="text-2xl text-green-600">{result.successful}</div>
                </AlertDescription>
              </Alert>

              <Alert className="border-red-500">
                <XCircle className="h-4 w-4 text-red-500" />
                <AlertDescription>
                  <div className="font-semibold">Failed</div>
                  <div className="text-2xl text-red-600">{result.failed}</div>
                </AlertDescription>
              </Alert>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Failed Transfers</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant="destructive">{error.row}</Badge>
                          </TableCell>
                          <TableCell>{error.data.source_account}</TableCell>
                          <TableCell>{error.data.destination_account}</TableCell>
                          <TableCell>{error.data.amount}</TableCell>
                          <TableCell className="text-red-600 text-sm">{error.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
