import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, MessageSquare, Plus, Send, Edit, Eye, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Communications = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isBulkSendDialogOpen, setIsBulkSendDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['communication-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_templates')
        .select('*')
        .order('category', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch communication logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['communication-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_logs')
        .select(`
          *,
          communication_templates(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch bulk communications
  const { data: bulkComms, isLoading: bulkLoading } = useQuery({
    queryKey: ['bulk-communications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bulk_communications')
        .select(`
          *,
          communication_templates(name)
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch institutions for sending
  const { data: institutions } = useQuery({
    queryKey: ['institutions-for-communication'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, institution_name')
        .eq('status', 'approved');
      
      if (error) throw error;
      return data;
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      const { error } = await supabase
        .from('communication_templates')
        .update({
          name: template.name,
          description: template.description,
          subject: template.subject,
          body: template.body,
          is_active: template.is_active,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', template.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      setIsEditDialogOpen(false);
      toast.success('Template updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });

  // Send individual communication
  const sendCommunicationMutation = useMutation({
    mutationFn: async (params: { template_key: string; recipient_email?: string; recipient_phone?: string; variables: any }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('send-communication', {
        body: params,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) throw response.error;
      if (response.data && response.data.success === false) {
        throw new Error(response.data.error || 'Communication failed');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      setIsSendDialogOpen(false);
      toast.success('Communication sent successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to send communication: ${error.message}`);
    },
  });

  // Send bulk communication
  const sendBulkMutation = useMutation({
    mutationFn: async (params: { template_key: string; recipient_filter: any; variables: any }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('send-bulk-communication', {
        body: params,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-communications'] });
      setIsBulkSendDialogOpen(false);
      toast.success('Bulk communication started');
    },
    onError: (error: any) => {
      toast.error(`Failed to start bulk communication: ${error.message}`);
    },
  });

  // Test all templates
  const testAllTemplatesMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('test-all-templates', {
        body: { email: testEmail },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      const sandboxNote = data.sandbox_mode ? ' (Resend sandbox mode active - emails rerouted)' : '';
      toast.success(`Sent ${data.sent} of ${data.total_attempted} email templates${sandboxNote}`);
    },
    onError: (error: any) => {
      toast.error(`Failed to test templates: ${error.message}`);
    },
  });

  // Quick per-template Send Test — fires admin-test-email (Resend-first) and surfaces live result.
  const [quickTestResult, setQuickTestResult] = useState<any | null>(null);
  const [quickTestKey, setQuickTestKey] = useState<string | null>(null);
  const quickTestMutation = useMutation({
    mutationFn: async (template: any) => {
      setQuickTestKey(template.template_key);
      setQuickTestResult(null);
      const { data: { user } } = await supabase.auth.getUser();
      const recipient = user?.email;
      if (!recipient) throw new Error("Sign in required to send a test.");
      const { data, error } = await supabase.functions.invoke("admin-test-email", {
        body: {
          recipient_email: recipient,
          subject: `[TEST] ${template.subject || template.name}`,
          body_html: template.body || `<p>${template.name}</p>`,
          template_key: template.template_key,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setQuickTestResult(data);
      if (data?.success) toast.success(`Test sent via ${data.provider} (${data.environment})`);
      else toast.error(data?.error || "Test failed");
    },
    onError: (e: any) => {
      const msg = e?.message || "Test failed";
      setQuickTestResult({ success: false, error: msg });
      toast.error(msg);
    },
  });

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      user_auth: 'bg-blue-100 text-blue-800',
      institution_management: 'bg-purple-100 text-purple-800',
      consent_management: 'bg-green-100 text-green-800',
      payment_notifications: 'bg-yellow-100 text-yellow-800',
      security_alerts: 'bg-red-100 text-red-800',
      system_notifications: 'bg-gray-100 text-gray-800',
      api_notifications: 'bg-indigo-100 text-indigo-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Communications Management</h1>
          <p className="text-muted-foreground">Manage email and SMS templates, send notifications to institutions and users</p>
        </div>
        <Button 
          onClick={() => {
            if (confirm('This will test all email templates with kangopenbanking@gmail.com. Continue?')) {
              testAllTemplatesMutation.mutate('kangopenbanking@gmail.com');
            }
          }}
          disabled={testAllTemplatesMutation.isPending}
        >
          <Send className="w-4 h-4 mr-2" />
          {testAllTemplatesMutation.isPending ? 'Sending...' : 'Test All Templates'}
        </Button>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates">
            <FileText className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="send">
            <Send className="w-4 h-4 mr-2" />
            Send Communication
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Eye className="w-4 h-4 mr-2" />
            Communication Logs
          </TabsTrigger>
          <TabsTrigger value="bulk">
            <Mail className="w-4 h-4 mr-2" />
            Bulk Communications
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templatesLoading ? (
              <p>Loading templates...</p>
            ) : (
              templates?.map((template) => (
                <Card key={template.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {template.template_type === 'email' ? (
                            <Mail className="w-4 h-4" />
                          ) : (
                            <MessageSquare className="w-4 h-4" />
                          )}
                          {template.name}
                        </CardTitle>
                        <CardDescription className="mt-1">{template.description}</CardDescription>
                      </div>
                      <Badge className={getCategoryBadge(template.category)} variant="secondary">
                        {template.category.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant={template.is_active ? 'default' : 'secondary'}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {template.is_system && (
                          <Badge variant="outline">System</Badge>
                        )}
                      </div>
                      {template.subject && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          <strong>Subject:</strong> {template.subject}
                        </p>
                      )}
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setIsSendDialogOpen(true);
                          }}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          data-testid={`send-test-${template.template_key}`}
                          onClick={() => quickTestMutation.mutate(template)}
                          disabled={quickTestMutation.isPending && quickTestKey === template.template_key}
                        >
                          {quickTestMutation.isPending && quickTestKey === template.template_key ? "Testing..." : "Send Test"}
                        </Button>
                      </div>
                      {quickTestResult && quickTestKey === template.template_key && (
                        <div
                          data-testid={`send-test-result-${template.template_key}`}
                          data-success={quickTestResult.success ? "true" : "false"}
                          data-provider={quickTestResult.provider || ""}
                          className="mt-2 rounded-md border p-2 text-[11px] bg-muted/30"
                        >
                          <div className="flex justify-between">
                            <span>Provider: <span className="font-medium">{quickTestResult.provider || "—"}</span></span>
                            <span className={quickTestResult.success ? "text-green-600" : "text-destructive"}>
                              {quickTestResult.success ? "sent" : "failed"}
                            </span>
                          </div>
                          {quickTestResult.error && <div className="text-destructive break-words mt-1">{quickTestResult.error}</div>}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Send Tab */}
        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Send Individual Communication</CardTitle>
              <CardDescription>Send a single email or SMS using a template</CardDescription>
            </CardHeader>
            <CardContent>
              <SendCommunicationForm
                templates={templates || []}
                onSubmit={(data) => sendCommunicationMutation.mutate(data)}
                isLoading={sendCommunicationMutation.isPending}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send Bulk Communication</CardTitle>
              <CardDescription>Send emails to multiple institutions at once</CardDescription>
            </CardHeader>
            <CardContent>
              <BulkSendForm
                templates={templates || []}
                institutions={institutions || []}
                onSubmit={(data) => sendBulkMutation.mutate(data)}
                isLoading={sendBulkMutation.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Communications</CardTitle>
              <CardDescription>View the history of sent emails and SMS</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <p>Loading logs...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Subject</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                        <TableCell>{log.communication_templates?.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.communication_type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {log.recipient_email || log.recipient_phone}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Communication History</CardTitle>
              <CardDescription>Track mass email campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              {bulkLoading ? (
                <p>Loading bulk communications...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkComms?.map((bulk) => (
                      <TableRow key={bulk.id}>
                        <TableCell>{new Date(bulk.created_at).toLocaleString()}</TableCell>
                        <TableCell>{bulk.communication_templates?.name}</TableCell>
                        <TableCell>{bulk.total_recipients}</TableCell>
                        <TableCell className="text-green-600">{bulk.sent_count}</TableCell>
                        <TableCell className="text-red-600">{bulk.failed_count}</TableCell>
                        <TableCell>
                          <Badge variant={bulk.status === 'completed' ? 'default' : 'secondary'}>
                            {bulk.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Template Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Modify the template content and settings</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <TemplateEditForm
              template={selectedTemplate}
              onSubmit={(data) => updateTemplateMutation.mutate(data)}
              isLoading={updateTemplateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
      </div>
  );
};

// Send Communication Form Component
const SendCommunicationForm = ({ templates, onSubmit, isLoading }: any) => {
  const [formData, setFormData] = useState({
    template_key: '',
    recipient_email: '',
    recipient_phone: '',
    variables: '{}',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const variables = JSON.parse(formData.variables);
      onSubmit({
        template_key: formData.template_key,
        recipient_email: formData.recipient_email || undefined,
        recipient_phone: formData.recipient_phone || undefined,
        variables,
      });
    } catch (error) {
      toast.error('Invalid JSON in variables field');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="template">Template</Label>
        <Select value={formData.template_key} onValueChange={(value) => setFormData({ ...formData, template_key: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select a template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template: any) => (
              <SelectItem key={template.id} value={template.template_key}>
                {template.name} ({template.template_type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipient_email">Recipient Email</Label>
        <Input
          id="recipient_email"
          type="email"
          value={formData.recipient_email}
          onChange={(e) => setFormData({ ...formData, recipient_email: e.target.value })}
          placeholder="email@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipient_phone">Recipient Phone (for SMS)</Label>
        <Input
          id="recipient_phone"
          type="tel"
          value={formData.recipient_phone}
          onChange={(e) => setFormData({ ...formData, recipient_phone: e.target.value })}
          placeholder="+237670000000"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="variables">Template Variables (JSON)</Label>
        <Textarea
          id="variables"
          value={formData.variables}
          onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
          placeholder='{"user_name": "John", "platform_name": "Open Banking"}'
          rows={4}
        />
      </div>

      <Button type="submit" disabled={isLoading || !formData.template_key}>
        {isLoading ? 'Sending...' : 'Send Communication'}
      </Button>
    </form>
  );
};

// Bulk Send Form Component
const BulkSendForm = ({ templates, institutions, onSubmit, isLoading }: any) => {
  const [formData, setFormData] = useState({
    template_key: '',
    recipient_type: 'all_institutions',
    institution_id: '',
    variables: '{}',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const variables = JSON.parse(formData.variables);
      const recipient_filter: any = {
        type: formData.recipient_type,
      };
      
      if (formData.recipient_type === 'specific_institution') {
        recipient_filter.institution_id = formData.institution_id;
      }

      onSubmit({
        template_key: formData.template_key,
        recipient_filter,
        variables,
      });
    } catch (error) {
      toast.error('Invalid JSON in variables field');
    }
  };

  const emailTemplates = templates.filter((t: any) => t.template_type === 'email');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bulk_template">Email Template</Label>
        <Select value={formData.template_key} onValueChange={(value) => setFormData({ ...formData, template_key: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select an email template" />
          </SelectTrigger>
          <SelectContent>
            {emailTemplates.map((template: any) => (
              <SelectItem key={template.id} value={template.template_key}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipient_type">Recipients</Label>
        <Select value={formData.recipient_type} onValueChange={(value) => setFormData({ ...formData, recipient_type: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_institutions">All Approved Institutions</SelectItem>
            <SelectItem value="specific_institution">Specific Institution</SelectItem>
            <SelectItem value="all_users">All Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.recipient_type === 'specific_institution' && (
        <div className="space-y-2">
          <Label htmlFor="institution">Select Institution</Label>
          <Select value={formData.institution_id} onValueChange={(value) => setFormData({ ...formData, institution_id: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select institution" />
            </SelectTrigger>
            <SelectContent>
              {institutions.map((inst: any) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.institution_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="bulk_variables">Template Variables (JSON)</Label>
        <Textarea
          id="bulk_variables"
          value={formData.variables}
          onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
          placeholder='{"platform_name": "Open Banking", "docs_link": "https://..."}'
          rows={4}
        />
      </div>

      <Button type="submit" disabled={isLoading || !formData.template_key}>
        {isLoading ? 'Starting...' : 'Send Bulk Communication'}
      </Button>
    </form>
  );
};

// Template Edit Form Component
const TemplateEditForm = ({ template, onSubmit, isLoading }: any) => {
  const [formData, setFormData] = useState({
    id: template.id,
    name: template.name,
    description: template.description || '',
    subject: template.subject || '',
    body: template.body,
    is_active: template.is_active,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Template Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
        />
      </div>

      {template.template_type === 'email' && (
        <div className="space-y-2">
          <Label htmlFor="subject">Email Subject</Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="body">Template Body</Label>
        <Textarea
          id="body"
          value={formData.body}
          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
          rows={12}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="rounded"
        />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading || template.is_system}>
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
        {template.is_system && (
          <p className="text-sm text-muted-foreground flex items-center">
            System templates have limited editing capabilities
          </p>
        )}
      </div>
    </form>
  );
};

export default Communications;