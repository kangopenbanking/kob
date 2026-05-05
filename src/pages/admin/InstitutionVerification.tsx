import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreateBranchDialog } from "@/components/admin/CreateBranchDialog";
import { InstitutionDetailsDialog } from "@/components/admin/InstitutionDetailsDialog";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Building2, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertTriangle,
  FileText,
  Shield,
  MapPin,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Ban,
  Settings, BadgeCheck} from "lucide-react";
import { format } from "date-fns";
import { API_CONFIG } from "@/config/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface Institution {
  id: string;
  institution_name: string;
  institution_type: string;
  status: string;
  verification_step: string;
  kyb_verified_at: string | null;
  main_branch_id: string | null;
  created_at: string;
  user_id: string;
}

interface VerificationStep {
  id: string;
  institution_id: string;
  step_name: string;
  step_type: string;
  status: string;
  completed_at: string | null;
  notes: string | null;
}

interface KYBSubmission {
  id: string;
  user_id: string;
  account_id: string | null;
  business_name: string;
  business_type: string;
  registration_number: string;
  industry: string;
  business_address: any;
  verification_status: string;
  created_at: string;
  verified_at: string | null;
}

export default function InstitutionVerification() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [requestingKYB, setRequestingKYB] = useState<string | null>(null);
  const [approvingKYB, setApprovingKYB] = useState<string | null>(null);
  const [rejectingKYB, setRejectingKYB] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [creatingSteps, setCreatingSteps] = useState<string | null>(null);

  // Fetch all institutions (not just pending verification)
  const { data: institutions, isLoading: institutionsLoading, refetch, error: institutionsError } = useQuery({
    queryKey: ["institutions-verification"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions")
        .select("*")
        .neq('verification_step', 'approved')
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Institution[];
    },
  });

  // Fetch verification steps
  const { data: verificationSteps, isLoading: stepsLoading, refetch: refetchSteps } = useQuery({
    queryKey: ["verification-steps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institution_verification_steps")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as VerificationStep[];
    },
  });

  // Fetch KYB submissions
  const { data: kybSubmissions, isLoading: kybLoading } = useQuery({
    queryKey: ["kyb-for-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_kyc")
        .select("*");

      if (error) throw error;
      return data as KYBSubmission[];
    },
  });

  const isLoading = institutionsLoading || stepsLoading || kybLoading;

  const getStepsForInstitution = (institutionId: string): VerificationStep[] => {
    return verificationSteps?.filter(step => step.institution_id === institutionId) || [];
  };

  const getKYBForInstitution = (userId: string, accountId: string | null): KYBSubmission | undefined => {
    return kybSubmissions?.find(kyb => 
      kyb.user_id === userId || (accountId && kyb.account_id === accountId)
    );
  };

  const calculateProgress = (steps: VerificationStep[]): number => {
    if (steps.length === 0) return 0;
    const completed = steps.filter(s => s.status === 'completed').length;
    return (completed / steps.length) * 100;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: { variant: "default", icon: CheckCircle, color: "text-green-500" },
      pending: { variant: "secondary", icon: Clock, color: "text-yellow-500" },
      in_progress: { variant: "default", icon: AlertTriangle, color: "text-blue-500" },
      failed: { variant: "destructive", icon: XCircle, color: "text-red-500" },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getVerificationStepBadge = (step: string) => {
    const stepLabels: Record<string, string> = {
      pending_registration: "Pending Registration",
      pending_kyb: "Pending KYB",
      kyb_submitted: "KYB Submitted",
      kyb_approved: "KYB Approved",
      pending_branch: "Pending Branch",
      approved: "Fully Approved",
      rejected: "Rejected"
    };

    const stepColors: Record<string, string> = {
      pending_registration: "bg-gray-100 text-gray-700",
      pending_kyb: "bg-yellow-100 text-yellow-700",
      kyb_submitted: "bg-blue-100 text-blue-700",
      kyb_approved: "bg-green-100 text-green-700",
      pending_branch: "bg-purple-100 text-purple-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700"
    };

    return (
      <Badge variant="outline" className={stepColors[step] || ""}>
        {stepLabels[step] || step}
      </Badge>
    );
  };

  const handleViewDetails = (institution: Institution) => {
    setSelectedInstitution(institution);
    setDetailsDialogOpen(true);
  };

  const handleCreateBranch = (institution: Institution) => {
    setSelectedInstitution(institution);
    setBranchDialogOpen(true);
  };

  // Create verification steps manually if trigger didn't fire
  const handleCreateVerificationSteps = async (institution: Institution) => {
    setCreatingSteps(institution.id);
    try {
      const steps = [
        { step_name: 'Institution Registration', step_type: 'registration', status: 'completed' },
        { step_name: 'Business KYC Submission', step_type: 'kyb_submission', status: 'pending' },
        { step_name: 'KYB Verification', step_type: 'kyb_verification', status: 'pending' },
        { step_name: 'Main Branch Creation', step_type: 'branch_creation', status: 'pending' },
        { step_name: 'Final Approval', step_type: 'final_approval', status: 'pending' },
      ];

      const { error } = await supabase
        .from('institution_verification_steps')
        .insert(steps.map(step => ({
          institution_id: institution.id,
          ...step
        })));

      if (error) throw error;

      toast({
        title: "Verification Steps Created",
        description: "Verification workflow initialized successfully.",
      });

      await refetchSteps();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreatingSteps(null);
    }
  };

  const handleRequestKYB = async (institution: Institution) => {
    setRequestingKYB(institution.id);
    try {
      // Get institution user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', institution.user_id)
        .single();

      if (profileError) throw new Error('Failed to fetch institution profile');

      if (!profile?.email) {
        throw new Error('No email found for institution user');
      }

      // Send KYB request email
      const { error: commError } = await supabase.functions.invoke('send-communication', {
        body: {
          template_key: 'kyb_request',
          recipient_email: profile.email,
          variables: {
            recipient_name: profile.full_name || 'Institution Representative',
            institution_name: institution.institution_name,
            dashboard_url: `${API_CONFIG.SITE_URL}/business-kyb-submission`
          }
        }
      });

      if (commError) throw commError;

      // Update institution verification step
      const { error: updateError } = await supabase
        .from('institutions')
        .update({ 
          verification_step: 'pending_kyb',
          updated_at: new Date().toISOString()
        })
        .eq('id', institution.id);

      if (updateError) throw updateError;

      // Update verification step
      await supabase
        .from('institution_verification_steps')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('institution_id', institution.id)
        .eq('step_type', 'registration');

      toast({
        title: "KYB Request Sent",
        description: `Email sent to ${profile.email} requesting Business KYC submission.`,
      });

      await refetch();
      await refetchSteps();
    } catch (error: any) {
      console.error('Error sending KYB request:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to send KYB request',
        variant: "destructive",
      });
    } finally {
      setRequestingKYB(null);
    }
  };

  const handleApproveKYB = async (institutionId: string, kybId: string) => {
    setApprovingKYB(institutionId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-kyb-verify', {
        body: {
          kyb_id: kybId,
          institution_id: institutionId,
          action: 'approve'
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "KYB Approved",
        description: data?.message || "Business KYC approved successfully. Institution can now create main branch.",
      });

      await refetch();
      await refetchSteps();
      queryClient.invalidateQueries({ queryKey: ["kyb-for-institutions"] });
    } catch (error: any) {
      console.error('Error approving KYB:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to approve KYB',
        variant: "destructive",
      });
    } finally {
      setApprovingKYB(null);
    }
  };

  const handleRejectKYB = async () => {
    if (!selectedInstitution || !rejectionReason) return;
    
    setRejectingKYB(selectedInstitution.id);
    try {
      const kyb = getKYBForInstitution(selectedInstitution.user_id, null);
      
      if (!kyb) {
        throw new Error('No KYB submission found for this institution');
      }

      const { data, error } = await supabase.functions.invoke('admin-kyb-verify', {
        body: {
          kyb_id: kyb.id,
          institution_id: selectedInstitution.id,
          action: 'reject',
          rejection_reason: rejectionReason
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Institution Rejected",
        description: data?.message || "The institution has been rejected and notified.",
      });

      setRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedInstitution(null);
      await refetch();
      await refetchSteps();
      queryClient.invalidateQueries({ queryKey: ["kyb-for-institutions"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRejectingKYB(null);
    }
  };

  const handleFinalApproval = async (institution: Institution) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-institution-approve', {
        body: { institution_id: institution.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Institution Approved",
        description: data?.message || `${institution.institution_name} has been fully approved and can now access all features.`,
      });

      await refetch();
      await refetchSteps();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const InstitutionCard = ({ institution }: { institution: Institution }) => {
    const steps = getStepsForInstitution(institution.id);
    const progress = calculateProgress(steps);
    const kyb = getKYBForInstitution(institution.user_id, null);
    const isProcessingKYB = requestingKYB === institution.id;
    const isApprovingKYBForThis = approvingKYB === institution.id;
    const isCreatingSteps = creatingSteps === institution.id;
    const hasNoSteps = steps.length === 0;

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {institution.institution_name}
              </CardTitle>
              <CardDescription className="text-xs">
                {institution.institution_type} • Created {format(new Date(institution.created_at), "MMM d, yyyy")}
              </CardDescription>
            </div>
            {getVerificationStepBadge(institution.verification_step)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* No Steps Warning */}
          {hasNoSteps && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700 text-xs">
                Verification steps not initialized.
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 ml-1 text-yellow-700 underline"
                  onClick={() => handleCreateVerificationSteps(institution)}
                  disabled={isCreatingSteps}
                >
                  {isCreatingSteps ? "Creating..." : "Initialize now"}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Verification Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Verification Checklist */}
          {steps.length > 0 && (
            <div className="space-y-2">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {step.status === 'completed' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : step.status === 'failed' ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className={step.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                      {step.step_name}
                    </span>
                  </div>
                  {getStatusBadge(step.status)}
                </div>
              ))}
            </div>
          )}

          {/* KYB Status */}
          {kyb && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Business KYC Status
                </span>
                <Badge variant={kyb.verification_status === 'approved' ? 'default' : 
                              kyb.verification_status === 'rejected' ? 'destructive' : 'secondary'}>
                  {kyb.verification_status?.toUpperCase()}
                </Badge>
              </div>
              {kyb.verification_status === 'pending' && (
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1" 
                    onClick={() => handleApproveKYB(institution.id, kyb.id)}
                    disabled={isApprovingKYBForThis}
                  >
                    {isApprovingKYBForThis ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    className="flex-1" 
                    onClick={() => {
                      setSelectedInstitution(institution);
                      setRejectDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Main Branch Status */}
          {institution.main_branch_id ? (
            <div className="space-y-2">
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <MapPin className="h-4 w-4" />
                  <span>Main branch created</span>
                </div>
              </div>
              {institution.verification_step !== 'approved' && (
                <Button 
                  className="w-full" 
                  onClick={() => handleFinalApproval(institution)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Final Approval
                </Button>
              )}
            </div>
          ) : (institution.verification_step === 'pending_branch' || institution.verification_step === 'kyb_approved') ? (
            <Button 
              className="w-full" 
              onClick={() => handleCreateBranch(institution)}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Create Main Branch
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : null}

          {/* Quick Actions */}
          <div className="flex gap-2 text-xs">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => handleViewDetails(institution)}
            >
              <FileText className="h-3 w-3 mr-1" />
              View Details
            </Button>
            {!kyb && institution.verification_step !== 'pending_kyb' && institution.verification_step !== 'rejected' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => handleRequestKYB(institution)}
                disabled={isProcessingKYB}
              >
                {isProcessingKYB ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Shield className="h-3 w-3 mr-1" />
                    Request KYB
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (institutionsError) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load institutions: {institutionsError.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <AdminPageHeader icon={BadgeCheck} title="Institution Verification" description="Review and verify financial institution applications">
          <Button variant="outline" onClick={() => refetch()} className="text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </AdminPageHeader>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading institutions...</p>
          </div>
        ) : institutions && institutions.length > 0 ? (
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">
                All ({institutions.length})
              </TabsTrigger>
              <TabsTrigger value="pending_registration">
                New ({institutions.filter(i => i.verification_step === 'pending_registration').length})
              </TabsTrigger>
              <TabsTrigger value="pending_kyb">
                Pending KYB ({institutions.filter(i => i.verification_step === 'pending_kyb').length})
              </TabsTrigger>
              <TabsTrigger value="kyb_submitted">
                KYB Review ({institutions.filter(i => i.verification_step === 'kyb_submitted').length})
              </TabsTrigger>
              <TabsTrigger value="pending_branch">
                Pending Branch ({institutions.filter(i => ['pending_branch', 'kyb_approved'].includes(i.verification_step)).length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({institutions.filter(i => i.verification_step === 'rejected').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {institutions.map((inst) => (
                  <InstitutionCard key={inst.id} institution={inst} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="pending_registration" className="space-y-4">
              {institutions.filter(i => i.verification_step === 'pending_registration').length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {institutions
                    .filter(i => i.verification_step === 'pending_registration')
                    .map((inst) => (
                      <InstitutionCard key={inst.id} institution={inst} />
                    ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No new registrations pending</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="pending_kyb" className="space-y-4">
              {institutions.filter(i => i.verification_step === 'pending_kyb').length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {institutions
                    .filter(i => i.verification_step === 'pending_kyb')
                    .map((inst) => (
                      <InstitutionCard key={inst.id} institution={inst} />
                    ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No institutions pending KYB submission</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="kyb_submitted" className="space-y-4">
              {institutions.filter(i => i.verification_step === 'kyb_submitted').length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {institutions
                    .filter(i => i.verification_step === 'kyb_submitted')
                    .map((inst) => (
                      <InstitutionCard key={inst.id} institution={inst} />
                    ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No KYB submissions to review</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="pending_branch" className="space-y-4">
              {institutions.filter(i => ['pending_branch', 'kyb_approved'].includes(i.verification_step)).length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {institutions
                    .filter(i => ['pending_branch', 'kyb_approved'].includes(i.verification_step))
                    .map((inst) => (
                      <InstitutionCard key={inst.id} institution={inst} />
                    ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No institutions pending branch creation</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="rejected" className="space-y-4">
              {institutions.filter(i => i.verification_step === 'rejected').length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {institutions
                    .filter(i => i.verification_step === 'rejected')
                    .map((inst) => (
                      <InstitutionCard key={inst.id} institution={inst} />
                    ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Ban className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No rejected institutions</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No institutions pending verification</p>
            </CardContent>
          </Card>
        )}

        {/* Dialogs */}
        {selectedInstitution && (
          <>
            <CreateBranchDialog
              open={branchDialogOpen}
              onOpenChange={setBranchDialogOpen}
              institutionId={selectedInstitution.id}
              institutionName={selectedInstitution.institution_name}
              onSuccess={() => {
                refetch();
                refetchSteps();
                setSelectedInstitution(null);
              }}
            />
            <InstitutionDetailsDialog
              open={detailsDialogOpen}
              onOpenChange={setDetailsDialogOpen}
              institution={selectedInstitution}
              verificationSteps={getStepsForInstitution(selectedInstitution.id)}
              kybSubmission={getKYBForInstitution(selectedInstitution.user_id, null) || null}
            />
          </>
        )}

        {/* Reject KYB Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Reject Institution
              </DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting {selectedInstitution?.institution_name}'s verification.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rejection Reason *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a detailed reason for rejection..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason("");
              }}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleRejectKYB}
                disabled={!rejectionReason || !!rejectingKYB}
              >
                {rejectingKYB ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  "Confirm Rejection"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
