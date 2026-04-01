import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Shield, Upload, List, XCircle, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function CertificateReference() {
  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">mTLS Certificate Management</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">Certificate Management API</h1>
        <p className="text-xl text-muted-foreground">
          Manage X.509 client certificates for mutual TLS authentication and certificate-bound access tokens (RFC 8705)
        </p>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Our Certificate Management API enables secure certificate-bound access tokens as required by FAPI 1.0 Advanced. 
            Upload X.509 certificates, list registered certificates, and revoke certificates when needed.
          </p>
          <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              FAPI 1.0 Advanced Requirement
            </p>
            <p className="text-sm text-muted-foreground">
              Certificate-bound access tokens (RFC 8705) are mandatory for production deployments. 
              All API access must use mTLS with registered certificates.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Certificate */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Certificate
              </CardTitle>
              <CardDescription>Register a new X.509 client certificate</CardDescription>
            </div>
            <Badge variant="secondary">POST</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm">POST /v1/certificates/upload</code>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Request Body</h4>
            <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">{`{
  "certificate_pem": "-----BEGIN CERTIFICATE-----\\n...\\n-----END CERTIFICATE-----",
  "tpp_registration_id": "uuid-of-tpp-registration"
}`}</pre>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Headers</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><code className="bg-muted px-2 py-0.5 rounded">Authorization</code> — Bearer token</li>
              <li><code className="bg-muted px-2 py-0.5 rounded">Idempotency-Key</code> — UUID (required for POST)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Response</h4>
            <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">{`{
  "id": "certificate-uuid",
  "thumbprint": "base64url-encoded-sha256-thumbprint",
  "fingerprint": "SHA256:hex:fingerprint",
  "subject_dn": "CN=Example TPP,O=Example Org",
  "issuer_dn": "CN=CA,O=Certificate Authority",
  "valid_from": "2026-01-01T00:00:00Z",
  "valid_until": "2027-01-01T00:00:00Z",
  "serial_number": "1234567890"
}`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List Certificates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                List Certificates
              </CardTitle>
              <CardDescription>Retrieve all registered certificates</CardDescription>
            </div>
            <Badge variant="secondary">GET</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm">GET /v1/certificates/list?tpp_registration_id=uuid</code>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Query Parameters</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><code className="bg-muted px-2 py-0.5 rounded">tpp_registration_id</code> (optional) — Filter by TPP registration</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Response</h4>
            <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">{`{
  "certificates": [
    {
      "id": "certificate-uuid",
      "thumbprint": "base64url-thumbprint",
      "fingerprint": "SHA256:hex:fingerprint",
      "subject_dn": "CN=Example TPP",
      "status": "active",
      "valid_until": "2027-01-01T00:00:00Z",
      "usage_count": 42,
      "last_used_at": "2026-02-15T12:00:00Z",
      "days_until_expiry": 318
    }
  ],
  "count": 1
}`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revoke Certificate */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Revoke Certificate
              </CardTitle>
              <CardDescription>Revoke a certificate and invalidate associated tokens</CardDescription>
            </div>
            <Badge variant="destructive">POST</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm">POST /v1/certificates/revoke</code>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Request Body</h4>
            <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">{`{
  "certificate_id": "uuid-of-certificate",
  "reason": "key_compromise" // or "cessation_of_operation", "superseded"
}`}</pre>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Headers</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><code className="bg-muted px-2 py-0.5 rounded">Authorization</code> — Bearer token</li>
              <li><code className="bg-muted px-2 py-0.5 rounded">Idempotency-Key</code> — UUID (required for POST)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Response</h4>
            <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">{`{
  "success": true,
  "certificate_id": "uuid-of-certificate",
  "revoked_at": "2026-02-16T00:00:00Z",
  "tokens_revoked": 5
}`}</pre>
            </div>
          </div>

          <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Immediate Effect
            </p>
            <p className="text-sm text-muted-foreground">
              Revoking a certificate immediately invalidates all access tokens bound to it. 
              This action cannot be undone.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Button asChild variant="outline">
              <Link to="/developer/certificates">
                <Shield className="mr-2 h-4 w-4" />
                Manage Certificates
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/guides/certificates">
                <ExternalLink className="mr-2 h-4 w-4" />
                Certificate Guide
              </Link>
            </Button>
          
      <AutoDocNavigation />
</div>
        </CardContent>
      </Card>
    </div>
  );
}
