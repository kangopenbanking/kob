import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BusinessKYCFormProps {
  accountId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const BusinessKYCForm = ({ accountId, onSuccess, onCancel }: BusinessKYCFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: "",
    registration_number: "",
    business_type: "",
    industry: "",
    vat_number: "",
    tax_id: "",
    registration_date: "",
    street: "",
    city: "",
    state: "",
    postal_code: "",
    country: "CM",
    business_description: "",
    annual_turnover: "",
    number_of_employees: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('business-kyc-submit', {
        body: {
          account_id: accountId,
          business_name: formData.business_name,
          registration_number: formData.registration_number,
          business_type: formData.business_type,
          industry: formData.industry,
          vat_number: formData.vat_number || null,
          tax_id: formData.tax_id || null,
          registration_date: formData.registration_date || null,
          business_address: {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
          },
          business_description: formData.business_description,
          annual_turnover: formData.annual_turnover ? parseFloat(formData.annual_turnover) : null,
          number_of_employees: formData.number_of_employees ? parseInt(formData.number_of_employees) : null,
        }
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast({ 
        title: "Success",
        description: "Business KYC submitted for verification" 
      });
      onSuccess();
    } catch (error: any) {
      console.error('Business KYC submission error:', error);
      
      let errorMessage = "Failed to submit KYC. Please try again.";
      
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="business_name">Business Name *</Label>
          <Input
            id="business_name"
            value={formData.business_name}
            onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="registration_number">Registration Number *</Label>
          <Input
            id="registration_number"
            value={formData.registration_number}
            onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="registration_date">Registration Date</Label>
          <Input
            id="registration_date"
            type="date"
            value={formData.registration_date}
            onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="business_type">Business Type *</Label>
          <Select value={formData.business_type} onValueChange={(value) => setFormData({ ...formData, business_type: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
              <SelectItem value="partnership">Partnership</SelectItem>
              <SelectItem value="limited_company">Limited Company</SelectItem>
              <SelectItem value="cooperative">Cooperative</SelectItem>
              <SelectItem value="ngo">NGO</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="industry">Industry *</Label>
          <Input
            id="industry"
            value={formData.industry}
            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
            placeholder="e.g., Technology, Retail"
            required
          />
        </div>

        <div>
          <Label htmlFor="vat_number">VAT Number</Label>
          <Input
            id="vat_number"
            value={formData.vat_number}
            onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="tax_id">Tax ID</Label>
          <Input
            id="tax_id"
            value={formData.tax_id}
            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="street">Business Address *</Label>
          <Input
            id="street"
            value={formData.street}
            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
            placeholder="Street address"
            required
          />
        </div>

        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="state">State/Region</Label>
          <Input
            id="state"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="postal_code">Postal Code</Label>
          <Input
            id="postal_code"
            value={formData.postal_code}
            onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            readOnly
          />
        </div>

        <div>
          <Label htmlFor="annual_turnover">Annual Turnover (XAF)</Label>
          <Input
            id="annual_turnover"
            type="number"
            value={formData.annual_turnover}
            onChange={(e) => setFormData({ ...formData, annual_turnover: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="number_of_employees">Number of Employees</Label>
          <Input
            id="number_of_employees"
            type="number"
            value={formData.number_of_employees}
            onChange={(e) => setFormData({ ...formData, number_of_employees: e.target.value })}
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="business_description">Business Description</Label>
          <Textarea
            id="business_description"
            value={formData.business_description}
            onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
            placeholder="Describe your business activities"
            rows={4}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit for Verification"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
