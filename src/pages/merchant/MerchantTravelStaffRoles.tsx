import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Loader2, Shield, Users, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const permissionKeys = [
  { key: 'services', label: 'Services', desc: 'Manage travel services' },
  { key: 'routes', label: 'Routes', desc: 'Create/edit routes' },
  { key: 'seating', label: 'Seating', desc: 'Manage seating plans' },
  { key: 'timetable', label: 'Timetable', desc: 'Manage schedules' },
  { key: 'bookings', label: 'Bookings', desc: 'View/manage bookings' },
  { key: 'discounts', label: 'Discounts', desc: 'Manage promotions' },
  { key: 'scanner', label: 'Scanner', desc: 'Scan tickets' },
  { key: 'notifications', label: 'Notifications', desc: 'Send passenger alerts' },
  { key: 'reports', label: 'Reports', desc: 'View analytics/reports' },
];

const rolePresets: Record<string, Record<string, boolean>> = {
  admin: Object.fromEntries(permissionKeys.map(p => [p.key, true])),
  manager: { services: true, routes: true, seating: true, timetable: true, bookings: true, discounts: true, scanner: true, notifications: true, reports: true },
  booking_agent: { bookings: true, scanner: true, notifications: false, services: false, routes: false, seating: false, timetable: false, discounts: false, reports: false },
  scanner: { scanner: true, bookings: false, services: false, routes: false, seating: false, timetable: false, discounts: false, notifications: false, reports: false },
  viewer: Object.fromEntries(permissionKeys.map(p => [p.key, false])),
};

const MerchantTravelStaffRoles: React.FC = () => {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [role, setRole] = useState('booking_agent');
  const [permissions, setPermissions] = useState<Record<string, boolean>>(rolePresets.booking_agent);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id).maybeSingle();
    if (!merchant) { setLoading(false); return; }
    setMerchantId(merchant.id);

    const { data } = await supabase.from('merchant_staff_roles').select('*').eq('merchant_id', merchant.id).order('created_at', { ascending: false });
    setStaff((data as any[]) || []);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setStaffName('');
    setStaffEmail('');
    setRole('booking_agent');
    setPermissions({ ...rolePresets.booking_agent });
    setDialogOpen(true);
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setStaffName(s.staff_name);
    setStaffEmail(s.staff_email || '');
    setRole(s.role);
    setPermissions(typeof s.permissions === 'object' ? { ...s.permissions } : { ...rolePresets.viewer });
    setDialogOpen(true);
  };

  const handleRolePreset = (r: string) => {
    setRole(r);
    setPermissions({ ...(rolePresets[r] || rolePresets.viewer) });
  };

  const togglePermission = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!merchantId || !staffName.trim()) { toast.error('Staff name required'); return; }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (editingId) {
      const { error } = await supabase.from('merchant_staff_roles').update({
        staff_name: staffName.trim(),
        staff_email: staffEmail.trim() || null,
        role,
        permissions,
      } as any).eq('id', editingId);
      if (error) toast.error(error.message);
      else toast.success('Staff role updated');
    } else {
      // For now, use the merchant owner's user_id as placeholder (real invite flow would send email)
      const { error } = await supabase.from('merchant_staff_roles').insert({
        merchant_id: merchantId,
        user_id: user?.id, // placeholder - in production, would look up by email
        staff_name: staffName.trim(),
        staff_email: staffEmail.trim() || null,
        role,
        permissions,
        invited_by: user?.id,
      } as any);
      if (error) {
        if (error.code === '23505') toast.error('This staff member already exists');
        else toast.error(error.message);
      } else toast.success('Staff member added');
    }

    setDialogOpen(false);
    fetchData();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this staff member?')) return;
    await supabase.from('merchant_staff_roles').delete().eq('id', id);
    toast.success('Staff member removed');
    fetchData();
  };

  const toggleActive = async (s: any) => {
    await supabase.from('merchant_staff_roles').update({ is_active: !s.is_active } as any).eq('id', s.id);
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const activeCount = staff.filter(s => s.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff & Role Access</h1>
          <p className="text-muted-foreground">Manage staff members and their access to travel services</p>
        </div>
        <Button onClick={openAdd}><UserPlus className="mr-2 h-4 w-4" /> Add Staff</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{staff.length}</p><p className="text-xs text-muted-foreground">Total Staff</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold text-green-600">{activeCount}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{Object.keys(rolePresets).length}</p><p className="text-xs text-muted-foreground">Role Presets</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Members</CardTitle>
          <CardDescription>Each member can be assigned a role with specific permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No staff members yet. Add your first team member to delegate access.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map(s => {
                  const perms = typeof s.permissions === 'object' ? s.permissions : {};
                  const activePerms = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.staff_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.staff_email || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{s.role.replace('_', ' ')}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {activePerms.slice(0, 3).map(p => (
                            <Badge key={p} variant="secondary" className="text-xs capitalize">{p}</Badge>
                          ))}
                          {activePerms.length > 3 && <Badge variant="secondary" className="text-xs">+{activePerms.length - 3}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="John Doe" value={staffName} onChange={e => setStaffName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input placeholder="john@example.com" type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role Preset</Label>
              <Select value={role} onValueChange={handleRolePreset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin – Full Access</SelectItem>
                  <SelectItem value="manager">Manager – All Operations</SelectItem>
                  <SelectItem value="booking_agent">Booking Agent – Bookings & Scanner</SelectItem>
                  <SelectItem value="scanner">Scanner – Ticket Scanning Only</SelectItem>
                  <SelectItem value="viewer">Viewer – No Access (Custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {permissionKeys.map(pk => (
                  <div key={pk.key} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{pk.label}</p>
                      <p className="text-xs text-muted-foreground">{pk.desc}</p>
                    </div>
                    <Switch checked={!!permissions[pk.key]} onCheckedChange={() => togglePermission(pk.key)} />
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving || !staffName.trim()} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {editingId ? 'Update Staff' : 'Add Staff Member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantTravelStaffRoles;
