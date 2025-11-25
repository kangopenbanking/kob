import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PersonalAccountRoute } from "@/components/PersonalAccountRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
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
import ApiExplorer from "./pages/developer/ApiExplorer";
import CertificateManagement from "./pages/developer/CertificateManagement";
import CertificateReference from "./pages/developer/CertificateReference";
import Sandbox from "./pages/developer/Sandbox";
import SandboxUsage from "./pages/developer/SandboxUsage";
import SandboxWebhooks from "./pages/developer/SandboxWebhooks";
import WebhookTesting from "./pages/developer/WebhookTesting";
import SandboxDataGenerator from "./pages/developer/SandboxDataGenerator";
import ApiPlayground from "./pages/developer/ApiPlayground";
import AISP from "./pages/guides/AISP";
import PISP from "./pages/guides/PISP";
import Security from "./pages/guides/Security";
import Webhooks from "./pages/guides/Webhooks";
import Certificates from "./pages/guides/Certificates";
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
import WooCommerceManagement from "./pages/admin/WooCommerceManagement";
import BranchManagement from "./pages/admin/BranchManagement";
import ApiClientManagement from "./pages/admin/ApiClientManagement";
import SandboxManagement from "./pages/admin/SandboxManagement";
import SecurityMonitoring from "./pages/admin/SecurityMonitoring";
import AuditLogs from "./pages/admin/AuditLogs";
import SystemConfig from "./pages/admin/SystemConfig";
import WebhookManagement from "./pages/admin/WebhookManagement";
import TransactionMonitoring from "./pages/admin/TransactionMonitoring";
import ConsentDataManagement from "./pages/admin/ConsentDataManagement";
import ConsentManagement from "./pages/ConsentManagement";
import SystemMonitoring from "./pages/SystemMonitoring";
import Dashboard from "./pages/Dashboard";
import SecuritySettings from "./pages/SecuritySettings";
import NotificationPreferences from "./pages/NotificationPreferences";
import Communications from "./pages/Communications";
import MobileMoney from "./pages/MobileMoney";
import Payments from "./pages/Payments";
import PersonalAccounts from "./pages/PersonalAccounts";
import BusinessAccounts from "./pages/BusinessAccounts";
import Savings from "./pages/Savings";
import Loans from "./pages/Loans";
import VirtualCards from "./pages/VirtualCards";
import CreditScore from "./pages/CreditScore";
import CreditReport from "./pages/CreditReport";
import CreditScoresInfo from "./pages/CreditScoresInfo";
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
import CreditManagement from "./pages/admin/CreditManagement";
import WooForKang from "./pages/WooForKang";
import PaymentFacilitation from "./pages/PaymentFacilitation";
import PaymentFacilitationDev from "./pages/developer/PaymentFacilitation";
import PaymentFacilitationAdmin from "./pages/admin/PaymentFacilitation";
import CrediQ from "./pages/CrediQ";
import CrediQOnboarding from "./pages/CrediQOnboarding";
import CrediQDashboard from "./pages/CrediQDashboard";
import CrediQSettings from "./pages/CrediQSettings";
import CrediQInfo from "./pages/CrediQInfo";
import CreditAPIDocumentation from "./pages/CreditAPIDocumentation";
import HealthMonitoring from "./pages/admin/HealthMonitoring";
import RLSMonitoring from "./pages/admin/RLSMonitoring";
import ApiHealthDashboard from "./pages/admin/ApiHealthDashboard";
import ApiTestingAdmin from "./pages/admin/ApiTesting";
import SystemAlerts from "./pages/admin/SystemAlerts";
import ApiPerformance from "./pages/admin/ApiPerformance";
import RateLimitConfig from "./pages/admin/RateLimitConfig";
import ApiDocumentation from "./pages/admin/ApiDocumentation";
import LoadTesting from "./pages/admin/LoadTesting";
import AuditTrailViewer from "./pages/admin/AuditTrailViewer";
import AnomalyDetection from "./pages/admin/AnomalyDetection";
import KYCVerificationReview from "./pages/admin/KYCVerificationReview";
import BusinessKYCReview from "./pages/admin/BusinessKYCReview";
import TPPRegistrationReview from "./pages/admin/TPPRegistrationReview";
import InstitutionVerification from "./pages/admin/InstitutionVerification";
import BusinessKYBSubmission from "./pages/BusinessKYBSubmission";
import ForDevelopers from "./pages/ForDevelopers";
import ApiCatalog from "./pages/ApiCatalog";
import QuickStart from "./pages/developer/QuickStart";
import Playground from "./pages/developer/Playground";
import Changelog from "./pages/developer/Changelog";
import ApiKeys from "./pages/developer/ApiKeys";
import FintechDevelopers from "./pages/solutions/FintechDevelopers";
import MobileMoneyIntegration from "./pages/solutions/MobileMoneyIntegration";
import CreditScoring from "./pages/solutions/CreditScoring";
import AIIntegrationGuide from "./pages/developer/AIIntegrationGuide";
import ApiDirectorySubmissions from "./pages/developer/ApiDirectorySubmissions";
import SecurityDashboard from "./pages/admin/SecurityDashboard";
import NoCodeIndex from "./pages/integrations/NoCodeIndex";
import ZapierGuide from "./pages/integrations/ZapierGuide";
import MakeGuide from "./pages/integrations/MakeGuide";
import BubbleGuide from "./pages/integrations/BubbleGuide";
import RetoolGuide from "./pages/integrations/RetoolGuide";
import WooCommerceGuide from "./pages/integrations/WooCommerceGuide";
import WooCommerceMerchantRegister from "./pages/integrations/WooCommerceMerchantRegister";
import WooCommercePluginCode from "./pages/integrations/WooCommercePluginCode";
import StatusWidget from "./pages/StatusWidget";
import EmbedStatusWidget from "./pages/EmbedStatusWidget";

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
          <ScrollToTop />
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
            <Route path="/guides/certificates" element={<Layout><Certificates /></Layout>} />
            <Route path="/register" element={<Layout><Register /></Layout>} />
            <Route path="/pending-approval" element={<Layout><ProtectedRoute><PersonalAccountRoute><PendingApproval /></PersonalAccountRoute></ProtectedRoute></Layout>} />
            <Route path="/business-kyb-submission" element={<Layout><ProtectedRoute><BusinessKYBSubmission /></ProtectedRoute></Layout>} />
            <Route path="/fi-portal" element={<Layout><ProtectedRoute><PersonalAccountRoute><FIPortal /></PersonalAccountRoute></ProtectedRoute></Layout>} />
            <Route path="/loans" element={<Layout><ProtectedRoute><PersonalAccountRoute><Loans /></PersonalAccountRoute></ProtectedRoute></Layout>} />
            
            {/* Admin Routes - Nested with AdminLayout */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}>
              <Route index element={<Admin />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="woocommerce-plugin" element={<WooCommerceManagement />} />
              <Route path="api-clients" element={<ApiClientManagement />} />
              <Route path="sandbox" element={<SandboxManagement />} />
              <Route path="security" element={<SecurityMonitoring />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="system-config" element={<SystemConfig />} />
              <Route path="webhooks" element={<WebhookManagement />} />
              <Route path="branches" element={<BranchManagement />} />
              <Route path="transactions" element={<TransactionMonitoring />} />
              <Route path="consent-data" element={<ConsentDataManagement />} />
              <Route path="health" element={<HealthMonitoring />} />
              <Route path="rls-monitoring" element={<RLSMonitoring />} />
              <Route path="api-health" element={<ApiHealthDashboard />} />
              <Route path="api-testing" element={<ApiTestingAdmin />} />
              <Route path="system-alerts" element={<SystemAlerts />} />
              <Route path="api-performance" element={<ApiPerformance />} />
              <Route path="rate-limits" element={<RateLimitConfig />} />
              <Route path="api-docs" element={<ApiDocumentation />} />
              <Route path="load-testing" element={<LoadTesting />} />
              <Route path="audit-trail" element={<AuditTrailViewer />} />
              <Route path="anomaly-detection" element={<AnomalyDetection />} />
              <Route path="credit-management" element={<CreditManagement />} />
              <Route path="payment-facilitation" element={<PaymentFacilitationAdmin />} />
              <Route path="kyc-verification" element={<KYCVerificationReview />} />
              <Route path="business-kyc" element={<BusinessKYCReview />} />
              <Route path="tpp-registrations" element={<TPPRegistrationReview />} />
              <Route path="institution-verification" element={<InstitutionVerification />} />
              <Route path="security-dashboard" element={<SecurityDashboard />} />
            </Route>
            <Route path="/system-monitoring" element={<ProtectedRoute requiredRole="admin"><AdminLayout><SystemMonitoring /></AdminLayout></ProtectedRoute>} />
            <Route path="/fee-management" element={<ProtectedRoute requiredRole="admin"><AdminLayout><FeeManagement /></AdminLayout></ProtectedRoute>} />
            <Route path="/communications" element={<ProtectedRoute requiredRole="admin"><AdminLayout><Communications /></AdminLayout></ProtectedRoute>} />
            <Route path="/compliance-dashboard" element={<ProtectedRoute requiredRole="admin"><AdminLayout><ComplianceDashboard /></AdminLayout></ProtectedRoute>} />
            
            {/* New Developer Portal */}
            <Route path="/developer" element={<DeveloperLayout />}>
              <Route index element={<DeveloperHome />} />
              <Route path="getting-started" element={<GettingStarted />} />
              <Route path="getting-started/authentication" element={<GettingStarted />} />
              <Route path="getting-started/first-call" element={<GettingStarted />} />
              <Route path="quick-start" element={<QuickStart />} />
              <Route path="playground" element={<Playground />} />
              <Route path="changelog" element={<Changelog />} />
              <Route path="api/aisp" element={<AispReference />} />
              <Route path="api/pisp" element={<PispReference />} />
              <Route path="api/mobile-money" element={<MobileMoneyReference />} />
              <Route path="api/banking" element={<BankingReference />} />
              <Route path="api/certificates" element={<CertificateReference />} />
              <Route path="api/webhooks" element={<WebhooksGuide />} />
              <Route path="payment-facilitation" element={<PaymentFacilitationDev />} />
              <Route path="console" element={<ApiConsole />} />
              <Route path="sandbox" element={<Sandbox />} />
              <Route path="sandbox/usage" element={<SandboxUsage />} />
              <Route path="sandbox/webhooks" element={<SandboxWebhooks />} />
              <Route path="sandbox/webhook-testing" element={<WebhookTesting />} />
              <Route path="sandbox/data-generator" element={<SandboxDataGenerator />} />
              <Route path="api-playground" element={<ApiPlayground />} />
              <Route path="api-testing" element={<ApiTesting />} />
              <Route path="examples" element={<CodeExamples />} />
              <Route path="guides/web" element={<WebIntegration />} />
              <Route path="guides/mobile" element={<MobileIntegration />} />
              <Route path="guides/sdks" element={<SDKsPage />} />
              <Route path="api-explorer" element={<ApiExplorer />} />
              <Route path="certificates" element={<CertificateManagement />} />
              <Route path="api-keys" element={<ProtectedRoute><ApiKeys /></ProtectedRoute>} />
              <Route path="ai-integration-guide" element={<AIIntegrationGuide />} />
              <Route path="api-directory-submissions" element={<ApiDirectorySubmissions />} />
            </Route>
            <Route path="/for-developers" element={<Layout><ForDevelopers /></Layout>} />
            <Route path="/api-catalog" element={<Layout><ApiCatalog /></Layout>} />
            
            {/* No-Code Integration Guides */}
            <Route path="/integrations" element={<Layout><NoCodeIndex /></Layout>} />
            <Route path="/integrations/zapier" element={<Layout><ZapierGuide /></Layout>} />
            <Route path="/integrations/make" element={<Layout><MakeGuide /></Layout>} />
            <Route path="/integrations/bubble" element={<Layout><BubbleGuide /></Layout>} />
            <Route path="/integrations/retool" element={<Layout><RetoolGuide /></Layout>} />
            <Route path="/integrations/woocommerce-docs" element={<Layout><WooCommerceGuide /></Layout>} />
            <Route path="/integrations/woocommerce-merchant-register" element={<Layout><WooCommerceMerchantRegister /></Layout>} />
            <Route path="/integrations/woocommerce-plugin-code" element={<Layout><WooCommercePluginCode /></Layout>} />
            <Route path="/woo-for-kang" element={<Layout><WooForKang /></Layout>} />
            
            {/* Solution Pages */}
            <Route path="/solutions/fintech-developers" element={<Layout><FintechDevelopers /></Layout>} />
            <Route path="/solutions/mobile-money-integration" element={<Layout><MobileMoneyIntegration /></Layout>} />
            <Route path="/solutions/credit-scoring" element={<Layout><CreditScoring /></Layout>} />
            
            <Route path="/developer-old" element={<Layout><ProtectedRoute><Developer /></ProtectedRoute></Layout>} />
            <Route path="/tpp-registration" element={<Layout><ProtectedRoute><TPPRegistration /></ProtectedRoute></Layout>} />
            <Route path="/consents" element={<Layout><ProtectedRoute><ConsentManagement /></ProtectedRoute></Layout>} />
            <Route path="/analytics" element={<Layout><ProtectedRoute><Analytics /></ProtectedRoute></Layout>} />
            <Route path="/monitoring" element={<Layout><ProtectedRoute requiredRole="admin"><SystemMonitoring /></ProtectedRoute></Layout>} />
            
            {/* User Dashboard Routes - Nested with DashboardLayout */}
            <Route path="/dashboard" element={<ProtectedRoute><PersonalAccountRoute><DashboardLayout /></PersonalAccountRoute></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
            </Route>
            <Route path="/security" element={<ProtectedRoute><PersonalAccountRoute><DashboardLayout><SecuritySettings /></DashboardLayout></PersonalAccountRoute></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><PersonalAccountRoute><DashboardLayout><NotificationPreferences /></DashboardLayout></PersonalAccountRoute></ProtectedRoute>} />
            <Route path="/mobile-money" element={<ProtectedRoute><PersonalAccountRoute><DashboardLayout><MobileMoney /></DashboardLayout></PersonalAccountRoute></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><PersonalAccountRoute><DashboardLayout><Payments /></DashboardLayout></PersonalAccountRoute></ProtectedRoute>} />
            <Route path="/personal-accounts" element={<Layout><ProtectedRoute><PersonalAccountRoute><PersonalAccounts /></PersonalAccountRoute></ProtectedRoute></Layout>} />
            <Route path="/business-accounts" element={<Layout><ProtectedRoute><PersonalAccountRoute><BusinessAccounts /></PersonalAccountRoute></ProtectedRoute></Layout>} />
            <Route path="/savings" element={<ProtectedRoute><PersonalAccountRoute><DashboardLayout><Savings /></DashboardLayout></PersonalAccountRoute></ProtectedRoute>} />
            <Route path="/virtual-cards" element={<ProtectedRoute><PersonalAccountRoute><DashboardLayout><VirtualCards /></DashboardLayout></PersonalAccountRoute></ProtectedRoute>} />
            
            {/* CrediQ Routes */}
            <Route path="/crediq" element={<CrediQ />} />
            <Route path="/crediq/info" element={<CrediQInfo />} />
            <Route path="/crediq/onboarding" element={<Layout><ProtectedRoute><CrediQOnboarding /></ProtectedRoute></Layout>} />
            <Route path="/crediq/dashboard" element={<ProtectedRoute><DashboardLayout><CrediQDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/crediq/settings" element={<Layout><ProtectedRoute><CrediQSettings /></ProtectedRoute></Layout>} />
            <Route path="/credit-score" element={<ProtectedRoute><DashboardLayout><CreditScore /></DashboardLayout></ProtectedRoute>} />
            <Route path="/credit-report" element={<ProtectedRoute><DashboardLayout><CreditReport /></DashboardLayout></ProtectedRoute>} />
            <Route path="/credit-scores-info" element={<Layout><CreditScoresInfo /></Layout>} />
            <Route path="/credit-api-docs" element={<Layout><CreditAPIDocumentation /></Layout>} />
            <Route path="/kyc-verification" element={<Layout><ProtectedRoute><PersonalAccountRoute><KYCVerification /></PersonalAccountRoute></ProtectedRoute></Layout>} />
            <Route path="/banking-ops" element={<ProtectedRoute><PersonalAccountRoute><DashboardLayout><BankingOps /></DashboardLayout></PersonalAccountRoute></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><DashboardLayout><ProfileSettings /></DashboardLayout></ProtectedRoute>} />
            <Route path="/profile-settings" element={<Layout><ProtectedRoute><ProfileSettings /></ProtectedRoute></Layout>} />
            <Route path="/privacy" element={<Layout><Privacy /></Layout>} />
            <Route path="/terms" element={<Layout><Terms /></Layout>} />
            <Route path="/cookies" element={<Layout><Cookies /></Layout>} />
            <Route path="/security-policy" element={<Layout><SecurityPolicy /></Layout>} />
            <Route path="/compliance" element={<Layout><CompliancePage /></Layout>} />
            <Route path="/sla" element={<Layout><SLA /></Layout>} />
            <Route path="/aup" element={<Layout><AUP /></Layout>} />
            <Route path="/status-widget" element={<StatusWidget />} />
            <Route path="/embed-status-widget" element={<EmbedStatusWidget />} />
            <Route path="/data-protection" element={<Layout><DataProtection /></Layout>} />
            <Route path="/about" element={<Layout><About /></Layout>} />
        <Route path="/contact" element={<Layout><Contact /></Layout>} />
        <Route path="/faq" element={<Layout><FAQ /></Layout>} />
        <Route path="/status" element={<Layout><Status /></Layout>} />
            <Route path="/integration-workflow" element={<Layout><IntegrationWorkflow /></Layout>} />
            <Route path="/payment-facilitation" element={<Layout><PaymentFacilitation /></Layout>} />
            <Route path="/pricing" element={<Layout><Pricing /></Layout>} />
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
