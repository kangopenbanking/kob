import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Key, Lock, RefreshCw, Smartphone, AlertTriangle, CheckCircle } from 'lucide-react';

export default function IdentityGuide() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Identity & Security Guide</h1>
        <p className="text-muted-foreground mt-2">Authentication, MFA, and session management for the KOB platform</p>
      </div>

      <Tabs defaultValue="auth">
        <TabsList>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="mfa">MFA</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="auth" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Authentication Methods</CardTitle>
              <CardDescription>The platform supports multiple authentication methods</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { method: 'Phone OTP', desc: 'SMS or WhatsApp verification code for Cameroon (+237) numbers', badge: 'Primary' },
                  { method: 'PIN Login', desc: '6-digit PIN with brute-force lockout (3 attempts / 30 min)', badge: 'Default' },
                  { method: 'Email + Password', desc: 'Standard email/password authentication with email verification', badge: 'Supported' },
                  { method: 'OAuth 2.0', desc: 'Client credentials, authorization code with PKCE, refresh token grants', badge: 'API' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{item.method}</span>
                        <Badge variant="outline" className="text-xs">{item.badge}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <h4 className="font-medium text-foreground mb-2">Unified Login Endpoint</h4>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`POST /v1/identity/login
Content-Type: application/json

{
  "method": "phone_otp",  // or "email_password", "pin"
  "phone": "+237600000000",
  "otp_code": "123456"
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mfa" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" /> Multi-Factor Authentication</CardTitle>
              <CardDescription>Step-up authentication for sensitive operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">Supported MFA Types</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>TOTP</strong> — Time-based one-time passwords (Google Authenticator, Authy)</li>
                  <li>• <strong>SMS OTP</strong> — 6-digit code sent via SMS</li>
                  <li>• <strong>Email OTP</strong> — 6-digit code sent via email</li>
                </ul>

                <h4 className="font-medium text-foreground mt-4">Operations Requiring MFA</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• API key rotation and creation</li>
                  <li>• Settlement account changes</li>
                  <li>• Payout configuration</li>
                  <li>• Role assignments and membership changes</li>
                  <li>• Webhook secret rotation</li>
                  <li>• Large value transfers</li>
                </ul>
              </div>

              <div className="mt-4">
                <h4 className="font-medium text-foreground mb-2">MFA Flow</h4>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`// 1. Enable TOTP
POST /v1/identity/mfa
{ "action": "enable-totp", "friendly_name": "My Phone" }
→ { "factor_id": "...", "totp_uri": "otpauth://...", "qr_data": "..." }

// 2. Create challenge for step-up
POST /v1/identity/mfa
{ "action": "challenge" }
→ { "challenge_id": "...", "factor_type": "totp", "expires_in": 300 }

// 3. Verify challenge
POST /v1/identity/mfa
{ "action": "verify", "challenge_id": "...", "code": "123456" }
→ { "verified": true }`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Session Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">Session Policies</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Single active session per app context (customer, banking, merchant)</li>
                  <li>• 5-minute inactivity timeout with 60-second warning</li>
                  <li>• Device fingerprinting and IP tracking</li>
                  <li>• Instant session displacement via Realtime</li>
                </ul>

                <h4 className="font-medium text-foreground mt-4">Token Management</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Short-lived access tokens (1 hour)</li>
                  <li>• Rotating refresh tokens with reuse detection</li>
                  <li>• Tokens stored as SHA-256 hashes (never plaintext)</li>
                  <li>• Cache-Control: no-store on all token responses</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Security Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { title: 'Rate Limiting', desc: 'OTP: 10 attempts/10min. Login: 3 failures trigger 30-min lockout.' },
                  { title: 'CAPTCHA', desc: 'Triggered for suspicious login patterns. Optional for PIN checks.' },
                  { title: 'Audit Logging', desc: 'All auth events logged immutably with IP, user agent, and risk scoring.' },
                  { title: 'Secret Hashing', desc: 'All API keys, webhook secrets, and PINs stored as SHA-256 hashes.' },
                  { title: 'mTLS', desc: 'Mutual TLS supported for OAuth token endpoint (production clients).' },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50">
                    <span className="font-medium text-foreground">{item.title}</span>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
