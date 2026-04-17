// ============================================================
// PERMANENT PUBLIC ROUTES -- DO NOT REMOVE OR REDIRECT
// These routes must remain publicly accessible at all times.
// No authentication, no login wall, no redirect.
// Required for international API standards compliance.
// Removing or changing these routes breaks SDK integrations
// and third-party developer tools worldwide.
// ============================================================
// PERMANENT_PUBLIC_ROUTES:
//   /developer
//   /developer/getting-started
//   /developer/api-explorer
//   /developer/examples/real-world
//   /developer/gateway/quickstart
//   /developer/gateway/webhooks
//   /developer/sandbox
//   /developer/guides/sdks
//   /developer/changelog
//   /openapi.json
//   /openapi.yaml
//   /openapi-sandbox.json
// ============================================================

import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGuard } from "@/components/RoleGuard";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PersonalAccountRoute } from "@/components/PersonalAccountRoute";
import { NonInstitutionRoute } from "@/components/auth/NonInstitutionRoute";
import { DashboardRouter } from "@/components/DashboardRouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PortalErrorBoundary } from "@/components/PortalErrorBoundary";
import { NestedNotFound } from "@/components/NestedNotFound";
import { ScrollToTop } from "@/components/ScrollToTop";
import { PWARouteGuard } from "@/components/pwa/PWARouteGuard";
import { DeveloperLayout } from "@/components/developer/DeveloperLayout";
import { PublicDeveloperLayout } from "@/components/developer/PublicDeveloperLayout";
import { InstitutionLayout } from "@/components/institution/InstitutionLayout";
import { MerchantLayout } from "@/components/merchant/MerchantLayout";
import { BankingAppLayout } from "./components/banking-app/BankingAppLayout";
import { FeatureGate } from "./components/pwa/FeatureGate";
import { CustomerAppLayout } from "./components/customer-app/CustomerAppLayout";
import { UnifiedBusinessLayout } from "./components/business-app/UnifiedBusinessLayout";
import { Loader2 } from "lucide-react";

// Global lazy loading fallback
const LazyFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// ─── Lazy-loaded pages ───────────────────────────────────────────────

// Core / Public
const Index = lazy(() => import("./pages/Index"));
const Documentation = lazy(() => import("./pages/Documentation"));
const Register = lazy(() => import("./pages/Register"));
const IntegrationWorkflow = lazy(() => import("./pages/IntegrationWorkflow"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Auth = lazy(() => import("./pages/Auth"));
const MandatoryPinSetup = lazy(() => import("./pages/MandatoryPinSetup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const Apps = lazy(() => import("./pages/Apps"));
const PublicStorefront = lazy(() => import("./pages/PublicStorefront"));
const PaymentCheckout = lazy(() => import("./pages/PaymentCheckout"));
const StatusWidget = lazy(() => import("./pages/StatusWidget"));
const EmbedStatusWidget = lazy(() => import("./pages/EmbedStatusWidget"));
const CustomerFundAccount = lazy(() => import("./pages/CustomerFundAccount"));
const BusinessKYBSubmission = lazy(() => import("./pages/BusinessKYBSubmission"));
const RemittanceLanding = lazy(() => import("./pages/RemittanceLanding"));
const PayByBankAuthorize = lazy(() => import("./pages/PayByBankAuthorize"));
const PayByBankApproval = lazy(() => import("./pages/customer-app/PayByBankApproval"));
const CustomerSupport = lazy(() => import("./pages/customer-app/CustomerSupport"));

// Legal / Info
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Cookies = lazy(() => import("./pages/Cookies"));
const SecurityPolicy = lazy(() => import("./pages/SecurityPolicy"));
const CompliancePage = lazy(() => import("./pages/CompliancePage"));
const SLA = lazy(() => import("./pages/SLA"));
const AUP = lazy(() => import("./pages/AUP"));
const DataProtection = lazy(() => import("./pages/DataProtection"));
const About = lazy(() => import("./pages/About"));
const ProductManual = lazy(() => import("./pages/ProductManual"));
const BankIntegrationGuide = lazy(() => import("./pages/BankIntegrationGuide"));
const Contact = lazy(() => import("./pages/Contact"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Status = lazy(() => import("./pages/Status"));
const HelpCentre = lazy(() => import("./pages/HelpCentre"));

// Guides
const AISP = lazy(() => import("./pages/guides/AISP"));
const PISP = lazy(() => import("./pages/guides/PISP"));
const Security = lazy(() => import("./pages/guides/Security"));
const Webhooks = lazy(() => import("./pages/guides/Webhooks"));
const Certificates = lazy(() => import("./pages/guides/Certificates"));

// Dashboard / Personal
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SecuritySettings = lazy(() => import("./pages/SecuritySettings"));
const NotificationPreferences = lazy(() => import("./pages/NotificationPreferences"));
const NotificationHistory = lazy(() => import("./pages/NotificationHistory"));
const Communications = lazy(() => import("./pages/Communications"));
const MobileMoney = lazy(() => import("./pages/MobileMoney"));
const Payments = lazy(() => import("./pages/Payments"));
const PersonalAccounts = lazy(() => import("./pages/PersonalAccounts"));
const BusinessAccounts = lazy(() => import("./pages/BusinessAccounts"));
const Savings = lazy(() => import("./pages/Savings"));
const Loans = lazy(() => import("./pages/Loans"));
const VirtualCards = lazy(() => import("./pages/VirtualCards"));
const CreditScore = lazy(() => import("./pages/CreditScore"));
const CreditReport = lazy(() => import("./pages/CreditReport"));
const CreditScoresInfo = lazy(() => import("./pages/CreditScoresInfo"));
const KYCVerification = lazy(() => import("./pages/KYCVerification"));
const BankingOps = lazy(() => import("./pages/BankingOps"));
const TPPRegistration = lazy(() => import("./pages/TPPRegistration"));
const ConsentManagement = lazy(() => import("./pages/ConsentManagement"));
const Analytics = lazy(() => import("./pages/Analytics"));
const SystemMonitoring = lazy(() => import("./pages/SystemMonitoring"));
const ComplianceDashboard = lazy(() => import("./pages/ComplianceDashboard"));
const ISO20022Dashboard = lazy(() => import("./pages/ISO20022Dashboard"));
const SWIFTDashboard = lazy(() => import("./pages/SWIFTDashboard"));
const FeeManagement = lazy(() => import("./pages/FeeManagement"));

// CrediQ
const CrediQ = lazy(() => import("./pages/CrediQ"));
const CrediQOnboarding = lazy(() => import("./pages/CrediQOnboarding"));
const CrediQDashboard = lazy(() => import("./pages/CrediQDashboard"));
const CrediQSettings = lazy(() => import("./pages/CrediQSettings"));
const CrediQInfo = lazy(() => import("./pages/CrediQInfo"));
const CreditAPIDocumentation = lazy(() => import("./pages/CreditAPIDocumentation"));

// Solutions / Marketing
const ForDevelopers = lazy(() => import("./pages/ForDevelopers"));
const ForMerchants = lazy(() => import("./pages/ForMerchants"));
const ApiCatalog = lazy(() => import("./pages/ApiCatalog"));
const WooForKang = lazy(() => import("./pages/WooForKang"));
const KobPOS = lazy(() => import("./pages/KobPOS"));
const PaymentFacilitation = lazy(() => import("./pages/PaymentFacilitation"));
const Architecture = lazy(() => import("./pages/Architecture"));
const KeyFunctionsSummary = lazy(() => import("./pages/KeyFunctionsSummary"));
const ROICalculator = lazy(() => import("./pages/ROICalculator"));
const PiggyBankInfo = lazy(() => import("./pages/PiggyBankInfo"));
const NjangiInfo = lazy(() => import("./pages/NjangiInfo"));
const RentReportingInfo = lazy(() => import("./pages/RentReportingInfo"));
const FintechDevelopers = lazy(() => import("./pages/solutions/FintechDevelopers"));
const MobileMoneyIntegration = lazy(() => import("./pages/solutions/MobileMoneyIntegration"));
const CreditScoring = lazy(() => import("./pages/solutions/CreditScoring"));
const ByoMobileMoney = lazy(() => import("./pages/products/ByoMobileMoney"));
const AdminTenantConnectors = lazy(() => import("./pages/admin/AdminTenantConnectors"));
const AdminBankOnboarding = lazy(() => import("./pages/admin/AdminBankOnboarding"));
const BankOperationsMonitor = lazy(() => import("./pages/admin/BankOperationsMonitor"));

// Developer Portal
const DeveloperHome = lazy(() => import("./pages/developer/DeveloperHome"));
const GettingStarted = lazy(() => import("./pages/developer/GettingStarted"));
const AispReference = lazy(() => import("./pages/developer/AispReference"));
const PispReference = lazy(() => import("./pages/developer/PispReference"));
const MobileMoneyReference = lazy(() => import("./pages/developer/MobileMoneyReference"));
const BankingReference = lazy(() => import("./pages/developer/BankingReference"));
const TransfersGuide = lazy(() => import("./pages/developer/TransfersGuide"));
const ApiConsole = lazy(() => import("./pages/developer/ApiConsole"));
const WebIntegration = lazy(() => import("./pages/developer/WebIntegration"));
const MobileIntegration = lazy(() => import("./pages/developer/MobileIntegration"));
const WebhooksGuide = lazy(() => import("./pages/developer/WebhooksGuide"));
const CodeExamples = lazy(() => import("./pages/developer/CodeExamples"));
const SDKsPage = lazy(() => import("./pages/developer/SDKsPage"));
const ApiTesting = lazy(() => import("./pages/developer/ApiTesting"));
const ApiExplorer = lazy(() => import("./pages/developer/ApiExplorer"));
const ApiExplorerStatic = lazy(() => import("./pages/developer/ApiExplorerStatic"));
const RedocPage = lazy(() => import("./pages/developer/RedocPage"));
const DocsHealth = lazy(() => import("./pages/developer/DocsHealth"));
const OpenApiDownloads = lazy(() => import("./pages/developer/OpenApiDownloads"));
const RealWorldExamples = lazy(() => import("./pages/developer/RealWorldExamples"));
const RealWorldExampleDetail = lazy(() => import("./pages/developer/RealWorldExampleDetail"));
const CertificateManagement = lazy(() => import("./pages/developer/CertificateManagement"));
const CertificateReference = lazy(() => import("./pages/developer/CertificateReference"));
const Sandbox = lazy(() => import("./pages/developer/Sandbox"));
const SandboxUsage = lazy(() => import("./pages/developer/SandboxUsage"));
const SandboxWebhooks = lazy(() => import("./pages/developer/SandboxWebhooks"));
const WebhookTesting = lazy(() => import("./pages/developer/WebhookTesting"));
const SandboxDataGenerator = lazy(() => import("./pages/developer/SandboxDataGenerator"));
const ApiPlayground = lazy(() => import("./pages/developer/ApiPlayground"));
const RefundsReference = lazy(() => import("./pages/developer/RefundsReference"));
const BeneficiariesReference = lazy(() => import("./pages/developer/BeneficiariesReference"));
const SettlementsReference = lazy(() => import("./pages/developer/SettlementsReference"));
const DisputesReference = lazy(() => import("./pages/developer/DisputesReference"));
const ExportsReference = lazy(() => import("./pages/developer/ExportsReference"));
const RiskAuditReference = lazy(() => import("./pages/developer/RiskAuditReference"));
const GatewayQuickstart = lazy(() => import("./pages/developer/GatewayQuickstart"));
const GatewayChargesGuide = lazy(() => import("./pages/developer/GatewayChargesGuide"));
const GatewayPayoutsGuide = lazy(() => import("./pages/developer/GatewayPayoutsGuide"));
const GatewayRefundsGuide = lazy(() => import("./pages/developer/GatewayRefundsGuide"));
const GatewaySettlementsGuide = lazy(() => import("./pages/developer/GatewaySettlementsGuide"));
const GatewayDisputesGuide = lazy(() => import("./pages/developer/GatewayDisputesGuide"));
const GatewayWebhooksGuide = lazy(() => import("./pages/developer/GatewayWebhooksGuide"));
const GatewayPaymentLinksGuide = lazy(() => import("./pages/developer/GatewayPaymentLinksGuide"));
const GatewaySubscriptionsGuide = lazy(() => import("./pages/developer/GatewaySubscriptionsGuide"));
const GatewaySplitPaymentsGuide = lazy(() => import("./pages/developer/GatewaySplitPaymentsGuide"));
const GatewayTokenizationGuide = lazy(() => import("./pages/developer/GatewayTokenizationGuide"));
const GatewayChargeEventsGuide = lazy(() => import("./pages/developer/GatewayChargeEventsGuide"));
const GatewayVirtualAccountsGuide = lazy(() => import("./pages/developer/GatewayVirtualAccountsGuide"));
const GatewayFundingGuide = lazy(() => import("./pages/developer/GatewayFundingGuide"));
const FundingIntentsGuide = lazy(() => import("./pages/developer/FundingIntentsGuide"));
const PayPalIntegrationGuide = lazy(() => import("./pages/developer/PayPalIntegrationGuide"));
const GatewayMerchantWalletGuide = lazy(() => import("./pages/developer/GatewayMerchantWalletGuide"));
const GatewayVerificationGuide = lazy(() => import("./pages/developer/GatewayVerificationGuide"));
const WalletsGuide = lazy(() => import("./pages/developer/WalletsGuide"));
const EscrowGuide = lazy(() => import("./pages/developer/EscrowGuide"));
const ComplianceScreeningGuide = lazy(() => import("./pages/developer/ComplianceScreeningGuide"));
const InstantPayoutsGuide = lazy(() => import("./pages/developer/InstantPayoutsGuide"));
const TreasuryGuide = lazy(() => import("./pages/developer/TreasuryGuide"));
const WebhooksV2Guide = lazy(() => import("./pages/developer/WebhooksV2Guide"));
const SandboxPayoutSimGuide = lazy(() => import("./pages/developer/SandboxPayoutSimGuide"));
const SLAMonitorGuide = lazy(() => import("./pages/developer/SLAMonitorGuide"));
const SLAPage = lazy(() => import("./pages/developer/SLAPage"));
const ErrorCodesReference = lazy(() => import("./pages/developer/ErrorCodesReference"));
const RateLimitsGuide = lazy(() => import("./pages/developer/RateLimitsGuide"));
const IdempotencyGuide = lazy(() => import("./pages/developer/IdempotencyGuide"));
const SupportedCurrenciesPage = lazy(() => import("./pages/developer/SupportedCurrenciesPage"));
const SupportedCountriesPage = lazy(() => import("./pages/developer/SupportedCountriesPage"));
const ApiStatusPage = lazy(() => import("./pages/developer/ApiStatusPage"));
const TestingGuide = lazy(() => import("./pages/developer/TestingGuide"));
const TokenLifecycleGuide = lazy(() => import("./pages/developer/TokenLifecycleGuide"));
const WebhookRetryGuide = lazy(() => import("./pages/developer/WebhookRetryGuide"));
const HttpCachingGuide = lazy(() => import("./pages/developer/HttpCachingGuide"));
const QuickStart = lazy(() => import("./pages/developer/QuickStart"));
const Playground = lazy(() => import("./pages/developer/Playground"));
const Changelog = lazy(() => import("./pages/developer/Changelog"));
const DeveloperForum = lazy(() => import("./pages/developer/DeveloperForum"));
const ApiKeys = lazy(() => import("./pages/developer/ApiKeys"));
const AIIntegrationGuide = lazy(() => import("./pages/developer/AIIntegrationGuide"));
const MerchantsPOSGuide = lazy(() => import("./pages/developer/MerchantsPOSGuide"));
const ApiDirectorySubmissions = lazy(() => import("./pages/developer/ApiDirectorySubmissions"));
const PaymentFacilitationDev = lazy(() => import("./pages/developer/PaymentFacilitation"));
const Developer = lazy(() => import("./pages/Developer"));

// New Developer Portal pages
const AuthenticationOverview = lazy(() => import("./pages/developer/AuthenticationOverview"));
const AuthApiKeys = lazy(() => import("./pages/developer/AuthApiKeys"));
const AuthOAuth2 = lazy(() => import("./pages/developer/AuthOAuth2"));
const AuthFapi = lazy(() => import("./pages/developer/AuthFapi"));
const AuthMtls = lazy(() => import("./pages/developer/AuthMtls"));
const SandboxOverview = lazy(() => import("./pages/developer/SandboxOverview"));
const ApiReferenceOverview = lazy(() => import("./pages/developer/ApiReferenceOverview"));
const OpenBankingOverview = lazy(() => import("./pages/developer/OpenBankingOverview"));
const MobileMoneyOverview = lazy(() => import("./pages/developer/MobileMoneyOverview"));
const MtnMomoGuide = lazy(() => import("./pages/developer/MtnMomoGuide"));
const OrangeMoneyGuide = lazy(() => import("./pages/developer/OrangeMoneyGuide"));
const ByoMobileMoneyGuide = lazy(() => import("./pages/developer/ByoMobileMoneyGuide"));
const PollingAndWebhooks = lazy(() => import("./pages/developer/PollingAndWebhooks"));
const SoapBankAdapter = lazy(() => import("./pages/developer/SoapBankAdapter"));
const MultiRailFailover = lazy(() => import("./pages/developer/MultiRailFailover"));
const BankAdapterFramework = lazy(() => import("./pages/developer/BankAdapterFramework"));
const BankOnboardingFlow = lazy(() => import("./pages/developer/BankOnboardingFlow"));
const CemacBankIntegration = lazy(() => import("./pages/developer/CemacBankIntegration"));
const CemacBankCatalog = lazy(() => import("./pages/developer/CemacBankCatalog"));
const ComplianceKyc = lazy(() => import("./pages/developer/ComplianceKyc"));
const ComplianceAml = lazy(() => import("./pages/developer/ComplianceAml"));
const ComplianceFapi = lazy(() => import("./pages/developer/ComplianceFapi"));
const Iso20022Overview = lazy(() => import("./pages/developer/Iso20022Overview"));
const GoLiveChecklist = lazy(() => import("./pages/developer/GoLiveChecklist"));
const AccessPolicy = lazy(() => import("./pages/developer/AccessPolicy"));
const DeveloperSupport = lazy(() => import("./pages/developer/DeveloperSupport"));
const SecurityCompliancePage = lazy(() => import("./pages/developer/SecurityCompliancePage"));
const PostmanGuide = lazy(() => import("./pages/developer/PostmanGuide"));
const SandboxConsole = lazy(() => import("./pages/developer/SandboxConsole"));
const SandboxCredentials = lazy(() => import("./pages/developer/SandboxCredentials"));
const SandboxTestCards = lazy(() => import("./pages/developer/SandboxTestCards"));
const SandboxMobileMoney = lazy(() => import("./pages/developer/SandboxMobileMoney"));
const SandboxSimulateWebhooks = lazy(() => import("./pages/developer/SandboxSimulateWebhooks"));
const ApiReferencePagination = lazy(() => import("./pages/developer/ApiReferencePagination"));
const ApiReferenceVersioning = lazy(() => import("./pages/developer/ApiReferenceVersioning"));
const OpenBankingConsents = lazy(() => import("./pages/developer/OpenBankingConsents"));
const Iso20022Messages = lazy(() => import("./pages/developer/Iso20022Messages"));
const DeveloperRegistration = lazy(() => import("./pages/developer/DeveloperRegistration"));

// Admin Portal
const Admin = lazy(() => import("./pages/Admin"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const WooCommerceManagement = lazy(() => import("./pages/admin/WooCommerceManagement"));
const BranchManagement = lazy(() => import("./pages/admin/BranchManagement"));
const ApiClientManagement = lazy(() => import("./pages/admin/ApiClientManagement"));
const SandboxManagement = lazy(() => import("./pages/admin/SandboxManagement"));
const SecurityMonitoring = lazy(() => import("./pages/admin/SecurityMonitoring"));
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const SystemConfig = lazy(() => import("./pages/admin/SystemConfig"));
const WebhookManagement = lazy(() => import("./pages/admin/WebhookManagement"));
const TransactionMonitoring = lazy(() => import("./pages/admin/TransactionMonitoring"));
const ConsentDataManagement = lazy(() => import("./pages/admin/ConsentDataManagement"));
const CreditManagement = lazy(() => import("./pages/admin/CreditManagement"));
const DisputeManagement = lazy(() => import("./pages/admin/DisputeManagement"));
const ReconciliationDashboard = lazy(() => import("./pages/admin/ReconciliationDashboard"));
const PayoutManagement = lazy(() => import("./pages/admin/PayoutManagement"));
const FraudDetection = lazy(() => import("./pages/admin/FraudDetection"));
const FundingManagement = lazy(() => import("./pages/admin/FundingManagement"));
const LinkedAccountRequests = lazy(() => import("./pages/admin/LinkedAccountRequests"));
const ExchangeRateManagement = lazy(() => import("./pages/admin/ExchangeRateManagement"));
const RevenueAnalytics = lazy(() => import("./pages/admin/RevenueAnalytics"));
const EmailTemplates = lazy(() => import("./pages/admin/EmailTemplates"));
const ManagedEmailAdmin = lazy(() => import("./pages/admin/ManagedEmailAdmin"));
const MerchantManagementAdmin = lazy(() => import("./pages/admin/MerchantManagement"));
const AuthBrandingManager = lazy(() => import("./pages/admin/AuthBrandingManager"));
const BankingAppManagement = lazy(() => import("./pages/admin/BankingAppManagement"));
const InstitutionAppUrls = lazy(() => import("./pages/admin/InstitutionAppUrls"));
const HomepageHeroManager = lazy(() => import("./pages/admin/HomepageHeroManager"));
const PaymentFacilitationAdmin = lazy(() => import("./pages/admin/PaymentFacilitation"));
const PaymentCommandCenter = lazy(() => import("./pages/admin/PaymentCommandCenter"));
const TranslationManager = lazy(() => import("./pages/admin/TranslationManager"));
const HealthMonitoring = lazy(() => import("./pages/admin/HealthMonitoring"));
const RLSMonitoring = lazy(() => import("./pages/admin/RLSMonitoring"));
const ApiHealthDashboard = lazy(() => import("./pages/admin/ApiHealthDashboard"));
const ApiTestingAdmin = lazy(() => import("./pages/admin/ApiTesting"));
const SystemAlerts = lazy(() => import("./pages/admin/SystemAlerts"));
const ApiPerformance = lazy(() => import("./pages/admin/ApiPerformance"));
const RateLimitConfig = lazy(() => import("./pages/admin/RateLimitConfig"));
const ApiDocumentation = lazy(() => import("./pages/admin/ApiDocumentation"));
const LoadTesting = lazy(() => import("./pages/admin/LoadTesting"));
const AuditTrailViewer = lazy(() => import("./pages/admin/AuditTrailViewer"));
const AnomalyDetection = lazy(() => import("./pages/admin/AnomalyDetection"));
const KYCVerificationReview = lazy(() => import("./pages/admin/KYCVerificationReview"));
const BusinessKYCReview = lazy(() => import("./pages/admin/BusinessKYCReview"));
const TPPRegistrationReview = lazy(() => import("./pages/admin/TPPRegistrationReview"));
const InstitutionVerification = lazy(() => import("./pages/admin/InstitutionVerification"));
const AccessRoleManagement = lazy(() => import("./pages/admin/AccessRoleManagement"));
const SupportedCountriesManagement = lazy(() => import("./pages/admin/SupportedCountriesManagement"));
const SecurityDashboard = lazy(() => import("./pages/admin/SecurityDashboard"));
const PinLockoutManagement = lazy(() => import("./pages/admin/PinLockoutManagement"));
const AdminTravelManagement = lazy(() => import("./pages/admin/AdminTravelManagement"));
const AdminTravelGuide = lazy(() => import("./pages/admin/AdminTravelGuide"));
const AdminMarketplace = lazy(() => import("./pages/admin/AdminMarketplace"));
const SettlementApproval = lazy(() => import("./pages/admin/SettlementApproval"));
const InvoiceManagement = lazy(() => import("./pages/admin/InvoiceManagement"));
const AdminMarketplaceModeration = lazy(() => import("./pages/admin/AdminMarketplaceModeration"));
const CustomerAppManagement = lazy(() => import("./pages/admin/CustomerAppManagement"));
const BusinessAppManagement = lazy(() => import("./pages/admin/BusinessAppManagement"));
const MerchantWalletOversight = lazy(() => import("./pages/admin/MerchantWalletOversight"));
const RewardsManagement = lazy(() => import("./pages/admin/RewardsManagement"));
const OnboardingManagement = lazy(() => import("./pages/admin/OnboardingManagement"));
const InstitutionManagement = lazy(() => import("./pages/admin/InstitutionManagement"));
const AdminBillManagement = lazy(() => import("./pages/admin/AdminBillManagement"));
const AdminInterbankPayments = lazy(() => import("./pages/admin/AdminInterbankPayments"));
const AdminBankDirectory = lazy(() => import("./pages/admin/AdminBankDirectory"));
const RemittanceOverview = lazy(() => import("./pages/admin/RemittanceOverview"));
const RemittanceSettlement = lazy(() => import("./pages/admin/RemittanceSettlement"));
const RemittancePartners = lazy(() => import("./pages/admin/RemittancePartners"));
const RemittanceBankConfirmations = lazy(() => import("./pages/admin/RemittanceBankConfirmations"));
const RemittanceOutbound = lazy(() => import("./pages/admin/RemittanceOutbound"));
const AdminPayByBank = lazy(() => import("./pages/admin/AdminPayByBank"));
const AdminSupportChat = lazy(() => import("./pages/admin/AdminSupportChat"));

// Developer Portal — Identity & Onboarding Guides + Pay by Bank
const PayByBankGuide = lazy(() => import("./pages/developer/PayByBankGuide"));

// Remittance Developer Docs
const DevRemittanceOverview = lazy(() => import("./pages/developer/remittance/RemittanceOverview"));
const DevRemittanceCorridorsQuotes = lazy(() => import("./pages/developer/remittance/RemittanceCorridorsQuotes"));
const DevRemittanceCreateTransfer = lazy(() => import("./pages/developer/remittance/RemittanceCreateTransfer"));
const DevRemittancePayinMethods = lazy(() => import("./pages/developer/remittance/RemittancePayinMethods"));
const DevRemittancePayoutMethods = lazy(() => import("./pages/developer/remittance/RemittancePayoutMethods"));
const DevRemittanceWebhooks = lazy(() => import("./pages/developer/remittance/RemittanceWebhooks"));
const DevRemittanceSandbox = lazy(() => import("./pages/developer/remittance/RemittanceSandboxTesting"));
const DevRemittanceErrors = lazy(() => import("./pages/developer/remittance/RemittanceErrorReference"));
const GettingStartedByType = lazy(() => import("./pages/developer/GettingStartedByType"));
const IdentityGuide = lazy(() => import("./pages/developer/IdentityGuide"));
const OnboardingGuide = lazy(() => import("./pages/developer/OnboardingGuide"));
const RolesPermissions = lazy(() => import("./pages/developer/RolesPermissions"));
const CompetitiveComparison = lazy(() => import("./pages/developer/CompetitiveComparison"));
const MigrationGuide = lazy(() => import("./pages/developer/MigrationGuide"));

// Bank Dashboard
const BankDashboardHome = lazy(() => import("./pages/bank-dashboard/BankDashboardHome"));
const BankConnectorSetup = lazy(() => import("./pages/bank-dashboard/BankConnectorSetup"));
const BankApprovalQueue = lazy(() => import("./pages/bank-dashboard/BankApprovalQueue"));
const BankCustomerView = lazy(() => import("./pages/bank-dashboard/BankCustomerView"));
const BankTransferManager = lazy(() => import("./pages/bank-dashboard/BankTransferManager"));
const BankReports = lazy(() => import("./pages/bank-dashboard/BankReports"));
const BankApiLogs = lazy(() => import("./pages/bank-dashboard/BankApiLogs"));

// Widgets
const EmbeddablePaymentWidget = lazy(() => import("./pages/widgets/EmbeddablePaymentWidget"));
const EmbeddableBankConnectWidget = lazy(() => import("./pages/widgets/EmbeddableBankConnectWidget"));
const EmbeddableVerificationWidget = lazy(() => import("./pages/widgets/EmbeddableVerificationWidget"));

// New Developer Pages
const WidgetSDKPage = lazy(() => import("./pages/developer/WidgetSDKPage"));
const OpenBankingStandards = lazy(() => import("./pages/developer/OpenBankingStandards"));
const BankOnboardingGuide = lazy(() => import("./pages/developer/BankOnboardingGuide"));
const TestReport = lazy(() => import("./pages/developer/TestReport"));

const FIPortal = lazy(() => import("./pages/FIPortal"));
const InstitutionTransactions = lazy(() => import("./pages/institution/InstitutionTransactions"));
const InstitutionAnalytics = lazy(() => import("./pages/institution/InstitutionAnalytics"));
const InstitutionApiClients = lazy(() => import("./pages/institution/InstitutionApiClients"));
const InstitutionApiKeys = lazy(() => import("./pages/institution/InstitutionApiKeys"));
const InstitutionApiDocs = lazy(() => import("./pages/institution/InstitutionApiDocs"));
const WooCommerceDashboard = lazy(() => import("./pages/institution/WooCommerceDashboard"));
const InstitutionSettlement = lazy(() => import("./pages/institution/InstitutionSettlement"));
const InstitutionPayments = lazy(() => import("./pages/institution/InstitutionPayments"));
const InstitutionWebhooks = lazy(() => import("./pages/institution/InstitutionWebhooks"));
const InstitutionCreditApi = lazy(() => import("./pages/institution/InstitutionCreditApi"));
const InstitutionCompliance = lazy(() => import("./pages/institution/InstitutionCompliance"));
const InstitutionDisputes = lazy(() => import("./pages/institution/InstitutionDisputes"));
const InstitutionProfile = lazy(() => import("./pages/institution/InstitutionProfile"));
const InstitutionTeam = lazy(() => import("./pages/institution/InstitutionTeam"));
const InstitutionSettings = lazy(() => import("./pages/institution/InstitutionSettings"));
const InstitutionAccounts = lazy(() => import("./pages/institution/InstitutionAccounts"));
const InstitutionBranches = lazy(() => import("./pages/institution/InstitutionBranches"));
const InstitutionLoans = lazy(() => import("./pages/institution/InstitutionLoans"));
const InstitutionSavings = lazy(() => import("./pages/institution/InstitutionSavings"));
const InstitutionCustomers = lazy(() => import("./pages/institution/InstitutionCustomers"));
const InstitutionKYCManagement = lazy(() => import("./pages/institution/InstitutionKYCManagement"));
const InstitutionBeneficiaries = lazy(() => import("./pages/institution/InstitutionBeneficiaries"));
const InstitutionLedger = lazy(() => import("./pages/institution/InstitutionLedger"));
const InstitutionAudit = lazy(() => import("./pages/institution/InstitutionAudit"));
const InstitutionBilling = lazy(() => import("./pages/institution/InstitutionBilling"));
const InstitutionConsents = lazy(() => import("./pages/institution/InstitutionConsents"));
const InstitutionCustomerOnboarding = lazy(() => import("./pages/institution/InstitutionCustomerOnboarding"));
const InstitutionStaff = lazy(() => import("./pages/institution/InstitutionStaff"));
const InstitutionWithdrawalPolicies = lazy(() => import("./pages/institution/InstitutionWithdrawalPolicies"));
const InstitutionApprovals = lazy(() => import("./pages/institution/InstitutionApprovals"));
const InstitutionOverdraft = lazy(() => import("./pages/institution/InstitutionOverdraft"));
const InstitutionStaffAuthorizations = lazy(() => import("./pages/institution/InstitutionStaffAuthorizations"));
const InstitutionIncidents = lazy(() => import("./pages/institution/InstitutionIncidents"));
const InstitutionRegulatory = lazy(() => import("./pages/institution/InstitutionRegulatory"));
const InstitutionMessaging = lazy(() => import("./pages/institution/InstitutionMessaging"));
const InstitutionExchangeRates = lazy(() => import("./pages/institution/InstitutionExchangeRates"));
const InstitutionAlerts = lazy(() => import("./pages/institution/InstitutionAlerts"));
const GatewayPaymentLinks = lazy(() => import("./pages/institution/GatewayPaymentLinks"));
const GatewaySubscriptions = lazy(() => import("./pages/institution/GatewaySubscriptions"));
const GatewaySubaccounts = lazy(() => import("./pages/institution/GatewaySubaccounts"));
const GatewayMerchants = lazy(() => import("./pages/institution/GatewayMerchants"));
const GatewayCustomers = lazy(() => import("./pages/institution/GatewayCustomers"));
const InstitutionFundAccount = lazy(() => import("./pages/institution/InstitutionFundAccount"));

// Institution Connector Kit
const ConnectorOverview = lazy(() => import("./pages/institution/connector/ConnectorOverview"));
const ConnectorUploads = lazy(() => import("./pages/institution/connector/ConnectorUploads"));
const ConnectorMappings = lazy(() => import("./pages/institution/connector/ConnectorMappings"));
const ConnectorBatches = lazy(() => import("./pages/institution/connector/ConnectorBatches"));
const ConnectorStatus = lazy(() => import("./pages/institution/connector/ConnectorStatus"));
const ConnectorReconciliation = lazy(() => import("./pages/institution/connector/ConnectorReconciliation"));
const ConnectorHealth = lazy(() => import("./pages/institution/connector/ConnectorHealth"));
const ConnectorAudit = lazy(() => import("./pages/institution/connector/ConnectorAudit"));
const ConnectorTemplates = lazy(() => import("./pages/institution/connector/ConnectorTemplates"));
const ConnectorGuide = lazy(() => import("./pages/institution/connector/ConnectorGuide"));
const ConnectorOnboard = lazy(() => import("./pages/institution/connector/ConnectorOnboard"));

// Merchant Portal
const MerchantDashboard = lazy(() => import("./pages/merchant/MerchantDashboard"));
const MerchantTransactions = lazy(() => import("./pages/merchant/MerchantTransactions"));
const MerchantPaymentLinks = lazy(() => import("./pages/merchant/MerchantPaymentLinks"));
const MerchantCustomers = lazy(() => import("./pages/merchant/MerchantCustomers"));
const MerchantSubscriptions = lazy(() => import("./pages/merchant/MerchantSubscriptions"));
const MerchantEscrow = lazy(() => import("./pages/merchant/MerchantEscrow"));
const MerchantPayouts = lazy(() => import("./pages/merchant/MerchantPayouts"));
const MerchantFundWallet = lazy(() => import("./pages/merchant/MerchantFundWallet"));
const MerchantSettlements = lazy(() => import("./pages/merchant/MerchantSettlements"));
const MerchantRefunds = lazy(() => import("./pages/merchant/MerchantRefunds"));
const MerchantApiKeys = lazy(() => import("./pages/merchant/MerchantApiKeys"));
const MerchantWebhooks = lazy(() => import("./pages/merchant/MerchantWebhooks"));
const MerchantSettlementAccounts = lazy(() => import("./pages/merchant/MerchantSettlementAccounts"));
const MerchantSubaccounts = lazy(() => import("./pages/merchant/MerchantSubaccounts"));
const MerchantKYB = lazy(() => import("./pages/merchant/MerchantKYB"));
const MerchantDisputes = lazy(() => import("./pages/merchant/MerchantDisputes"));
const MerchantProfile = lazy(() => import("./pages/merchant/MerchantProfile"));
const MerchantAnalytics = lazy(() => import("./pages/merchant/MerchantAnalytics"));
const MerchantRegister = lazy(() => import("./pages/merchant/MerchantRegister"));
const MerchantTravelServices = lazy(() => import("./pages/merchant/MerchantTravelServices"));
const BusinessTravelServices = lazy(() => import("./pages/business-app/BusinessTravelServices"));
const MerchantTravelSeating = lazy(() => import("./pages/merchant/MerchantTravelSeating"));
const MerchantTravelRoutes = lazy(() => import("./pages/merchant/MerchantTravelRoutes"));
const MerchantTravelBookings = lazy(() => import("./pages/merchant/MerchantTravelBookings"));
const MerchantTravelScanner = lazy(() => import("./pages/merchant/MerchantTravelScanner"));
const MerchantStorefront = lazy(() => import("./pages/merchant/MerchantStorefront"));
const MerchantTravelTimetable = lazy(() => import("./pages/merchant/MerchantTravelTimetable"));
const MerchantTravelGuide = lazy(() => import("./pages/merchant/MerchantTravelGuide"));
const MerchantTravelCounterBooking = lazy(() => import("./pages/merchant/MerchantTravelCounterBooking"));
const MerchantTravelDiscounts = lazy(() => import("./pages/merchant/MerchantTravelDiscounts"));
const MerchantTravelNotifications = lazy(() => import("./pages/merchant/MerchantTravelNotifications"));
const MerchantTravelStaffRoles = lazy(() => import("./pages/merchant/MerchantTravelStaffRoles"));
const StaffLogin = lazy(() => import("./pages/merchant/StaffLogin"));
const MerchantFees = lazy(() => import("./pages/merchant/MerchantFees"));
const MerchantPlans = lazy(() => import("./pages/merchant/MerchantPlans"));
const MerchantLocations = lazy(() => import("./pages/merchant/MerchantLocations"));
const MerchantWooSync = lazy(() => import("./pages/merchant/MerchantWooSync"));
const MerchantBranding = lazy(() => import("./pages/merchant/MerchantBranding"));
const MerchantApiKeyManagement = lazy(() => import("./pages/merchant/MerchantApiKeyManagement"));
const MerchantBulkOperations = lazy(() => import("./pages/merchant/MerchantBulkOperations"));
const MerchantWhiteLabel = lazy(() => import("./pages/merchant/MerchantWhiteLabel"));
const MerchantAdvancedAnalytics = lazy(() => import("./pages/merchant/MerchantAdvancedAnalytics"));
const MerchantPOSTill = lazy(() => import("./pages/merchant/MerchantPOSTill"));
const MerchantPayByBank = lazy(() => import("./pages/merchant/MerchantPayByBank"));

// Banking App PWA
const BankSplash = lazy(() => import("./pages/banking-app/BankSplash"));
const BankAuth = lazy(() => import("./pages/banking-app/BankAuth"));
const BankApply = lazy(() => import("./pages/banking-app/BankApply"));
const BankKYC = lazy(() => import("./pages/banking-app/BankKYC"));
const BankHome = lazy(() => import("./pages/banking-app/BankHome"));
const BankPayments = lazy(() => import("./pages/banking-app/BankPayments"));
const BankCards = lazy(() => import("./pages/banking-app/BankCards"));
const BankHistory = lazy(() => import("./pages/banking-app/BankHistory"));
const BankMore = lazy(() => import("./pages/banking-app/BankMore"));
const BankSendMoney = lazy(() => import("./pages/banking-app/BankSendMoney"));
const BankSendAbroad = lazy(() => import("./pages/banking-app/BankSendAbroad"));
const BankFundAccount = lazy(() => import("./pages/banking-app/BankFundAccount"));
const BankQRPay = lazy(() => import("./pages/banking-app/BankQRPay"));
const BankMobileMoney = lazy(() => import("./pages/banking-app/BankMobileMoney"));
const BankBills = lazy(() => import("./pages/banking-app/BankBills"));
const BankReceive = lazy(() => import("./pages/banking-app/BankReceive"));
const BankSavings = lazy(() => import("./pages/banking-app/BankSavings"));
const BankNewSavings = lazy(() => import("./pages/banking-app/BankNewSavings"));
const BankLoans = lazy(() => import("./pages/banking-app/BankLoans"));
const BankCreditScore = lazy(() => import("./pages/banking-app/BankCreditScore"));
const BankSettings = lazy(() => import("./pages/banking-app/BankSettings"));
const BankAlerts = lazy(() => import("./pages/banking-app/BankAlerts"));
const BankHelp = lazy(() => import("./pages/banking-app/BankHelp"));
const BankDisputes = lazy(() => import("./pages/banking-app/BankDisputes"));
const BankRemittances = lazy(() => import("./pages/banking-app/BankRemittances"));
const BankSupport = lazy(() => import("./pages/banking-app/BankSupport"));


// Customer App PWA
const CustomerSplash = lazy(() => import("./pages/customer-app/CustomerSplash"));
const CustomerAuth = lazy(() => import("./pages/customer-app/CustomerAuth"));
const CustomerOnboarding = lazy(() => import("./pages/customer-app/CustomerOnboarding"));
const CustomerRegister = lazy(() => import("./pages/customer-app/CustomerRegister"));
const CustomerHome = lazy(() => import("./pages/customer-app/CustomerHome"));
const CustomerScan = lazy(() => import("./pages/customer-app/CustomerScan"));
const CustomerActivity = lazy(() => import("./pages/customer-app/CustomerActivity"));
const CustomerCards = lazy(() => import("./pages/customer-app/CustomerCards"));
const CustomerMore = lazy(() => import("./pages/customer-app/CustomerMore"));
const CustomerOrderTracking = lazy(() => import("./pages/customer-app/CustomerOrderTracking").then(m => ({ default: m.CustomerOrderTracking })));
const CustomerTransfer = lazy(() => import("./pages/customer-app/CustomerTransfer"));
const CustomerRequest = lazy(() => import("./pages/customer-app/CustomerRequest"));
const CustomerBills = lazy(() => import("./pages/customer-app/CustomerBillsV2"));
const CustomerInvoices = lazy(() => import("./pages/customer-app/CustomerInvoices"));
const CustomerBank = lazy(() => import("./pages/customer-app/CustomerBank"));
const CustomerSplitBills = lazy(() => import("./pages/customer-app/CustomerSplitBills"));
const CustomerPayLinks = lazy(() => import("./pages/customer-app/CustomerPayLinks"));
const CustomerCashOut = lazy(() => import("./pages/customer-app/CustomerCashOut"));
const CustomerLinkedAccounts = lazy(() => import("./pages/customer-app/CustomerLinkedAccounts"));
const CustomerFundWallet = lazy(() => import("./pages/customer-app/CustomerFundWallet"));
const CustomerRecurring = lazy(() => import("./pages/customer-app/CustomerRecurring"));
const CustomerRewards = lazy(() => import("./pages/customer-app/CustomerRewards"));
const CustomerPiggyBank = lazy(() => import("./pages/customer-app/CustomerPiggyBank"));
const CustomerNjangi = lazy(() => import("./pages/customer-app/CustomerNjangi"));
const CustomerRentReporting = lazy(() => import("./pages/customer-app/CustomerRentReporting"));
const CustomerCreditScore = lazy(() => import("./pages/customer-app/CustomerCreditScore"));
const CustomerSettings = lazy(() => import("./pages/customer-app/CustomerSettings"));
const CustomerAlerts = lazy(() => import("./pages/customer-app/CustomerAlerts"));
const CustomerHelp = lazy(() => import("./pages/customer-app/CustomerHelp"));
const CustomerTravelCategories = lazy(() => import("./pages/customer-app/CustomerTravelCategories"));
const CustomerTravelAgencies = lazy(() => import("./pages/customer-app/CustomerTravelAgencies"));
const CustomerTravelTrips = lazy(() => import("./pages/customer-app/CustomerTravelTrips"));
const CustomerTravelBooking = lazy(() => import("./pages/customer-app/CustomerTravelBooking"));
const CustomerTravelTicket = lazy(() => import("./pages/customer-app/CustomerTravelTicket"));
const CustomerTravelHistory = lazy(() => import("./pages/customer-app/CustomerTravelHistory"));
const CustomerStores = lazy(() => import("./pages/customer-app/CustomerStores"));
const CustomerStoreDetail = lazy(() => import("./pages/customer-app/CustomerStoreDetail"));
const CustomerCart = lazy(() => import("./pages/customer-app/CustomerCart"));
const CustomerDisputes = lazy(() => import("./pages/customer-app/CustomerDisputes"));
const CustomerSendMoney = lazy(() => import("./pages/customer-app/CustomerSendMoney"));
const CustomerRemittances = lazy(() => import("./pages/customer-app/CustomerRemittances"));
const CustomerLoyalty = lazy(() => import("./pages/customer-app/CustomerLoyalty").then(m => ({ default: m.CustomerLoyalty })));
const CustomerMarketplace = lazy(() => import("./pages/customer-app/CustomerMarketplace").then(m => ({ default: m.CustomerMarketplace })));
const CustomerReviews = lazy(() => import("./pages/customer-app/CustomerReviews").then(m => ({ default: m.CustomerReviews })));
const CustomerWishlist = lazy(() => import("./pages/customer-app/CustomerWishlist").then(m => ({ default: m.CustomerWishlist })));

// Business App PWA
const BusinessSplash = lazy(() => import("./pages/business-app/BusinessSplash"));
const BusinessAuth = lazy(() => import("./pages/business-app/BusinessAuth"));
const BusinessHome = lazy(() => import("./pages/business-app/BusinessHome"));
const BusinessWallet = lazy(() => import("./pages/business-app/BusinessWallet"));
const BusinessReceive = lazy(() => import("./pages/business-app/BusinessReceive"));
const BusinessOrders = lazy(() => import("./pages/business-app/BusinessOrders"));
const BusinessMore = lazy(() => import("./pages/business-app/BusinessMore"));
const BusinessRefunds = lazy(() => import("./pages/business-app/BusinessRefunds"));
const BusinessRegister = lazy(() => import("./pages/business-app/BusinessRegister"));
const BusinessTill = lazy(() => import("./pages/business-app/BusinessTill"));
const BusinessCustomers = lazy(() => import("./pages/business-app/BusinessCustomers"));
const BusinessCoupons = lazy(() => import("./pages/business-app/BusinessCoupons"));
const BusinessReviews = lazy(() => import("./pages/business-app/BusinessReviews"));
const BusinessQuickOrder = lazy(() => import("./pages/business-app/BusinessQuickOrder"));
const BusinessProducts = lazy(() => import("./pages/business-app/BusinessProducts"));
const BusinessAnalytics = lazy(() => import("./pages/business-app/BusinessAnalytics"));
const BusinessStaff = lazy(() => import("./pages/business-app/BusinessStaff"));
const BusinessStorefront = lazy(() => import("./pages/business-app/BusinessStorefront"));
const BusinessInventory = lazy(() => import("./pages/business-app/BusinessInventory"));
const BusinessProductForm = lazy(() => import("./pages/business-app/BusinessProductForm"));
const BusinessTravel = lazy(() => import("./pages/business-app/BusinessTravel"));
const BusinessSupport = lazy(() => import("./pages/business-app/BusinessSupport"));
const BusinessSettings = lazy(() => import("./pages/business-app/BusinessSettings"));
const BusinessCompliance = lazy(() => import("./pages/business-app/BusinessCompliance"));
const BusinessEnterprise = lazy(() => import("./pages/business-app/BusinessEnterprise"));
const BusinessWebhookLogs = lazy(() => import("./pages/business-app/BusinessWebhookLogs"));
const BusinessDisputesPage = lazy(() => import("./pages/business-app/BusinessDisputes"));

// Integrations
const NoCodeIndex = lazy(() => import("./pages/integrations/NoCodeIndex"));
const ZapierGuide = lazy(() => import("./pages/integrations/ZapierGuide"));
const MakeGuide = lazy(() => import("./pages/integrations/MakeGuide"));
const BubbleGuide = lazy(() => import("./pages/integrations/BubbleGuide"));
const RetoolGuide = lazy(() => import("./pages/integrations/RetoolGuide"));
const WooCommerceGuide = lazy(() => import("./pages/integrations/WooCommerceGuide"));
const WooCommerceMerchantRegister = lazy(() => import("./pages/integrations/WooCommerceMerchantRegister"));
const WooCommercePluginCode = lazy(() => import("./pages/integrations/WooCommercePluginCode"));

// Regulatory / Architecture / Compliance / Investors / Certification / Sandbox / API
const CameroonCompliancePage = lazy(() => import("./pages/regulatory/CameroonCompliance"));
const AmlPolicyPage = lazy(() => import("./pages/compliance/AmlPolicy"));
const KycFrameworkPage = lazy(() => import("./pages/compliance/KycFramework"));
const RiskMonitoringPage = lazy(() => import("./pages/compliance/RiskMonitoring"));
const FraudEnginePage = lazy(() => import("./pages/architecture/FraudEngine"));
const RiskScoringModelPage = lazy(() => import("./pages/architecture/RiskScoringModel"));
const LedgerSystemPage = lazy(() => import("./pages/architecture/LedgerSystem"));
const ReconciliationFrameworkPage = lazy(() => import("./pages/architecture/ReconciliationFramework"));
const SettlementEnginePage = lazy(() => import("./pages/architecture/SettlementEngine"));
const InfrastructurePage = lazy(() => import("./pages/architecture/Infrastructure"));
const DisasterRecoveryPage = lazy(() => import("./pages/architecture/DisasterRecovery"));
const ExpansionCountryPage = lazy(() => import("./pages/expansion/ExpansionCountry"));
const IncidentResponsePage = lazy(() => import("./pages/security/IncidentResponse"));
const VersioningPage = lazy(() => import("./pages/api/Versioning"));
const ErrorCodesPage = lazy(() => import("./pages/api/ErrorCodes"));
const WebhooksReferencePage = lazy(() => import("./pages/api/WebhooksReference"));
const IdempotencyPage = lazy(() => import("./pages/api/Idempotency"));
const RateLimitsPage = lazy(() => import("./pages/api/RateLimits"));
const SandboxTestingPage = lazy(() => import("./pages/api/SandboxTesting"));
const SecurityReferencePage = lazy(() => import("./pages/api/SecurityReference"));
const TechnicalOverviewPage = lazy(() => import("./pages/investors/TechnicalOverview"));
const RiskDisclosurePage = lazy(() => import("./pages/investors/RiskDisclosure"));
const ComplianceStatusPage = lazy(() => import("./pages/investors/ComplianceStatus"));
const InfrastructureMaturityPage = lazy(() => import("./pages/investors/InfrastructureMaturity"));
const AGradeStatusPage = lazy(() => import("./pages/certification/AGradeStatus"));
const SimulationToolsPage = lazy(() => import("./pages/sandbox/SimulationTools"));
const FilingPackIndex = lazy(() => import("./pages/regulatory/FilingPackIndex"));
const CorporateStructure = lazy(() => import("./pages/regulatory/CorporateStructure"));
const InternalControlPolicy = lazy(() => import("./pages/regulatory/InternalControlPolicy"));
const LicenseApplicationPage = lazy(() => import("./pages/regulatory/LicenseApplication"));
const BusinessContinuityPage = lazy(() => import("./pages/regulatory/BusinessContinuity"));
const AmlCftPack = lazy(() => import("./pages/regulatory/AmlCftPack"));
const DataProtectionPolicy = lazy(() => import("./pages/regulatory/DataProtectionPolicy"));
const TechnicalDisclosure = lazy(() => import("./pages/regulatory/TechnicalDisclosure"));
const RiskAssessmentPage = lazy(() => import("./pages/regulatory/RiskAssessment"));
const ReportingTemplates = lazy(() => import("./pages/regulatory/ReportingTemplates"));
const RegulatoryReadiness = lazy(() => import("./pages/regulatory/RegulatoryReadiness"));
const KycDueDiligence = lazy(() => import("./pages/regulatory/KycDueDiligence"));

// ─── QueryClient ─────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── App ─────────────────────────────────────────────────────────────

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          <ScrollToTop />
          <PWARouteGuard>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Suspense fallback={<LazyFallback />}>
            <Routes>
            <Route path="/" element={<Layout><Index /></Layout>} />
            <Route path="/documentation" element={<Layout><Documentation /></Layout>} />
            <Route path="/guides/aisp" element={<Layout><AISP /></Layout>} />
            <Route path="/guides/pisp" element={<Layout><PISP /></Layout>} />
            <Route path="/guides/security" element={<Layout><Security /></Layout>} />
            <Route path="/guides/webhooks" element={<Layout><Webhooks /></Layout>} />
            <Route path="/guides/certificates" element={<Layout><Certificates /></Layout>} />
            <Route path="/register" element={<Layout><Register /></Layout>} />
            <Route path="/apps" element={<Layout><Apps /></Layout>} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/store/:merchantId" element={<PublicStorefront />} />
            <Route path="/pending-approval" element={<Layout><ProtectedRoute><PersonalAccountRoute><PendingApproval /></PersonalAccountRoute></ProtectedRoute></Layout>} />
            <Route path="/business-kyb-submission" element={<ProtectedRoute><DashboardLayout><BusinessKYBSubmission /></DashboardLayout></ProtectedRoute>} />
            <Route path="/fund-account" element={<Layout><ProtectedRoute><NonInstitutionRoute><CustomerFundAccount /></NonInstitutionRoute></ProtectedRoute></Layout>} />
            {/* Institution Portal Routes - Nested with InstitutionLayout */}
            <Route path="/fi-portal" element={<ProtectedRoute><RoleGuard allowedRoles={['institution', 'staff']} redirectTo="/dashboard"><InstitutionLayout /></RoleGuard></ProtectedRoute>}>
              <Route index element={<FIPortal />} />
              <Route path="transactions" element={<InstitutionTransactions />} />
              <Route path="analytics" element={<InstitutionAnalytics />} />
              <Route path="api-clients" element={<InstitutionApiClients />} />
              <Route path="api-keys" element={<InstitutionApiKeys />} />
              <Route path="api-docs" element={<InstitutionApiDocs />} />
              <Route path="woocommerce" element={<WooCommerceDashboard />} />
              <Route path="settlement" element={<InstitutionSettlement />} />
              <Route path="payments" element={<InstitutionPayments />} />
              <Route path="webhooks" element={<InstitutionWebhooks />} />
              <Route path="credit-api" element={<InstitutionCreditApi />} />
              <Route path="compliance" element={<InstitutionCompliance />} />
              <Route path="disputes" element={<InstitutionDisputes />} />
              <Route path="profile" element={<InstitutionProfile />} />
              <Route path="team" element={<InstitutionTeam />} />
              <Route path="settings" element={<InstitutionSettings />} />
              <Route path="accounts" element={<InstitutionAccounts />} />
              <Route path="branches" element={<InstitutionBranches />} />
              <Route path="loans" element={<InstitutionLoans />} />
              <Route path="savings" element={<InstitutionSavings />} />
              <Route path="customers" element={<InstitutionCustomers />} />
              <Route path="kyc" element={<InstitutionKYCManagement />} />
              <Route path="beneficiaries" element={<InstitutionBeneficiaries />} />
              <Route path="ledger" element={<InstitutionLedger />} />
              <Route path="audit" element={<InstitutionAudit />} />
              <Route path="billing" element={<InstitutionBilling />} />
              <Route path="consents" element={<InstitutionConsents />} />
              <Route path="customer-onboarding" element={<InstitutionCustomerOnboarding />} />
              <Route path="staff" element={<InstitutionStaff />} />
              <Route path="staff-authorizations" element={<InstitutionStaffAuthorizations />} />
              <Route path="withdrawal-policies" element={<InstitutionWithdrawalPolicies />} />
              <Route path="approvals" element={<InstitutionApprovals />} />
              <Route path="overdraft" element={<InstitutionOverdraft />} />
              <Route path="incidents" element={<InstitutionIncidents />} />
              <Route path="regulatory" element={<InstitutionRegulatory />} />
              <Route path="messaging" element={<InstitutionMessaging />} />
              <Route path="exchange-rates" element={<InstitutionExchangeRates />} />
              <Route path="alerts" element={<InstitutionAlerts />} />
              <Route path="gateway-payment-links" element={<GatewayPaymentLinks />} />
              <Route path="gateway-subscriptions" element={<GatewaySubscriptions />} />
              <Route path="gateway-subaccounts" element={<GatewaySubaccounts />} />
              <Route path="gateway-customers" element={<GatewayCustomers />} />
              <Route path="gateway-merchants" element={<GatewayMerchants />} />
              <Route path="pay-by-bank" element={<AdminPayByBank />} />
              <Route path="fund-account" element={<InstitutionFundAccount />} />
              {/* Bank Connector Kit */}
              <Route path="connector" element={<ConnectorOverview />} />
              <Route path="connector/uploads" element={<ConnectorUploads />} />
              <Route path="connector/mappings" element={<ConnectorMappings />} />
              <Route path="connector/batches" element={<ConnectorBatches />} />
              <Route path="connector/status" element={<ConnectorStatus />} />
              <Route path="connector/reconciliation" element={<ConnectorReconciliation />} />
              <Route path="connector/health" element={<ConnectorHealth />} />
              <Route path="connector/audit" element={<ConnectorAudit />} />
              <Route path="connector/templates" element={<ConnectorTemplates />} />
              <Route path="connector/guide" element={<ConnectorGuide />} />
              <Route path="connector/onboard" element={<ConnectorOnboard />} />
              {/* Banking Dashboard */}
              <Route path="banking" element={<BankDashboardHome />} />
              <Route path="banking/connector-setup" element={<BankConnectorSetup />} />
              <Route path="banking/approvals" element={<BankApprovalQueue />} />
              <Route path="banking/customers" element={<BankCustomerView />} />
              <Route path="banking/transfers" element={<BankTransferManager />} />
              <Route path="banking/reports" element={<BankReports />} />
              <Route path="banking/api-logs" element={<BankApiLogs />} />
              <Route path="*" element={<NestedNotFound portalName="FI Portal" homePath="/fi-portal" />} />
            </Route>
            {/* Merchant Portal Routes */}
            <Route path="/merchant" element={<ProtectedRoute><RoleGuard allowedRoles={['merchant']} redirectTo="/dashboard"><MerchantLayout /></RoleGuard></ProtectedRoute>}>
              <Route index element={<MerchantDashboard />} />
              <Route path="transactions" element={<MerchantTransactions />} />
              <Route path="payment-links" element={<MerchantPaymentLinks />} />
              <Route path="customers" element={<MerchantCustomers />} />
              <Route path="subscriptions" element={<MerchantSubscriptions />} />
              <Route path="escrow" element={<MerchantEscrow />} />
              <Route path="fund-wallet" element={<MerchantFundWallet />} />
              <Route path="payouts" element={<MerchantPayouts />} />
              <Route path="settlements" element={<MerchantSettlements />} />
              <Route path="refunds" element={<MerchantRefunds />} />
              <Route path="api-keys" element={<MerchantApiKeys />} />
              <Route path="webhooks" element={<MerchantWebhooks />} />
              <Route path="settlement-accounts" element={<MerchantSettlementAccounts />} />
              <Route path="subaccounts" element={<MerchantSubaccounts />} />
              <Route path="kyb" element={<MerchantKYB />} />
              <Route path="disputes" element={<MerchantDisputes />} />
              <Route path="profile" element={<MerchantProfile />} />
              <Route path="analytics" element={<MerchantAnalytics />} />
              <Route path="travel-services" element={<MerchantTravelServices />} />
              <Route path="travel-routes" element={<MerchantTravelRoutes />} />
              <Route path="travel-seating" element={<MerchantTravelSeating />} />
              <Route path="travel-timetable" element={<MerchantTravelTimetable />} />
              <Route path="travel-bookings" element={<MerchantTravelBookings />} />
              <Route path="travel-counter-booking" element={<MerchantTravelCounterBooking />} />
              <Route path="travel-guide" element={<MerchantTravelGuide />} />
              <Route path="travel-discounts" element={<MerchantTravelDiscounts />} />
              <Route path="travel-notifications" element={<MerchantTravelNotifications />} />
              <Route path="travel-staff-roles" element={<MerchantTravelStaffRoles />} />
              <Route path="travel-scanner" element={<MerchantTravelScanner />} />
              <Route path="storefront" element={<MerchantStorefront />} />
              {/* Phase 2: Financial Operations */}
              <Route path="fees" element={<MerchantFees />} />
              {/* Phase 3: Advanced Commerce */}
              <Route path="plans" element={<MerchantPlans />} />
              <Route path="locations" element={<MerchantLocations />} />
              <Route path="woo-sync" element={<MerchantWooSync />} />
              {/* Phase 4: Enterprise Features */}
              <Route path="branding" element={<MerchantBranding />} />
              <Route path="api-key-management" element={<MerchantApiKeyManagement />} />
              <Route path="bulk-operations" element={<MerchantBulkOperations />} />
              <Route path="white-label" element={<MerchantWhiteLabel />} />
              <Route path="advanced-analytics" element={<MerchantAdvancedAnalytics />} />
              <Route path="pos-till" element={<MerchantPOSTill />} />
              <Route path="notification-history" element={<NotificationHistory />} />
              <Route path="pay-by-bank" element={<MerchantPayByBank />} />
              <Route path="*" element={<NestedNotFound portalName="Merchant Portal" homePath="/merchant" />} />
            </Route>
            <Route path="/merchant-register" element={<ProtectedRoute><NonInstitutionRoute><MerchantRegister /></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/loans" element={<ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><DashboardLayout><Loans /></DashboardLayout></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute>} />
            
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
              <Route path="institution-management" element={<InstitutionManagement />} />
              <Route path="security-dashboard" element={<SecurityDashboard />} />
              <Route path="pin-lockout" element={<PinLockoutManagement />} />
              {/* Phase 1: Fixed orphaned routes - now inside admin layout */}
              <Route path="fee-management" element={<FeeManagement />} />
              <Route path="system-monitoring" element={<SystemMonitoring />} />
              <Route path="communications" element={<Communications />} />
              <Route path="compliance-dashboard" element={<ComplianceDashboard />} />
              {/* Phase 2: New critical pages */}
              <Route path="disputes" element={<DisputeManagement />} />
              <Route path="reconciliation" element={<ReconciliationDashboard />} />
              <Route path="payment-command-center" element={<PaymentCommandCenter />} />
              <Route path="business-app-management" element={<BusinessAppManagement />} />
              <Route path="payouts" element={<PayoutManagement />} />
              <Route path="funding" element={<FundingManagement />} />
              <Route path="linked-account-requests" element={<LinkedAccountRequests />} />
              <Route path="fraud-detection" element={<FraudDetection />} />
              <Route path="exchange-rates" element={<ExchangeRateManagement />} />
              <Route path="revenue" element={<RevenueAnalytics />} />
              <Route path="email-templates" element={<EmailTemplates />} />
              <Route path="managed-emails" element={<ManagedEmailAdmin />} />
              <Route path="merchants" element={<MerchantManagementAdmin />} />
              <Route path="merchant-wallet-oversight" element={<MerchantWalletOversight />} />
              <Route path="auth-branding" element={<AuthBrandingManager />} />
              <Route path="banking-apps" element={<BankingAppManagement />} />
              <Route path="customer-apps" element={<CustomerAppManagement />} />
              <Route path="institution-urls" element={<InstitutionAppUrls />} />
              <Route path="homepage-hero" element={<HomepageHeroManager />} />
              <Route path="access-roles" element={<AccessRoleManagement />} />
              <Route path="supported-countries" element={<SupportedCountriesManagement />} />
              <Route path="translations" element={<TranslationManager />} />
              <Route path="travel-management" element={<AdminTravelManagement />} />
              <Route path="travel-guide" element={<AdminTravelGuide />} />
              <Route path="marketplace" element={<AdminMarketplace />} />
              {/* Phase 2: Financial Operations */}
              <Route path="settlement-approval" element={<SettlementApproval />} />
              <Route path="invoice-management" element={<InvoiceManagement />} />
              {/* Phase 3: Advanced Commerce */}
              <Route path="marketplace-moderation" element={<AdminMarketplaceModeration />} />
              <Route path="rewards-management" element={<RewardsManagement />} />
              <Route path="onboarding-management" element={<OnboardingManagement />} />
              <Route path="bill-management" element={<AdminBillManagement />} />
              {/* Phase 2+3: Interbank Engine */}
              <Route path="interbank-payments" element={<AdminInterbankPayments />} />
              <Route path="bank-directory" element={<AdminBankDirectory />} />
              {/* Phase 1: Remittance-as-a-Service */}
              <Route path="remittance-overview" element={<RemittanceOverview />} />
              <Route path="remittance-partners" element={<RemittancePartners />} />
              <Route path="remittance-bank-confirmations" element={<RemittanceBankConfirmations />} />
              <Route path="remittance-settlements" element={<RemittanceSettlement />} />
              <Route path="remittance-outbound" element={<RemittanceOutbound />} />
              <Route path="pay-by-bank" element={<AdminPayByBank />} />
              <Route path="support-chat" element={<AdminSupportChat />} />
              <Route path="tenant-connectors" element={<AdminTenantConnectors />} />
              <Route path="bank-onboarding" element={<AdminBankOnboarding />} />
              <Route path="bank-operations" element={<BankOperationsMonitor />} />
              <Route path="*" element={<NestedNotFound portalName="Admin Portal" homePath="/admin" />} />
            </Route>
            {/* Legacy redirects for old orphaned routes */}
            <Route path="/system-monitoring" element={<Navigate to="/admin/system-monitoring" replace />} />
            <Route path="/fee-management" element={<Navigate to="/admin/fee-management" replace />} />
            <Route path="/communications" element={<Navigate to="/admin/communications" replace />} />
            <Route path="/compliance-dashboard" element={<Navigate to="/admin/compliance-dashboard" replace />} />
            
            {/* Public Developer Documentation — no auth required */}
            <Route path="/developer" element={<PublicDeveloperLayout />}>
              <Route index element={<DeveloperHome />} />
              <Route path="getting-started" element={<GettingStarted />} />
              <Route path="getting-started/authentication" element={<GettingStarted />} />
              <Route path="getting-started/first-call" element={<GettingStarted />} />
              <Route path="quick-start" element={<QuickStart />} />
              <Route path="changelog" element={<Changelog />} />
              <Route path="forum" element={<DeveloperForum />} />
              <Route path="api/aisp" element={<AispReference />} />
              <Route path="api/pisp" element={<PispReference />} />
              <Route path="api/mobile-money" element={<MobileMoneyReference />} />
              <Route path="api/banking" element={<BankingReference />} />
              <Route path="api/transfers" element={<TransfersGuide />} />
              <Route path="api/certificates" element={<CertificateReference />} />
              <Route path="api/webhooks" element={<WebhooksGuide />} />
              <Route path="api/refunds" element={<RefundsReference />} />
              <Route path="api/beneficiaries" element={<BeneficiariesReference />} />
              <Route path="api/settlements" element={<SettlementsReference />} />
              <Route path="api/disputes" element={<DisputesReference />} />
              <Route path="api/exports" element={<ExportsReference />} />
              <Route path="api/risk-audit" element={<RiskAuditReference />} />
              <Route path="gateway/quickstart" element={<GatewayQuickstart />} />
              <Route path="gateway/charges" element={<GatewayChargesGuide />} />
              <Route path="gateway/payouts" element={<GatewayPayoutsGuide />} />
              <Route path="gateway/refunds" element={<GatewayRefundsGuide />} />
              <Route path="gateway/settlements" element={<GatewaySettlementsGuide />} />
              <Route path="gateway/disputes" element={<GatewayDisputesGuide />} />
              <Route path="gateway/webhooks" element={<GatewayWebhooksGuide />} />
              <Route path="gateway/payment-links" element={<GatewayPaymentLinksGuide />} />
              <Route path="gateway/subscriptions" element={<GatewaySubscriptionsGuide />} />
              <Route path="gateway/split-payments" element={<GatewaySplitPaymentsGuide />} />
              <Route path="gateway/tokenization" element={<GatewayTokenizationGuide />} />
              <Route path="gateway/charge-events" element={<GatewayChargeEventsGuide />} />
              <Route path="gateway/virtual-accounts" element={<GatewayVirtualAccountsGuide />} />
              <Route path="gateway/merchant-wallet" element={<GatewayMerchantWalletGuide />} />
              <Route path="gateway/verification" element={<GatewayVerificationGuide />} />
              <Route path="gateway/funding" element={<GatewayFundingGuide />} />
              <Route path="gateway/funding-intents" element={<FundingIntentsGuide />} />
              <Route path="gateway/wallets" element={<WalletsGuide />} />
              <Route path="gateway/escrow" element={<EscrowGuide />} />
              <Route path="gateway/compliance" element={<ComplianceScreeningGuide />} />
              <Route path="gateway/instant-payouts" element={<InstantPayoutsGuide />} />
              <Route path="gateway/treasury" element={<TreasuryGuide />} />
              <Route path="gateway/webhooks-v2" element={<WebhooksV2Guide />} />
              <Route path="gateway/sla" element={<SLAMonitorGuide />} />
              <Route path="sla" element={<SLAPage />} />
              <Route path="api/error-codes" element={<ErrorCodesReference />} />
              <Route path="api/rate-limits" element={<RateLimitsGuide />} />
              <Route path="api/idempotency" element={<IdempotencyGuide />} />
              <Route path="api/currencies" element={<SupportedCurrenciesPage />} />
              <Route path="api/countries" element={<SupportedCountriesPage />} />
              <Route path="api/testing" element={<TestingGuide />} />
              <Route path="status" element={<ApiStatusPage />} />
              <Route path="gateway/paypal" element={<PayPalIntegrationGuide />} />
              <Route path="payment-facilitation" element={<PaymentFacilitationDev />} />
              <Route path="examples" element={<CodeExamples />} />
              <Route path="examples/real-world" element={<RealWorldExamples />} />
              <Route path="examples/:slug" element={<RealWorldExampleDetail />} />
              <Route path="guides/web" element={<WebIntegration />} />
              <Route path="guides/mobile" element={<MobileIntegration />} />
              <Route path="guides/sdks" element={<SDKsPage />} />
              <Route path="api-explorer" element={<ApiExplorer />} />
              <Route path="api-explorer-static" element={<ApiExplorerStatic />} />
              <Route path="redoc" element={<RedocPage />} />
              <Route path="redoc-sandbox" element={<RedocPage />} />
              <Route path="docs-health" element={<DocsHealth />} />
              {/* Plug-and-play aliases for common developer paths */}
              <Route path="swagger" element={<ApiExplorer />} />
              <Route path="openapi" element={<OpenApiDownloads />} />
              <Route path="reference" element={<RedocPage />} />
              <Route path="docs" element={<Navigate to="/developer/getting-started" replace />} />
              <Route path="quickstart" element={<Navigate to="/developer/getting-started" replace />} />
              <Route path="ai-integration-guide" element={<AIIntegrationGuide />} />
              <Route path="api-directory-submissions" element={<ApiDirectorySubmissions />} />
              <Route path="integration-workflow" element={<IntegrationWorkflow />} />
              <Route path="merchants-pos" element={<MerchantsPOSGuide />} />
              <Route path="getting-started-by-type" element={<GettingStartedByType />} />
              <Route path="identity-guide" element={<IdentityGuide />} />
              <Route path="onboarding-guide" element={<OnboardingGuide />} />
              <Route path="roles-permissions" element={<RolesPermissions />} />
              <Route path="compare" element={<CompetitiveComparison />} />
              <Route path="migrate" element={<MigrationGuide />} />
              <Route path="pay-by-bank" element={<PayByBankGuide />} />
              {/* New documentation pages */}
              <Route path="authentication" element={<AuthenticationOverview />} />
              <Route path="authentication/api-keys" element={<AuthApiKeys />} />
              <Route path="authentication/oauth2" element={<AuthOAuth2 />} />
              <Route path="authentication/fapi" element={<AuthFapi />} />
              <Route path="authentication/mtls" element={<AuthMtls />} />
              <Route path="sdks" element={<Navigate to="/developer/guides/sdks" replace />} />
              <Route path="sandbox" element={<Navigate to="/developer/sandbox/overview" replace />} />
              <Route path="sandbox/overview" element={<SandboxOverview />} />
              <Route path="sandbox/credentials" element={<SandboxCredentials />} />
              <Route path="sandbox/test-cards" element={<SandboxTestCards />} />
              <Route path="sandbox/mobile-money" element={<SandboxMobileMoney />} />
              <Route path="sandbox/console" element={<SandboxConsole />} />
              <Route path="sandbox/simulate-webhooks" element={<SandboxSimulateWebhooks />} />
              <Route path="api-playground" element={<ApiPlayground />} />
              <Route path="api-reference" element={<ApiReferenceOverview />} />
              <Route path="api-reference/errors" element={<ErrorCodesReference />} />
              <Route path="api-reference/pagination" element={<ApiReferencePagination />} />
              <Route path="api-reference/rate-limits" element={<RateLimitsGuide />} />
              <Route path="api-reference/versioning" element={<ApiReferenceVersioning />} />
              <Route path="api-reference/idempotency" element={<IdempotencyGuide />} />
              <Route path="api-reference/token-lifecycle" element={<TokenLifecycleGuide />} />
              <Route path="api-reference/webhook-retry" element={<WebhookRetryGuide />} />
              <Route path="api-reference/http-caching" element={<HttpCachingGuide />} />
              <Route path="open-banking" element={<OpenBankingOverview />} />
              <Route path="open-banking/aisp" element={<AispReference />} />
              <Route path="open-banking/pisp" element={<PispReference />} />
              <Route path="open-banking/consents" element={<OpenBankingConsents />} />
              <Route path="open-banking/pay-by-bank" element={<PayByBankGuide />} />
              <Route path="mobile-money" element={<MobileMoneyOverview />} />
              <Route path="mobile-money/mtn" element={<MtnMomoGuide />} />
              <Route path="mobile-money/orange" element={<OrangeMoneyGuide />} />
              <Route path="connectors/byo-mobile-money" element={<ByoMobileMoneyGuide />} />
              <Route path="connectors/polling-and-webhooks" element={<PollingAndWebhooks />} />
              <Route path="connectors/soap-bank-adapter" element={<SoapBankAdapter />} />
              <Route path="connectors/multi-rail-failover" element={<MultiRailFailover />} />
              <Route path="connectors/bank-adapter-framework" element={<BankAdapterFramework />} />
              <Route path="connectors/bank-onboarding-flow" element={<BankOnboardingFlow />} />
              <Route path="connectors/cemac-bank-integration" element={<CemacBankIntegration />} />
              <Route path="connectors/cemac-bank-catalog" element={<CemacBankCatalog />} />
              <Route path="compliance/kyc" element={<ComplianceKyc />} />
              <Route path="compliance/aml" element={<ComplianceAml />} />
              <Route path="compliance/fapi" element={<ComplianceFapi />} />
              <Route path="iso20022" element={<Iso20022Overview />} />
              <Route path="iso20022/messages" element={<Iso20022Messages />} />
              <Route path="guides/go-live" element={<GoLiveChecklist />} />
              <Route path="guides/postman" element={<PostmanGuide />} />
              <Route path="guides/migrate" element={<MigrationGuide />} />
              <Route path="guides/webhooks" element={<Navigate to="/developer/api-reference/webhook-retry" replace />} />
              <Route path="playground" element={<Navigate to="/developer/api-playground" replace />} />
              <Route path="access-policy" element={<AccessPolicy />} />
              <Route path="register" element={<DeveloperRegistration />} />
              <Route path="support" element={<DeveloperSupport />} />
              <Route path="security" element={<SecurityCompliancePage />} />
              <Route path="compliance" element={<SecurityCompliancePage />} />
              <Route path="gateway/tokenisation" element={<GatewayTokenizationGuide />} />
              <Route path="gateway/reconciliation" element={<GatewaySettlementsGuide />} />
              <Route path="widgets" element={<WidgetSDKPage />} />
              <Route path="open-banking/standards" element={<OpenBankingStandards />} />
              <Route path="bank-onboarding" element={<BankOnboardingGuide />} />
              <Route path="test-report" element={<TestReport />} />
              {/* Remittance API Docs */}
              <Route path="remittance" element={<DevRemittanceOverview />} />
              <Route path="remittance/corridors-quotes" element={<DevRemittanceCorridorsQuotes />} />
              <Route path="remittance/create-transfer" element={<DevRemittanceCreateTransfer />} />
              <Route path="remittance/payin-methods" element={<DevRemittancePayinMethods />} />
              <Route path="remittance/payout-methods" element={<DevRemittancePayoutMethods />} />
              <Route path="remittance/webhooks" element={<DevRemittanceWebhooks />} />
              <Route path="remittance/sandbox" element={<DevRemittanceSandbox />} />
              <Route path="remittance/errors" element={<DevRemittanceErrors />} />
              {/* Phase 10 — Redirect aliases for legacy / cross-portal references (keep URLs working, preserve Public Mandate) */}
              <Route path="api-keys" element={<Navigate to="/developer-tools/api-keys" replace />} />
              <Route path="console" element={<Navigate to="/developer-tools/console" replace />} />
              <Route path="api-testing" element={<Navigate to="/developer-tools/api-testing" replace />} />
              <Route path="certificates" element={<Navigate to="/developer-tools/certificates" replace />} />
              <Route path="sandbox/webhook-testing" element={<Navigate to="/developer-tools/sandbox/webhook-testing" replace />} />
              <Route path="sandbox/data-generator" element={<Navigate to="/developer-tools/sandbox/data-generator" replace />} />
              <Route path="sandbox/webhooks" element={<Navigate to="/developer-tools/sandbox/webhooks" replace />} />
              <Route path="auth/api-keys" element={<Navigate to="/developer/authentication/api-keys" replace />} />
              <Route path="gateway/authentication" element={<Navigate to="/developer/authentication" replace />} />
              <Route path="go-live" element={<Navigate to="/developer/guides/go-live" replace />} />
              <Route path="guides/authentication" element={<Navigate to="/developer/authentication" replace />} />
              <Route path="guides/charges" element={<Navigate to="/developer/gateway/charges" replace />} />
              <Route path="guides/roles-permissions" element={<Navigate to="/developer/roles-permissions" replace />} />
              <Route path="guides/token-lifecycle" element={<Navigate to="/developer/api-reference/token-lifecycle" replace />} />
              <Route path="onboarding" element={<Navigate to="/developer/onboarding-guide" replace />} />
              <Route path="reference/error-codes" element={<Navigate to="/developer/api-reference/errors" replace />} />
              <Route path="reference/idempotency" element={<Navigate to="/developer/api-reference/idempotency" replace />} />
              <Route path="webhooks" element={<Navigate to="/developer/gateway/webhooks" replace />} />
              <Route path="*" element={<NestedNotFound portalName="Developer Portal" homePath="/developer" />} />
            </Route>

            {/* Protected Developer Tools — auth + role required */}
            <Route path="/developer-tools" element={<ProtectedRoute><RoleGuard allowedRoles={['developer', 'tpp']} redirectTo="/dashboard"><DeveloperLayout /></RoleGuard></ProtectedRoute>}>
              <Route path="sandbox" element={<Sandbox />} />
              <Route path="sandbox/usage" element={<SandboxUsage />} />
              <Route path="sandbox/webhooks" element={<SandboxWebhooks />} />
              <Route path="sandbox/webhook-testing" element={<WebhookTesting />} />
              <Route path="sandbox/data-generator" element={<SandboxDataGenerator />} />
              <Route path="sandbox/payout-simulation" element={<SandboxPayoutSimGuide />} />
              <Route path="api-playground" element={<ApiPlayground />} />
              <Route path="api-testing" element={<ApiTesting />} />
              <Route path="playground" element={<Playground />} />
              <Route path="console" element={<ApiConsole />} />
              <Route path="certificates" element={<CertificateManagement />} />
              <Route path="api-keys" element={<ApiKeys />} />
            </Route>
            <Route path="/for-developers" element={<Layout><ForDevelopers /></Layout>} />
            <Route path="/for-merchants" element={<Layout><ForMerchants /></Layout>} />
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
            <Route path="/kob-pos" element={<Layout><KobPOS /></Layout>} />

            {/* Solution Pages */}
            <Route path="/solutions/fintech-developers" element={<Layout><FintechDevelopers /></Layout>} />
            <Route path="/solutions/mobile-money-integration" element={<Layout><MobileMoneyIntegration /></Layout>} />
            <Route path="/solutions/credit-scoring" element={<Layout><CreditScoring /></Layout>} />
            <Route path="/products/byo-mobile-money" element={<Layout><ByoMobileMoney /></Layout>} />
            
            {/* Widget standalone routes - public */}
            <Route path="/widgets/payment" element={<EmbeddablePaymentWidget />} />
            <Route path="/widgets/bank-connect" element={<EmbeddableBankConnectWidget />} />
            <Route path="/widgets/verify" element={<EmbeddableVerificationWidget />} />

            {/* Bank Dashboard - redirects to fi-portal */}
            <Route path="/bank-dashboard" element={<Navigate to="/fi-portal/banking" replace />} />
            <Route path="/bank-dashboard/*" element={<Navigate to="/fi-portal/banking" replace />} />

            <Route path="/developer-old" element={<Navigate to="/developer" replace />} />
            <Route path="/tpp-registration" element={<Layout><ProtectedRoute><TPPRegistration /></ProtectedRoute></Layout>} />
            <Route path="/consents" element={<Layout><ProtectedRoute><ConsentManagement /></ProtectedRoute></Layout>} />
            <Route path="/analytics" element={<Layout><ProtectedRoute><Analytics /></ProtectedRoute></Layout>} />
            <Route path="/monitoring" element={<Layout><ProtectedRoute requiredRole="admin"><SystemMonitoring /></ProtectedRoute></Layout>} />
            
            {/* User Dashboard Routes - Nested with DashboardLayout */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
            
            {/* Personal Dashboard (only for non-institution, non-personal-restricted users) */}
            <Route path="/personal-dashboard" element={<ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><DashboardLayout /></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
            </Route>
            <Route path="/security" element={<ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><DashboardLayout><SecuritySettings /></DashboardLayout></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><DashboardLayout><NotificationPreferences /></DashboardLayout></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/notification-history" element={<ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><DashboardLayout><NotificationHistory /></DashboardLayout></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/mobile-money" element={<ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><DashboardLayout><MobileMoney /></DashboardLayout></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><DashboardLayout><Payments /></DashboardLayout></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/personal-accounts" element={<Layout><ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><PersonalAccounts /></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute></Layout>} />
            <Route path="/business-accounts" element={<Layout><ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><BusinessAccounts /></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute></Layout>} />
            <Route path="/savings" element={<ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><DashboardLayout><Savings /></DashboardLayout></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/virtual-cards" element={<ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><DashboardLayout><VirtualCards /></DashboardLayout></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute>} />
            
            {/* CrediQ Routes */}
            <Route path="/crediq" element={<CrediQ />} />
            <Route path="/crediq/info" element={<CrediQInfo />} />
            <Route path="/crediq/onboarding" element={<Layout><ProtectedRoute><NonInstitutionRoute><CrediQOnboarding /></NonInstitutionRoute></ProtectedRoute></Layout>} />
            <Route path="/crediq/dashboard" element={<ProtectedRoute><NonInstitutionRoute><DashboardLayout><CrediQDashboard /></DashboardLayout></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/crediq/settings" element={<Layout><ProtectedRoute><NonInstitutionRoute><CrediQSettings /></NonInstitutionRoute></ProtectedRoute></Layout>} />
            <Route path="/credit-score" element={<ProtectedRoute><NonInstitutionRoute><DashboardLayout><CreditScore /></DashboardLayout></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/credit-report" element={<ProtectedRoute><NonInstitutionRoute><DashboardLayout><CreditReport /></DashboardLayout></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/credit-scores-info" element={<Layout><CreditScoresInfo /></Layout>} />
            <Route path="/credit-api-docs" element={<Layout><CreditAPIDocumentation /></Layout>} />
            <Route path="/kyc-verification" element={<Layout><ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><KYCVerification /></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute></Layout>} />
            <Route path="/banking-ops" element={<ProtectedRoute><NonInstitutionRoute><PersonalAccountRoute><DashboardLayout><BankingOps /></DashboardLayout></PersonalAccountRoute></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><NonInstitutionRoute><DashboardLayout><ProfileSettings /></DashboardLayout></NonInstitutionRoute></ProtectedRoute>} />
            <Route path="/profile-settings" element={<Layout><ProtectedRoute><NonInstitutionRoute><ProfileSettings /></NonInstitutionRoute></ProtectedRoute></Layout>} />
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
            <Route path="/remittance" element={<Layout><RemittanceLanding /></Layout>} />
            <Route path="/manual/:type" element={<Layout><ProductManual /></Layout>} />
            <Route path="/bank-integration-guide" element={<Layout><BankIntegrationGuide /></Layout>} />
            <Route path="/contact" element={<Layout><Contact /></Layout>} />
            <Route path="/faq" element={<Layout><FAQ /></Layout>} />
            <Route path="/help-centre" element={<Layout><HelpCentre /></Layout>} />
            <Route path="/status" element={<Layout><Status /></Layout>} />
            <Route path="/integration-workflow" element={<Layout><IntegrationWorkflow /></Layout>} />
            
            <Route path="/architecture" element={<Layout><Architecture /></Layout>} />
            <Route path="/key-functions" element={<Layout><KeyFunctionsSummary /></Layout>} />
            <Route path="/roi-calculator" element={<Layout><ROICalculator /></Layout>} />
            <Route path="/payment-facilitation" element={<Layout><PaymentFacilitation /></Layout>} />
            <Route path="/pricing" element={<Layout><Pricing /></Layout>} />
            <Route path="/regulatory/readiness" element={<Layout><RegulatoryReadiness /></Layout>} />
            <Route path="/regulatory/kyc-due-diligence" element={<Layout><KycDueDiligence /></Layout>} />
            <Route path="/regulatory/filing-pack" element={<Layout><FilingPackIndex /></Layout>} />
            <Route path="/regulatory/corporate-structure" element={<Layout><CorporateStructure /></Layout>} />
            <Route path="/regulatory/internal-control-policy" element={<Layout><InternalControlPolicy /></Layout>} />
            <Route path="/regulatory/license-application" element={<Layout><LicenseApplicationPage /></Layout>} />
            <Route path="/regulatory/business-continuity" element={<Layout><BusinessContinuityPage /></Layout>} />
            <Route path="/regulatory/aml-cft-pack" element={<Layout><AmlCftPack /></Layout>} />
            <Route path="/regulatory/data-protection-policy" element={<Layout><DataProtectionPolicy /></Layout>} />
            <Route path="/regulatory/technical-disclosure" element={<Layout><TechnicalDisclosure /></Layout>} />
            <Route path="/regulatory/risk-assessment" element={<Layout><RiskAssessmentPage /></Layout>} />
            <Route path="/regulatory/reporting-templates" element={<Layout><ReportingTemplates /></Layout>} />
            <Route path="/regulatory/cameroon-compliance" element={<Layout><CameroonCompliancePage /></Layout>} />
            <Route path="/compliance/aml-policy" element={<Layout><AmlPolicyPage /></Layout>} />
            <Route path="/compliance/kyc-framework" element={<Layout><KycFrameworkPage /></Layout>} />
            <Route path="/compliance/risk-monitoring" element={<Layout><RiskMonitoringPage /></Layout>} />
            <Route path="/architecture/fraud-engine" element={<Layout><FraudEnginePage /></Layout>} />
            <Route path="/architecture/risk-scoring-model" element={<Layout><RiskScoringModelPage /></Layout>} />
            <Route path="/architecture/ledger-system" element={<Layout><LedgerSystemPage /></Layout>} />
            <Route path="/architecture/reconciliation-framework" element={<Layout><ReconciliationFrameworkPage /></Layout>} />
            <Route path="/architecture/settlement-engine" element={<Layout><SettlementEnginePage /></Layout>} />
            <Route path="/architecture/infrastructure" element={<Layout><InfrastructurePage /></Layout>} />
            <Route path="/architecture/disaster-recovery" element={<Layout><DisasterRecoveryPage /></Layout>} />
            <Route path="/expansion/:country" element={<Layout><ExpansionCountryPage /></Layout>} />
            <Route path="/security/incident-response" element={<Layout><IncidentResponsePage /></Layout>} />
            <Route path="/api/versioning" element={<Layout><VersioningPage /></Layout>} />
            <Route path="/api/error-codes" element={<Layout><ErrorCodesPage /></Layout>} />
            <Route path="/api/webhooks" element={<Layout><WebhooksReferencePage /></Layout>} />
            <Route path="/api/idempotency" element={<Layout><IdempotencyPage /></Layout>} />
            <Route path="/api/rate-limits" element={<Layout><RateLimitsPage /></Layout>} />
            <Route path="/api/sandbox-testing" element={<Layout><SandboxTestingPage /></Layout>} />
            <Route path="/api/security" element={<Layout><SecurityReferencePage /></Layout>} />
            <Route path="/investors/technical-overview" element={<Layout><TechnicalOverviewPage /></Layout>} />
            <Route path="/investors/risk-disclosure" element={<Layout><RiskDisclosurePage /></Layout>} />
            <Route path="/investors/compliance-status" element={<Layout><ComplianceStatusPage /></Layout>} />
            <Route path="/investors/infrastructure-maturity" element={<Layout><InfrastructureMaturityPage /></Layout>} />
            <Route path="/certification/a-grade-status" element={<Layout><AGradeStatusPage /></Layout>} />
            <Route path="/sandbox/simulation-tools" element={<Layout><SimulationToolsPage /></Layout>} />
            <Route path="/iso20022" element={<Layout><ProtectedRoute requiredRole="admin"><ISO20022Dashboard /></ProtectedRoute></Layout>} />
            <Route path="/swift" element={<Layout><ProtectedRoute requiredRole="admin"><SWIFTDashboard /></ProtectedRoute></Layout>} />
            <Route path="/piggybank" element={<Layout><PiggyBankInfo /></Layout>} />
            <Route path="/njangi" element={<Layout><NjangiInfo /></Layout>} />
            <Route path="/rent-reporting" element={<Layout><RentReportingInfo /></Layout>} />
            <Route path="/auth" element={<Layout showFooter={false}><Auth /></Layout>} />
            <Route path="/staff-login" element={<StaffLogin />} />
            <Route path="/setup-pin" element={<MandatoryPinSetup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Banking App redirects for legacy /banking-app paths */}
            <Route path="/banking-app/*" element={<Navigate to="/apps" replace />} />
            {/* Banking App PWA Routes */}
            <Route path="/bank/:institutionId" element={<BankSplash />} />
            <Route path="/bank/:institutionId/auth" element={<BankAuth />} />
            <Route path="/bank/:institutionId/reset-password" element={<ResetPassword />} />
            <Route path="/bank/:institutionId/apply" element={<BankApply />} />
            <Route path="/bank/:institutionId/kyc" element={<BankingAppLayout />}><Route index element={<BankKYC />} /></Route>
            <Route path="/bank/:institutionId" element={<BankingAppLayout />}>
              <Route path="home" element={<BankHome />} />
              <Route path="payments" element={<BankPayments />} />
              <Route path="payments/send" element={<BankSendMoney />} />
              <Route path="payments/send-abroad" element={<BankSendAbroad />} />
              <Route path="payments/qr" element={<FeatureGate featureKey="qr_payments"><BankQRPay /></FeatureGate>} />
              <Route path="payments/mobile-money" element={<FeatureGate featureKey="mobile_money"><BankMobileMoney /></FeatureGate>} />
              <Route path="payments/bills" element={<FeatureGate featureKey="bill_payments"><BankBills /></FeatureGate>} />
              <Route path="payments/receive" element={<BankReceive />} />
              <Route path="cards" element={<FeatureGate featureKey="cards"><BankCards /></FeatureGate>} />
              <Route path="history" element={<BankHistory />} />
              <Route path="fund" element={<BankFundAccount />} />
              <Route path="more" element={<BankMore />} />
              <Route path="more/savings" element={<FeatureGate featureKey="savings"><BankSavings /></FeatureGate>} />
              <Route path="more/savings/new" element={<FeatureGate featureKey="savings"><BankNewSavings /></FeatureGate>} />
              <Route path="more/loans" element={<FeatureGate featureKey="loans"><BankLoans /></FeatureGate>} />
              <Route path="more/credit" element={<FeatureGate featureKey="credit_score"><BankCreditScore /></FeatureGate>} />
              <Route path="more/settings" element={<BankSettings />} />
              <Route path="more/alerts" element={<BankAlerts />} />
              <Route path="more/help" element={<BankHelp />} />
              <Route path="more/disputes" element={<BankDisputes />} />
              <Route path="more/remittances" element={<BankRemittances />} />
              <Route path="more/support" element={<BankSupport />} />
            </Route>

            {/* Customer App PWA Routes — unified (no institutionId) */}
            <Route path="/app" element={<CustomerSplash />} />
            <Route path="/app/auth" element={<CustomerAuth />} />
            <Route path="/app/reset-password" element={<ResetPassword />} />
            <Route path="/app/register" element={<CustomerRegister />} />
            <Route path="/app/onboarding" element={<CustomerOnboarding />} />
            {/* Legacy redirect: old institution-scoped URLs */}
            <Route path="/app/:institutionId" element={<Navigate to="/app" replace />} />
            <Route path="/app/:institutionId/*" element={<Navigate to="/app" replace />} />
            <Route path="/app" element={<CustomerAppLayout />}>
              <Route path="home" element={<CustomerHome />} />
              <Route path="activity" element={<CustomerActivity />} />
              <Route path="scan" element={<CustomerScan />} />
              <Route path="cards" element={<CustomerCards />} />
              <Route path="more" element={<CustomerMore />} />
              <Route path="transfer" element={<CustomerTransfer />} />
              <Route path="request" element={<CustomerRequest />} />
              <Route path="bills" element={<CustomerBills />} />
              <Route path="invoices" element={<CustomerInvoices />} />
              <Route path="bank" element={<CustomerBank />} />
              <Route path="split-bills" element={<CustomerSplitBills />} />
              <Route path="pay-links" element={<CustomerPayLinks />} />
              <Route path="cash-out" element={<CustomerCashOut />} />
              <Route path="recurring" element={<CustomerRecurring />} />
              <Route path="rewards" element={<CustomerRewards />} />
              <Route path="piggybank" element={<CustomerPiggyBank />} />
              <Route path="njangi" element={<CustomerNjangi />} />
              <Route path="rent-reporting" element={<CustomerRentReporting />} />
              <Route path="credit" element={<CustomerCreditScore />} />
              <Route path="settings" element={<CustomerSettings />} />
              <Route path="alerts" element={<CustomerAlerts />} />
              <Route path="help" element={<CustomerHelp />} />
              <Route path="linked-accounts" element={<CustomerLinkedAccounts />} />
              <Route path="fund" element={<CustomerFundWallet />} />
              <Route path="travel" element={<CustomerTravelCategories />} />
              <Route path="travel/:category" element={<CustomerTravelAgencies />} />
              <Route path="travel/:category/:serviceId" element={<CustomerTravelTrips />} />
              <Route path="travel/:category/:serviceId/trips/:tripId" element={<CustomerTravelBooking />} />
              <Route path="travel/ticket/:bookingId" element={<CustomerTravelTicket />} />
              <Route path="travel/history" element={<CustomerTravelHistory />} />
              <Route path="stores" element={<CustomerStores />} />
              <Route path="stores/:merchantId" element={<CustomerStoreDetail />} />
              <Route path="cart" element={<CustomerCart />} />
              <Route path="orders" element={<CustomerOrderTracking />} />
              <Route path="disputes" element={<CustomerDisputes />} />
              <Route path="send-money" element={<CustomerSendMoney />} />
              <Route path="remittances" element={<CustomerRemittances />} />
              <Route path="authorize-payment/:intentId" element={<PayByBankApproval />} />
              <Route path="support" element={<CustomerSupport />} />
              <Route path="loyalty" element={<CustomerLoyalty />} />
              <Route path="marketplace" element={<CustomerMarketplace />} />
              <Route path="reviews" element={<CustomerReviews />} />
              <Route path="wishlist" element={<CustomerWishlist />} />
            </Route>

            {/* Business App PWA Routes */}
            <Route path="/biz" element={<BusinessSplash />} />
            <Route path="/biz/auth" element={<BusinessAuth />} />
            <Route path="/biz/register" element={<BusinessRegister />} />
            <Route path="/biz/reset-password" element={<ResetPassword />} />
            <Route path="/biz" element={<UnifiedBusinessLayout />}>
              <Route path="home" element={<BusinessHome />} />
              <Route path="wallet" element={<BusinessWallet />} />
              <Route path="receive" element={<BusinessReceive />} />
              <Route path="orders" element={<BusinessOrders />} />
              <Route path="refunds" element={<BusinessRefunds />} />
              <Route path="fees" element={<MerchantFees />} />
              <Route path="till" element={<BusinessTill />} />
              <Route path="more" element={<BusinessMore />} />
              <Route path="customers" element={<BusinessCustomers />} />
              <Route path="coupons" element={<BusinessCoupons />} />
              <Route path="reviews" element={<BusinessReviews />} />
              <Route path="quick-order" element={<BusinessQuickOrder />} />
              <Route path="products" element={<BusinessProducts />} />
              <Route path="products/new" element={<BusinessProductForm />} />
              <Route path="products/:id" element={<BusinessProductForm />} />
              <Route path="analytics" element={<BusinessAnalytics />} />
              <Route path="advanced-analytics" element={<MerchantAdvancedAnalytics />} />
              <Route path="staff" element={<BusinessStaff />} />
              <Route path="storefront" element={<BusinessStorefront />} />
              <Route path="inventory" element={<BusinessInventory />} />
              <Route path="notifications" element={<NotificationPreferences />} />
              <Route path="notification-history" element={<NotificationHistory />} />
              {/* Travel */}
              <Route path="travel" element={<BusinessTravel />} />
              <Route path="travel/services" element={<BusinessTravelServices />} />
              <Route path="travel/routes" element={<MerchantTravelRoutes />} />
              <Route path="travel/seating" element={<MerchantTravelSeating />} />
              <Route path="travel/timetable" element={<MerchantTravelTimetable />} />
              <Route path="travel/bookings" element={<MerchantTravelBookings />} />
              <Route path="travel/counter-booking" element={<MerchantTravelCounterBooking />} />
              <Route path="travel/scanner" element={<MerchantTravelScanner />} />
              <Route path="travel/discounts" element={<MerchantTravelDiscounts />} />
              <Route path="travel/staff-roles" element={<MerchantTravelStaffRoles />} />
              <Route path="travel/notifications" element={<MerchantTravelNotifications />} />
              {/* Settings & Configuration */}
              <Route path="settings" element={<BusinessSettings />} />
              <Route path="compliance" element={<BusinessCompliance />} />
              <Route path="enterprise" element={<BusinessEnterprise />} />
              <Route path="webhook-logs" element={<BusinessWebhookLogs />} />
              <Route path="disputes" element={<BusinessDisputesPage />} />
              <Route path="support" element={<BusinessSupport />} />
              <Route path="kyb" element={<MerchantKYB />} />
              <Route path="api-keys" element={<MerchantApiKeys />} />
              <Route path="api-key-management" element={<MerchantApiKeyManagement />} />
              <Route path="webhooks" element={<MerchantWebhooks />} />
              <Route path="settlement-accounts" element={<MerchantSettlementAccounts />} />
              <Route path="subaccounts" element={<MerchantSubaccounts />} />
              <Route path="settlements" element={<MerchantSettlements />} />
              <Route path="payouts" element={<MerchantPayouts />} />
              <Route path="fund-wallet" element={<MerchantFundWallet />} />
              <Route path="escrow" element={<MerchantEscrow />} />
              <Route path="bulk-operations" element={<MerchantBulkOperations />} />
              <Route path="transactions" element={<MerchantTransactions />} />
              <Route path="payment-links" element={<MerchantPaymentLinks />} />
              <Route path="subscriptions" element={<MerchantSubscriptions />} />
              <Route path="plans" element={<MerchantPlans />} />
              <Route path="woo-sync" element={<MerchantWooSync />} />
              <Route path="locations" element={<MerchantLocations />} />
              <Route path="branding" element={<MerchantBranding />} />
              <Route path="white-label" element={<MerchantWhiteLabel />} />
              <Route path="profile" element={<MerchantProfile />} />
              <Route path="pos-till" element={<MerchantPOSTill />} />
              {/* Catch-all 404 */}
              <Route path="*" element={<NestedNotFound portalName="Business App" homePath="/biz/home" />} />
            </Route>

            <Route path="/pay/authorize" element={<PayByBankAuthorize />} />
            <Route path="/pay/:slug" element={<PaymentCheckout />} />
            <Route path="*" element={<Layout><NotFound /></Layout>} />
            </Routes>
            </Suspense>
          </TooltipProvider>
          </PWARouteGuard>
        </BrowserRouter>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
