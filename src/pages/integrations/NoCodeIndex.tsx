import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Zap, Workflow, Circle, Database, ArrowRight, CheckCircle2 } from "lucide-react";

const NoCodeIndex = () => {
  const platforms = [
    {
      name: "Zapier",
      icon: Zap,
      description: "Connect Kang Open Banking to 5,000+ apps with no code",
      difficulty: "Beginner",
      useCases: ["Automated accounting", "Transaction notifications", "CRM sync"],
      link: "/integrations/zapier",
      color: "text-orange-500"
    },
    {
      name: "Make.com",
      icon: Workflow,
      description: "Build complex automation workflows with visual builder",
      difficulty: "Intermediate",
      useCases: ["Multi-step payments", "Data transformation", "Conditional flows"],
      link: "/integrations/make",
      color: "text-purple-500"
    },
    {
      name: "Bubble.io",
      icon: Circle,
      description: "Build full-stack fintech apps without writing code",
      difficulty: "Intermediate",
      useCases: ["Customer portals", "Payment dashboards", "Mobile banking apps"],
      link: "/integrations/bubble",
      color: "text-blue-500"
    },
    {
      name: "Retool",
      icon: Database,
      description: "Create internal tools and admin panels in minutes",
      difficulty: "Beginner",
      useCases: ["Admin dashboards", "Transaction monitoring", "User management"],
      link: "/integrations/retool",
      color: "text-green-500"
    }
  ];

  const benefits = [
    "No coding required - visual drag-and-drop interfaces",
    "Connect to 5,000+ apps and services",
    "Reduce development time by 90%",
    "Perfect for MVPs and rapid prototyping",
    "Lower costs compared to custom development",
    "Scale from prototype to production"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge className="mb-4" variant="secondary">No-Code Integration</Badge>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Build Financial Apps Without Code
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Connect Kang Open Banking API to your favorite no-code platforms. 
            Build banking apps, payment workflows, and financial dashboards in hours, not months.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/register">Get API Keys</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/developer/api-explorer">View API Docs</Link>
            </Button>
          </div>
        </div>

        {/* Why No-Code Section */}
        <Card className="mb-16 border-2">
          <CardHeader>
            <CardTitle className="text-2xl">Why Use No-Code Integration?</CardTitle>
            <CardDescription>
              Perfect for startups, SMEs, and financial institutions across Africa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Platforms Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Choose Your Platform</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {platforms.map((platform) => {
              const Icon = platform.icon;
              return (
                <Card key={platform.name} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg bg-muted ${platform.color}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <CardTitle>{platform.name}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            {platform.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-4">
                      {platform.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <p className="text-sm font-semibold mb-2">Common Use Cases:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {platform.useCases.map((useCase, index) => (
                          <li key={index}>• {useCase}</li>
                        ))}
                      </ul>
                    </div>
                    <Button asChild className="w-full">
                      <Link to={platform.link}>
                        View Integration Guide <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Quick Start Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started in 3 Steps</CardTitle>
            <CardDescription>The same process across all platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  1
                </div>
                <h3 className="font-semibold mb-2">Get API Credentials</h3>
                <p className="text-sm text-muted-foreground">
                  Register and obtain your OAuth client ID and secret
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  2
                </div>
                <h3 className="font-semibold mb-2">Configure Platform</h3>
                <p className="text-sm text-muted-foreground">
                  Follow our step-by-step guide for your chosen platform
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  3
                </div>
                <h3 className="font-semibold mb-2">Start Building</h3>
                <p className="text-sm text-muted-foreground">
                  Use visual builders to create your financial workflows
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center mt-16 p-12 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5">
          <h2 className="text-3xl font-bold mb-4">Ready to Build?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Get your API credentials now and start building financial applications in minutes
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/register">Create Free Account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoCodeIndex;
