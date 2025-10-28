import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onUserCreated }: CreateUserDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone_number: "",
    country_code: "+237",
    institution_id: "",
    branch_id: "",
    position: "",
    department: "",
    employment_type: "full_time",
    start_date: new Date().toISOString().split('T')[0],
    roles: [] as string[],
    send_welcome_email: true
  });

  // Load institutions on mount
  useEffect(() => {
    loadInstitutions();
  }, []);

  const loadInstitutions = async () => {
    const { data } = await supabase
      .from('institutions')
      .select('id, institution_name')
      .order('institution_name');
    
    if (data) setInstitutions(data);
  };

  const loadBranches = async (institutionId: string) => {
    const { data } = await supabase
      .from('branches')
      .select('id, branch_name')
      .eq('institution_id', institutionId)
      .eq('is_active', true)
      .order('branch_name');
    
    if (data) setBranches(data);
  };

  const handleInstitutionChange = (value: string) => {
    setFormData({ ...formData, institution_id: value, branch_id: "" });
    loadBranches(value);
  };

  const toggleRole = (role: string) => {
    setFormData({
      ...formData,
      roles: formData.roles.includes(role)
        ? formData.roles.filter(r => r !== role)
        : [...formData.roles, role]
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message,
      });

      if (!formData.send_welcome_email && data.user.temp_password) {
        toast({
          title: "Temporary Password",
          description: `Password: ${data.user.temp_password}`,
          duration: 10000,
        });
      }

      onUserCreated();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        email: "",
        full_name: "",
        phone_number: "",
        country_code: "+237",
        institution_id: "",
        branch_id: "",
        position: "",
        department: "",
        employment_type: "full_time",
        start_date: new Date().toISOString().split('T')[0],
        roles: [],
        send_welcome_email: true
      });
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
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country_code">Country Code</Label>
              <Input
                id="country_code"
                value={formData.country_code}
                onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>User Roles</Label>
            <div className="flex gap-4">
              {['admin', 'moderator', 'institution'].map((role) => (
                <div key={role} className="flex items-center space-x-2">
                  <Checkbox
                    id={role}
                    checked={formData.roles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <Label htmlFor={role} className="cursor-pointer capitalize">
                    {role}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="institution">Institution</Label>
              <Select value={formData.institution_id} onValueChange={handleInstitutionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select institution" />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.institution_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select 
                value={formData.branch_id} 
                onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
                disabled={!formData.institution_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g., Account Officer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g., Operations"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employment">Employment Type</Label>
              <Select 
                value={formData.employment_type} 
                onValueChange={(value) => setFormData({ ...formData, employment_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="welcome_email"
              checked={formData.send_welcome_email}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, send_welcome_email: checked as boolean })
              }
            />
            <Label htmlFor="welcome_email" className="cursor-pointer">
              Send welcome email with login instructions
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create User"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
