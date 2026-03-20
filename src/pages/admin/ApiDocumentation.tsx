import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileJson, Copy, CheckCircle2, FileCode} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const EDGE_FUNCTIONS = [
  // AISP
  { name: "aisp-accounts", path: "/v1/aisp/accounts", method: "GET", category: "AISP", description: "List accounts for authenticated customer", auth: true },
  { name: "aisp-account-detail", path: "/v1/aisp/accounts/{accountId}", method: "GET", category: "AISP", description: "Get account details", auth: true },
  { name: "aisp-balances", path: "/v1/aisp/accounts/{accountId}/balances", method: "GET", category: "AISP", description: "Get account balances", auth: true },
  { name: "aisp-transactions", path: "/v1/aisp/accounts/{accountId}/transactions", method: "GET", category: "AISP", description: "Get transaction history with pagination", auth: true },
  { name: "aisp-beneficiaries", path: "/v1/aisp/accounts/{accountId}/beneficiaries", method: "GET", category: "AISP", description: "Get account beneficiaries", auth: true },
  { name: "aisp-standing-orders", path: "/v1/aisp/accounts/{accountId}/standing-orders", method: "GET", category: "AISP", description: "Get standing orders", auth: true },
  { name: "aisp-direct-debits", path: "/v1/aisp/accounts/{accountId}/direct-debits", method: "GET", category: "AISP", description: "Get direct debit mandates", auth: true },
  { name: "aisp-create-consent", path: "/v1/aisp/consents", method: "POST", category: "AISP", description: "Create AISP consent", auth: true },

  // PISP
  { name: "pisp-create-consent", path: "/v1/pisp/consents", method: "POST", category: "PISP", description: "Create PISP consent", auth: true },
  { name: "pisp-domestic-payment", path: "/v1/pisp/domestic-payments", method: "POST", category: "PISP", description: "Initiate domestic payment", auth: true },
  { name: "pisp-payment-submission", path: "/v1/pisp/payment-submissions", method: "POST", category: "PISP", description: "Submit payment for processing", auth: true },
  { name: "pisp-payment-details", path: "/v1/pisp/domestic-payments/{paymentId}", method: "GET", category: "PISP", description: "Get payment status and details", auth: true },
  { name: "bulk-transfers", path: "/v1/pisp/bulk-transfers", method: "POST", category: "PISP", description: "Process bulk payment batch", auth: true },

  // Payments
  { name: "mobile-money-charge", path: "/v1/mobile-money/charge", method: "POST", category: "Payments", description: "Charge mobile money account", auth: true },
  { name: "mobile-money-verify", path: "/v1/mobile-money/verify", method: "POST", category: "Payments", description: "Verify mobile money transaction", auth: true },
  { name: "mobile-money-transfer", path: "/v1/mobile-money/transfer", method: "POST", category: "Payments", description: "Send money to mobile wallet", auth: true },
  { name: "mobile-money-to-bank", path: "/v1/mobile-money/to-bank", method: "POST", category: "Payments", description: "Transfer mobile money to bank account", auth: true },
  { name: "flutterwave-bank-transfer", path: "/v1/payments/bank-transfer", method: "POST", category: "Payments", description: "Bank transfer via Flutterwave", auth: true },
  { name: "stripe-payment-intent", path: "/v1/payments/stripe/intent", method: "POST", category: "Payments", description: "Create Stripe payment intent", auth: true },

  // Credit
  { name: "credit-score-fetch", path: "/v1/credit/score", method: "GET", category: "Credit", description: "Fetch user credit score", auth: true },
  { name: "credit-score-calculate", path: "/v1/credit/score/calculate", method: "POST", category: "Credit", description: "Calculate credit score", auth: true },
  { name: "credit-report-generate", path: "/v1/credit/report", method: "POST", category: "Credit", description: "Generate credit report", auth: true },

  // Loans
  { name: "loan-apply", path: "/v1/loans/apply", method: "POST", category: "Loans", description: "Apply for a loan", auth: true },
  { name: "loan-calculate", path: "/v1/loans/calculate", method: "POST", category: "Loans", description: "Calculate loan terms", auth: false },
  { name: "loan-repay", path: "/v1/loans/repay", method: "POST", category: "Loans", description: "Make loan repayment", auth: true },
  { name: "loan-approve", path: "/v1/loans/approve", method: "POST", category: "Loans", description: "Approve loan application (admin)", auth: true },
  { name: "loan-disburse", path: "/v1/loans/disburse", method: "POST", category: "Loans", description: "Disburse approved loan", auth: true },
  { name: "loan-status", path: "/v1/loans/{loanId}/status", method: "GET", category: "Loans", description: "Get loan status", auth: true },

  // Savings
  { name: "savings-create", path: "/v1/savings/create", method: "POST", category: "Savings", description: "Create savings account", auth: true },
  { name: "savings-deposit", path: "/v1/savings/deposit", method: "POST", category: "Savings", description: "Deposit to savings", auth: true },
  { name: "savings-withdraw", path: "/v1/savings/withdraw", method: "POST", category: "Savings", description: "Withdraw from savings", auth: true },
  { name: "savings-accrue-interest", path: "/v1/savings/accrue-interest", method: "POST", category: "Savings", description: "Accrue interest on savings accounts", auth: true },

  // Compliance
  { name: "kyc-submit", path: "/v1/compliance/kyc/submit", method: "POST", category: "Compliance", description: "Submit KYC documentation", auth: true },
  { name: "business-kyc-submit", path: "/v1/compliance/kyc/business", method: "POST", category: "Compliance", description: "Submit business KYC", auth: true },
  { name: "sanctions-screen", path: "/v1/compliance/sanctions/screen", method: "POST", category: "Compliance", description: "Screen for sanctions", auth: true },

  // Cards
  { name: "virtual-cards", path: "/v1/cards/create", method: "POST", category: "Cards", description: "Create virtual card", auth: true },
  { name: "virtual-cards", path: "/v1/cards/list", method: "GET", category: "Cards", description: "List virtual cards", auth: true },
  { name: "virtual-cards", path: "/v1/cards/topup", method: "POST", category: "Cards", description: "Top up virtual card", auth: true },

  // Auth / DCR
  { name: "oauth-token", path: "/v1/oauth/token", method: "POST", category: "Auth", description: "Exchange credentials for access token", auth: false },
  { name: "oauth-authorize", path: "/v1/oauth/authorize", method: "POST", category: "Auth", description: "Authorize OAuth request", auth: true },
  { name: "dcr-register", path: "/v1/dcr/register", method: "POST", category: "DCR", description: "Dynamic Client Registration with SSA", auth: false },
  { name: "par-request", path: "/v1/par/request", method: "POST", category: "DCR", description: "Pushed Authorization Request", auth: true },

  // Certificates
  { name: "certificate-upload", path: "/v1/certificates/upload", method: "POST", category: "Certificates", description: "Upload client certificate for mTLS", auth: true },
  { name: "certificate-list", path: "/v1/certificates/list", method: "GET", category: "Certificates", description: "List registered certificates", auth: true },
  { name: "certificate-revoke", path: "/v1/certificates/revoke", method: "POST", category: "Certificates", description: "Revoke a client certificate", auth: true },

  // Ledger
  { name: "journal-post", path: "/v1/ledger/journal", method: "POST", category: "Ledger", description: "Post double-entry journal entry", auth: true },
  { name: "ledger-accounts", path: "/v1/ledger/accounts", method: "GET", category: "Ledger", description: "List ledger accounts", auth: true },
  { name: "ledger-balance", path: "/v1/ledger/accounts/{accountId}/balance", method: "GET", category: "Ledger", description: "Get ledger account balance", auth: true },
  { name: "ledger-trial-balance", path: "/v1/ledger/trial-balance", method: "GET", category: "Ledger", description: "Generate trial balance report", auth: true },

  // Admin
  { name: "admin-list-loans", path: "/v1/admin/loans", method: "GET", category: "Admin", description: "List all loans (admin)", auth: true },
  { name: "admin-list-savings", path: "/v1/admin/savings", method: "GET", category: "Admin", description: "List all savings accounts (admin)", auth: true },
  { name: "admin-list-consents", path: "/v1/admin/consents", method: "GET", category: "Admin", description: "List all consents (admin)", auth: true },
  { name: "admin-reports", path: "/v1/admin/reports", method: "GET", category: "Admin", description: "Generate admin reports", auth: true },
  { name: "admin-audit-logs", path: "/v1/admin/audit-logs", method: "GET", category: "Admin", description: "Retrieve audit trail", auth: true },

  // Banking / ISO20022
  { name: "bank-reconcile", path: "/v1/banking/reconcile", method: "POST", category: "Banking", description: "Reconcile bank transactions", auth: true },
  { name: "generate-bank-statement", path: "/v1/banking/statement", method: "POST", category: "Banking", description: "Generate bank statement", auth: true },
  { name: "bank-sync", path: "/v1/banking/sync", method: "POST", category: "Banking", description: "Synchronize bank account data", auth: true },
  { name: "iso20022-pain001-parser", path: "/v1/banking/iso20022/pain001", method: "POST", category: "ISO20022", description: "Parse ISO 20022 pain.001 message", auth: true },
  { name: "iso20022-pacs008-generator", path: "/v1/banking/iso20022/pacs008", method: "POST", category: "ISO20022", description: "Generate ISO 20022 pacs.008 message", auth: true },
  { name: "iso20022-camt053-parser", path: "/v1/banking/iso20022/camt053", method: "POST", category: "ISO20022", description: "Parse ISO 20022 camt.053 statement", auth: true },
  { name: "swift-mt103-generator", path: "/v1/banking/swift/mt103/generate", method: "POST", category: "ISO20022", description: "Generate SWIFT MT103 message", auth: true },
  { name: "swift-mt103-parser", path: "/v1/banking/swift/mt103/parse", method: "POST", category: "ISO20022", description: "Parse SWIFT MT103 message", auth: true },
  { name: "swift-mt940-parser", path: "/v1/banking/swift/mt940/parse", method: "POST", category: "ISO20022", description: "Parse SWIFT MT940 statement", auth: true },

  // System
  { name: "api-health", path: "/v1/health", method: "GET", category: "System", description: "Check API health status", auth: false },
  { name: "public-api-spec", path: "/v1/openapi.json", method: "GET", category: "System", description: "OpenAPI 3.1.0 specification", auth: false },
];

export default function ApiDocumentation() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateOpenAPISpec = () => {
    const spec = {
      openapi: "3.1.0",
      info: {
        title: "Kang Open Banking API",
        version: "1.0.0",
        description: "Comprehensive Open Banking API with AISP, PISP, mobile money, credit scoring, loans, savings, double-entry ledger, and ISO 20022 / SWIFT message handling. FAPI 1.0 Advanced compliant.",
        contact: {
          name: "KOB API Support",
          email: "support@kangopenbanking.com",
          url: "https://kangopenbanking.com/documentation"
        }
      },
      servers: [
        {
          url: "https://api.kangopenbanking.com/v1",
          description: "Production server"
        }
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          },
          OAuth2: {
            type: "oauth2",
            flows: {
              clientCredentials: {
                tokenUrl: "/v1/oauth/token",
                scopes: {
                  openid: "OpenID Connect",
                  accounts: "Account information access",
                  balances: "Balance information access",
                  transactions: "Transaction history access",
                  payments: "Payment initiation",
                  offline_access: "Refresh token access"
                }
              }
            }
          }
        },
        schemas: {
          Error: {
            type: "object",
            description: "RFC 7807 Problem Details",
            properties: {
              error: { type: "string", description: "Human-readable error summary" },
              error_code: { type: "string", description: "Domain-prefixed error code (e.g. PISP_004)" },
              message: { type: "string", description: "Detailed error message" },
              details: { type: "object", description: "Additional context for the error" },
              error_id: { type: "string", format: "uuid", description: "Unique error identifier for support" },
              timestamp: { type: "string", format: "date-time", description: "ISO 8601 timestamp" }
            },
            required: ["error", "error_code", "message", "timestamp"]
          }
        }
      },
      paths: EDGE_FUNCTIONS.reduce((acc, func) => {
        acc[func.path] = {
          [func.method.toLowerCase()]: {
            summary: func.description,
            tags: [func.category],
            security: func.auth ? [{ BearerAuth: [] }] : [],
            ...(func.method === "POST" ? {
              parameters: [
                {
                  name: "Idempotency-Key",
                  in: "header",
                  required: true,
                  schema: { type: "string", format: "uuid" },
                  description: "Unique key for idempotent request processing (24h expiry)"
                }
              ]
            } : {}),
            responses: {
              "200": {
                description: "Successful response",
                content: {
                  "application/json": {
                    schema: { type: "object" }
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
              "429": {
                description: "Rate limit exceeded",
                headers: {
                  "Retry-After": {
                    schema: { type: "integer" },
                    description: "Seconds until rate limit resets"
                  }
                },
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
        { name: "Payments", description: "Mobile money and bank transfer endpoints" },
        { name: "Credit", description: "Credit scoring and reporting endpoints" },
        { name: "Loans", description: "Loan management endpoints" },
        { name: "Savings", description: "Savings account endpoints" },
        { name: "Compliance", description: "KYC and sanctions screening endpoints" },
        { name: "Cards", description: "Virtual card management endpoints" },
        { name: "Auth", description: "OAuth 2.0 authentication endpoints" },
        { name: "DCR", description: "Dynamic Client Registration endpoints" },
        { name: "Certificates", description: "mTLS certificate management endpoints" },
        { name: "Ledger", description: "Double-entry ledger and journal endpoints" },
        { name: "Admin", description: "Administrative and reporting endpoints" },
        { name: "Banking", description: "Bank reconciliation and statement endpoints" },
        { name: "ISO20022", description: "ISO 20022 and SWIFT message handling" },
        { name: "System", description: "Health check and system endpoints" }
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
      <AdminPageHeader icon={FileCode} title="API Documentation" description="OpenAPI specification and interactive API documentation" />

      <div className="flex items-center justify-between">
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
          <div className="text-sm text-muted-foreground">API Domains</div>
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
