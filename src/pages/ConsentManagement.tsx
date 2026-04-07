import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Shield, FileText, CreditCard, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ConsentManagement = () => {
  const [aispConsents, setAispConsents] = useState<any[]>([]);
  const [pispConsents, setPispConsents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedConsent, setSelectedConsent] = useState<any>(null);

  useEffect(() => {
    fetchConsents();
  }, []);

  const fetchConsents = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to view consents");
        return;
      }

      // Fetch AISP consents
      const { data: aisp, error: aispError } = await supabase
        .from('aisp_consents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (aispError) throw aispError;
      setAispConsents(aisp || []);

      // Fetch PISP consents
      const { data: pisp, error: pispError } = await supabase
        .from('pisp_consents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (pispError) throw pispError;
      setPispConsents(pisp || []);

    } catch (error: any) {
      console.error('Error fetching consents:', error);
      toast.error("Failed to load consents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (consentId: string, consentType: 'aisp' | 'pisp') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in");
        return;
      }

      const { error } = await supabase.functions.invoke('consent-revoke', {
        body: {
          consent_id: consentId,
          consent_type: consentType,
          reason: 'User requested revocation via dashboard'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success("Consent revoked successfully");
      fetchConsents();
      setRevokeDialogOpen(false);
      setSelectedConsent(null);
    } catch (error: any) {
      console.error('Error revoking consent:', error);
      toast.error(extractEdgeFunctionError(error, "Failed to revoke consent"));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any }> = {
      'AwaitingAuthorisation': { variant: 'secondary', icon: Clock },
      'Authorised': { variant: 'default', icon: CheckCircle2 },
      'Rejected': { variant: 'destructive', icon: XCircle },
      'Revoked': { variant: 'outline', icon: XCircle },
      'Expired': { variant: 'outline', icon: AlertCircle },
    };

    const config = statusConfig[status] || { variant: 'outline', icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const openRevokeDialog = (consent: any, type: 'aisp' | 'pisp') => {
    setSelectedConsent({ ...consent, type });
    setRevokeDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Consent Management</h1>
          <p className="text-muted-foreground">
            Manage your data sharing and payment authorizations
          </p>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You have full control over which third-party providers can access your data.
            You can revoke access at any time.
          </AlertDescription>
        </Alert>

        {/* AISP Consents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Account Information Consents (AISP)
            </CardTitle>
            <CardDescription>
              Third-party apps that can view your account information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : aispConsents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No account information consents found
              </p>
            ) : (
              <div className="space-y-4">
                {aispConsents.map((consent) => (
                  <div
                    key={consent.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{consent.client_id}</p>
                          {getStatusBadge(consent.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Consent ID: {consent.consent_id}
                        </p>
                      </div>
                      {consent.status === 'Authorised' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openRevokeDialog(consent, 'aisp')}
                        >
                          Revoke Access
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p>{new Date(consent.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Expires</p>
                        <p>{new Date(consent.expiration_date).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {consent.permissions && (
                      <div>
                        <p className="text-sm font-medium mb-2">Permissions:</p>
                        <div className="flex flex-wrap gap-2">
                          {(consent.permissions as string[]).map((permission, idx) => (
                            <Badge key={idx} variant="secondary">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PISP Consents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Consents (PISP)
            </CardTitle>
            <CardDescription>
              Third-party apps authorized to initiate payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : pispConsents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No payment consents found
              </p>
            ) : (
              <div className="space-y-4">
                {pispConsents.map((consent) => (
                  <div
                    key={consent.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{consent.client_id}</p>
                          {getStatusBadge(consent.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Consent ID: {consent.consent_id}
                        </p>
                      </div>
                      {consent.status === 'Authorised' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openRevokeDialog(consent, 'pisp')}
                        >
                          Revoke Access
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-semibold">
                          {consent.instructed_amount.amount} {consent.instructed_amount.currency}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Payment Type</p>
                        <p className="capitalize">{consent.payment_type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p>{new Date(consent.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Expires</p>
                        <p>{new Date(consent.expires_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {consent.creditor && (
                      <div>
                        <p className="text-sm text-muted-foreground">Creditor:</p>
                        <p className="font-medium">{consent.creditor.name}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Consent?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this consent? The third-party provider will
              immediately lose access to your data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                selectedConsent &&
                handleRevoke(selectedConsent.consent_id, selectedConsent.type)
              }
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ConsentManagement;
