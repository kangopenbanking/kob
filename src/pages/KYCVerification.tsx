import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

export default function KYCVerification() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    verification_type: 'identity',
    document_type: '',
    document_number: '',
    document_country: '',
    document_expiry_date: '',
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('kyc-submit', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "KYC verification submitted successfully",
      });

      // Reset form
      setFormData({
        verification_type: 'identity',
        document_type: '',
        document_number: '',
        document_country: '',
        document_expiry_date: '',
      });
    } catch (error: any) {
      console.error('Error submitting KYC:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit KYC verification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">KYC Verification</h1>
        <p className="text-muted-foreground">
          Complete your identity verification to access all features
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity Verification</CardTitle>
          <CardDescription>
            Please provide your identification documents for verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verification_type">Verification Type</Label>
              <Select
                value={formData.verification_type}
                onValueChange={(value) => setFormData({ ...formData, verification_type: value })}
              >
                <SelectTrigger id="verification_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="identity">Identity Verification</SelectItem>
                  <SelectItem value="address">Address Verification</SelectItem>
                  <SelectItem value="source_of_funds">Source of Funds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_type">Document Type</Label>
              <Select
                value={formData.document_type}
                onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                required
              >
                <SelectTrigger id="document_type">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="national_id">National ID Card</SelectItem>
                  <SelectItem value="drivers_license">Driver's License</SelectItem>
                  <SelectItem value="utility_bill">Utility Bill</SelectItem>
                  <SelectItem value="bank_statement">Bank Statement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_number">Document Number</Label>
              <Input
                id="document_number"
                value={formData.document_number}
                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                placeholder="Enter document number"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_country">Country of Issue</Label>
              <Input
                id="document_country"
                value={formData.document_country}
                onChange={(e) => setFormData({ ...formData, document_country: e.target.value })}
                placeholder="e.g., Cameroon"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_expiry_date">Expiry Date</Label>
              <Input
                id="document_expiry_date"
                type="date"
                value={formData.document_expiry_date}
                onChange={(e) => setFormData({ ...formData, document_expiry_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Document Upload</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG or PDF (max. 10MB)
                </p>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  Choose File
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">Important Information</p>
                  <ul className="mt-2 text-blue-700 list-disc list-inside space-y-1">
                    <li>Ensure all document details are clearly visible</li>
                    <li>Document must be valid and not expired</li>
                    <li>Verification typically takes 1-2 business days</li>
                    <li>Your data is encrypted and securely stored</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit for Verification"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Verification Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Identity Verification</p>
                  <p className="text-sm text-muted-foreground">Completed on Jan 15, 2025</p>
                </div>
              </div>
              <span className="text-sm text-green-600 font-medium">Approved</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
