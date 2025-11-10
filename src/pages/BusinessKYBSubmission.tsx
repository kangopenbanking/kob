import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BusinessKYCForm } from "@/components/business/BusinessKYCForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Building2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BusinessKYBSubmission() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [institution, setInstitution] = useState<any>(null);
  const [existingKYB, setExistingKYB] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkInstitutionAndKYB();
  }, []);

  const checkInstitutionAndKYB = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Get user's institution
      const { data: instData, error: instError } = await supabase
        .from('institutions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (instError || !instData) {
        toast({
          title: "No Institution Found",
          description: "You must register an institution first",
          variant: "destructive"
        });
        navigate('/register');
        return;
      }

      setInstitution(instData);

      // Check for existing KYB submission
      const { data: kybData } = await supabase
        .from('business_kyc')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setExistingKYB(kybData);

    } catch (error: any) {
      console.error('Error checking institution:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKYBSuccess = async () => {
    try {
      // Update institution verification step
      const { error } = await supabase
        .from('institutions')
        .update({ verification_step: 'kyb_submitted' })
        .eq('id', institution.id);

      if (error) throw error;

      // Update verification step record
      await supabase
        .from('institution_verification_steps')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('institution_id', institution.id)
        .eq('step_type', 'kyb_submission');

      toast({
        title: "KYB Submitted Successfully",
        description: "Your business KYC is under review. You'll be notified once approved.",
      });

      navigate('/pending-approval');
    } catch (error: any) {
      console.error('Error updating verification step:', error);
      // Still navigate even if step update fails
      navigate('/pending-approval');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (existingKYB && existingKYB.verification_status === 'approved') {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-500/10 p-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-2xl">KYB Already Approved</CardTitle>
            <CardDescription>
              Your business KYC has been approved. You can access your FI Portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/fi-portal')}>
              Go to FI Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (existingKYB && existingKYB.verification_status === 'pending') {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-yellow-500/10 p-4">
                <Shield className="h-12 w-12 text-yellow-500" />
              </div>
            </div>
            <CardTitle className="text-2xl">KYB Under Review</CardTitle>
            <CardDescription>
              Your business KYC submission is currently being reviewed by our compliance team.
              We'll notify you once the review is complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button onClick={() => navigate('/pending-approval')}>
              View Status
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-primary/10 p-4">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">Business KYC Submission</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Complete your business verification for <strong>{institution?.institution_name}</strong> to access the FI Portal
        </p>
      </div>

      <BusinessKYCForm 
        accountId={institution?.id || ''}
        onSuccess={handleKYBSuccess}
        onCancel={() => navigate('/dashboard')}
      />
    </div>
  );
}
