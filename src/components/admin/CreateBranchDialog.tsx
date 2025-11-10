import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CreateBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institutionId: string;
  institutionName: string;
  onSuccess?: () => void;
}

export function CreateBranchDialog({
  open,
  onOpenChange,
  institutionId,
  institutionName,
  onSuccess
}: CreateBranchDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    branch_name: `${institutionName} - Main Branch`,
    branch_code: "",
    branch_type: "main",
    address: { 
      street: "", 
      city: "", 
      state: "",
      country: "CM",
      postal_code: ""
    },
    phone: "",
    email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Create branch
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .insert({
          institution_id: institutionId,
          branch_name: formData.branch_name,
          branch_code: formData.branch_code,
          branch_type: formData.branch_type,
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          is_active: true
        })
        .select()
        .single();

      if (branchError) throw branchError;

      // Update institution with main_branch_id and verification_step
      const { error: updateError } = await supabase
        .from('institutions')
        .update({
          main_branch_id: branchData.id,
          verification_step: 'approved',
          status: 'approved'
        })
        .eq('id', institutionId);

      if (updateError) throw updateError;

      // Update verification step
      const { error: stepError } = await supabase
        .from('institution_verification_steps')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('institution_id', institutionId)
        .eq('step_type', 'branch_creation');

      if (stepError) throw stepError;

      // Complete final approval step
      const { error: finalStepError } = await supabase
        .from('institution_verification_steps')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('institution_id', institutionId)
        .eq('step_type', 'final_approval');

      if (finalStepError) throw finalStepError;

      toast({
        title: "Success",
        description: "Main branch created and institution approved successfully!",
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create Main Branch for {institutionName}
          </DialogTitle>
          <DialogDescription>
            Create the main/head office branch for this institution to complete the approval process.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Institution Details</CardTitle>
              <CardDescription className="text-xs">
                Auto-filled from institution registration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{institutionName}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Branch Name *</Label>
              <Input
                value={formData.branch_name}
                onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                placeholder="e.g., Main Branch, Head Office"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Branch Code *</Label>
              <Input
                value={formData.branch_code}
                onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
                placeholder="e.g., MAIN-001"
                required
              />
              <p className="text-xs text-muted-foreground">Unique identifier for this branch</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Branch Type</Label>
            <Select 
              value={formData.branch_type}
              onValueChange={(value) => setFormData({ ...formData, branch_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main Branch / Head Office</SelectItem>
                <SelectItem value="regional">Regional Branch</SelectItem>
                <SelectItem value="local">Local Branch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Branch Address *
            </Label>
            
            <Input
              placeholder="Street Address"
              value={formData.address.street}
              onChange={(e) => setFormData({ 
                ...formData, 
                address: { ...formData.address, street: e.target.value }
              })}
              required
            />
            
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="City"
                value={formData.address.city}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  address: { ...formData.address, city: e.target.value }
                })}
                required
              />
              <Input
                placeholder="State/Region"
                value={formData.address.state}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  address: { ...formData.address, state: e.target.value }
                })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Postal Code"
                value={formData.address.postal_code}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  address: { ...formData.address, postal_code: e.target.value }
                })}
              />
              <Input
                placeholder="Country"
                value={formData.address.country}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  address: { ...formData.address, country: e.target.value }
                })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+237 6XX XXX XXX"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="branch@institution.com"
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Branch & Approve Institution"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
