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
import { Upload, FileCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PreviewTransaction {
  transaction_reference: string;
  amount: number;
  currency: string;
  credit_debit_indicator: string;
  booking_date: string;
  transaction_information: string;
  validation_status?: string;
  validation_message?: string;
}

export function TransactionImportPreview() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewTransaction[]>([]);
  const [fileType, setFileType] = useState<string>('csv');
  const [bankConnectionId, setBankConnectionId] = useState<string>('');
  const [importResult, setImportResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview([]);
      setImportResult(null);
      
      // Auto-detect file type
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (extension === 'csv') setFileType('csv');
      else if (extension === 'xml') setFileType('camt053');
      else if (extension === 'txt' || extension === 'mt940') setFileType('mt940');
    }
  };

  const handlePreview = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to preview",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileData = event.target?.result as string;

        // Parse based on file type
        let parsedTransactions: PreviewTransaction[] = [];
        
        if (fileType === 'csv') {
          parsedTransactions = parseCSVPreview(fileData);
        } else if (fileType === 'mt940') {
          parsedTransactions = parseMT940Preview(fileData);
        } else if (fileType === 'camt053') {
          parsedTransactions = parseCAMT053Preview(fileData);
        }

        // Validate transactions
        const validatedTransactions = validateTransactions(parsedTransactions);
        setPreview(validatedTransactions);

        toast({
          title: "Preview Generated",
          description: `${parsedTransactions.length} transactions loaded`,
        });
      };

      reader.readAsText(file);
    } catch (error: any) {
      toast({
        title: "Preview Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || preview.length === 0 || !bankConnectionId) {
      toast({
        title: "Missing Information",
        description: "Please preview transactions and select a bank connection",
        variant: "destructive",
      });
      return;
    }

    const validTransactions = preview.filter(t => t.validation_status === 'valid');
    if (validTransactions.length === 0) {
      toast({
        title: "No Valid Transactions",
        description: "All transactions have validation errors",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileData = event.target?.result as string;

        const { data, error } = await supabase.functions.invoke('bank-import-transactions', {
          body: {
            bank_connection_id: bankConnectionId,
            file_name: file.name,
            file_type: fileType,
            file_data: fileData,
          },
        });

        if (error) throw error;

        setImportResult(data);
        toast({
          title: "Import Complete",
          description: `${data.successful_imports} transactions imported successfully`,
        });
      };

      reader.readAsText(file);
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const parseCSVPreview = (data: string): PreviewTransaction[] => {
    const lines = data.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const transactions: PreviewTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      transactions.push({
        transaction_reference: row.reference || row.transaction_reference || `CSV-${i}`,
        amount: parseFloat(row.amount) || 0,
        currency: row.currency || 'XAF',
        credit_debit_indicator: row.type || row.credit_debit_indicator || 'Debit',
        booking_date: row.date || row.booking_date || new Date().toISOString(),
        transaction_information: row.description || row.transaction_information || '',
      });
    }

    return transactions;
  };

  const parseMT940Preview = (data: string): PreviewTransaction[] => {
    // Simplified MT940 preview parsing
    const transactions: PreviewTransaction[] = [];
    const lines = data.split('\n');
    
    lines.forEach((line, index) => {
      if (line.startsWith(':61:')) {
        const content = line.substring(4);
        const match = content.match(/(\d{6}).*?(C|D)(\d+,?\d*)/);
        if (match) {
          transactions.push({
            transaction_reference: `MT940-${index}`,
            amount: parseFloat(match[3].replace(',', '.')),
            currency: 'XAF',
            credit_debit_indicator: match[2] === 'C' ? 'Credit' : 'Debit',
            booking_date: new Date().toISOString(),
            transaction_information: 'MT940 Transaction',
          });
        }
      }
    });

    return transactions;
  };

  const parseCAMT053Preview = (data: string): PreviewTransaction[] => {
    // Simplified CAMT.053 preview parsing
    const transactions: PreviewTransaction[] = [];
    const entryRegex = /<Ntry>(.*?)<\/Ntry>/gs;
    const entries = data.match(entryRegex);

    entries?.forEach((entry, index) => {
      const amtMatch = entry.match(/<Amt[^>]*>([^<]+)<\/Amt>/);
      const cdtDbtIndMatch = entry.match(/<CdtDbtInd>([^<]+)<\/CdtDbtInd>/);

      transactions.push({
        transaction_reference: `CAMT-${index}`,
        amount: amtMatch ? parseFloat(amtMatch[1]) : 0,
        currency: 'XAF',
        credit_debit_indicator: cdtDbtIndMatch && cdtDbtIndMatch[1] === 'CRDT' ? 'Credit' : 'Debit',
        booking_date: new Date().toISOString(),
        transaction_information: 'CAMT.053 Transaction',
      });
    });

    return transactions;
  };

  const validateTransactions = (transactions: PreviewTransaction[]) => {
    return transactions.map(txn => {
      const newTxn = { ...txn };
      
      // Validation rules
      if (!newTxn.amount || newTxn.amount <= 0) {
        newTxn.validation_status = 'error';
        newTxn.validation_message = 'Invalid amount';
        return newTxn;
      }

      if (!newTxn.transaction_reference) {
        newTxn.validation_status = 'error';
        newTxn.validation_message = 'Missing reference';
        return newTxn;
      }

      newTxn.validation_status = 'valid';
      return newTxn;
    });
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'valid') return <Badge className="bg-green-500">Valid</Badge>;
    if (status === 'duplicate') return <Badge variant="secondary">Duplicate</Badge>;
    if (status === 'error') return <Badge variant="destructive">Error</Badge>;
    return null;
  };

  const validCount = preview.filter(t => t.validation_status === 'valid').length;
  const duplicateCount = preview.filter(t => t.validation_status === 'duplicate').length;
  const errorCount = preview.filter(t => t.validation_status === 'error').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Transactions with Preview
          </CardTitle>
          <CardDescription>
            Upload and validate transaction files before importing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Bank Connection</Label>
              <Select value={bankConnectionId} onValueChange={setBankConnectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank1">Commercial Bank Cameroon</SelectItem>
                  <SelectItem value="bank2">Afriland First Bank</SelectItem>
                  <SelectItem value="bank3">Société Générale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>File Type</Label>
              <Select value={fileType} onValueChange={setFileType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="mt940">MT940 (SWIFT)</SelectItem>
                  <SelectItem value="camt053">CAMT.053 (ISO 20022)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Upload File</Label>
              <Input
                type="file"
                accept=".csv,.txt,.xml,.mt940"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePreview} disabled={!file || loading} variant="outline">
              <FileCheck className="h-4 w-4 mr-2" />
              {loading ? "Processing..." : "Preview Transactions"}
            </Button>
            <Button onClick={handleImport} disabled={preview.length === 0 || validCount === 0 || loading}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Import {validCount > 0 ? `${validCount} Valid` : ''} Transactions
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction Preview</CardTitle>
            <CardDescription>
              Review and validate before importing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Alert className="border-green-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  <div className="font-semibold">Valid</div>
                  <div className="text-2xl text-green-600">{validCount}</div>
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <AlertDescription>
                  <div className="font-semibold">Duplicates</div>
                  <div className="text-2xl text-orange-600">{duplicateCount}</div>
                </AlertDescription>
              </Alert>

              <Alert className="border-red-500">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <AlertDescription>
                  <div className="font-semibold">Errors</div>
                  <div className="text-2xl text-red-600">{errorCount}</div>
                </AlertDescription>
              </Alert>
            </div>

            <div className="border rounded-lg max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((txn, index) => (
                    <TableRow key={index}>
                      <TableCell>{getStatusBadge(txn.validation_status)}</TableCell>
                      <TableCell className="font-mono text-sm">{txn.transaction_reference}</TableCell>
                      <TableCell>
                        <Badge variant={txn.credit_debit_indicator === 'Credit' ? 'default' : 'secondary'}>
                          {txn.credit_debit_indicator}
                        </Badge>
                      </TableCell>
                      <TableCell>{txn.currency} {txn.amount.toLocaleString()}</TableCell>
                      <TableCell className="max-w-xs truncate">{txn.transaction_information}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{txn.validation_message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {importResult && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold">Import Complete</div>
            <div>Total: {importResult.total_records} | Success: {importResult.successful_imports} | Failed: {importResult.failed_imports} | Duplicates: {importResult.duplicate_records}</div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
