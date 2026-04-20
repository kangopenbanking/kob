import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { UserPlus, Loader2, Shield, Pencil, Trash2, Eye, EyeOff, Copy, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCanonicalUrl } from '@/config/api';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

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
  const [showPassword, setShowPassword] = useState(false);

  // Form
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffPin, setStaffPin] = useState('');
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
    setStaffPhone('');
    setStaffPassword('');
    setStaffPin('');
    setRole('booking_agent');
    setPermissions({ ...rolePresets.booking_agent });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setStaffName(s.staff_name);
    setStaffEmail(s.staff_email || '');
    setStaffPhone(s.phone_number || '');
    setStaffPassword('');
    setStaffPin('');
    setRole(s.role);
    setPermissions(typeof s.permissions === 'object' ? { ...s.permissions } : { ...rolePresets.viewer });
    setShowPassword(false);
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

    try {
      if (editingId) {
        // Update existing — only update role/permissions/name/phone
        const { error } = await supabase.from('merchant_staff_roles').update({
          staff_name: staffName.trim(),
          staff_email: staffEmail.trim() || null,
          phone_number: staffPhone.trim() || null,
          role,
          permissions,
        } as any).eq('id', editingId);
        if (error) throw error;
        toast.success('Staff role updated');
      } else {
        // Create new staff via edge function
        if (!staffEmail.trim()) { toast.error('Email is required'); setSaving(false); return; }
        if (!staffPassword || staffPassword.length < 6) { toast.error('Password must be at least 6 characters'); setSaving(false); return; }
        if (staffPin.length !== 6) { toast.error('PIN must be exactly 6 digits'); setSaving(false); return; }

        const { data, error } = await supabase.functions.invoke('merchant-create-staff', {
          body: {
            staff_name: staffName.trim(),
            staff_email: staffEmail.trim(),
            phone_number: staffPhone.trim() || null,
            password: staffPassword,
            pin_code: staffPin,
            role,
            permissions,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success('Staff account created! They can now log in at /staff-login');
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(extractEdgeFunctionError(error, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this staff member? Their login will be revoked.')) return;
    await supabase.from('merchant_staff_roles').delete().eq('id', id);
    toast.success('Staff member removed');
    fetchData();
  };

  const toggleActive = async (s: any) => {
    await supabase.from('merchant_staff_roles').update({ is_active: !s.is_active } as any).eq('id', s.id);
    toast.success(s.is_active ? 'Staff deactivated' : 'Staff activated');
    fetchData();
  };

  const copyLoginLink = () => {
    const url = getCanonicalUrl('/staff-login');
    navigator.clipboard.writeText(url);
    toast.success('Staff login link copied!');
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const activeCount = staff.filter(s => s.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Staff & Role Access</h1>
          <p className="text-sm text-muted-foreground">Manage staff members and their access to travel services</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={copyLoginLink}>
            <Link2 className="mr-2 h-4 w-4" /> Copy Login Link
          </Button>
          <Button size="sm" onClick={openAdd}><UserPlus className="mr-2 h-4 w-4" /> Add Staff</Button>
        </div>
      </div>

      {/* Staff Login Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm space-y-1 min-w-0">
              <p className="font-medium">Staff Login Portal</p>
              <p className="text-muted-foreground break-words">
                Staff members log in at <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">/staff-login</code> using their
                email + password <strong>or</strong> phone + 6-digit PIN. Share the login link with your team using the button above.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold">{staff.length}</p><p className="text-xs text-muted-foreground">Total Staff</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold text-primary">{activeCount}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card className="col-span-2 sm:col-span-1"><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold">{Object.keys(rolePresets).length}</p><p className="text-xs text-muted-foreground">Role Presets</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Members</CardTitle>
          <CardDescription>Each member can sign in with email+password or phone+PIN</CardDescription>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No staff members yet. Add your first team member to delegate access.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden sm:table-cell">Permissions</TableHead>
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
                        <TableCell className="font-medium whitespace-nowrap">{s.staff_name}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm text-muted-foreground truncate max-w-[160px]">{s.staff_email || '—'}</p>
                            {s.phone_number && <p className="text-xs text-muted-foreground">{s.phone_number}</p>}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize whitespace-nowrap">{s.role.replace('_', ' ')}</Badge></TableCell>
                        <TableCell className="hidden sm:table-cell">
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Name & Email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input placeholder="John Doe" value={staffName} onChange={e => setStaffName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input placeholder="john@example.com" type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} disabled={!!editingId} />
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input placeholder="+237 6XX XXX XXX" type="tel" value={staffPhone} onChange={e => setStaffPhone(e.target.value)} />
              <p className="text-xs text-muted-foreground">Required for Phone + PIN login method</p>
            </div>

            {/* Password & PIN — only for new staff */}
            {!editingId && (
              <>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={staffPassword}
                      onChange={e => setStaffPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">This is the staff member's login password</p>
                </div>

                <div className="space-y-3">
                  <Label>6-Digit PIN *</Label>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={staffPin} onChange={setStaffPin}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    PIN for quick Phone + PIN sign-in. Share this with your staff member securely.
                  </p>
                </div>
              </>
            )}

            {/* Role Preset */}
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

            {/* Permissions Grid */}
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
              {editingId ? 'Update Staff' : 'Create Staff Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantTravelStaffRoles;
