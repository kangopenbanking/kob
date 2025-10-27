import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, Mail, Phone, Building2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PendingApproval() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState<any>(null);

  useEffect(() => {
    checkInstitutionStatus();
  }, []);

  const checkInstitutionStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching institution:', error);
        navigate('/register');
        return;
      }

      setInstitution(data);

      // If approved, redirect to portal
      if (data.status === 'approved') {
        toast({
          title: 'Institution Approved!',
          description: 'Your institution has been approved. Redirecting to portal...',
        });
        setTimeout(() => navigate('/fi-portal'), 2000);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          title: 'Application Under Review',
          description: 'Your institution registration is being reviewed by our team',
        };
      case 'approved':
        return {
          icon: CheckCircle2,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          title: 'Application Approved',
          description: 'Your institution has been approved!',
        };
      case 'rejected':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          title: 'Application Not Approved',
          description: 'Unfortunately, your application was not approved',
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-500',
          bgColor: 'bg-gray-500/10',
          title: 'Application Status',
          description: 'Processing your application',
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!institution) {
    return null;
  }

  const statusConfig = getStatusConfig(institution.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <div className={`h-16 w-16 rounded-full ${statusConfig.bgColor} flex items-center justify-center`}>
                <StatusIcon className={`h-8 w-8 ${statusConfig.color}`} />
              </div>
              <Badge 
                variant={institution.status === 'pending' ? 'secondary' : institution.status === 'approved' ? 'default' : 'destructive'}
              >
                {institution.status}
              </Badge>
            </div>
            <CardTitle className="text-3xl">{statusConfig.title}</CardTitle>
            <CardDescription className="text-lg">
              {statusConfig.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {institution.status === 'pending' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  What happens next?
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Our compliance team is reviewing your application</li>
                  <li>• Review typically takes 2-3 business days</li>
                  <li>• You'll receive a notification via email and SMS once approved</li>
                  <li>• You can check this page anytime for updates</li>
                </ul>
              </div>
            )}

            {institution.status === 'rejected' && institution.rejection_reason && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  Rejection Reason
                </h4>
                <p className="text-sm text-muted-foreground">{institution.rejection_reason}</p>
              </div>
            )}

            {/* Institution Details */}
            <div className="border-t pt-6">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Application Details
              </h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Institution Name</span>
                  <p className="font-medium">{institution.institution_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium capitalize">{institution.institution_type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Registration Number</span>
                  <p className="font-mono">{institution.registration_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Country</span>
                  <p className="font-medium">{institution.country}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contact Email</span>
                  <p className="font-medium">{institution.contact_email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contact Phone</span>
                  <p className="font-medium">{institution.contact_phone}</p>
                </div>
                <div className="md:col-span-2">
                  <span className="text-muted-foreground">Address</span>
                  <p className="font-medium">{institution.address}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted</span>
                  <p className="font-medium">
                    {new Date(institution.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              {institution.status === 'rejected' && (
                <Button onClick={() => navigate('/register')} className="flex-1">
                  <FileText className="mr-2 h-4 w-4" />
                  Resubmit Application
                </Button>
              )}
              {institution.status === 'pending' && (
                <Button 
                  variant="outline" 
                  onClick={() => checkInstitutionStatus()}
                  className="flex-1"
                >
                  Refresh Status
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/')}>
                Back to Home
              </Button>
            </div>

            {/* Contact Support */}
            <div className="border-t pt-6">
              <h4 className="font-semibold mb-3">Need Help?</h4>
              <p className="text-sm text-muted-foreground mb-4">
                If you have questions about your application, please contact our support team:
              </p>
              <div className="flex gap-4">
                <Button variant="outline" size="sm" onClick={() => window.location.href = 'mailto:support@kangopenbanking.com'}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email Support
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.location.href = 'tel:+237XXXXXXXX'}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call Support
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
