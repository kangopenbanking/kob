import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { User, Building2, Landmark, Code, ArrowRight, Shield, Key, Globe } from 'lucide-react';

const ACCOUNT_TYPES = [
  {
    type: 'personal',
    title: 'Personal Account',
    description: 'Access banking services, manage payments, and track your finances.',
    icon: User,
    features: ['Mobile money transfers', 'Bill payments', 'Credit score tracking', 'Virtual cards'],
    authPath: '/auth',
    color: 'text-primary',
    bgColor: 'bg-primary/5',
    steps: ['Create account with phone or email', 'Verify identity (KYC)', 'Set up PIN', 'Start transacting']
  },
  {
    type: 'merchant',
    title: 'Merchant / Business',
    description: 'Accept payments, manage settlements, and grow your business.',
    icon: Building2,
    features: ['Payment gateway', 'POS integration', 'Settlement management', 'Business analytics'],
    authPath: '/merchant-register',
    color: 'text-green-600',
    bgColor: 'bg-green-500/5',
    steps: ['Register your business', 'Complete KYB verification', 'Configure settlement', 'Start accepting payments']
  },
  {
    type: 'institution',
    title: 'Financial Institution',
    description: 'Banks, credit unions, and fintechs — integrate open banking APIs.',
    icon: Landmark,
    features: ['AISP/PISP APIs', 'Customer onboarding', 'Branch management', 'Compliance tools'],
    authPath: '/register',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/5',
    steps: ['Submit institution application', 'Provide compliance documents', 'Await regulatory approval', 'Access API credentials']
  },
  {
    type: 'developer',
    title: 'Developer / TPP',
    description: 'Build applications with open banking and payment APIs.',
    icon: Code,
    features: ['Sandbox environment', 'Full API access', 'Webhook testing', 'SDK & libraries'],
    authPath: '/tpp-registration',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/5',
    steps: ['Create developer account', 'Get sandbox API keys', 'Build & test integration', 'Request production access']
  }
];

export default function GettingStartedByType() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Getting Started</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Choose your account type to get started with Kang Open Banking
        </p>
      </div>

      {/* Security badges */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> COBAC Compliant</Badge>
        <Badge variant="outline" className="gap-1"><Key className="h-3 w-3" /> OAuth 2.0 + PKCE</Badge>
        <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Cameroon / CEMAC</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ACCOUNT_TYPES.map((account) => {
          const Icon = account.icon;
          return (
            <Card key={account.type} className="hover:shadow-lg transition-shadow group">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${account.bgColor} flex items-center justify-center mb-3`}>
                  <Icon className={`h-6 w-6 ${account.color}`} />
                </div>
                <CardTitle className="text-xl">{account.title}</CardTitle>
                <CardDescription>{account.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Key Features</h4>
                  <ul className="space-y-1">
                    {account.features.map((f, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Onboarding Steps</h4>
                  <ol className="space-y-1">
                    {account.steps.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>

                <Button className="w-full group-hover:gap-3 transition-all" onClick={() => navigate(account.authPath)}>
                  Get Started <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Already have an account?</h3>
            <p className="text-muted-foreground">Sign in to access your dashboard</p>
            <Button variant="outline" onClick={() => navigate('/auth')}>Sign In</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
