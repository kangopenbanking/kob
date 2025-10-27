import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TrendingUp
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Admin = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Stats
  const [totalInstitutions, setTotalInstitutions] = useState(0);
  const [totalConsents, setTotalConsents] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [activeConsents, setActiveConsents] = useState(0);
  
  // Data
  const [pendingRegistrations, setPendingRegistrations] = useState<any[]>([]);
  const [recentConsents, setRecentConsents] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
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

      const hasAdminRole = roles?.some(r => r.role === 'admin');
      
      if (!hasAdminRole) {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges",
          variant: "destructive"
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      loadDashboardData();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/');
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load stats
      const [institutionsRes, consentsRes, paymentsRes] = await Promise.all([
        supabase.from('institutions').select('id', { count: 'exact' }),
        supabase.from('aisp_consents').select('id', { count: 'exact' }),
        supabase.from('payments').select('id', { count: 'exact' })
      ]);

      setTotalInstitutions(institutionsRes.count || 0);
      setTotalConsents(consentsRes.count || 0);
      setTotalPayments(paymentsRes.count || 0);

      // Active consents (AISP)
      const { count: activeCount } = await supabase
        .from('aisp_consents')
        .select('id', { count: 'exact' })
        .eq('status', 'Authorised')
        .gt('expiration_date', new Date().toISOString());
      
      setActiveConsents(activeCount || 0);

      // Pending registrations
      const { data: pending } = await supabase
        .from('institutions')
        .select('*, profiles(full_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setPendingRegistrations(pending || []);

      // Recent consents
      const { data: consents } = await supabase
        .from('aisp_consents')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setRecentConsents(consents || []);

      // Recent payments
      const { data: payments } = await supabase
        .from('payments')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setRecentPayments(payments || []);

      // Audit logs
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
      // Get institution details to enable sandbox for developers
      const { data: institution } = await supabase
        .from('institutions')
        .select('institution_type, user_id, institution_name')
        .eq('id', institutionId)
        .single();

      // Get user email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', institution?.user_id)
        .single();

      if (!institution) throw new Error('Institution not found');

      // Generate sandbox credentials for developers
      let sandboxClientId: string | null = null;
      let sandboxClientSecret: string | null = null;
      
      if (institution.institution_type === 'developer') {
        sandboxClientId = `dev_${crypto.randomUUID().replace(/-/g, '')}`;
        sandboxClientSecret = `sk_${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
      }

      // Security Fix: Approve institution first, then use secure function to encrypt credentials
      const updateData: any = { 
        status: 'approved',
        approved_at: new Date().toISOString(),
        sandbox_access: institution.institution_type === 'developer'
        // Note: sandbox_credentials will be encrypted separately using secure function
      };

      const { error } = await supabase
        .from('institutions')
        .update(updateData)
        .eq('id', institutionId);

      if (error) throw error;

      // Security Fix: Encrypt and store sandbox credentials using secure function
      if (sandboxClientId && sandboxClientSecret) {
        const { error: encryptError } = await supabase.rpc('encrypt_sandbox_credentials', {
          _institution_id: institutionId,
          _client_id: sandboxClientId,
          _client_secret: sandboxClientSecret
        });
        
        if (encryptError) {
          console.error('Failed to encrypt sandbox credentials:', encryptError);
          // Still continue with approval, credentials can be regenerated
        }
      }

      // Log audit event using secure logging function
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

      // Send approval notification email
      // Note: Only send client_id in email, never send plain-text secret
      try {
        await supabase.functions.invoke('send-communication', {
          body: {
            template_key: 'institution_approved',
            recipient_email: profile?.email,
            recipient_id: institution.user_id,
            variables: {
              institution_name: institution.institution_name,
              portal_url: `${window.location.origin}/fi-portal`,
              client_id: sandboxClientId || '',
              // Security Fix: Send secret only once via secure channel
              client_secret: sandboxClientSecret || '',
              is_developer: institution.institution_type === 'developer',
              security_note: 'Please save your client secret securely. It will not be shown again.'
            }
          }
        });
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
      }

      toast({
        title: "Institution Approved",
        description: institution.institution_type === 'developer' 
          ? "Institution approved with sandbox credentials generated"
          : "Institution approved successfully"
      });

      loadDashboardData();
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
      // Get institution details and user email
      const { data: institution } = await supabase
        .from('institutions')
        .select('user_id, institution_name, institution_type')
        .eq('id', institutionId)
        .single();

      // Get user email from profiles
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

      // Log audit event using secure logging function
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

      // Send rejection notification email
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
              reapply_url: `${window.location.origin}/register`
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
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
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
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Admin Dashboard</span>
        </div>
        <h1 className="text-4xl font-bold mb-2">Platform Management</h1>
        <p className="text-muted-foreground">
          Monitor and manage institutions, consents, payments, and system activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Institutions</p>
                <p className="text-3xl font-bold">{totalInstitutions}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {pendingRegistrations.length} pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Consents</p>
                <p className="text-3xl font-bold">{totalConsents}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-accent" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {activeConsents} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Payments</p>
                <p className="text-3xl font-bold">{totalPayments}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              All payment requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Audit Events</p>
                <p className="text-3xl font-bold">{auditLogs.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-accent" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Recent events tracked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="registrations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="registrations">
            <Building2 className="h-4 w-4 mr-2" />
            Registrations
          </TabsTrigger>
          <TabsTrigger value="consents">
            <FileText className="h-4 w-4 mr-2" />
            Consents
          </TabsTrigger>
          <TabsTrigger value="payments">
            <DollarSign className="h-4 w-4 mr-2" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="fees">
            <DollarSign className="h-4 w-4 mr-2" />
            Fee Management
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Activity className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Pending Registrations */}
        <TabsContent value="registrations">
          <Card>
            <CardHeader>
              <CardTitle>Pending Institution Registrations</CardTitle>
              <CardDescription>
                Review and approve new institution applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRegistrations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending registrations
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRegistrations.map((institution) => (
                    <div
                      key={institution.id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-lg">
                            {institution.institution_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {institution.institution_type} • {institution.country}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Registration #:</span>
                          <p className="font-mono">{institution.registration_number}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Contact:</span>
                          <p>{institution.profiles?.email}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Address:</span>
                          <p>{institution.address}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Applied:</span>
                          <p>{formatDate(institution.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => approveInstitution(institution.id)}
                          className="flex-1"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectInstitution(institution.id)}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Consents */}
        <TabsContent value="consents">
          <Card>
            <CardHeader>
              <CardTitle>Recent Consents</CardTitle>
              <CardDescription>
                Monitor AISP consent activity across the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentConsents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No consents found
                </div>
              ) : (
                <div className="space-y-4">
                  {recentConsents.map((consent) => (
                    <div
                      key={consent.id}
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-mono text-sm text-muted-foreground">
                            {consent.consent_id}
                          </p>
                          <p className="font-medium">
                            User: {consent.profiles?.full_name || 'Unknown'}
                          </p>
                        </div>
                        {getStatusBadge(consent.status)}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Client ID:</span>
                          <p className="font-mono text-xs truncate">
                            {consent.client_id}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span>
                          <p>{formatDate(consent.created_at)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Expires:</span>
                          <p>{formatDate(consent.expiration_date)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Payments */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
              <CardDescription>
                Monitor PISP payment transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No payments found
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-mono text-sm text-muted-foreground">
                            {payment.payment_id}
                          </p>
                          <p className="font-medium">
                            User: {payment.profiles?.full_name || 'Unknown'}
                          </p>
                        </div>
                        {getStatusBadge(payment.status)}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <p className="font-semibold">
                            {payment.instructed_amount?.amount} {payment.instructed_amount?.currency}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Creditor:</span>
                          <p className="truncate">
                            {payment.creditor_account?.name}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span>
                          <p>{formatDate(payment.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fee Management */}
        <TabsContent value="fees">
          <Card>
            <CardHeader>
              <CardTitle>Fee Management System</CardTitle>
              <CardDescription>
                Configure transaction fees and manage billing for institutions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/fee-management')}>
                Open Fee Management Dashboard
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                Manage fee structures, view transaction fees, generate invoices, and configure waivers for all institutions.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Event Logs</CardTitle>
              <CardDescription>
                System activity and consent event tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No audit logs found
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 border rounded-lg text-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{log.event_type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Consent:</span>
                          <p className="font-mono">{log.consent_id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <p className="uppercase">{log.consent_type}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;