import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { 
  ArrowRight, 
  UserCheck, 
  Key, 
  Code, 
  CreditCard, 
  Shield, 
  Calculator,
  Book,
  Activity,
  TestTube,
  Rocket,
  Headphones,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { IntegrationFlowDiagram } from "@/components/workflow/IntegrationFlowDiagram";
import { OAuthFlowDiagram } from "@/components/workflow/OAuthFlowDiagram";
import { FeeCalculationDiagram } from "@/components/workflow/FeeCalculationDiagram";
import { SystemArchitectureDiagram } from "@/components/workflow/SystemArchitectureDiagram";
import { TimelineEstimator } from "@/components/workflow/TimelineEstimator";
import { DocNavigation } from "@/components/developer/DocNavigation";

const phases = [
  {
    number: 1,
    title: "Registration & Onboarding",
    duration: "Week 1-2",
    icon: UserCheck,
    color: "bg-blue-500",
    description: "Register your institution and complete KYC verification",
    tasks: [
      "Submit institution registration form",
      "Upload required documents (Business license, Tax ID, COBAC certification)",
      "Complete KYC/AML verification",
      "Receive approval notification (2-3 business days)"
    ],
    status: "critical"
  },
  {
    number: 2,
    title: "Access & Credentials",
    duration: "Week 2",
    icon: Key,
    color: "bg-blue-500",
    description: "Obtain API credentials and access the FI Portal",
    tasks: [
      "Access FI Portal dashboard",
      "Generate sandbox API credentials (Client ID, Client Secret)",
      "Review API documentation and integration guides",
      "Set up webhook endpoints (optional)"
    ],
    status: "critical"
  },
  {
    number: 3,
    title: "Technical Integration",
    duration: "Week 3-6",
    icon: Code,
    color: "bg-green-500",
    description: "Implement OAuth 2.0 authentication and core APIs",
    tasks: [
      "Implement OAuth 2.0 + FAPI 1.0 authentication flow",
      "Integrate AISP APIs (accounts, balances, transactions)",
      "Integrate PISP APIs (payment initiation, status)",
      "Implement error handling and retry logic",
      "Set up webhook listeners for async notifications"
    ],
    status: "development"
  },
  {
    number: 4,
    title: "Payment Processing",
    duration: "Week 4-6",
    icon: CreditCard,
    color: "bg-green-500",
    description: "Enable payment channels and transaction processing",
    tasks: [
      "Integrate Mobile Money (MTN, Orange) for XAF",
      "Set up card payments via Stripe (optional)",
      "Configure bank transfer via Flutterwave (optional)",
      "Implement mobile-to-bank transfer flows",
      "Test payment reconciliation"
    ],
    status: "development"
  },
  {
    number: 5,
    title: "Compliance & Customer Management",
    duration: "Week 5-7",
    icon: Shield,
    color: "bg-orange-500",
    description: "Implement KYC, AML, and regulatory compliance",
    tasks: [
      "Set up KYC/AML verification workflows",
      "Implement sanctions screening (OFAC, UN, EU)",
      "Configure Strong Customer Authentication (SCA)",
      "Set up transaction monitoring and alerts",
      "Enable consent management for GDPR compliance",
      "Configure audit trail logging"
    ],
    status: "compliance"
  },
  {
    number: 6,
    title: "Fee Management",
    duration: "Week 6-8",
    icon: Calculator,
    color: "bg-purple-500",
    description: "Configure fee structures and billing",
    tasks: [
      "Review pricing models (fixed, percentage, tiered)",
      "Configure custom fee structures for your institution",
      "Set up automated invoice generation",
      "Test fee calculation workflows",
      "Configure waiver rules (optional)"
    ],
    status: "operations"
  },
  {
    number: 7,
    title: "Developer Tools",
    duration: "Week 6-8",
    icon: Book,
    color: "bg-green-500",
    description: "Familiarize with developer resources",
    tasks: [
      "Explore API Console for live testing",
      "Review code examples (Node.js, Python, PHP)",
      "Set up SDKs in your development environment",
      "Configure webhook event subscriptions",
      "Access API status page for monitoring"
    ],
    status: "development"
  },
  {
    number: 8,
    title: "Monitoring & Analytics",
    duration: "Week 7-8",
    icon: Activity,
    color: "bg-gray-500",
    description: "Set up monitoring and analytics dashboards",
    tasks: [
      "Configure system health monitoring",
      "Set up alerting for critical events",
      "Review analytics dashboard for API usage",
      "Configure error tracking and logging",
      "Set up performance monitoring"
    ],
    status: "monitoring"
  },
  {
    number: 9,
    title: "Testing & Certification",
    duration: "Week 8-10",
    icon: TestTube,
    color: "bg-green-500",
    description: "Comprehensive testing and security audit",
    tasks: [
      "Complete functional testing in sandbox",
      "Perform security penetration testing",
      "Conduct vulnerability assessment",
      "Complete compliance audit checklist",
      "Load testing for production readiness",
      "Submit certification application"
    ],
    status: "testing"
  },
  {
    number: 10,
    title: "Production Deployment",
    duration: "Week 10",
    icon: Rocket,
    color: "bg-purple-500",
    description: "Go live with production credentials",
    tasks: [
      "Receive production API credentials",
      "Update configuration to production endpoints",
      "Perform smoke testing in production",
      "Monitor initial transactions closely",
      "Confirm go-live with Kang Open Banking team"
    ],
    status: "production"
  },
  {
    number: 11,
    title: "Ongoing Operations",
    duration: "Ongoing",
    icon: Headphones,
    color: "bg-gray-500",
    description: "Continuous monitoring and support",
    tasks: [
      "Monitor API health and performance",
      "Review monthly analytics reports",
      "Stay updated with API changes via changelog",
      "Access 24/7 technical support",
      "Participate in quarterly business reviews"
    ],
    status: "monitoring"
  }
];

const statusConfig = {
  critical: { label: "Critical", class: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  development: { label: "Development", class: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  compliance: { label: "Compliance", class: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  operations: { label: "Operations", class: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  testing: { label: "Testing", class: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  production: { label: "Production", class: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  monitoring: { label: "Monitoring", class: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" }
};

export default function IntegrationWorkflow() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      {/* Hero Section */}
      <div className="text-center mb-12 space-y-4">
        <Badge variant="outline" className="mb-4">Integration Guide</Badge>
        <h1 className="text-4xl md:text-5xl font-bold">
          Integration Workflow
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Complete step-by-step guide to integrate Kang Open Banking with your financial institution.
          From registration to production deployment in 10 weeks.
        </p>
        <div className="flex flex-wrap gap-4 justify-center pt-4">
          <Button asChild size="lg">
            <Link to="/register">
              Start Integration <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/developer/getting-started">
              Developer Docs
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/pricing">
              View Pricing
            </Link>
          </Button>
        </div>
      </div>

      <Separator className="my-12" />

      {/* Timeline Estimator */}
      <div className="mb-12">
        <TimelineEstimator />
      </div>

      <Separator className="my-12" />

      {/* Main Integration Flow Diagram */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle>Complete Integration Flow</CardTitle>
          <CardDescription>
            Visual overview of all 11 phases from registration to ongoing operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntegrationFlowDiagram />
          <div className="flex flex-wrap gap-2 mt-6 justify-center">
            <Badge className="bg-blue-500">Registration & Setup</Badge>
            <Badge className="bg-green-500">Development</Badge>
            <Badge className="bg-orange-500">Compliance & Security</Badge>
            <Badge className="bg-purple-500">Operations & Billing</Badge>
            <Badge className="bg-gray-500">Monitoring & Support</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Technical Architecture */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle>System Architecture</CardTitle>
          <CardDescription>
            High-level overview of the Kang Open Banking platform architecture
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SystemArchitectureDiagram />
          <div className="bg-muted p-4 rounded-lg mt-6">
            <p className="text-sm">
              <strong>Architecture Highlights:</strong> The platform uses a microservices
              architecture with dedicated services for AISP, PISP, Mobile Money, Banking Operations,
              KYC/AML, and Fee Management. All services are protected by OAuth 2.0 + FAPI 1.0 Advanced
              authentication with rate limiting and response caching.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Technical Details */}
      <Tabs defaultValue="phases" className="mb-12">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="phases">Integration Phases</TabsTrigger>
          <TabsTrigger value="oauth">OAuth Flow</TabsTrigger>
          <TabsTrigger value="fees">Fee Processing</TabsTrigger>
        </TabsList>

        <TabsContent value="phases" className="space-y-6 mt-6">
          {phases.map((phase) => {
            const Icon = phase.icon;
            const status = statusConfig[phase.status as keyof typeof statusConfig];
            
            return (
              <Card key={phase.number} className="border-l-4" style={{ borderLeftColor: phase.color.replace('bg-', '#').replace('-500', '') }}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`${phase.color} p-3 rounded-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-xl">
                            Phase {phase.number}: {phase.title}
                          </CardTitle>
                          <Badge variant="outline" className={status.class}>
                            {status.label}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {phase.duration}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{phase.description}</p>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Key Tasks:</h4>
                    <ul className="space-y-2">
                      {phase.tasks.map((task, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="oauth" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>OAuth 2.0 + FAPI 1.0 Authentication Flow</CardTitle>
              <CardDescription>
                Secure authentication using OAuth 2.0 with Financial-grade API (FAPI) 1.0 Advanced profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OAuthFlowDiagram />
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Security Features
                  </h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Pushed Authorization Request (PAR)</li>
                    <li>JWT-secured Authorization Request (JAR)</li>
                    <li>Mutual TLS (mTLS) for client authentication</li>
                    <li>PKCE for authorization code flow</li>
                    <li>Token binding and rotation</li>
                  </ul>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Code className="h-4 w-4 text-primary" />
                    Implementation Steps
                  </h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Register your OAuth client</li>
                    <li>Implement PAR endpoint call</li>
                    <li>Handle authorization redirect</li>
                    <li>Exchange code for tokens</li>
                    <li>Use access token for API calls</li>
                  </ul>
                </div>
              </div>
              <div className="mt-6 flex gap-4">
                <Button asChild variant="outline">
                  <Link to="/guides/security">Security Guide</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/developer/getting-started">Get Started</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Fee Calculation & Billing Workflow</CardTitle>
              <CardDescription>
                Automated fee calculation, waiver application, and monthly invoice generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeeCalculationDiagram />
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Fee Models</h4>
                  <ul className="text-sm space-y-2">
                    <li><strong>Fixed:</strong> Set amount per transaction (e.g., 500 XAF)</li>
                    <li><strong>Percentage:</strong> % of transaction value (e.g., 0.5%)</li>
                    <li><strong>Hybrid:</strong> Fixed + Percentage (e.g., 200 XAF + 0.3%)</li>
                    <li><strong>Tiered:</strong> Volume-based pricing with breakpoints</li>
                  </ul>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Waiver Rules</h4>
                  <ul className="text-sm space-y-2">
                    <li><strong>Promotional:</strong> Time-limited fee waivers</li>
                    <li><strong>Volume-based:</strong> Discounts for high-volume clients</li>
                    <li><strong>Partner:</strong> Special rates for strategic partners</li>
                    <li><strong>Custom:</strong> Negotiated waiver agreements</li>
                  </ul>
                </div>
              </div>
              <div className="mt-6">
                <Button asChild variant="outline">
                  <Link to="/pricing">View Pricing Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Implementation Guidelines */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle>Implementation Guidelines</CardTitle>
          <CardDescription>Best practices and recommendations for successful integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Prerequisites
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Valid business registration in Cameroon</li>
                <li>COBAC licensing (for banks/FIs)</li>
                <li>Technical team with OAuth 2.0 experience</li>
                <li>Dedicated server/infrastructure for production</li>
                <li>SSL/TLS certificates for mTLS</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Common Pitfalls to Avoid
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Skipping sandbox testing phase</li>
                <li>Inadequate error handling and retry logic</li>
                <li>Not implementing webhook listeners</li>
                <li>Ignoring rate limiting guidelines</li>
                <li>Insufficient security audit before production</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">Testing Strategy</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Unit Testing</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Test individual API endpoints, authentication flows, and data validation
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Integration Testing</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Test end-to-end workflows including payments, reconciliation, and webhooks
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Load Testing</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Simulate production traffic to ensure performance under load
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="bg-primary/5 p-6 rounded-lg border border-primary/20">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Ready to Start Integration?
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Register your institution to receive sandbox credentials and begin your integration journey today.
            </p>
            <div className="flex gap-3">
              <Button asChild>
                <Link to="/register">Register Now</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/contact">Contact Sales</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/developer/console">API Console</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resources Section */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
          <CardDescription>Helpful links and documentation for your integration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Link to="/developer/getting-started" className="group">
              <Card className="h-full border-primary/20 hover:border-primary transition-colors">
                <CardHeader>
                  <Book className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-base">Getting Started Guide</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Step-by-step tutorial for your first API integration
                </CardContent>
              </Card>
            </Link>
            <Link to="/developer/api/aisp" className="group">
              <Card className="h-full border-primary/20 hover:border-primary transition-colors">
                <CardHeader>
                  <Code className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-base">API Reference</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Complete API documentation with examples
                </CardContent>
              </Card>
            </Link>
            <Link to="/developer/code-examples" className="group">
              <Card className="h-full border-primary/20 hover:border-primary transition-colors">
                <CardHeader>
                  <Code className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-base">Code Examples</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Sample code in Node.js, Python, PHP, and more
                </CardContent>
              </Card>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Footer */}
      <DocNavigation
        nextPage={{
          title: "Getting Started",
          path: "/developer/getting-started"
        }}
      />
    </div>
  );
}
