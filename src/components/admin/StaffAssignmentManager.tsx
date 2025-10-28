import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Edit, Trash2, Building2, Users } from "lucide-react";

interface StaffAssignment {
  id: string;
  user_id: string;
  institution_id: string;
  branch_id: string | null;
  position: string;
  department: string | null;
  employment_type: string;
  is_active: boolean;
  profiles: { full_name: string; email: string };
  institutions: { institution_name: string };
  branches?: { branch_name: string };
}

export function StaffAssignmentManager() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [filterInstitution, setFilterInstitution] = useState("");

  const [formData, setFormData] = useState({
    user_id: "",
    institution_id: "",
    branch_id: "",
    position: "",
    department: "",
    employment_type: "full_time",
    start_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, [filterInstitution]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load institutions
      const { data: instData } = await supabase
        .from('institutions')
        .select('id, institution_name')
        .order('institution_name');
      if (instData) setInstitutions(instData);

      // Load users
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (userData) setUsers(userData);

      // Load assignments
      let query = supabase
        .from('staff_assignments')
        .select(`
          *,
          institutions(institution_name),
          branches(branch_name)
        `)
        .order('created_at', { ascending: false });

      if (filterInstitution) {
        query = query.eq('institution_id', filterInstitution);
      }

      const { data: assignData, error } = await query;
      if (error) throw error;
      
      // Get profile info separately
      if (assignData) {
        const enrichedData = await Promise.all(
          assignData.map(async (assignment) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', assignment.user_id)
              .single();
            
            return {
              ...assignment,
              profiles: profile || { full_name: 'Unknown', email: 'N/A' }
            };
          })
        );
        setAssignments(enrichedData as any);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.functions.invoke('admin-assign-staff', {
        body: {
          ...formData,
          branch_id: formData.branch_id || null
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Staff assignment updated successfully"
      });

      setDialogOpen(false);
      loadData();
      resetForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (assignment: StaffAssignment) => {
    setEditingAssignment(assignment);
    setFormData({
      user_id: assignment.user_id,
      institution_id: assignment.institution_id,
      branch_id: assignment.branch_id || "",
      position: assignment.position,
      department: assignment.department || "",
      employment_type: assignment.employment_type,
      start_date: new Date().toISOString().split('T')[0],
    });
    loadBranches(assignment.institution_id);
    setDialogOpen(true);
  };

  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Remove this staff assignment?')) return;

    try {
      const { error } = await supabase
        .from('staff_assignments')
        .update({ is_active: false })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({ title: "Success", description: "Assignment removed" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: "",
      institution_id: "",
      branch_id: "",
      position: "",
      department: "",
      employment_type: "full_time",
      start_date: new Date().toISOString().split('T')[0],
    });
    setEditingAssignment(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Staff Assignment Manager</h2>
          <p className="text-muted-foreground">Assign users to institutions and branches</p>
        </div>
        <Button onClick={openCreateDialog}>
          <UserPlus className="mr-2 h-4 w-4" />
          New Assignment
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={filterInstitution} onValueChange={setFilterInstitution}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Filter by institution" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Institutions</SelectItem>
            {institutions.map((inst) => (
              <SelectItem key={inst.id} value={inst.id}>
                {inst.institution_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Assignments ({assignments.length})</CardTitle>
          <CardDescription>View and manage user-institution-branch assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading assignments...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{assignment.profiles.full_name}</div>
                        <div className="text-sm text-muted-foreground">{assignment.profiles.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{assignment.institutions.institution_name}</TableCell>
                    <TableCell>{assignment.branches?.branch_name || '-'}</TableCell>
                    <TableCell>{assignment.position}</TableCell>
                    <TableCell>{assignment.department || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{assignment.employment_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={assignment.is_active ? "default" : "secondary"}>
                        {assignment.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(assignment)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleDelete(assignment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Edit Assignment' : 'New Staff Assignment'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>User *</Label>
              <Select 
                value={formData.user_id}
                onValueChange={(value) => setFormData({ ...formData, user_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Institution *</Label>
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
                <Label>Branch (Optional)</Label>
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
                <Label>Position *</Label>
                <Input
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="e.g., Branch Manager"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g., Operations"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employment Type *</Label>
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
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAssignment ? 'Update' : 'Create'} Assignment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
