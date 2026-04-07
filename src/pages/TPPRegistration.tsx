import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy, CheckCircle2, AlertCircle, Shield, Key } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MandatoryPinSetupStep } from "@/components/auth/MandatoryPinSetupStep";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const TPPRegistration = () => {
  const [softwareStatement, setSoftwareStatement] = useState("");
  const [redirectUris, setRedirectUris] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [registration, setRegistration] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState(false);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRegister = async () => {
    if (!softwareStatement.trim()) {
      toast.error("Please provide a Software Statement Assertion (SSA)");
      return;
    }

    setIsLoading(true);
    try {
      const redirectUrisArray = redirectUris
        .split('\n')
        .map(uri => uri.trim())
        .filter(uri => uri.length > 0);

      const { data, error } = await supabase.functions.invoke('dcr-register', {
        body: {
          software_statement: softwareStatement.trim(),
          redirect_uris: redirectUrisArray,
          scope: 'accounts payments',
        }
      });

      if (error) throw error;

      setRegistration(data);
      toast.success("TPP registration successful!");
      // Check if user needs PIN setup
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("pin_code_hash").eq("id", user.id).maybeSingle();
        if (!profile?.pin_code_hash) {
          setShowPinSetup(true);
        }
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(extractEdgeFunctionError(error, "Failed to register TPP"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        {showPinSetup && (
          <Card className="border-primary/50">
            <CardContent className="pt-6">
              <MandatoryPinSetupStep onComplete={() => setShowPinSetup(false)} />
            </CardContent>
          </Card>
        )}
        <div>
          <h1 className="text-4xl font-bold mb-2">TPP Registration</h1>
          <p className="text-muted-foreground">
            Register your Third-Party Provider application via Dynamic Client Registration (DCR)
          </p>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            This registration flow follows UK Open Banking standards and FAPI 1.0 Advanced security profile.
            You'll need a valid Software Statement Assertion (SSA) from the Kang Open Banking Directory.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Register New TPP Client</CardTitle>
            <CardDescription>
              Provide your Software Statement Assertion (SSA) and redirect URIs to register your application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ssa">Software Statement Assertion (SSA) *</Label>
              <Textarea
                id="ssa"
                placeholder="Paste your signed JWT Software Statement Assertion here..."
                value={softwareStatement}
                onChange={(e) => setSoftwareStatement(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                The SSA is a signed JWT containing your software metadata. Contact the Kang Open Banking Directory to obtain one.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="redirectUris">Redirect URIs (optional)</Label>
              <Textarea
                id="redirectUris"
                placeholder="https://yourapp.com/callback&#10;https://yourapp.com/oauth/callback"
                value={redirectUris}
                onChange={(e) => setRedirectUris(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                One URI per line. These will be used for OAuth2 authorization callbacks.
              </p>
            </div>

            <Button 
              onClick={handleRegister} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Registering..." : "Register TPP"}
            </Button>
          </CardContent>
        </Card>

        {registration && (
          <Card className="border-accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                Registration Successful
              </CardTitle>
              <CardDescription>
                Store these credentials securely. The client secret is shown only once.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Copy and save your client secret now. 
                  You won't be able to see it again.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Client ID
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={registration.client_id} 
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(registration.client_id, 'client_id')}
                    >
                      {copiedField === 'client_id' ? (
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Client Secret
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={registration.client_secret} 
                      readOnly 
                      type="password"
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(registration.client_secret, 'client_secret')}
                    >
                      {copiedField === 'client_secret' ? (
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-xs text-muted-foreground">Client Name</Label>
                    <p className="font-medium">{registration.client_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Environment</Label>
                    <p className="font-medium capitalize">{registration.environment}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Software Roles</Label>
                    <p className="font-medium">{registration.software_roles.join(', ')}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Scopes</Label>
                    <p className="font-medium">{registration.scope}</p>
                  </div>
                </div>

                {registration.redirect_uris && registration.redirect_uris.length > 0 && (
                  <div className="pt-4 border-t">
                    <Label className="text-xs text-muted-foreground">Redirect URIs</Label>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      {registration.redirect_uris.map((uri: string, index: number) => (
                        <li key={index} className="text-sm font-mono">{uri}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2">Next Steps</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Generate or upload your mTLS client certificate</li>
                  <li>Implement the OAuth2 authorization code flow with PAR and JAR</li>
                  <li>Test your integration in the sandbox environment</li>
                  <li>Request production access when ready</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Available Endpoints</h4>
              <ul className="space-y-1 text-sm text-muted-foreground font-mono">
                <li>• JWKS: https://api.kangopenbanking.com/v1/jwks-endpoint</li>
                <li>• OIDC Config: https://api.kangopenbanking.com/v1/oidc-config</li>
                <li>• PAR: https://api.kangopenbanking.com/v1/par-endpoint</li>
                <li>• DCR: https://api.kangopenbanking.com/v1/dcr-register</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TPPRegistration;
