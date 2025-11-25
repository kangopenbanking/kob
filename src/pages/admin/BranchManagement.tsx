import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Plus, Edit, Trash2, MapPin, Phone, Mail, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BranchManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [branches, setBranches] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<any>(null);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [filterInstitution, setFilterInstitution] = useState("");
  const [error, setError] = useState<string | null>(null);
  
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
    try {
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
    } catch (error: any) {
      setError("Failed to verify access permissions");
      console.error("Access check error:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load institutions
      const { data: instData, error: instError } = await supabase
        .from('institutions')
        .select('id, institution_name')
        .order('institution_name');
      
      if (instError) throw instError;
      if (instData) setInstitutions(instData);

      // Load branches
      const { data, error } = await supabase.functions.invoke('admin-manage-branches', {
        body: (filterInstitution && filterInstitution !== 'all')
          ? { institution_id: filterInstitution }
          : {},
      });

      if (error) throw error;
      setBranches(data.branches || []);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to load branches";
      setError(errorMessage);
      toast({ 
        title: "Error loading data", 
        description: errorMessage, 
        variant: "destructive" 
      });
      console.error("Load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.institution_id || !formData.branch_name || !formData.branch_code) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill in all required fields", 
        variant: "destructive" 
      });
      return;
    }

    setSubmitting(true);
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
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save branch", 
        variant: "destructive" 
      });
      console.error("Submit error:", error);
    } finally {
      setSubmitting(false);
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

  const confirmDelete = (branch: any) => {
    setBranchToDelete(branch);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!branchToDelete) return;

    try {
      const { error } = await supabase.functions.invoke(`admin-manage-branches/${branchToDelete.id}`, {
        method: 'DELETE'
      });

      if (error) throw error;

      toast({ title: "Success", description: "Branch deleted successfully" });
      setDeleteDialogOpen(false);
      setBranchToDelete(null);
      loadData();
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete branch", 
        variant: "destructive" 
      });
      console.error("Delete error:", error);
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
    <>
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

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-8 w-20" />
                  <div className="flex gap-2 mt-4">
                    <Skeleton className="h-9 w-16" />
                    <Skeleton className="h-9 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : branches.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No branches found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {filterInstitution && filterInstitution !== 'all' 
                  ? "No branches for the selected institution" 
                  : "Get started by creating your first branch"}
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Branch
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <Card key={branch.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {branch.branch_name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {branch.institutions?.institution_name || 'Unknown Institution'}
                      </CardDescription>
                    </div>
                    <Badge variant={branch.is_active ? "default" : "secondary"}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {branch.address?.street && `${branch.address.street}, `}
                        {branch.address?.city || 'No address'}
                      </span>
                    </div>
                    
                    {branch.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{branch.phone}</span>
                      </div>
                    )}
                    
                    {branch.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground truncate">{branch.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Badge variant="outline" className="text-xs">
                      {branch.branch_code}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {branch.branch_type}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleEdit(branch)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => confirmDelete(branch)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingBranch ? 'Edit Branch' : 'Create New Branch'}
              </DialogTitle>
              <DialogDescription>
                {editingBranch 
                  ? 'Update the branch information below' 
                  : 'Fill in the details to create a new branch'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Institution *</Label>
                  <Select 
                    value={formData.institution_id}
                    onValueChange={(value) => setFormData({ ...formData, institution_id: value })}
                    disabled={submitting}
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
                    disabled={submitting}
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
                    disabled={submitting}
                    placeholder="Enter branch name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Branch Code *</Label>
                  <Input
                    value={formData.branch_code}
                    onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
                    required
                    disabled={submitting}
                    placeholder="Enter branch code"
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
                  disabled={submitting}
                />
                <Input
                  placeholder="City"
                  value={formData.address.city}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, city: e.target.value }
                  })}
                  required
                  disabled={submitting}
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={submitting}
                    placeholder="+237 XXX XXX XXX"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={submitting}
                    placeholder="branch@example.com"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Branch</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{branchToDelete?.branch_name}</strong>? 
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
              >
                Delete Branch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
