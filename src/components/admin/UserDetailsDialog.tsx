import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { 
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
  User, Mail, Phone, Calendar, Shield, Edit, Save, X,
  CheckCircle, XCircle, Clock, Building2, MapPin, KeyRound
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  phone_verified?: boolean;
  phone_verified_at?: string;
  country_code?: string;
  preferred_otp_method?: string;
  address?: string;
  city?: string;
  date_of_birth?: string;
  gender?: string;
  occupation?: string;
  account_type?: string;
  linked_account_name?: string;
  linked_account_number?: string;
  linked_account_type?: string;
  pin_code_set_at?: string;
  created_at: string;
  updated_at: string;
  roles: string[];
  status: string;
}

interface UserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  onUpdate: () => void;
}

export function UserDetailsDialog({ open, onOpenChange, userId, onUpdate }: UserDetailsDialogProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [staffAssignments, setStaffAssignments] = useState<any[]>([]);
  const [pinCode, setPinCode] = useState('');
  const [settingPin, setSettingPin] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    country_code: '',
    preferred_otp_method: '',
    address: '',
    city: '',
    date_of_birth: '',
    gender: '',
    occupation: '',
    account_type: '',
    linked_account_name: '',
    linked_account_number: '',
    linked_account_type: '',
  });

  useEffect(() => {
    if (userId && open) {
      loadUserDetails();
      setPinCode('');
    }
  }, [userId, open]);

  const loadUserDetails = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      const userData: UserProfile = {
        ...profile,
        roles: userRoles?.map(r => r.role) || [],
        status: 'active'
      };

      setUser(userData);
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone_number: profile.phone_number || '',
        country_code: profile.country_code || '',
        preferred_otp_method: profile.preferred_otp_method || '',
        address: profile.address || '',
        city: profile.city || '',
        date_of_birth: profile.date_of_birth || '',
        gender: profile.gender || '',
        occupation: profile.occupation || '',
        account_type: profile.account_type || '',
        linked_account_name: profile.linked_account_name || '',
        linked_account_number: profile.linked_account_number || '',
        linked_account_type: profile.linked_account_type || '',
      });

      const { data: assignments } = await supabase
        .from('staff_assignments')
        .select(`*, institutions(institution_name), branches(branch_name)`)
        .eq('user_id', userId)
        .eq('is_active', true);
      
      setStaffAssignments(assignments || []);
    } catch (error) {
      logger.error('Error loading user details:', error);
      toast.error('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone_number: formData.phone_number,
          country_code: formData.country_code,
          preferred_otp_method: formData.preferred_otp_method || null,
          address: formData.address || null,
          city: formData.city || null,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          occupation: formData.occupation || null,
          account_type: formData.account_type || null,
          linked_account_name: formData.linked_account_name || null,
          linked_account_number: formData.linked_account_number || null,
          linked_account_type: formData.linked_account_type || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      toast.success('User details updated successfully');
      setEditing(false);
      loadUserDetails();
      onUpdate();
    } catch (error) {
      logger.error('Error updating user:', error);
      toast.error('Failed to update user details');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async () => {
    if (!userId) return;
    if (!/^\d{6}$/.test(pinCode)) {
      toast.error('PIN must be exactly 6 digits');
      return;
    }

    try {
      setSettingPin(true);
      const { data, error } = await supabase.functions.invoke('admin-set-pin', {
        body: { user_id: userId, pin_code: pinCode },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('PIN code assigned successfully');
      setPinCode('');
      loadUserDetails();
    } catch (error: any) {
      logger.error('Error setting PIN:', error);
      toast.error(extractEdgeFunctionError(error, 'Failed to set PIN code'));
    } finally {
      setSettingPin(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'moderator': return 'default';
      case 'institution': return 'secondary';
      default: return 'outline';
    }
  };

  const renderField = (label: string, id: string, value: string, icon?: React.ReactNode, type?: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {editing ? (
        <Input
          id={id}
          type={type || 'text'}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setFormData({ ...formData, [id]: e.target.value })}
        />
      ) : (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
          {icon}
          {value || 'Not provided'}
        </div>
      )}
    </div>
  );

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading user details...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Details
          </DialogTitle>
          <DialogDescription>
            View and manage user account information
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>User's basic profile information</CardDescription>
                  </div>
                  {!editing ? (
                    <Button onClick={() => setEditing(true)} size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button onClick={handleSave} size="sm" disabled={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button 
                        onClick={() => { setEditing(false); loadUserDetails(); }} 
                        size="sm" variant="outline"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md font-mono text-sm">
                      {user.id}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{user.status}</Badge>
                    </div>
                  </div>

                  {renderField('Full Name', 'full_name', formData.full_name, <User className="h-4 w-4 text-muted-foreground" />)}
                  {renderField('Email Address', 'email', formData.email, <Mail className="h-4 w-4 text-muted-foreground" />, 'email')}
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    {editing ? (
                      <Input
                        id="phone_number"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {user.phone_number || 'Not provided'}
                        {user.phone_verified && (
                          <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                        )}
                      </div>
                    )}
                  </div>

                  {renderField('Country Code', 'country_code', formData.country_code, undefined, 'text', 'CM')}
                  {renderField('Address', 'address', formData.address, <MapPin className="h-4 w-4 text-muted-foreground" />)}
                  {renderField('City', 'city', formData.city)}
                  {renderField('Date of Birth', 'date_of_birth', formData.date_of_birth, <Calendar className="h-4 w-4 text-muted-foreground" />, 'date')}
                  
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    {editing ? (
                      <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        {formData.gender ? formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1) : 'Not provided'}
                      </div>
                    )}
                  </div>

                  {renderField('Occupation', 'occupation', formData.occupation)}

                  <div className="space-y-2">
                    <Label htmlFor="account_type">Account Type</Label>
                    {editing ? (
                      <Select value={formData.account_type} onValueChange={(v) => setFormData({ ...formData, account_type: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">Personal</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="institution">Institution</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        {formData.account_type ? formData.account_type.charAt(0).toUpperCase() + formData.account_type.slice(1) : 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferred_otp_method">Preferred OTP Method</Label>
                    {editing ? (
                      <Select value={formData.preferred_otp_method} onValueChange={(v) => setFormData({ ...formData, preferred_otp_method: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select OTP method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        {formData.preferred_otp_method || 'Not set'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Linked Account Section */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3">Linked Account</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    {renderField('Account Name', 'linked_account_name', formData.linked_account_name)}
                    {renderField('Account Number', 'linked_account_number', formData.linked_account_number)}
                    
                    <div className="space-y-2">
                      <Label htmlFor="linked_account_type">Account Type</Label>
                      {editing ? (
                        <Select value={formData.linked_account_type} onValueChange={(v) => setFormData({ ...formData, linked_account_type: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="momo">Mobile Money</SelectItem>
                            <SelectItem value="bank">Bank Account</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          {formData.linked_account_type || 'Not provided'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Created At</Label>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(user.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Last Updated</Label>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {new Date(user.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Roles & Permissions</CardTitle>
                <CardDescription>User's assigned roles in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {user.roles.length > 0 ? (
                    user.roles.map(role => (
                      <Badge key={role} variant={getRoleBadgeVariant(role)}>
                        <Shield className="h-3 w-3 mr-1" />
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">No roles assigned</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Staff Assignments</CardTitle>
                <CardDescription>Institution and branch assignments for this user</CardDescription>
              </CardHeader>
              <CardContent>
                {staffAssignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No assignments found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {staffAssignments.map((assignment: any) => (
                      <div key={assignment.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {assignment.institutions?.institution_name}
                          </span>
                        </div>
                        
                        {assignment.branches && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{assignment.branches.branch_name}</span>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                          <div>
                            <span className="text-muted-foreground">Position:</span>
                            <span className="ml-2 font-medium">{assignment.position}</span>
                          </div>
                          {assignment.department && (
                            <div>
                              <span className="text-muted-foreground">Department:</span>
                              <span className="ml-2 font-medium">{assignment.department}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Type:</span>
                            <span className="ml-2 font-medium capitalize">
                              {assignment.employment_type?.replace('_', ' ')}
                            </span>
                          </div>
                          {assignment.start_date && (
                            <div>
                              <span className="text-muted-foreground">Start Date:</span>
                              <span className="ml-2 font-medium">
                                {new Date(assignment.start_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <Badge variant={assignment.is_active ? "default" : "secondary"} className="mt-2">
                          {assignment.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Information</CardTitle>
                <CardDescription>Account security and verification status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Phone Verified</div>
                      <div className="text-sm text-muted-foreground">
                        {user.phone_verified ? 'Verified' : 'Not verified'}
                      </div>
                    </div>
                    {user.phone_verified ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {user.phone_verified_at && (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">Verified At</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(user.phone_verified_at).toLocaleString()}
                        </div>
                      </div>
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">PIN Code</div>
                      <div className="text-sm text-muted-foreground">
                        {user.pin_code_set_at ? `Set on ${new Date(user.pin_code_set_at).toLocaleDateString()}` : 'Not set'}
                      </div>
                    </div>
                    {user.pin_code_set_at ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Preferred OTP Method</div>
                      <div className="text-sm text-muted-foreground">
                        {user.preferred_otp_method || 'Not set'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Admin PIN Assignment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Assign PIN Code
                </CardTitle>
                <CardDescription>Set or reset a 6-digit PIN code for this user</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="pin_code">6-Digit PIN</Label>
                    <Input
                      id="pin_code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter 6-digit PIN"
                      value={pinCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPinCode(val);
                      }}
                    />
                  </div>
                  <Button
                    onClick={handleSetPin}
                    disabled={pinCode.length !== 6 || settingPin}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {settingPin ? 'Setting...' : 'Set PIN'}
                  </Button>
                </div>
                {user.pin_code_set_at && (
                  <p className="text-sm text-muted-foreground mt-2">
                    ⚠️ This user already has a PIN set. Setting a new one will replace it.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Account Activity</CardTitle>
                <CardDescription>Recent account activity and history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Account Created</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(user.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Last Profile Update</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(user.updated_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
