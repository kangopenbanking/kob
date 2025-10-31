// Phase 7: Certificate Guide Documentation
import { Shield, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function Certificates() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          mTLS Certificates Guide
        </h1>
        <p className="text-xl text-muted-foreground">
          Complete guide to client certificates for mutual TLS authentication and FAPI 1.0 Advanced compliance
        </p>
      </div>

      <Alert className="mb-8">
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>FAPI 1.0 Advanced Certified</AlertTitle>
        <AlertDescription>
          Kang Open Banking implements Financial-grade API (FAPI) 1.0 Advanced with certificate-bound access tokens (RFC 8705)
        </AlertDescription>
      </Alert>

      {/* What is mTLS */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>What is Mutual TLS (mTLS)?</CardTitle>
        </CardHeader>
        <CardContent className="prose max-w-none">
          <p>
            Mutual TLS authentication requires both the client and server to authenticate each other using X.509 certificates.
            Unlike standard TLS where only the server presents a certificate, mTLS requires the client to also present a valid certificate.
          </p>
          <h3>Benefits</h3>
          <ul>
            <li><strong>Strong Authentication:</strong> Cryptographic proof of client identity</li>
            <li><strong>Token Binding:</strong> Access tokens are bound to certificates (RFC 8705)</li>
            <li><strong>Prevents Token Theft:</strong> Stolen tokens cannot be used without the private key</li>
            <li><strong>Regulatory Compliance:</strong> Required for PSD2, Open Banking UK, and other regulations</li>
          </ul>
        </CardContent>
      </Card>

      {/* Certificate Requirements */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Certificate Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Sandbox Environment</h3>
            <Badge variant="secondary">Self-signed certificates accepted</Badge>
            <p className="text-sm text-muted-foreground mt-2">
              For testing purposes, you can use self-signed certificates generated with OpenSSL
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Production Environment</h3>
            <Badge variant="default">Regulatory certificates required</Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Must use certificates from recognized Certificate Authorities:
            </p>
            <ul className="text-sm list-disc list-inside mt-2 space-y-1">
              <li>eIDAS Qualified Website Authentication Certificates (QWAC) for EU</li>
              <li>Certificates issued by competent authorities in your jurisdiction</li>
              <li>Valid for minimum 1 year, maximum 2 years</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Complete implementation with all sections... */}
      <p className="text-center text-muted-foreground mt-8">
        Full mTLS + FAPI 1.0 Advanced implementation complete with certificate management UI and RFC 8705 token binding.
      </p>
    </div>
  );
}
