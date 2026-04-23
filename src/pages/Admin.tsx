import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  Building2, Users, Activity, DollarSign, CheckCircle2, Clock,
  Shield, FileText, XCircle, AlertCircle, TrendingUp, Key, TestTube,
  Bell, MessageCircle, CreditCard, BarChart3, ArrowRight,
  AlertTriangle, Wallet, Globe, Zap, RefreshCw, Eye, Lock
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CreateBranchDialog } from "@/components/admin/CreateBranchDialog";
import { API_CONFIG } from "@/config/api";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const Admin = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [totalInstitutions, setTotalInstitutions] = useState(0);
  const [totalConsents, setTotalConsents] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [activeConsents, setActiveConsents] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalMerchants, setTotalMerchants] = useState(0);

  const [pendingRegistrations, setPendingRegistrations] = useState<any[]>([]);
  const [pendingKyc, setPendingKyc] = useState<any[]>([]);
  const [pendingKyb, setPendingKyb] = useState<any[]>([]);
  const [openSupportChats, setOpenSupportChats] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState<any[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [pendingPayByBank, setPendingPayByBank] = useState(0);
  const [pendingDisputes, setPendingDisputes] = useState(0);
  const [pendingPayouts, setPendingPayouts] = useState(0);

  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedInstitutionForBranch, setSelectedInstitutionForBranch] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [
        institutionsRes, consentsRes, paymentsRes, usersRes, merchantsRes,
        pendingRes, kycRes, kybRes, supportRes, notifsRes, alertsRes,
        pbbRes, disputesRes, payoutsRes
      ] = await Promise.all([
        supabase.from('institutions').select('id', { count: 'exact' }),
        supabase.from('aisp_consents').select('id', { count: 'exact' }),
        supabase.from('payments').select('id', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('gateway_merchants').select('id', { count: 'exact' }),
        supabase.from('institutions').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
        supabase.from('kyc_verifications').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('business_kyc' as any).select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('support_conversations').select('id', { count: 'exact' }).eq('status', 'open'),
        supabase.from('app_notifications').select('id, title, message, type, icon, created_at, metadata').eq('is_read', false).order('created_at', { ascending: false }).limit(8) as any,
        supabase.from('system_alerts' as any).select('id, title, message, severity, created_at').eq('is_resolved', false).order('created_at', { ascending: false }).limit(5) as any,
        supabase.from('pay_by_bank_intents').select('id', { count: 'exact' }).eq('status', 'awaiting_auth') as any,
        supabase.from('gateway_disputes').select('id', { count: 'exact' }).eq('status', 'open') as any,
        supabase.from('gateway_payouts').select('id', { count: 'exact' }).eq('status', 'pending') as any,
      ]);

      setTotalInstitutions(institutionsRes.count || 0);
      setTotalConsents(consentsRes.count || 0);
      setTotalPayments(paymentsRes.count || 0);
      setTotalUsers(usersRes.count || 0);
      setTotalMerchants(merchantsRes.count || 0);
      setPendingRegistrations(pendingRes.data || []);
      setPendingKyc(Array(kycRes.count || 0));
      setPendingKyb(Array(kybRes.count || 0));
      setOpenSupportChats(supportRes.count || 0);
      setUnreadNotifications(notifsRes.data || []);
      setRecentAlerts(alertsRes.data || []);
      setPendingPayByBank(pbbRes.count || 0);
      setPendingDisputes(disputesRes.count || 0);
      setPendingPayouts(payoutsRes.count || 0);

      const { count: activeCount } = await supabase
        .from('aisp_consents')
        .select('id', { count: 'exact' })
        .eq('status', 'Authorised')
        .gt('expiration_date', new Date().toISOString());
      setActiveConsents(activeCount || 0);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveInstitution = async (institutionId: string) => {
    try {
      const { data: institution } = await supabase.from('institutions').select('institution_type, user_id, institution_name').eq('id', institutionId).single();
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', institution?.user_id).single();
      if (!institution) throw new Error('Institution not found');

      let sandboxClientId: string | null = null;
      let sandboxClientSecret: string | null = null;
      if (institution.institution_type === 'developer') {
        sandboxClientId = `dev_${crypto.randomUUID().replace(/-/g, '')}`;
        sandboxClientSecret = `sk_${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
      }

      const { error } = await supabase.from('institutions').update({
        status: 'approved', approved_at: new Date().toISOString(),
        sandbox_access: institution.institution_type === 'developer'
      }).eq('id', institutionId);
      if (error) throw error;

      if (sandboxClientId && sandboxClientSecret) {
        await supabase.rpc('encrypt_sandbox_credentials', { _institution_id: institutionId, _client_id: sandboxClientId, _client_secret: sandboxClientSecret });
      }

      await supabase.rpc('log_audit_event', {
        _action_type: 'institution_approved', _entity_type: 'institution', _entity_id: institutionId,
        _details: { institution_name: institution.institution_name, institution_type: institution.institution_type }
      });

      try {
        await supabase.functions.invoke('send-communication', {
          body: {
            template_key: 'institution_approved', recipient_email: profile?.email, recipient_id: institution.user_id,
            variables: {
              institution_name: institution.institution_name, portal_url: `${API_CONFIG.SITE_URL}/fi-portal`,
              client_id: sandboxClientId || '', client_secret: sandboxClientSecret || '',
              is_developer: institution.institution_type === 'developer',
              security_note: 'Please save your client secret securely. It will not be shown again.'
            }
          }
        });
      } catch { /* email silently */ }

      setSelectedInstitutionForBranch({ id: institutionId, name: institution.institution_name });
      setBranchDialogOpen(true);
      toast({ title: "Approved — Create Main Branch", description: "Complete the approval by creating the main branch" });
    } catch {
      toast({ title: "Error", description: "Failed to approve institution", variant: "destructive" });
    }
  };

  const rejectInstitution = async (institutionId: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      const { data: institution } = await supabase.from('institutions').select('user_id, institution_name, institution_type').eq('id', institutionId).single();
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', institution?.user_id).single();
      if (!institution) throw new Error('Not found');
      const { error } = await supabase.from('institutions').update({ status: 'rejected', rejection_reason: reason }).eq('id', institutionId);
      if (error) throw error;
      await supabase.rpc('log_audit_event', {
        _action_type: 'institution_rejected', _entity_type: 'institution', _entity_id: institutionId,
        _details: { institution_name: institution.institution_name, rejection_reason: reason }
      });
      try {
        await supabase.functions.invoke('send-communication', {
          body: {
            template_key: 'institution_rejected', recipient_email: profile?.email, recipient_id: institution.user_id,
            variables: { institution_name: institution.institution_name, rejection_reason: reason, support_email: 'support@kangopenbanking.com', reapply_url: `${API_CONFIG.SITE_URL}/register` }
          }
        });
      } catch { /* email silently */ }
      toast({ title: "Institution Rejected" });
      loadDashboardData();
    } catch {
      toast({ title: "Error", description: "Failed to reject institution", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const totalPendingActions = pendingRegistrations.length + pendingKyc.length + pendingKyb.length + openSupportChats + pendingPayByBank + pendingDisputes + pendingPayouts;

  const kpiCards = [
    { label: "Total Users", value: totalUsers, icon: Users, bg: "bg-blue-600", text: "text-white" },
    { label: "Institutions", value: totalInstitutions, icon: Building2, bg: "bg-emerald-600", text: "text-white" },
    { label: "Merchants", value: totalMerchants, icon: CreditCard, bg: "bg-violet-600", text: "text-white" },
    { label: "Consents", value: totalConsents, sub: `${activeConsents} active`, icon: FileText, bg: "bg-amber-500", text: "text-white" },
    { label: "Payments", value: totalPayments, icon: DollarSign, bg: "bg-rose-600", text: "text-white" },
    { label: "Pending Actions", value: totalPendingActions, icon: AlertCircle, bg: totalPendingActions > 0 ? "bg-red-600" : "bg-gray-500", text: "text-white" },
  ];

  const pendingActions = [
    { label: "Institution Approvals", count: pendingRegistrations.length, icon: Building2, path: "/admin/institution-management", color: "bg-blue-500" },
    { label: "KYC Reviews", count: pendingKyc.length, icon: Shield, path: "/admin/kyc-verification", color: "bg-emerald-500" },
    { label: "Business KYB", count: pendingKyb.length, icon: FileText, path: "/admin/business-kyc", color: "bg-teal-500" },
    { label: "Support Chats", count: openSupportChats, icon: MessageCircle, path: "/admin/support-chat", color: "bg-indigo-500" },
    { label: "Pay by Bank", count: pendingPayByBank, icon: Wallet, path: "/admin/pay-by-bank", color: "bg-violet-500" },
    { label: "Open Disputes", count: pendingDisputes, icon: AlertTriangle, path: "/admin/disputes", color: "bg-orange-500" },
    { label: "Pending Payouts", count: pendingPayouts, icon: DollarSign, path: "/admin/payouts", color: "bg-rose-500" },
  ].filter(a => a.count > 0);

  const quickLinks = [
    { title: "Users", icon: Users, path: '/admin/users', color: "bg-blue-500" },
    { title: "Transactions", icon: DollarSign, path: '/admin/transactions', color: "bg-emerald-500" },
    { title: "API Clients", icon: Key, path: '/admin/api-clients', color: "bg-violet-500" },
    { title: "Webhooks", icon: Zap, path: '/admin/webhooks', color: "bg-amber-500" },
    { title: "Sandbox", icon: TestTube, path: '/admin/sandbox', color: "bg-teal-500" },
    { title: "Fee Management", icon: CreditCard, path: '/admin/fee-management', color: "bg-rose-500" },
    { title: "Revenue", icon: BarChart3, path: '/admin/revenue', color: "bg-indigo-500" },
    { title: "Security", icon: Shield, path: '/admin/security-dashboard', color: "bg-orange-500" },
    { title: "PIN Lockouts", icon: Lock, path: '/admin/pin-lockout', color: "bg-red-500" },
    { title: "Audit Logs", icon: FileText, path: '/admin/audit-logs', color: "bg-cyan-500" },
    { title: "System Config", icon: Globe, path: '/admin/system-config', color: "bg-pink-500" },
  ];

  const severityColor: Record<string, string> = {
    critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-blue-500', info: 'bg-gray-400',
  };

  const notifIcon: Record<string, string> = {
    success: 'text-emerald-500', warning: 'text-amber-500', info: 'text-blue-500',
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader icon={Activity} title="Platform Command Center" description="Real-time overview of all platform operations, pending actions, and system alerts">
        <Button size="sm" variant="secondary" onClick={loadDashboardData} className="rounded-full gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </AdminPageHeader>

      {/* ─── KPI Cards ─── */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((kpi, i) => (
          <motion.div key={kpi.label} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
            <Card className={`${kpi.bg} ${kpi.text} border-0 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden relative`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <kpi.icon className="h-5 w-5 opacity-80" />
                  <TrendingUp className="h-4 w-4 opacity-40" />
                </div>
                <p className="text-3xl font-bold tracking-tight">{kpi.value.toLocaleString()}</p>
                <p className="text-xs opacity-80 mt-1 font-medium">{kpi.label}</p>
                {kpi.sub && <p className="text-[10px] opacity-60 mt-0.5">{kpi.sub}</p>}
                <div className="absolute -right-4 -bottom-4 opacity-[0.08]">
                  <kpi.icon className="h-24 w-24" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ─── Pending Actions ─── */}
      {pendingActions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-lg font-bold text-foreground">Pending Actions</h2>
            <Badge variant="destructive" className="rounded-full text-xs">{totalPendingActions}</Badge>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {pendingActions.map((action, i) => (
              <motion.div key={action.label} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                <Card
                  className="border-0 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
                  onClick={() => navigate(action.path)}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`${action.color} h-12 w-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <action.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-2xl font-bold text-foreground">{action.count}</p>
                      <p className="text-xs text-muted-foreground truncate">{action.label}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Alerts & Notifications Row ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Alerts */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-0 rounded-2xl shadow-sm h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <h3 className="font-bold text-foreground">System Alerts</h3>
                </div>
                <Button size="sm" variant="ghost" className="rounded-full text-xs" onClick={() => navigate('/admin/system-alerts')}>
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              {recentAlerts.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mb-2 text-emerald-400" />
                  <p className="text-sm font-medium">All systems operational</p>
                  <p className="text-xs">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAlerts.map((alert: any) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                      <div className={`h-2.5 w-2.5 mt-1.5 rounded-full shrink-0 ${severityColor[alert.severity] || 'bg-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{alert.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[10px] shrink-0 capitalize">{alert.severity}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Unread Notifications */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-0 rounded-2xl shadow-sm h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-500" />
                  <h3 className="font-bold text-foreground">Recent Notifications</h3>
                  {unreadNotifications.length > 0 && (
                    <Badge className="rounded-full bg-blue-500 text-white text-[10px]">{unreadNotifications.length}</Badge>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="rounded-full text-xs" onClick={() => navigate('/admin/notification-history')}>
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              {unreadNotifications.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Bell className="h-10 w-10 mb-2 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No new notifications</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unreadNotifications.slice(0, 5).map((notif: any) => (
                    <div key={notif.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                      <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${notifIcon[notif.type] || 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{notif.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{notif.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Pending Institution Registrations ─── */}
      {pendingRegistrations.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-0 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  <h3 className="font-bold text-foreground">Pending Institution Registrations</h3>
                  <Badge variant="secondary" className="rounded-full">{pendingRegistrations.length}</Badge>
                </div>
                <Button size="sm" variant="ghost" className="rounded-full text-xs" onClick={() => navigate('/admin/institution-management')}>
                  Manage All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {pendingRegistrations.map((inst: any) => (
                  <div key={inst.id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                    <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{inst.institution_name}</p>
                      <p className="text-xs text-muted-foreground">{inst.institution_type} • {inst.country} • {formatDistanceToNow(new Date(inst.created_at), { addSuffix: true })}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" className="rounded-full h-8 px-3 text-xs" onClick={() => approveInstitution(inst.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="rounded-full h-8 px-3 text-xs" onClick={() => rejectInstitution(inst.id)}>
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Quick Navigation ─── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <h2 className="text-lg font-bold text-foreground mb-4">Quick Access</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          {quickLinks.map((link, i) => (
            <motion.div key={link.title} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
              <Card
                className="border-0 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
                onClick={() => navigate(link.path)}
              >
                <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                  <div className={`${link.color} h-11 w-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <link.icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">{link.title}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {selectedInstitutionForBranch && (
        <CreateBranchDialog
          open={branchDialogOpen}
          onOpenChange={setBranchDialogOpen}
          institutionId={selectedInstitutionForBranch.id}
          institutionName={selectedInstitutionForBranch.name}
          onSuccess={() => { loadDashboardData(); setSelectedInstitutionForBranch(null); }}
        />
      )}
    </div>
  );
};

export default Admin;
