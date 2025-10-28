import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Documentation from "./pages/Documentation";
import Register from "./pages/Register";
import IntegrationWorkflow from "./pages/IntegrationWorkflow";
import Pricing from "./pages/Pricing";
import { DeveloperLayout } from "@/components/developer/DeveloperLayout";
import DeveloperHome from "./pages/developer/DeveloperHome";
import GettingStarted from "./pages/developer/GettingStarted";
import AispReference from "./pages/developer/AispReference";
import PispReference from "./pages/developer/PispReference";
import MobileMoneyReference from "./pages/developer/MobileMoneyReference";
import BankingReference from "./pages/developer/BankingReference";
import ApiConsole from "./pages/developer/ApiConsole";
import WebIntegration from "./pages/developer/WebIntegration";
import MobileIntegration from "./pages/developer/MobileIntegration";
import WebhooksGuide from "./pages/developer/WebhooksGuide";
import CodeExamples from "./pages/developer/CodeExamples";
import SDKsPage from "./pages/developer/SDKsPage";
import ApiTesting from "./pages/developer/ApiTesting";
import AISP from "./pages/guides/AISP";
import PISP from "./pages/guides/PISP";
import Security from "./pages/guides/Security";
import Webhooks from "./pages/guides/Webhooks";
import Admin from "./pages/Admin";
import Developer from "./pages/Developer";
import Auth from "./pages/Auth";
import ProfileSettings from "./pages/ProfileSettings";
import TPPRegistration from "./pages/TPPRegistration";
import ComplianceDashboard from "./pages/ComplianceDashboard";
import ISO20022Dashboard from "./pages/ISO20022Dashboard";
import SWIFTDashboard from "./pages/SWIFTDashboard";
import Analytics from "./pages/Analytics";
import UserManagement from "./pages/admin/UserManagement";
import ApiClientManagement from "./pages/admin/ApiClientManagement";
import SandboxManagement from "./pages/admin/SandboxManagement";
import SecurityMonitoring from "./pages/admin/SecurityMonitoring";
import AuditLogs from "./pages/admin/AuditLogs";
import SystemConfig from "./pages/admin/SystemConfig";
import WebhookManagement from "./pages/admin/WebhookManagement";
import TransactionMonitoring from "./pages/admin/TransactionMonitoring";
import ConsentManagement from "./pages/ConsentManagement";
import SystemMonitoring from "./pages/SystemMonitoring";
import Dashboard from "./pages/Dashboard";
import SecuritySettings from "./pages/SecuritySettings";
import Communications from "./pages/Communications";
import MobileMoney from "./pages/MobileMoney";
import Payments from "./pages/Payments";
import PersonalAccounts from "./pages/PersonalAccounts";
import BusinessAccounts from "./pages/BusinessAccounts";
import Savings from "./pages/Savings";
import Loans from "./pages/Loans";
import KYCVerification from "./pages/KYCVerification";
import BankingOps from "./pages/BankingOps";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";
import SecurityPolicy from "./pages/SecurityPolicy";
import CompliancePage from "./pages/CompliancePage";
import SLA from "./pages/SLA";
import AUP from "./pages/AUP";
import DataProtection from "./pages/DataProtection";
import About from "./pages/About";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import Status from "./pages/Status";
import NotFound from "./pages/NotFound";
import PendingApproval from "./pages/PendingApproval";
import FIPortal from "./pages/FIPortal";
import FeeManagement from "./pages/FeeManagement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <BrowserRouter>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Routes>
            <Route path="/" element={<Layout><Index /></Layout>} />
            <Route path="/documentation" element={<Layout><Documentation /></Layout>} />
            <Route path="/guides/aisp" element={<Layout><AISP /></Layout>} />
            <Route path="/guides/pisp" element={<Layout><PISP /></Layout>} />
            <Route path="/guides/security" element={<Layout><Security /></Layout>} />
            <Route path="/guides/webhooks" element={<Layout><Webhooks /></Layout>} />
            <Route path="/register" element={<Layout><Register /></Layout>} />
            <Route path="/pending-approval" element={<Layout><ProtectedRoute><PendingApproval /></ProtectedRoute></Layout>} />
            <Route path="/fi-portal" element={<Layout><ProtectedRoute><FIPortal /></ProtectedRoute></Layout>} />
            <Route path="/loans" element={<Layout><ProtectedRoute><Loans /></ProtectedRoute></Layout>} />
            <Route path="/admin" element={<Layout><ProtectedRoute requiredRole="admin"><Admin /></ProtectedRoute></Layout>} />
            <Route path="/admin/users" element={<Layout><ProtectedRoute requiredRole="admin"><UserManagement /></ProtectedRoute></Layout>} />
            <Route path="/admin/api-clients" element={<Layout><ProtectedRoute requiredRole="admin"><ApiClientManagement /></ProtectedRoute></Layout>} />
            <Route path="/admin/sandbox" element={<Layout><ProtectedRoute requiredRole="admin"><SandboxManagement /></ProtectedRoute></Layout>} />
            <Route path="/admin/security" element={<Layout><ProtectedRoute requiredRole="admin"><SecurityMonitoring /></ProtectedRoute></Layout>} />
            <Route path="/admin/audit-logs" element={<Layout><ProtectedRoute requiredRole="admin"><AuditLogs /></ProtectedRoute></Layout>} />
            <Route path="/admin/system-config" element={<Layout><ProtectedRoute requiredRole="admin"><SystemConfig /></ProtectedRoute></Layout>} />
            <Route path="/admin/webhooks" element={<Layout><ProtectedRoute requiredRole="admin"><WebhookManagement /></ProtectedRoute></Layout>} />
            <Route path="/admin/transactions" element={<Layout><ProtectedRoute requiredRole="admin"><TransactionMonitoring /></ProtectedRoute></Layout>} />
            
            {/* New Developer Portal */}
            <Route path="/developer" element={<DeveloperLayout />}>
              <Route index element={<DeveloperHome />} />
              <Route path="getting-started" element={<GettingStarted />} />
              <Route path="getting-started/authentication" element={<GettingStarted />} />
              <Route path="getting-started/first-call" element={<GettingStarted />} />
              <Route path="api/aisp" element={<AispReference />} />
              <Route path="api/pisp" element={<PispReference />} />
              <Route path="api/mobile-money" element={<MobileMoneyReference />} />
              <Route path="api/banking" element={<BankingReference />} />
              <Route path="api/webhooks" element={<WebhooksGuide />} />
              <Route path="console" element={<ApiConsole />} />
              <Route path="sandbox" element={<ApiConsole />} />
              <Route path="api-testing" element={<ApiTesting />} />
              <Route path="examples" element={<CodeExamples />} />
              <Route path="guides/web" element={<WebIntegration />} />
              <Route path="guides/mobile" element={<MobileIntegration />} />
              <Route path="guides/sdks" element={<SDKsPage />} />
            </Route>
            <Route path="/developer-old" element={<Layout><ProtectedRoute><Developer /></ProtectedRoute></Layout>} />
            <Route path="/tpp-registration" element={<Layout><ProtectedRoute><TPPRegistration /></ProtectedRoute></Layout>} />
            <Route path="/consents" element={<Layout><ProtectedRoute><ConsentManagement /></ProtectedRoute></Layout>} />
            <Route path="/analytics" element={<Layout><ProtectedRoute><Analytics /></ProtectedRoute></Layout>} />
            <Route path="/monitoring" element={<Layout><ProtectedRoute requiredRole="admin"><SystemMonitoring /></ProtectedRoute></Layout>} />
            <Route path="/dashboard" element={<Layout><ProtectedRoute><Dashboard /></ProtectedRoute></Layout>} />
            <Route path="/security" element={<Layout><ProtectedRoute><SecuritySettings /></ProtectedRoute></Layout>} />
            <Route path="/communications" element={<Layout><ProtectedRoute requiredRole="admin"><Communications /></ProtectedRoute></Layout>} />
            <Route path="/mobile-money" element={<Layout><ProtectedRoute><MobileMoney /></ProtectedRoute></Layout>} />
            <Route path="/payments" element={<Layout><ProtectedRoute><Payments /></ProtectedRoute></Layout>} />
            <Route path="/personal-accounts" element={<Layout><ProtectedRoute><PersonalAccounts /></ProtectedRoute></Layout>} />
            <Route path="/business-accounts" element={<Layout><ProtectedRoute><BusinessAccounts /></ProtectedRoute></Layout>} />
            <Route path="/savings" element={<Layout><ProtectedRoute><Savings /></ProtectedRoute></Layout>} />
            <Route path="/compliance-dashboard" element={<Layout><ProtectedRoute requiredRole="admin"><ComplianceDashboard /></ProtectedRoute></Layout>} />
            <Route path="/kyc-verification" element={<Layout><ProtectedRoute><KYCVerification /></ProtectedRoute></Layout>} />
            <Route path="/banking-ops" element={<Layout><ProtectedRoute><BankingOps /></ProtectedRoute></Layout>} />
            <Route path="/profile-settings" element={<Layout><ProtectedRoute><ProfileSettings /></ProtectedRoute></Layout>} />
            <Route path="/privacy" element={<Layout><Privacy /></Layout>} />
            <Route path="/terms" element={<Layout><Terms /></Layout>} />
            <Route path="/cookies" element={<Layout><Cookies /></Layout>} />
            <Route path="/security-policy" element={<Layout><SecurityPolicy /></Layout>} />
            <Route path="/compliance" element={<Layout><CompliancePage /></Layout>} />
            <Route path="/sla" element={<Layout><SLA /></Layout>} />
            <Route path="/aup" element={<Layout><AUP /></Layout>} />
            <Route path="/data-protection" element={<Layout><DataProtection /></Layout>} />
            <Route path="/about" element={<Layout><About /></Layout>} />
        <Route path="/contact" element={<Layout><Contact /></Layout>} />
        <Route path="/faq" element={<Layout><FAQ /></Layout>} />
        <Route path="/status" element={<Layout><Status /></Layout>} />
        <Route path="/integration-workflow" element={<Layout><IntegrationWorkflow /></Layout>} />
        <Route path="/pricing" element={<Layout><Pricing /></Layout>} />
            <Route path="/fee-management" element={<Layout><ProtectedRoute requiredRole="admin"><FeeManagement /></ProtectedRoute></Layout>} />
            <Route path="/iso20022" element={<Layout><ProtectedRoute requiredRole="admin"><ISO20022Dashboard /></ProtectedRoute></Layout>} />
            <Route path="/swift" element={<Layout><ProtectedRoute requiredRole="admin"><SWIFTDashboard /></ProtectedRoute></Layout>} />
            <Route path="/auth" element={<Layout showFooter={false}><Auth /></Layout>} />
            <Route path="*" element={<Layout><NotFound /></Layout>} />
            </Routes>
          </TooltipProvider>
        </BrowserRouter>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
