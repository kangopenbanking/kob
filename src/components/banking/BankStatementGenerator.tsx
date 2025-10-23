import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BankStatementGenerator() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    account_id: '',
    format: 'csv',
    date_from: '',
    date_to: '',
  });

  const handleGenerate = async () => {
    if (!form.account_id || !form.date_from || !form.date_to) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-bank-statement', {
        body: form,
      });

      if (error) throw error;

      // Create a blob and download
      const blob = new Blob([data], { 
        type: form.format === 'csv' ? 'text/csv' : 'text/plain' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement_${form.account_id}_${form.date_from}_${form.date_to}.${form.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Statement Generated",
        description: "Bank statement downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Bank Statement Generator
        </CardTitle>
        <CardDescription>
          Generate account statements in multiple formats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="account_id">Account ID</Label>
            <Input
              id="account_id"
              placeholder="Enter account ID"
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <Select value={form.format} onValueChange={(value) => setForm({ ...form, format: value })}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="mt940">MT940 (SWIFT)</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_from">From Date</Label>
            <Input
              id="date_from"
              type="date"
              value={form.date_from}
              onChange={(e) => setForm({ ...form, date_from: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_to">To Date</Label>
            <Input
              id="date_to"
              type="date"
              value={form.date_to}
              onChange={(e) => setForm({ ...form, date_to: e.target.value })}
            />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={loading} className="w-full">
          <Download className="h-4 w-4 mr-2" />
          {loading ? "Generating..." : "Generate & Download Statement"}
        </Button>

        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Available Formats:</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• <strong>CSV</strong> - Compatible with Excel and other spreadsheet applications</li>
            <li>• <strong>MT940</strong> - SWIFT standard format for bank statements</li>
            <li>• <strong>JSON</strong> - Structured data format for system integration</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
