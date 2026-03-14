import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Building2, Landmark, Code, ArrowRight, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';

const STATUS_FLOW = [
  { status: 'draft', icon: FileText, color: 'text-muted-foreground', desc: 'Application created, not yet submitted' },
  { status: 'submitted', icon: Clock, color: 'text-primary', desc: 'Submitted for review' },
  { status: 'under_review', icon: Clock, color: 'text-amber-600', desc: 'Being reviewed by compliance team' },
  { status: 'approved', icon: CheckCircle, color: 'text-green-600', desc: 'Approved — full access granted' },
  { status: 'rejected', icon: XCircle, color: 'text-destructive', desc: 'Rejected — action required' },
];

export default function OnboardingGuide() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Onboarding & KYB/KYC Guide</h1>
        <p className="text-muted-foreground mt-2">Complete lifecycle for identity verification and account activation</p>
      </div>

      {/* Status Flow */}
      <Card>
        <CardHeader>
          <CardTitle>Application Status Flow</CardTitle>
          <CardDescription>All account types follow this unified lifecycle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            {STATUS_FLOW.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.status} className="flex items-center gap-1">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
                    <Icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-sm font-medium capitalize">{s.status.replace('_', ' ')}</span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal"><User className="h-4 w-4 mr-1" /> Personal</TabsTrigger>
          <TabsTrigger value="merchant"><Building2 className="h-4 w-4 mr-1" /> Merchant</TabsTrigger>
          <TabsTrigger value="institution"><Landmark className="h-4 w-4 mr-1" /> Institution</TabsTrigger>
          <TabsTrigger value="developer"><Code className="h-4 w-4 mr-1" /> Developer</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Account Onboarding</CardTitle>
              <CardDescription>Three-tier KYC verification system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-foreground">Tier 1 — Basic (100,000 XAF/day)</h4>
                  <p className="text-sm text-muted-foreground">Phone verification + basic profile information</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-foreground">Tier 2 — Standard (1,000,000 XAF/day)</h4>
                  <p className="text-sm text-muted-foreground">National ID or passport + proof of address</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-foreground">Tier 3 — Premium (5,000,000 XAF/day)</h4>
                  <p className="text-sm text-muted-foreground">Enhanced due diligence + bank statement</p>
                </div>
              </div>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`POST /v1/onboarding/personal/start
POST /v1/onboarding/personal/{id}/documents
POST /v1/onboarding/personal/{id}/submit
GET  /v1/onboarding/personal/{id}/status`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="merchant" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Merchant KYB Verification</CardTitle>
              <CardDescription>Business identity verification and settlement setup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Required Documents</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Business registration certificate</li>
                  <li>• Tax identification number</li>
                  <li>• Director/owner national ID</li>
                  <li>• Proof of business address</li>
                  <li>• Bank account details for settlement</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Access Gating</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• <Badge variant="outline" className="text-xs">Pre-KYB</Badge> Limited sandbox access, test payments only</li>
                  <li>• <Badge variant="outline" className="text-xs">Post-KYB</Badge> Full production keys, live payments, payouts enabled</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="institution" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Institution Onboarding</CardTitle>
              <CardDescription>Banks, credit unions, MFIs — compliance-first workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Required Documents</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• COBAC/CEMAC banking license</li>
                  <li>• Articles of incorporation</li>
                  <li>• Board resolution authorizing API integration</li>
                  <li>• Compliance officer contact</li>
                  <li>• AML/CFT policy documentation</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Approval Flow</h4>
                <p className="text-sm text-muted-foreground">
                  Institution applications are reviewed by the platform compliance team.
                  After approval, the institution receives API client credentials and can
                  onboard their own customers via the FI Portal.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="developer" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Developer / TPP Onboarding</CardTitle>
              <CardDescription>Sandbox-first development with production gating</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Lifecycle</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge>sandbox_active</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">prod_requested</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge className="bg-green-500/10 text-green-700">prod_approved</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Sandbox Access (Immediate)</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Test API keys auto-generated</li>
                  <li>• Full API access in sandbox mode</li>
                  <li>• Webhook testing tools</li>
                  <li>• Data generator for test scenarios</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Production Access (After Review)</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Submit production access request</li>
                  <li>• Provide use case documentation</li>
                  <li>• Platform team reviews and approves</li>
                  <li>• Production keys issued</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
