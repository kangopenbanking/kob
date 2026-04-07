// Phase 6: Certificate Management UI
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Upload, Trash2, CheckCircle, XCircle, Clock, AlertTriangle, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthRequiredAlert } from '@/components/developer/AuthRequiredAlert';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface Certificate {
  id: string;
  fingerprint: string;
  thumbprint: string;
  subject_dn: string;
  issuer_dn: string;
  serial_number: string;
  valid_from: string;
  valid_until: string;
  days_until_expiry: number;
  status: string;
  is_revoked: boolean;
  revoked_at: string | null;
  revocation_reason: string | null;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  tpp_registration: {
    id: string;
    client_id: string;
    client_name: string;
  };
}

interface TPPRegistration {
  id: string;
  client_id: string;
  client_name: string;
}

export default function CertificateManagement() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [tppRegistrations, setTppRegistrations] = useState<TPPRegistration[]>([]);
  const [selectedTpp, setSelectedTpp] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true);
      loadTppRegistrations();
      loadCertificates();
    };
    init();
  }, []);

  const loadTppRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('tpp_registrations')
        .select('id, client_id, client_name')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTppRegistrations(data || []);
    } catch (error) {
      console.error('Failed to load TPP registrations:', error);
      toast.error('Failed to load TPP registrations');
    }
  };

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('certificate-list', {
        method: 'GET'
      });

      if (error) throw error;
      setCertificates(data?.certificates || []);
    } catch (error) {
      console.error('Failed to load certificates:', error);
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.pem') && !file.name.endsWith('.crt')) {
        toast.error('Please upload a PEM (.pem) or certificate (.crt) file');
        return;
      }
      setCertFile(file);
    }
  };

  const handleUpload = async () => {
    if (!certFile || !selectedTpp) {
      toast.error('Please select a TPP registration and certificate file');
      return;
    }

    setUploading(true);
    try {
      const pem = await certFile.text();
      
      const { data, error } = await supabase.functions.invoke('certificate-upload', {
        body: {
          certificate_pem: pem,
          tpp_registration_id: selectedTpp,
        }
      });

      if (error) throw error;

      toast.success('Certificate uploaded successfully');
      setCertFile(null);
      setSelectedTpp('');
      loadCertificates();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(extractEdgeFunctionError(error, 'Failed to upload certificate'));
    } finally {
      setUploading(false);
    }
  };

  const handleRevoke = async (certId: string) => {
    if (!confirm('Are you sure you want to revoke this certificate? All access tokens bound to it will become invalid.')) return;

    try {
      const { error } = await supabase.functions.invoke('certificate-revoke', {
        body: {
          certificate_id: certId,
          reason: 'User-initiated revocation',
        }
      });

      if (error) throw error;

      toast.success('Certificate revoked successfully');
      loadCertificates();
    } catch (error: any) {
      console.error('Revoke error:', error);
      toast.error(extractEdgeFunctionError(error, 'Failed to revoke certificate'));
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Active</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Expired</Badge>;
      case 'revoked':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Revoked</Badge>;
      case 'expiring_soon':
        return <Badge variant="outline" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Expiring Soon</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          mTLS Certificate Management
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage client certificates for mutual TLS authentication and FAPI 1.0 Advanced compliance
        </p>
      </div>

      {!isAuthenticated && !loading && (
        <AuthRequiredAlert feature="certificate management" />
      )}

      {isAuthenticated && (
        <>

      <Alert className="mb-8">
        <Shield className="h-4 w-4" />
        <AlertTitle>Certificate-Bound Access Tokens (RFC 8705)</AlertTitle>
        <AlertDescription>
          All access tokens issued to mTLS clients are cryptographically bound to the client certificate.
          This prevents token theft - even if an access token is stolen, it cannot be used without the private key.
        </AlertDescription>
      </Alert>

      {/* Upload Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Client Certificate
          </CardTitle>
          <CardDescription>
            Upload X.509 client certificate for certificate-bound access tokens (RFC 8705)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="tpp-select">TPP Registration</Label>
            <Select value={selectedTpp} onValueChange={setSelectedTpp}>
              <SelectTrigger id="tpp-select">
                <SelectValue placeholder="Select TPP registration" />
              </SelectTrigger>
              <SelectContent>
                {tppRegistrations.map((tpp) => (
                  <SelectItem key={tpp.id} value={tpp.id}>
                    {tpp.client_name} ({tpp.client_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="cert-file">Certificate File (PEM format)</Label>
            <input
              id="cert-file"
              type="file"
              accept=".pem,.crt"
              onChange={handleFileChange}
              className="block w-full text-sm border rounded-md p-2 mt-1"
            />
            {certFile && (
              <p className="text-sm text-muted-foreground mt-1">
                Selected: {certFile.name} ({(certFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>For sandbox testing:</strong> You can use self-signed certificates.
              <br />
              <strong>For production:</strong> Regulatory-approved certificates (eIDAS, etc.) are required.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleUpload} 
            disabled={uploading || !certFile || !selectedTpp}
            className="w-full"
          >
            {uploading ? 'Uploading...' : 'Upload Certificate'}
          </Button>
        </CardContent>
      </Card>

      {/* Test Certificate Generation Guide */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Generate Test Certificate</CardTitle>
          <CardDescription>For sandbox testing only</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-md font-mono text-sm overflow-x-auto">
            <p className="text-muted-foreground mb-2"># Generate self-signed certificate</p>
            <code>
              openssl req -x509 -newkey rsa:2048 -keyout client-key.pem -out client-cert.pem -days 365 -nodes \<br />
              &nbsp;&nbsp;-subj "/CN=My TPP/O=My Company/C=CM"
            </code>
            <p className="text-muted-foreground mt-4 mb-2"># Extract certificate fingerprint</p>
            <code>
              openssl x509 -in client-cert.pem -noout -fingerprint -sha256
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Certificates List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Certificates</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${certificates.length} certificate(s) registered`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading certificates...</p>
          ) : certificates.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No certificates uploaded yet</p>
          ) : (
            <div className="space-y-6">
              {certificates.map((cert) => (
                <div key={cert.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-primary" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold">
                            {cert.fingerprint.slice(0, 20)}...
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(cert.fingerprint, 'Fingerprint')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          TPP: {cert.tpp_registration.client_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(cert.status)}
                      {!cert.is_revoked && cert.status !== 'expired' && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleRevoke(cert.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Subject DN</p>
                      <p className="font-mono text-xs break-all">{cert.subject_dn}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Issuer DN</p>
                      <p className="font-mono text-xs break-all">{cert.issuer_dn}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Serial Number</p>
                      <p className="font-mono text-xs">{cert.serial_number}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Valid Until</p>
                      <p className="text-xs">
                        {new Date(cert.valid_until).toLocaleDateString()} 
                        {cert.status !== 'expired' && cert.status !== 'revoked' && (
                          <span className="text-muted-foreground ml-2">
                            ({cert.days_until_expiry} days remaining)
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Usage Count</p>
                      <p className="text-xs">{cert.usage_count} authentication(s)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Used</p>
                      <p className="text-xs">
                        {cert.last_used_at 
                          ? new Date(cert.last_used_at).toLocaleString()
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>

                  {cert.is_revoked && (
                    <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                      <p className="text-sm font-semibold text-destructive">Revoked</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(cert.revoked_at!).toLocaleString()}
                        {cert.revocation_reason && ` - ${cert.revocation_reason}`}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t">
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View RFC 8705 Thumbprint
                      </summary>
                      <div className="mt-2 p-2 bg-muted rounded font-mono text-xs break-all flex items-center gap-2">
                        <code>{cert.thumbprint}</code>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(cert.thumbprint, 'Thumbprint')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        This thumbprint is included in the <code>cnf</code> claim of certificate-bound access tokens
                      </p>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
