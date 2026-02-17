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
  const [files, setFiles] = useState<{
    front: File | null;
    back: File | null;
    selfie: File | null;
  }>({ front: null, back: null, selfie: null });
  const { toast } = useToast();

  const uploadFile = async (file: File, type: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${type}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let document_front_url, document_back_url, selfie_url;
      
      // Upload files to storage
      if (files.front) {
        document_front_url = await uploadFile(files.front, 'front');
      }
      if (files.back) {
        document_back_url = await uploadFile(files.back, 'back');
      }
      if (files.selfie) {
        selfie_url = await uploadFile(files.selfie, 'selfie');
      }

      const { data, error } = await supabase.functions.invoke('kyc-submit', {
        body: {
          ...formData,
          document_front_url,
          document_back_url,
          selfie_url
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

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
      setFiles({ front: null, back: null, selfie: null });
    } catch (error: any) {
      console.error('Error submitting KYC:', error);
      
      let errorMessage = "Failed to submit KYC verification";
      
      // Extract specific error messages
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      }
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
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

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="document-front">Document Front *</Label>
                <Input
                  id="document-front"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFiles({ ...files, front: e.target.files?.[0] || null })}
                />
                {files.front && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {files.front.name}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="document-back">Document Back (if applicable)</Label>
                <Input
                  id="document-back"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFiles({ ...files, back: e.target.files?.[0] || null })}
                />
                {files.back && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {files.back.name}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="selfie">Selfie Photo *</Label>
                <Input
                  id="selfie"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFiles({ ...files, selfie: e.target.files?.[0] || null })}
                />
                {files.selfie && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {files.selfie.name}
                  </p>
                )}
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
                  <p className="text-sm text-muted-foreground">Completed on Feb 16, 2026</p>
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
