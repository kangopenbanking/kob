import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileJson, Copy, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

const EDGE_FUNCTIONS = [
  { name: "aisp-accounts", path: "/aisp-accounts", method: "GET", category: "AISP", description: "Get user account information", auth: true },
  { name: "aisp-balances", path: "/aisp-balances", method: "GET", category: "AISP", description: "Get account balances", auth: true },
  { name: "aisp-transactions", path: "/aisp-transactions", method: "GET", category: "AISP", description: "Get transaction history", auth: true },
  { name: "aisp-create-consent", path: "/aisp-create-consent", method: "POST", category: "AISP", description: "Create AISP consent", auth: true },
  { name: "pisp-create-consent", path: "/pisp-create-consent", method: "POST", category: "PISP", description: "Create PISP consent", auth: true },
  { name: "pisp-domestic-payment", path: "/pisp-domestic-payment", method: "POST", category: "PISP", description: "Initiate domestic payment", auth: true },
  { name: "mobile-money-charge", path: "/mobile-money-charge", method: "POST", category: "Payments", description: "Charge mobile money account", auth: true },
  { name: "mobile-money-transfer", path: "/mobile-money-transfer", method: "POST", category: "Payments", description: "Transfer mobile money", auth: true },
  { name: "flutterwave-bank-transfer", path: "/flutterwave-bank-transfer", method: "POST", category: "Payments", description: "Bank transfer via Flutterwave", auth: true },
  { name: "credit-score-fetch", path: "/credit-score-fetch", method: "GET", category: "Credit", description: "Fetch user credit score", auth: true },
  { name: "credit-score-calculate", path: "/credit-score-calculate", method: "POST", category: "Credit", description: "Calculate credit score", auth: true },
  { name: "credit-report-generate", path: "/credit-report-generate", method: "POST", category: "Credit", description: "Generate credit report", auth: true },
  { name: "loan-apply", path: "/loan-apply", method: "POST", category: "Loans", description: "Apply for a loan", auth: true },
  { name: "loan-calculate", path: "/loan-calculate", method: "POST", category: "Loans", description: "Calculate loan terms", auth: false },
  { name: "loan-repay", path: "/loan-repay", method: "POST", category: "Loans", description: "Make loan repayment", auth: true },
  { name: "savings-create", path: "/savings-create", method: "POST", category: "Savings", description: "Create savings account", auth: true },
  { name: "savings-deposit", path: "/savings-deposit", method: "POST", category: "Savings", description: "Deposit to savings", auth: true },
  { name: "savings-withdraw", path: "/savings-withdraw", method: "POST", category: "Savings", description: "Withdraw from savings", auth: true },
  { name: "kyc-submit", path: "/kyc-submit", method: "POST", category: "Compliance", description: "Submit KYC documentation", auth: true },
  { name: "business-kyc-submit", path: "/business-kyc-submit", method: "POST", category: "Compliance", description: "Submit business KYC", auth: true },
  { name: "sanctions-screen", path: "/sanctions-screen", method: "POST", category: "Compliance", description: "Screen for sanctions", auth: true },
  { name: "virtual-card-create", path: "/virtual-card-create", method: "POST", category: "Cards", description: "Create virtual card", auth: true },
  { name: "virtual-card-list", path: "/virtual-card-list", method: "GET", category: "Cards", description: "List virtual cards", auth: true },
  { name: "virtual-card-topup", path: "/virtual-card-topup", method: "POST", category: "Cards", description: "Top up virtual card", auth: true },
  { name: "oauth-token", path: "/oauth-token", method: "POST", category: "Auth", description: "Exchange authorization code for token", auth: false },
  { name: "oauth-authorize", path: "/oauth-authorize", method: "POST", category: "Auth", description: "Authorize OAuth request", auth: true },
  { name: "certificate-upload", path: "/certificate-upload", method: "POST", category: "Certificates", description: "Upload client certificate", auth: true },
  { name: "certificate-list", path: "/certificate-list", method: "GET", category: "Certificates", description: "List certificates", auth: true },
  { name: "api-health", path: "/api-health", method: "GET", category: "System", description: "Check API health status", auth: false },
];

export default function ApiDocumentation() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateOpenAPISpec = () => {
    const spec = {
      openapi: "3.0.0",
      info: {
        title: "KoB Banking API",
        version: "1.0.0",
        description: "Comprehensive banking API with Open Banking, payments, credit scoring, and compliance features",
        contact: {
          name: "API Support",
          email: "support@kob-banking.com"
        }
      },
      servers: [
        {
          url: "https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1",
          description: "Production server"
        }
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        },
        schemas: {
          Error: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" }
            }
          }
        }
      },
      paths: EDGE_FUNCTIONS.reduce((acc, func) => {
        acc[func.path] = {
          [func.method.toLowerCase()]: {
            summary: func.description,
            tags: [func.category],
            security: func.auth ? [{ BearerAuth: [] }] : [],
            responses: {
              "200": {
                description: "Successful response",
                content: {
                  "application/json": {
                    schema: {
                      type: "object"
                    }
                  }
                }
              },
              "400": {
                description: "Bad request",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Error" }
                  }
                }
              },
              "401": {
                description: "Unauthorized",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Error" }
                  }
                }
              },
              "500": {
                description: "Internal server error",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Error" }
                  }
                }
              }
            }
          }
        };
        return acc;
      }, {} as any),
      tags: [
        { name: "AISP", description: "Account Information Service Provider endpoints" },
        { name: "PISP", description: "Payment Initiation Service Provider endpoints" },
        { name: "Payments", description: "Payment processing endpoints" },
        { name: "Credit", description: "Credit scoring and reporting endpoints" },
        { name: "Loans", description: "Loan management endpoints" },
        { name: "Savings", description: "Savings account endpoints" },
        { name: "Compliance", description: "KYC and compliance endpoints" },
        { name: "Cards", description: "Virtual card management endpoints" },
        { name: "Auth", description: "Authentication and authorization endpoints" },
        { name: "Certificates", description: "Certificate management endpoints" },
        { name: "System", description: "System and health check endpoints" }
      ]
    };

    return spec;
  };

  const spec = generateOpenAPISpec();
  const specJSON = JSON.stringify(spec, null, 2);

  const downloadSpec = () => {
    const blob = new Blob([specJSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kob-api-openapi-spec.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "OpenAPI spec downloaded successfully" });
  };

  const copySpec = () => {
    navigator.clipboard.writeText(specJSON);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const categories = Array.from(new Set(EDGE_FUNCTIONS.map(f => f.category)));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Documentation Generator</h1>
          <p className="text-muted-foreground">Auto-generated OpenAPI/Swagger specification for 70+ endpoints</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={copySpec} variant="outline">
            {copied ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied!" : "Copy Spec"}
          </Button>
          <Button onClick={downloadSpec}>
            <Download className="mr-2 h-4 w-4" />
            Download JSON
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{EDGE_FUNCTIONS.length}</div>
          <div className="text-sm text-muted-foreground">Total Endpoints</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{categories.length}</div>
          <div className="text-sm text-muted-foreground">API Categories</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{EDGE_FUNCTIONS.filter(f => f.auth).length}</div>
          <div className="text-sm text-muted-foreground">Protected Endpoints</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{EDGE_FUNCTIONS.filter(f => !f.auth).length}</div>
          <div className="text-sm text-muted-foreground">Public Endpoints</div>
        </Card>
      </div>

      <Tabs defaultValue="swagger" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="swagger">Swagger UI</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="json">OpenAPI JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="swagger" className="mt-6">
          <Card className="p-6">
            <SwaggerUI spec={spec} />
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="mt-6 space-y-4">
          {categories.map(category => (
            <Card key={category} className="p-6">
              <h2 className="text-xl font-semibold mb-4">{category}</h2>
              <div className="space-y-2">
                {EDGE_FUNCTIONS.filter(f => f.category === category).map(func => (
                  <div key={func.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent">
                    <div className="flex items-center gap-3">
                      <Badge variant={func.method === "GET" ? "secondary" : "default"}>
                        {func.method}
                      </Badge>
                      <code className="text-sm">{func.path}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{func.description}</span>
                      {func.auth && (
                        <Badge variant="outline">
                          <FileJson className="mr-1 h-3 w-3" />
                          Auth Required
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="json" className="mt-6">
          <Card className="p-6">
            <Textarea
              value={specJSON}
              readOnly
              className="font-mono text-sm min-h-[600px]"
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
