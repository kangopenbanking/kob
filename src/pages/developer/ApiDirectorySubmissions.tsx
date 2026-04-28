import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, ExternalLink, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";

const ApiDirectorySubmissions = () => {
  const directories = [
    {
      name: "ProgrammableWeb",
      status: "pending",
      url: "https://www.programmableweb.com/apis/directory",
      description: "World's largest API directory with 24,000+ APIs",
      submitUrl: "https://www.programmableweb.com/api-submission",
      requirements: [
        "Detailed API description",
        "Working API endpoint",
        "Documentation link",
        "Terms of service",
        "Contact email"
      ]
    },
    {
      name: "RapidAPI Hub",
      status: "pending",
      url: "https://rapidapi.com/hub",
      description: "Marketplace with millions of developers",
      submitUrl: "https://rapidapi.com/provider/sign-up",
      requirements: [
        "OpenAPI specification",
        "API testing endpoints",
        "Pricing information",
        "Code examples",
        "Support documentation"
      ]
    },
    {
      name: "APIs.guru",
      status: "pending",
      url: "https://apis.guru/",
      description: "Wikipedia for Web APIs - community-driven",
      submitUrl: "https://github.com/APIs-guru/openapi-directory",
      requirements: [
        "Valid OpenAPI 3.0+ spec",
        "Publicly accessible API",
        "Submit via GitHub PR",
        "Pass automated validation"
      ]
    },
    {
      name: "Postman Public Network",
      status: "ready",
      url: "https://www.postman.com/explore",
      description: "Network of public APIs and collections",
      submitUrl: "https://www.postman.com/",
      requirements: [
        "Postman collection (Available)",
        "API documentation",
        "Workspace setup",
        "Collection publishing"
      ]
    },
    {
      name: "Public APIs GitHub",
      status: "pending",
      url: "https://github.com/public-apis/public-apis",
      description: "Collective list of free APIs for software and web development",
      submitUrl: "https://github.com/public-apis/public-apis",
      requirements: [
        "Submit via GitHub PR",
        "Follow contribution guidelines",
        "Include API category",
        "Auth type specification",
        "HTTPS endpoint"
      ]
    },
    {
      name: "OpenAPI.tools",
      status: "ready",
      url: "https://openapi.tools/",
      description: "Directory of OpenAPI-based tools and APIs",
      submitUrl: "https://github.com/openapi-contrib/openapi-directory",
      requirements: [
        "OpenAPI specification (Available)",
        "Submit via GitHub",
        "Pass validation"
      ]
    },
    {
      name: "API List",
      status: "pending",
      url: "https://apilist.fun/",
      description: "Curated list of APIs for developers",
      submitUrl: "https://apilist.fun/submit",
      requirements: [
        "API name and description",
        "Category selection",
        "Documentation link",
        "Pricing model"
      ]
    },
    {
      name: "API Directory",
      status: "pending",
      url: "https://www.api-directory.com/",
      description: "Comprehensive API catalog",
      submitUrl: "https://www.api-directory.com/submit",
      requirements: [
        "Detailed API information",
        "Category tags",
        "Documentation URL",
        "Support contact"
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "submitted":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <>
      <SEO
        title="API Directory Submissions - Kang Open Banking"
        description="Track KOB API submissions to major API directories including ProgrammableWeb, RapidAPI, APIs.guru, and Postman Public Network for maximum discoverability."
        keywords="API directory, API submission, ProgrammableWeb, RapidAPI, APIs.guru, Postman, API marketplace, API discovery"
        canonical="https://kangopenbanking.com/developer/api-directory-submissions"
      />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">API Directory Submissions</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Track our submissions to major API directories for maximum discoverability
          </p>
        </div>

        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            KOB API is being submitted to major directories to ensure AI agents, developers, and tools can easily discover and integrate our services.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Submission Requirements</CardTitle>
              <CardDescription>
                What we've prepared for directory submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">OpenAPI 3.0 Specification</span>
                  <Badge variant="outline" className="ml-auto">
                    <a href="https://kangopenbanking.com/openapi.json" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Postman Collection</span>
                  <Badge variant="outline" className="ml-auto">
                    <a href="https://api.kangopenbanking.com/v1/postman-collection" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">APIs.json Descriptor</span>
                  <Badge variant="outline" className="ml-auto">
                    <a href="https://kangopenbanking.com/apis.json" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">AI Plugin Manifest</span>
                  <Badge variant="outline" className="ml-auto">
                    <a href="https://kangopenbanking.com/.well-known/ai-plugin.json" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Comprehensive Documentation</span>
                  <Badge variant="outline" className="ml-auto">
                    <a href="/developer" className="flex items-center gap-1">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Interactive API Explorer</span>
                  <Badge variant="outline" className="ml-auto">
                    <a href="/developer/api-explorer" className="flex items-center gap-1">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <h2 className="text-2xl font-bold">Directory Submissions</h2>
            {directories.map((directory) => (
              <Card key={directory.name}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {directory.name}
                        <Badge variant="outline" className={`${getStatusColor(directory.status)} text-white`}>
                          {directory.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {directory.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">Requirements:</h4>
                    <ul className="space-y-1">
                      {directory.requirements.map((req, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={directory.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visit Directory
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={directory.submitUrl} target="_blank" rel="noopener noreferrer">
                        <Clock className="h-4 w-4 mr-2" />
                        Submission Page
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Timeline & Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-semibold">Phase 1: Preparation (Completed)</p>
                  <p className="text-sm text-muted-foreground">All required assets created and validated</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-semibold">Phase 2: Submissions (In Progress)</p>
                  <p className="text-sm text-muted-foreground">Submitting to directories and marketplaces</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-semibold">Phase 3: Verification (Pending)</p>
                  <p className="text-sm text-muted-foreground">Await approval and listing verification</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-semibold">Phase 4: Optimization (Pending)</p>
                  <p className="text-sm text-muted-foreground">Monitor performance and optimize listings</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ApiDirectorySubmissions;
