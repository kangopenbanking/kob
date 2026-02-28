import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Users, 
  Activity, 
  DollarSign, 
  CheckCircle2,
  Clock,
  Shield,
  FileText,
  XCircle,
  AlertCircle,
  TrendingUp,
  ArrowLeft,
  Key,
  TestTube
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CreateBranchDialog } from "@/components/admin/CreateBranchDialog";
import { API_CONFIG } from "@/config/api";

const Admin = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  const [totalInstitutions, setTotalInstitutions] = useState(0);
  const [totalConsents, setTotalConsents] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [activeConsents, setActiveConsents] = useState(0);
  
  const [pendingRegistrations, setPendingRegistrations] = useState<any[]>([]);
  const [recentConsents, setRecentConsents] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedInstitutionForBranch, setSelectedInstitutionForBranch] = useState<{id: string; name: string} | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [institutionsRes, consentsRes, paymentsRes] = await Promise.all([
        supabase.from('institutions').select('id', { count: 'exact' }),
        supabase.from('aisp_consents').select('id', { count: 'exact' }),
        supabase.from('payments').select('id', { count: 'exact' })
      ]);

      setTotalInstitutions(institutionsRes.count || 0);
      setTotalConsents(consentsRes.count || 0);
      setTotalPayments(paymentsRes.count || 0);

      const { count: activeCount } = await supabase
        .from('aisp_consents')
        .select('id', { count: 'exact' })
        .eq('status', 'Authorised')
        .gt('expiration_date', new Date().toISOString());
      
      setActiveConsents(activeCount || 0);

      const { data: pending } = await supabase
        .from('institutions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setPendingRegistrations(pending || []);

      const { data: consents } = await supabase
        .from('aisp_consents')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setRecentConsents(consents || []);

      const { data: payments } = await supabase
        .from('payments')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setRecentPayments(payments || []);

      const { data: logs } = await supabase
        .from('consent_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      setAuditLogs(logs || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const approveInstitution = async (institutionId: string) => {
    try {
      const { data: institution } = await supabase
        .from('institutions')
        .select('institution_type, user_id, institution_name')
        .eq('id', institutionId)
        .single();

      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', institution?.user_id)
        .single();

      if (!institution) throw new Error('Institution not found');

      let sandboxClientId: string | null = null;
      let sandboxClientSecret: string | null = null;
      
      if (institution.institution_type === 'developer') {
        sandboxClientId = `dev_${crypto.randomUUID().replace(/-/g, '')}`;
        sandboxClientSecret = `sk_${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
      }

      const updateData: any = { 
        status: 'approved',
        approved_at: new Date().toISOString(),
        sandbox_access: institution.institution_type === 'developer'
      };

      const { error } = await supabase
        .from('institutions')
        .update(updateData)
        .eq('id', institutionId);

      if (error) throw error;

      if (sandboxClientId && sandboxClientSecret) {
        const { error: encryptError } = await supabase.rpc('encrypt_sandbox_credentials', {
          _institution_id: institutionId,
          _client_id: sandboxClientId,
          _client_secret: sandboxClientSecret
        });
        
        if (encryptError) {
          console.error('Failed to encrypt sandbox credentials:', encryptError);
        }
      }

      await supabase.rpc('log_audit_event', {
        _action_type: 'institution_approved',
        _entity_type: 'institution',
        _entity_id: institutionId,
        _details: {
          institution_name: institution.institution_name,
          institution_type: institution.institution_type,
          sandbox_enabled: institution.institution_type === 'developer'
        }
      });

      try {
        await supabase.functions.invoke('send-communication', {
          body: {
            template_key: 'institution_approved',
            recipient_email: profile?.email,
            recipient_id: institution.user_id,
            variables: {
              institution_name: institution.institution_name,
              portal_url: `${API_CONFIG.SITE_URL}/fi-portal`,
              client_id: sandboxClientId || '',
              client_secret: sandboxClientSecret || '',
              is_developer: institution.institution_type === 'developer',
              security_note: 'Please save your client secret securely. It will not be shown again.'
            }
          }
        });
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
      }

      setSelectedInstitutionForBranch({
        id: institutionId,
        name: institution.institution_name
      });
      setBranchDialogOpen(true);

      toast({
        title: "Institution Approved - Create Main Branch",
        description: "Now create the main branch to complete the approval process"
      });
    } catch (error) {
      console.error('Error approving institution:', error);
      toast({
        title: "Error",
        description: "Failed to approve institution",
        variant: "destructive"
      });
    }
  };

  const rejectInstitution = async (institutionId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      const { data: institution } = await supabase
        .from('institutions')
        .select('user_id, institution_name, institution_type')
        .eq('id', institutionId)
        .single();

      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', institution?.user_id)
        .single();

      if (!institution) throw new Error('Institution not found');

      const { error } = await supabase
        .from('institutions')
        .update({ 
          status: 'rejected',
          rejection_reason: reason
        })
        .eq('id', institutionId);

      if (error) throw error;

      await supabase.rpc('log_audit_event', {
        _action_type: 'institution_rejected',
        _entity_type: 'institution',
        _entity_id: institutionId,
        _details: {
          institution_name: institution.institution_name,
          institution_type: institution.institution_type,
          rejection_reason: reason
        }
      });

      try {
        await supabase.functions.invoke('send-communication', {
          body: {
            template_key: 'institution_rejected',
            recipient_email: profile?.email,
            recipient_id: institution.user_id,
            variables: {
              institution_name: institution.institution_name,
              rejection_reason: reason,
              support_email: 'support@kangopenbanking.com',
              reapply_url: `${API_CONFIG.SITE_URL}/register`
            }
          }
        });
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
      }

      toast({
        title: "Institution Rejected",
        description: "The institution has been rejected with reason provided"
      });

      loadDashboardData();
    } catch (error) {
      console.error('Error rejecting institution:', error);
      toast({
        title: "Error",
        description: "Failed to reject institution",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      'Authorised': { variant: 'default', icon: CheckCircle2 },
      'AwaitingAuthorisation': { variant: 'secondary', icon: Clock },
      'Rejected': { variant: 'destructive', icon: XCircle },
      'Revoked': { variant: 'outline', icon: XCircle },
      'Expired': { variant: 'outline', icon: Clock },
      'Pending': { variant: 'secondary', icon: Clock },
      'AcceptedSettlementInProgress': { variant: 'default', icon: TrendingUp },
      'AcceptedSettlementCompleted': { variant: 'default', icon: CheckCircle2 }
    };

    const config = variants[status] || { variant: 'outline', icon: AlertCircle };
    const Icon = config.icon;

    return (
      <span className={`status-pill ${
        status === 'Authorised' || status === 'AcceptedSettlementCompleted' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' :
        status === 'Rejected' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' :
        'bg-muted text-muted-foreground'
      }`}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const navCards = [
    { title: "User Management", icon: Users, path: '/admin/users', description: "Manage platform users" },
    { title: "API Clients", icon: Key, path: '/admin/api-clients', description: "OAuth client credentials" },
    { title: "Sandbox", icon: TestTube, path: '/admin/sandbox', description: "Developer testing environment" },
    { title: "Security", icon: Shield, path: '/admin/security', description: "Security monitoring" },
    { title: "Audit Logs", icon: FileText, path: '/admin/audit-logs', description: "System activity logs" },
    { title: "System Config", icon: Shield, path: '/admin/system-config', description: "Platform configuration" },
    { title: "Webhooks", icon: Activity, path: '/admin/webhooks', description: "Event notifications" },
    { title: "Transactions", icon: DollarSign, path: '/admin/transactions', description: "Transaction monitoring" },
    { title: "Health Monitor", icon: Activity, path: '/admin/health', description: "System health checks" },
    { title: "RLS Monitoring", icon: Shield, path: '/admin/rls-monitoring', description: "Row-level security" },
  ];

  const stats = [
    { label: "Total Institutions", value: totalInstitutions, sub: `${pendingRegistrations.length} pending`, icon: Building2, color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
    { label: "Total Consents", value: totalConsents, sub: `${activeConsents} active`, icon: FileText, color: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" },
    { label: "Total Payments", value: totalPayments, sub: "All payment requests", icon: DollarSign, color: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400" },
    { label: "Audit Events", value: auditLogs.length, sub: "Recent events tracked", icon: Activity, color: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Management</h1>
        <p className="text-muted-foreground mt-1">
          Monitor and manage the Kash Open Banking platform
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-xl border-0 shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
                  <p className="stat-value">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Navigation */}
      <div className="grid gap-3 md:grid-cols-5">
        {navCards.map((card) => (
          <Card
            key={card.title}
            className="rounded-xl border-0 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
            onClick={() => navigate(card.path)}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                <card.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xs font-medium">{card.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="registrations" className="space-y-6">
        <TabsList className="inline-flex h-10 items-center rounded-full bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="registrations" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4 mr-2" />
            Registrations
          </TabsTrigger>
          <TabsTrigger value="consents" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4 mr-2" />
            Consents
          </TabsTrigger>
          <TabsTrigger value="payments" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <DollarSign className="h-4 w-4 mr-2" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="fees" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <DollarSign className="h-4 w-4 mr-2" />
            Fees
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Activity className="h-4 w-4 mr-2" />
            Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrations">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Pending Institution Registrations</CardTitle>
              <CardDescription className="text-xs">Review and approve new institution applications</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRegistrations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Building2 className="h-6 w-6 text-muted-foreground" /></div>
                  <p className="text-sm text-muted-foreground">No pending registrations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRegistrations.map((institution) => (
                    <div key={institution.id} className="rounded-xl bg-muted/30 p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{institution.institution_name}</h4>
                          <p className="text-xs text-muted-foreground">{institution.institution_type} • {institution.country}</p>
                        </div>
                        <span className="status-pill bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                          <Clock className="h-3 w-3 mr-1" />Pending
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-xs text-muted-foreground">Registration #</span><p className="font-mono text-xs">{institution.registration_number}</p></div>
                        <div><span className="text-xs text-muted-foreground">Contact</span><p className="text-xs">{institution.profiles?.email}</p></div>
                        <div><span className="text-xs text-muted-foreground">Address</span><p className="text-xs">{institution.address}</p></div>
                        <div><span className="text-xs text-muted-foreground">Applied</span><p className="text-xs">{formatDate(institution.created_at)}</p></div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="flex-1 rounded-full" onClick={() => approveInstitution(institution.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1 rounded-full" onClick={() => rejectInstitution(institution.id)}>
                          <XCircle className="h-4 w-4 mr-2" />Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consents">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent Consents</CardTitle>
              <CardDescription className="text-xs">Monitor AISP consent activity</CardDescription>
            </CardHeader>
            <CardContent>
              {recentConsents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><FileText className="h-6 w-6 text-muted-foreground" /></div>
                  <p className="text-sm text-muted-foreground">No consents found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentConsents.map((consent) => (
                    <div key={consent.id} className="data-row rounded-xl">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">{consent.consent_id}</p>
                          <p className="text-sm font-medium">{consent.profiles?.full_name || 'Unknown'}</p>
                        </div>
                        {getStatusBadge(consent.status)}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div><span className="text-muted-foreground">Client ID</span><p className="font-mono truncate">{consent.client_id}</p></div>
                        <div><span className="text-muted-foreground">Created</span><p>{formatDate(consent.created_at)}</p></div>
                        <div><span className="text-muted-foreground">Expires</span><p>{formatDate(consent.expiration_date)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent Payments</CardTitle>
              <CardDescription className="text-xs">Monitor PISP payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentPayments.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><DollarSign className="h-6 w-6 text-muted-foreground" /></div>
                  <p className="text-sm text-muted-foreground">No payments found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentPayments.map((payment) => (
                    <div key={payment.id} className="data-row rounded-xl">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">{payment.payment_id}</p>
                          <p className="text-sm font-medium">{payment.profiles?.full_name || 'Unknown'}</p>
                        </div>
                        {getStatusBadge(payment.status)}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div><span className="text-muted-foreground">Amount</span><p className="font-semibold">{payment.instructed_amount?.amount} {payment.instructed_amount?.currency}</p></div>
                        <div><span className="text-muted-foreground">Creditor</span><p className="truncate">{payment.creditor_account?.name}</p></div>
                        <div><span className="text-muted-foreground">Created</span><p>{formatDate(payment.created_at)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Fee Management System</CardTitle>
              <CardDescription className="text-xs">Configure transaction fees and manage billing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <Button className="rounded-full" onClick={() => navigate('/admin/fee-management')}>Open Fee Management Dashboard</Button>
                <Button className="rounded-full" variant="outline" onClick={() => navigate('/admin/payment-facilitation')}>Payment Facilitation & Settlements</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Manage fee structures, transaction fees, invoices, waivers, and automated settlements.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Audit Event Logs</CardTitle>
              <CardDescription className="text-xs">System activity and consent event tracking</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Activity className="h-6 w-6 text-muted-foreground" /></div>
                  <p className="text-sm text-muted-foreground">No audit logs found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="data-row rounded-xl text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="status-pill bg-muted text-muted-foreground">{log.event_type}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(log.created_at)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Consent:</span> <span className="font-mono">{log.consent_id}</span></div>
                        <div><span className="text-muted-foreground">Type:</span> <span className="uppercase">{log.consent_type}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedInstitutionForBranch && (
        <CreateBranchDialog
          open={branchDialogOpen}
          onOpenChange={setBranchDialogOpen}
          institutionId={selectedInstitutionForBranch.id}
          institutionName={selectedInstitutionForBranch.name}
          onSuccess={() => {
            loadDashboardData();
            setSelectedInstitutionForBranch(null);
          }}
        />
      )}
    </div>
  );
};

export default Admin;
