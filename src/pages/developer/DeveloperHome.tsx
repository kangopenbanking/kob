import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Code, Smartphone, Zap, Shield, Book, Terminal, Webhook, Database } from "lucide-react";
import { DocNavigation } from "@/components/developer/DocNavigation";

export default function DeveloperHome() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl font-bold tracking-tight">
          Build with Kang Open Banking
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Access account information, initiate payments, and integrate mobile money services with our comprehensive API platform
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link to="/developer/getting-started">
            <Button size="lg">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/developer/console">
            <Button size="lg" variant="outline">
              Try API Console
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Start Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <Book className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Quick Start Guide</CardTitle>
            <CardDescription>
              Get up and running in minutes with our step-by-step tutorial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/developer/getting-started">
              <Button variant="ghost" className="w-full justify-start">
                Read Guide <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <Terminal className="h-8 w-8 text-primary mb-2" />
            <CardTitle>API Console</CardTitle>
            <CardDescription>
              Test API endpoints in real-time with our interactive console
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/developer/console">
              <Button variant="ghost" className="w-full justify-start">
                Open Console <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <Code className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Code Examples</CardTitle>
            <CardDescription>
              Browse implementation examples in multiple programming languages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/developer/examples">
              <Button variant="ghost" className="w-full justify-start">
                View Examples <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Core APIs */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Core APIs</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Account Information (AISP)</CardTitle>
                  <CardDescription>
                    Access account details, balances, and transaction history
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Retrieve customer account data with their consent. Perfect for personal finance apps, budgeting tools, and financial aggregators.
              </p>
              <Link to="/developer/api/aisp">
                <Button variant="outline" className="w-full">
                  View AISP Documentation
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Payment Initiation (PISP)</CardTitle>
                  <CardDescription>
                    Initiate domestic and international payments securely
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Enable payment initiation directly from bank accounts. Ideal for checkout flows, bill payments, and business-to-business transfers.
              </p>
              <Link to="/developer/api/pisp">
                <Button variant="outline" className="w-full">
                  View PISP Documentation
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Smartphone className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Mobile Money</CardTitle>
                  <CardDescription>
                    Integrate MTN, Orange Money, and Express Union
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Support mobile money payments across Cameroon's major providers. Essential for e-commerce and financial inclusion.
              </p>
              <Link to="/developer/api/mobile-money">
                <Button variant="outline" className="w-full">
                  View Mobile Money Documentation
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Webhook className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Webhooks</CardTitle>
                  <CardDescription>
                    Receive real-time notifications for events
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Stay informed about payment status changes, consent updates, and account events with our webhook system.
              </p>
              <Link to="/developer/api/webhooks">
                <Button variant="outline" className="w-full">
                  View Webhooks Documentation
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Integration Guides */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Integration Guides</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <Code className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Web Applications</CardTitle>
              <CardDescription>
                Integrate KOB APIs into your web applications with React, Vue, or vanilla JavaScript
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/developer/guides/web">
                <Button className="w-full">
                  Web Integration Guide <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <Smartphone className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Mobile Applications</CardTitle>
              <CardDescription>
                Build iOS and Android apps with native SDKs or cross-platform frameworks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/developer/guides/mobile">
                <Button className="w-full">
                  Mobile Integration Guide <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Why Kang Open Banking?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <Shield className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Bank-Grade Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                OAuth 2.0, mTLS, and FAPI 1.0 compliance ensure your data and transactions are always secure
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Real-Time Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Instant payment confirmations and account data synchronization for seamless user experiences
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Database className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Comprehensive Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Access all major banks and mobile money providers in Cameroon through a single unified API
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <DocNavigation
        nextPage={{
          title: "Getting Started",
          path: "/developer/getting-started"
        }}
      />
    </div>
  );
}
