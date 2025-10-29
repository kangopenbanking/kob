import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Plus, Edit, Trash2, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function BranchManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [branches, setBranches] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [filterInstitution, setFilterInstitution] = useState("");
  
  const [formData, setFormData] = useState({
    institution_id: "",
    branch_name: "",
    branch_code: "",
    branch_type: "local",
    address: { street: "", city: "", country: "CM" },
    phone: "",
    email: "",
    is_active: true
  });

  useEffect(() => {
    checkAccess();
    loadData();
  }, [filterInstitution]);

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      navigate('/dashboard');
      toast({ title: "Access denied", variant: "destructive" });
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load institutions
      const { data: instData } = await supabase
        .from('institutions')
        .select('id, institution_name')
        .order('institution_name');
      
      if (instData) setInstitutions(instData);

      // Load branches
      const { data, error } = await supabase.functions.invoke('admin-manage-branches', {
        method: 'GET',
        headers: (filterInstitution && filterInstitution !== 'all')
          ? { 'x-institution-id': filterInstitution }
          : undefined,
      });

      if (error) throw error;
      setBranches(data.branches || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const method = editingBranch ? 'PUT' : 'POST';
      const endpoint = editingBranch 
        ? `admin-manage-branches/${editingBranch.id}`
        : 'admin-manage-branches';

      const { error } = await supabase.functions.invoke(endpoint, {
        method,
        body: formData
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Branch ${editingBranch ? 'updated' : 'created'} successfully`
      });

      setDialogOpen(false);
      setEditingBranch(null);
      loadData();
      resetForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (branch: any) => {
    setEditingBranch(branch);
    setFormData({
      institution_id: branch.institution_id,
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
      branch_type: branch.branch_type,
      address: branch.address,
      phone: branch.phone || "",
      email: branch.email || "",
      is_active: branch.is_active
    });
    setDialogOpen(true);
  };

  const handleDelete = async (branchId: string) => {
    if (!confirm('Are you sure you want to delete this branch?')) return;

    try {
      const { error } = await supabase.functions.invoke(`admin-manage-branches/${branchId}`, {
        method: 'DELETE'
      });

      if (error) throw error;

      toast({ title: "Success", description: "Branch deleted successfully" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      institution_id: "",
      branch_name: "",
      branch_code: "",
      branch_type: "local",
      address: { street: "", city: "", country: "CM" },
      phone: "",
      email: "",
      is_active: true
    });
  };

  const openCreateDialog = () => {
    setEditingBranch(null);
    resetForm();
    setDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Branch Management</h1>
            <p className="text-muted-foreground">Manage bank and financial institution branches</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Branch
          </Button>
        </div>

        <div className="flex gap-4">
          <Select value={filterInstitution} onValueChange={setFilterInstitution}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Filter by institution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Institutions</SelectItem>
              {institutions.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.institution_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading branches...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <Card key={branch.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {branch.branch_name}
                      </CardTitle>
                      <CardDescription>{branch.institutions?.institution_name}</CardDescription>
                    </div>
                    <Badge variant={branch.is_active ? "default" : "secondary"}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{branch.address?.city || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Code: {branch.branch_code}</span>
                  </div>
                  <Badge variant="outline">{branch.branch_type}</Badge>
                  
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(branch)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleDelete(branch.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingBranch ? 'Edit Branch' : 'Create New Branch'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Institution *</Label>
                  <Select 
                    value={formData.institution_id}
                    onValueChange={(value) => setFormData({ ...formData, institution_id: value })}
                  >
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
                  <Label>Branch Type *</Label>
                  <Select 
                    value={formData.branch_type}
                    onValueChange={(value) => setFormData({ ...formData, branch_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Main</SelectItem>
                      <SelectItem value="regional">Regional</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Branch Name *</Label>
                  <Input
                    value={formData.branch_name}
                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Branch Code *</Label>
                  <Input
                    value={formData.branch_code}
                    onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address *</Label>
                <Input
                  placeholder="Street"
                  value={formData.address.street}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, street: e.target.value }
                  })}
                  required
                />
                <Input
                  placeholder="City"
                  value={formData.address.city}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, city: e.target.value }
                  })}
                  required
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingBranch ? 'Update' : 'Create'} Branch
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
