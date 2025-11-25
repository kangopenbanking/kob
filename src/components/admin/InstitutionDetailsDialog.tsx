import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  CheckCircle, 
  Clock, 
  XCircle,
  Shield,
  MapPin,
  FileText,
  Calendar,
  User,
  Mail,
  Phone,
  Globe
} from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  step_name: string;
  step_type: string;
  status: string;
  completed_at: string | null;
  notes: string | null;
}

interface KYBSubmission {
  id: string;
  business_name: string;
  business_type: string;
  registration_number: string;
  industry: string;
  business_address: any;
  verification_status: string;
  created_at: string;
  verified_at: string | null;
}

interface InstitutionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institution: Institution;
  verificationSteps: VerificationStep[];
  kybSubmission: KYBSubmission | null;
}

export function InstitutionDetailsDialog({
  open,
  onOpenChange,
  institution,
  verificationSteps,
  kybSubmission
}: InstitutionDetailsDialogProps) {
  const calculateProgress = (steps: VerificationStep[]) => {
    const completed = steps.filter(s => s.status === 'completed').length;
    return (completed / Math.max(steps.length, 1)) * 100;
  };

  const progress = calculateProgress(verificationSteps);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Institution Details
          </DialogTitle>
          <DialogDescription>
            Complete overview of {institution.institution_name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pr-4">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Institution Name</p>
                    <p className="font-medium">{institution.institution_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Type</p>
                    <Badge variant="outline">{institution.institution_type}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <Badge variant={institution.status === 'approved' ? 'default' : 'secondary'}>
                      {institution.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Registration Date</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(institution.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verification Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Verification Progress</CardTitle>
                <CardDescription className="text-xs">
                  Current step: {institution.verification_step.replace(/_/g, ' ').toUpperCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Overall Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="space-y-2">
                  {verificationSteps.map((step) => (
                    <div key={step.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-start gap-2 flex-1">
                        {step.status === 'completed' ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        ) : step.status === 'failed' ? (
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${step.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {step.step_name}
                          </p>
                          {step.completed_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Completed {format(new Date(step.completed_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          )}
                          {step.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{step.notes}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={step.status === 'completed' ? 'default' : 'secondary'} className="ml-2">
                        {step.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* KYB Information */}
            {kybSubmission && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Business KYC Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Business Name</p>
                      <p className="font-medium">{kybSubmission.business_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Business Type</p>
                      <Badge variant="outline">{kybSubmission.business_type}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Registration Number</p>
                      <p className="font-mono text-xs">{kybSubmission.registration_number}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Industry</p>
                      <p>{kybSubmission.industry}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground mb-1">Business Address</p>
                      <p className="text-xs flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>
                          {kybSubmission.business_address?.street}, {kybSubmission.business_address?.city}
                          {kybSubmission.business_address?.state && `, ${kybSubmission.business_address.state}`}
                          {kybSubmission.business_address?.country && `, ${kybSubmission.business_address.country}`}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Verification Status</p>
                      <Badge variant={kybSubmission.verification_status === 'approved' ? 'default' : 'secondary'}>
                        {kybSubmission.verification_status.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Submission Date</p>
                      <p className="text-xs">{format(new Date(kybSubmission.created_at), "MMM d, yyyy")}</p>
                    </div>
                    {kybSubmission.verified_at && (
                      <div>
                        <p className="text-muted-foreground mb-1">Verified Date</p>
                        <p className="text-xs">{format(new Date(kybSubmission.verified_at), "MMM d, yyyy")}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Branch Information */}
            {institution.main_branch_id && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Main Branch Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span>Main branch has been created and approved</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
