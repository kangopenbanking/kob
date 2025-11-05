import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ExternalLink, Lock, Unlock } from "lucide-react";
import { Link } from "react-router-dom";

interface ApiEndpoint {
  name: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  category: string;
  description: string;
  requiresAuth: boolean;
  docs?: string;
}

export default function ApiCatalog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const endpoints: ApiEndpoint[] = [
    // OAuth & Authentication
    { name: "OAuth Token", path: "/oauth-token", method: "POST", category: "Authentication", description: "Obtain OAuth 2.0 access token", requiresAuth: false },
    { name: "OAuth Authorize", path: "/oauth-authorize", method: "GET", category: "Authentication", description: "OAuth authorization endpoint", requiresAuth: false },
    { name: "OAuth Introspect", path: "/oauth-introspect", method: "POST", category: "Authentication", description: "Introspect OAuth token", requiresAuth: true },
    { name: "JWKS Endpoint", path: "/jwks-endpoint", method: "GET", category: "Authentication", description: "JSON Web Key Set", requiresAuth: false },
    
    // AISP (Account Information)
    { name: "List Accounts", path: "/aisp-accounts", method: "GET", category: "Account Information", description: "Retrieve all accounts for a user", requiresAuth: true },
    { name: "Account Balances", path: "/aisp-balances", method: "GET", category: "Account Information", description: "Get account balances", requiresAuth: true },
    { name: "Account Transactions", path: "/aisp-transactions", method: "GET", category: "Account Information", description: "Retrieve transaction history", requiresAuth: true },
    { name: "Standing Orders", path: "/aisp-standing-orders", method: "GET", category: "Account Information", description: "Get standing orders", requiresAuth: true },
    { name: "Direct Debits", path: "/aisp-direct-debits", method: "GET", category: "Account Information", description: "Get direct debits", requiresAuth: true },
    { name: "Beneficiaries", path: "/aisp-beneficiaries", method: "GET", category: "Account Information", description: "Get saved beneficiaries", requiresAuth: true },
    
    // PISP (Payment Initiation)
    { name: "Create Payment Consent", path: "/pisp-create-consent", method: "POST", category: "Payment Initiation", description: "Create payment consent", requiresAuth: true },
    { name: "Domestic Payment", path: "/pisp-domestic-payment", method: "POST", category: "Payment Initiation", description: "Initiate domestic payment", requiresAuth: true },
    { name: "Payment Submission", path: "/pisp-payment-submission", method: "POST", category: "Payment Initiation", description: "Submit payment for processing", requiresAuth: true },
    { name: "Payment Details", path: "/pisp-payment-details", method: "GET", category: "Payment Initiation", description: "Get payment status and details", requiresAuth: true },
    
    // Mobile Money
    { name: "Mobile Money Charge", path: "/mobile-money-charge", method: "POST", category: "Mobile Money", description: "Charge mobile money wallet", requiresAuth: true },
    { name: "Mobile Money Transfer", path: "/mobile-money-transfer", method: "POST", category: "Mobile Money", description: "Transfer to mobile money", requiresAuth: true },
    { name: "Mobile Money Verify", path: "/mobile-money-verify", method: "GET", category: "Mobile Money", description: "Verify mobile money transaction", requiresAuth: true },
    { name: "Mobile Money to Bank", path: "/mobile-money-to-bank", method: "POST", category: "Mobile Money", description: "Transfer from MoMo to bank", requiresAuth: true },
    
    // Credit Scoring
    { name: "Calculate Credit Score", path: "/credit-score-calculate", method: "POST", category: "Credit Scoring", description: "Calculate user credit score", requiresAuth: true },
    { name: "Fetch Credit Score", path: "/credit-score-fetch", method: "GET", category: "Credit Scoring", description: "Retrieve existing credit score", requiresAuth: true },
    { name: "Simulate Score", path: "/credit-score-simulate", method: "POST", category: "Credit Scoring", description: "Simulate credit score changes", requiresAuth: true },
    { name: "Credit Tips", path: "/credit-score-tips", method: "GET", category: "Credit Scoring", description: "Get credit improvement tips", requiresAuth: true },
    { name: "Credit Report", path: "/credit-report-generate", method: "POST", category: "Credit Scoring", description: "Generate detailed credit report", requiresAuth: true },
    
    // Banking Operations
    { name: "Bank Sync", path: "/bank-sync", method: "POST", category: "Banking Operations", description: "Sync bank account data", requiresAuth: true },
    { name: "Bank Reconciliation", path: "/bank-reconcile", method: "POST", category: "Banking Operations", description: "Reconcile transactions", requiresAuth: true },
    { name: "Import Transactions", path: "/bank-import-transactions", method: "POST", category: "Banking Operations", description: "Import transaction data", requiresAuth: true },
    { name: "Generate Statement", path: "/generate-bank-statement", method: "POST", category: "Banking Operations", description: "Generate bank statement PDF", requiresAuth: true },
    { name: "Bulk Transfers", path: "/bulk-transfers", method: "POST", category: "Banking Operations", description: "Process bulk transfers", requiresAuth: true },
    
    // Loans & Savings
    { name: "Apply for Loan", path: "/loan-apply", method: "POST", category: "Loans", description: "Submit loan application", requiresAuth: true },
    { name: "Loan Calculator", path: "/loan-calculate", method: "POST", category: "Loans", description: "Calculate loan terms", requiresAuth: false },
    { name: "Loan Repayment", path: "/loan-repay", method: "POST", category: "Loans", description: "Make loan repayment", requiresAuth: true },
    { name: "Create Savings", path: "/savings-create", method: "POST", category: "Savings", description: "Create savings account", requiresAuth: true },
    { name: "Savings Deposit", path: "/savings-deposit", method: "POST", category: "Savings", description: "Deposit to savings", requiresAuth: true },
    { name: "Savings Withdraw", path: "/savings-withdraw", method: "POST", category: "Savings", description: "Withdraw from savings", requiresAuth: true },
    
    // ISO20022 & SWIFT
    { name: "Parse PAIN.001", path: "/iso20022-pain001-parser", method: "POST", category: "ISO20022", description: "Parse ISO20022 payment initiation", requiresAuth: true },
    { name: "Generate PACS.008", path: "/iso20022-pacs008-generator", method: "POST", category: "ISO20022", description: "Generate payment clearing", requiresAuth: true },
    { name: "Parse CAMT.053", path: "/iso20022-camt053-parser", method: "POST", category: "ISO20022", description: "Parse bank statement", requiresAuth: true },
    { name: "Parse MT103", path: "/swift-mt103-parser", method: "POST", category: "SWIFT", description: "Parse SWIFT MT103 message", requiresAuth: true },
    { name: "Generate MT103", path: "/swift-mt103-generator", method: "POST", category: "SWIFT", description: "Generate SWIFT MT103", requiresAuth: true },
    { name: "Parse MT940", path: "/swift-mt940-parser", method: "POST", category: "SWIFT", description: "Parse SWIFT MT940 statement", requiresAuth: true },
    
    // Compliance & Security
    { name: "KYC Submit", path: "/kyc-submit", method: "POST", category: "Compliance", description: "Submit KYC verification", requiresAuth: true },
    { name: "Sanctions Screen", path: "/sanctions-screen", method: "POST", category: "Compliance", description: "Screen for sanctions", requiresAuth: true },
    { name: "Transaction Monitor", path: "/transaction-monitor", method: "POST", category: "Compliance", description: "Monitor for suspicious activity", requiresAuth: true },
    { name: "SCA Initiate", path: "/sca-initiate", method: "POST", category: "Security", description: "Initiate strong customer auth", requiresAuth: true },
    { name: "SCA Verify", path: "/sca-verify", method: "POST", category: "Security", description: "Verify SCA response", requiresAuth: true },
    
    // System
    { name: "API Health", path: "/api-health", method: "GET", category: "System", description: "Check API health status", requiresAuth: false },
    { name: "System Health", path: "/system-health-check", method: "GET", category: "System", description: "System health check", requiresAuth: false },
    { name: "OpenAPI Spec", path: "/public-api-spec", method: "GET", category: "System", description: "OpenAPI specification", requiresAuth: false },
    { name: "Postman Collection", path: "/postman-collection", method: "GET", category: "System", description: "Postman collection download", requiresAuth: false },
  ];

  const categories = useMemo(() => {
    const cats = new Set(endpoints.map(e => e.category));
    return Array.from(cats).sort();
  }, []);

  const filteredEndpoints = useMemo(() => {
    return endpoints.filter(endpoint => {
      const matchesSearch = 
        endpoint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        endpoint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        endpoint.path.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || endpoint.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, categoryFilter, endpoints]);

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "POST": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "PUT": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "DELETE": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "PATCH": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default: return "bg-muted";
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">API Endpoint Catalog</h1>
          <p className="text-xl text-muted-foreground">
            Browse all {endpoints.length} available API endpoints
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search endpoints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredEndpoints.length} of {endpoints.length} endpoints
          </p>
        </div>

        {/* Endpoints Grid */}
        <div className="grid gap-4">
          {filteredEndpoints.map((endpoint, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={getMethodColor(endpoint.method)}>
                        {endpoint.method}
                      </Badge>
                      <code className="text-sm font-mono">{endpoint.path}</code>
                      {endpoint.requiresAuth ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <CardTitle className="text-lg">{endpoint.name}</CardTitle>
                    <CardDescription>{endpoint.description}</CardDescription>
                  </div>
                  <Badge variant="secondary">{endpoint.category}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Link to="/developer/api-explorer">
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Try in Explorer
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredEndpoints.length === 0 && (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">No endpoints found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
