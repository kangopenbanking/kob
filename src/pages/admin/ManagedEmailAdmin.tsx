import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Mail, Edit, Eye, Send, Search, BarChart3, Settings, FileText, Building2, MailCheck} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const CATEGORIES = [
  { key: 'transactional', label: 'Transactional', color: 'bg-blue-100 text-blue-800' },
  { key: 'account_lifecycle', label: 'Account Lifecycle', color: 'bg-green-100 text-green-800' },
  { key: 'security', label: 'Security & Alerts', color: 'bg-red-100 text-red-800' },
  { key: 'credit', label: 'Credit (CrediQ)', color: 'bg-purple-100 text-purple-800' },
];

const ManagedEmailAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingType, setEditingType] = useState<any>(null);
  const [previewType, setPreviewType] = useState<any>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<string>('global');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  // Fetch email types
  const { data: emailTypes = [], isLoading } = useQuery({
    queryKey: ['managed-email-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managed_email_types')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  // Fetch institutions
  const { data: institutions = [] } = useQuery({
    queryKey: ['institutions-for-email'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, institution_name, logo_url, primary_color')
        .eq('status', 'approved' as any)
        .order('institution_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch overrides for selected institution
  const { data: overrides = [] } = useQuery({
    queryKey: ['email-overrides', selectedInstitution],
    queryFn: async () => {
      if (selectedInstitution === 'global') return [];
      const { data, error } = await supabase
        .from('institution_email_overrides')
        .select('*')
        .eq('institution_id', selectedInstitution);
      if (error) throw error;
      return data;
    },
    enabled: selectedInstitution !== 'global',
  });

  // Fetch email logs
  const { data: emailLogs = [] } = useQuery({
    queryKey: ['managed-email-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managed_email_logs')
        .select('*, managed_email_types(name, category)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Fetch institution email settings
  const { data: instSettings } = useQuery({
    queryKey: ['inst-email-settings', selectedInstitution],
    queryFn: async () => {
      if (selectedInstitution === 'global') return null;
      const { data } = await supabase
        .from('institution_email_settings')
        .select('*')
        .eq('institution_id', selectedInstitution)
        .maybeSingle();
      return data;
    },
    enabled: selectedInstitution !== 'global',
  });

  // Toggle email type active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('managed_email_types')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-email-types'] });
      toast.success('Email type updated');
    },
  });

  // Toggle institution override
  const toggleOverride = useMutation({
    mutationFn: async ({ email_type_id, is_enabled }: { email_type_id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('institution_email_overrides')
        .upsert({
          institution_id: selectedInstitution,
          email_type_id,
          is_enabled,
        }, { onConflict: 'institution_id,email_type_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-overrides'] });
      toast.success('Override updated');
    },
  });

  // Save template edit
  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editingType) return;
      if (selectedInstitution === 'global') {
        const { error } = await supabase
          .from('managed_email_types')
          .update({ default_subject: editSubject, default_body_html: editBody })
          .eq('id', editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('institution_email_overrides')
          .upsert({
            institution_id: selectedInstitution,
            email_type_id: editingType.id,
            custom_subject: editSubject,
            custom_body_html: editBody,
          }, { onConflict: 'institution_id,email_type_id' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-email-types'] });
      queryClient.invalidateQueries({ queryKey: ['email-overrides'] });
      setEditingType(null);
      toast.success('Template saved');
    },
  });

  // Save institution branding settings
  const saveBranding = useMutation({
    mutationFn: async (settings: any) => {
      const { error } = await supabase
        .from('institution_email_settings')
        .upsert({
          institution_id: selectedInstitution,
          ...settings,
        }, { onConflict: 'institution_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inst-email-settings'] });
      toast.success('Branding settings saved');
    },
  });

  // Send test email — supports custom recipient (e.g. an agent's address)
  // and records the attempt in managed_email_test_sends.
  const [testDialogKey, setTestDialogKey] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState('');

  const sendTest = useMutation({
    mutationFn: async ({ emailKey, recipient }: { emailKey: string; recipient?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No authenticated user');
      const target = (recipient || '').trim() || user.email;

      const { data, error } = await supabase.functions.invoke('managed-email-test', {
        body: {
          email_key: emailKey,
          recipient_email: target,
          institution_id: selectedInstitution !== 'global' ? selectedInstitution : undefined,
          variables: {
            customer_name: user.user_metadata?.full_name || 'Test User',
            currency: 'XAF',
            amount: '50,000',
            reference: 'TEST-REF-001',
            date: new Date().toLocaleDateString(),
            account_last4: '4567',
            institution_name: 'Test Bank',
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.status === 'failed') {
        throw new Error((data as any)?.error || 'Delivery failed');
      }
      return data;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Test email sent to ${vars.recipient || 'your inbox'}`);
      setTestDialogKey(null);
      setTestRecipient('');
    },
    onError: (e: any) => toast.error(extractEdgeFunctionError(e)),
  });

  const filtered = emailTypes.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.email_key.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const getOverride = (typeId: string) => overrides.find((o: any) => o.email_type_id === typeId);
  const getCategoryBadge = (category: string) => CATEGORIES.find(c => c.key === category);

  const stats = {
    total: emailTypes.length,
    active: emailTypes.filter(t => t.is_active).length,
    sent: emailLogs.filter((l: any) => l.status === 'sent').length,
    failed: emailLogs.filter((l: any) => l.status === 'failed').length,
  };

  const openEdit = (type: any) => {
    const override = getOverride(type.id);
    setEditingType(type);
    setEditSubject(override?.custom_subject || type.default_subject);
    setEditBody(override?.custom_body_html || type.default_body_html);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={MailCheck} title="Email Management" description="Manage all automated emails for institutions and customers" />

      <div className="flex items-center justify-end">
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">Total Templates</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <p className="text-xs text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
          <p className="text-xs text-muted-foreground">Sent (Recent)</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <p className="text-xs text-muted-foreground">Failed (Recent)</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates"><FileText className="h-4 w-4 mr-1" />Email Templates</TabsTrigger>
          <TabsTrigger value="branding"><Settings className="h-4 w-4 mr-1" />Institution Branding</TabsTrigger>
          <TabsTrigger value="logs"><BarChart3 className="h-4 w-4 mr-1" />Send Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search emails..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
              <SelectTrigger className="w-[220px]"><Building2 className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (All Institutions)</SelectItem>
                {institutions.map((inst: any) => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.institution_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Templates Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No email templates found</TableCell></TableRow>
                  ) : filtered.map(type => {
                    const cat = getCategoryBadge(type.category);
                    const override = getOverride(type.id);
                    const isEnabled = override ? override.is_enabled : type.is_active;

                    return (
                      <TableRow key={type.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{type.name}</div>
                          <div className="text-xs text-muted-foreground">{type.email_key}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${cat?.color || ''}`}>{cat?.label || type.category}</Badge>
                          {override && <Badge variant="secondary" className="text-xs ml-1">Custom</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{type.trigger_event || '—'}</TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => {
                              if (selectedInstitution === 'global') {
                                toggleActive.mutate({ id: type.id, is_active: checked });
                              } else {
                                toggleOverride.mutate({ email_type_id: type.id, is_enabled: checked });
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(type)}><Edit className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setPreviewType(type)}><Eye className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setTestDialogKey(type.email_key); setTestRecipient(''); }} disabled={sendTest.isPending} title="Send test email">
                            <Send className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          {selectedInstitution === 'global' ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a specific institution above to configure its email branding.</p>
              <p className="text-sm mt-2">Global emails use Kang Open Banking branding by default.</p>
            </CardContent></Card>
          ) : (
            <InstitutionBrandingForm
              settings={instSettings}
              institutionId={selectedInstitution}
              onSave={(s: any) => saveBranding.mutate(s)}
              isSaving={saveBranding.isPending}
            />
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Email Activity</CardTitle>
              <CardDescription>Last 100 emails sent through the managed system</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No email logs yet</TableCell></TableRow>
                  ) : emailLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm font-medium">{log.managed_email_types?.name || '—'}</TableCell>
                      <TableCell className="text-sm">{log.recipient_email}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{log.subject}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className="text-xs">
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingType} onOpenChange={(o) => !o && setEditingType(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit: {editingType?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Subject Line</Label>
              <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Body (HTML)</Label>
              <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={12} className="mt-1 font-mono text-xs" />
            </div>
            {editingType?.available_variables && (
              <div>
                <Label className="text-xs text-muted-foreground">Available Variables</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(Array.isArray(editingType.available_variables) ? editingType.available_variables : []).map((v: string) => (
                    <Badge key={v} variant="outline" className="text-xs font-mono cursor-pointer" onClick={() => {
                      setEditBody(prev => prev + `{{${v}}}`);
                    }}>{`{{${v}}}`}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingType(null)}>Cancel</Button>
              <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>Save Template</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewType} onOpenChange={(o) => !o && setPreviewType(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {previewType?.name}</DialogTitle>
          </DialogHeader>
          {previewType && (
            <div className="space-y-3">
              <div className="text-sm"><strong>Subject:</strong> {previewType.default_subject}</div>
              <div className="border rounded-lg p-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewType.default_body_html) }} />
              <div className="text-xs text-muted-foreground">
                <strong>Trigger:</strong> {previewType.trigger_event || 'Manual'} | <strong>Category:</strong> {previewType.category}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Test Email Dialog */}
      <Dialog open={!!testDialogKey} onOpenChange={(o) => { if (!o) { setTestDialogKey(null); setTestRecipient(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send a preview of <span className="font-mono text-xs">{testDialogKey}</span> to confirm delivery and rendering. Leave blank to send to your own inbox.
            </p>
            <div>
              <Label>Recipient email (optional)</Label>
              <Input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="agent@example.com"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setTestDialogKey(null); setTestRecipient(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => testDialogKey && sendTest.mutate({ emailKey: testDialogKey, recipient: testRecipient })}
                disabled={sendTest.isPending}
              >
                {sendTest.isPending ? 'Sending...' : 'Send Test'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const InstitutionBrandingForm: React.FC<{
  settings: any;
  institutionId: string;
  onSave: (s: any) => void;
  isSaving: boolean;
}> = ({ settings, onSave, isSaving }) => {
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url || '');
  const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || '#007A3D');
  const [secondaryColor, setSecondaryColor] = useState(settings?.secondary_color || '#1e3a8a');
  const [footerText, setFooterText] = useState(settings?.footer_text || 'Powered by Kang Open Banking');
  const [fromName, setFromName] = useState(settings?.from_name || '');
  const [replyTo, setReplyTo] = useState(settings?.reply_to_email || '');

  React.useEffect(() => {
    setLogoUrl(settings?.logo_url || '');
    setPrimaryColor(settings?.primary_color || '#007A3D');
    setSecondaryColor(settings?.secondary_color || '#1e3a8a');
    setFooterText(settings?.footer_text || 'Powered by Kang Open Banking');
    setFromName(settings?.from_name || '');
    setReplyTo(settings?.reply_to_email || '');
  }, [settings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email Branding</CardTitle>
        <CardDescription>Customise how emails appear for this institution's customers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Logo URL</Label>
            <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." className="mt-1" />
          </div>
          <div>
            <Label>From Name</Label>
            <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="e.g. Afriland First Bank" className="mt-1" />
          </div>
          <div>
            <Label>Primary Color</Label>
            <div className="flex gap-2 mt-1">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
              <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div>
            <Label>Secondary Color</Label>
            <div className="flex gap-2 mt-1">
              <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
              <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div>
            <Label>Reply-To Email</Label>
            <Input value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="support@bank.com" className="mt-1" />
          </div>
          <div>
            <Label>Footer Text</Label>
            <Input value={footerText} onChange={e => setFooterText(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => onSave({ logo_url: logoUrl, primary_color: primaryColor, secondary_color: secondaryColor, footer_text: footerText, from_name: fromName, reply_to_email: replyTo })} disabled={isSaving}>
            Save Branding
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManagedEmailAdmin;
