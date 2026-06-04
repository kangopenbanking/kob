import {
  Send,
  Receipt,
  Globe,
  Languages,
  Smartphone,
  Palette,
  LayoutDashboard,
  Users,
  Settings,
  Shield,
  Activity,
  FileText,
  Webhook,
  DollarSign,
  Key,
  Database,
  AlertTriangle,
  ScrollText,
  Building2,
  Mail,
  CreditCard,
  Database as DatabaseIcon,
  ShoppingCart,
  Scale,
  RefreshCw,
  Banknote,
  Search,
  ArrowLeftRight,
  BarChart3,
  FileCode,
  Store,
  Link2,
  CheckCircle2,
  Landmark,
  MessageCircle,
  Plug,
  Lock,
  Code2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  title: string;
  path: string;
  icon: LucideIcon;
}

export interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

export const adminNavigation: AdminNavSection[] = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", path: "/admin", icon: LayoutDashboard },
      { title: "Fee Management", path: "/admin/fee-management", icon: DollarSign },
      { title: "System Monitoring", path: "/admin/system-monitoring", icon: Activity },
      { title: "System Alerts", path: "/admin/system-alerts", icon: AlertTriangle },
      { title: "Revenue Analytics", path: "/admin/revenue", icon: BarChart3 },
    ],
  },
  {
    title: "Registration & Verification",
    items: [
      { title: "Institution Verification", path: "/admin/institution-verification", icon: Shield },
      { title: "Institution Management", path: "/admin/institution-management", icon: Building2 },
      { title: "KYC Verification", path: "/admin/kyc-verification", icon: Shield },
      { title: "Business KYC (KYB)", path: "/admin/business-kyc", icon: Building2 },
      { title: "KYB Review Queue", path: "/admin/kyb-review-queue", icon: CheckCircle2 },
      { title: "Loan Review Queue", path: "/admin/loan-review-queue", icon: CheckCircle2 },
      { title: "Savings Anomaly Queue", path: "/admin/savings-anomaly-queue", icon: CheckCircle2 },
      { title: "TPP Registrations", path: "/admin/tpp-registrations", icon: Key },
      { title: "Onboarding Queue", path: "/admin/onboarding-management", icon: CheckCircle2 },
    ],
  },
  {
    title: "Payments & Settlements",
    items: [
      { title: "Merchant Management", path: "/admin/merchants", icon: Store },
      { title: "Merchant Wallets", path: "/admin/merchant-wallet-oversight", icon: Banknote },
      { title: "Payment Facilitation", path: "/admin/payment-facilitation", icon: CreditCard },
      { title: "Dispute Management", path: "/admin/disputes", icon: Scale },
      { title: "Payout Management", path: "/admin/payouts", icon: Banknote },
      { title: "Funding Management", path: "/admin/funding", icon: Banknote },
      { title: "Reconciliation", path: "/admin/reconciliation", icon: RefreshCw },
      { title: "Settlement Approval", path: "/admin/settlement-approval", icon: CheckCircle2 },
      { title: "Invoice Management", path: "/admin/invoice-management", icon: Receipt },
      { title: "Payment Command Center", path: "/admin/payment-command-center", icon: Activity },
      { title: "Tenant Connectors (BYO)", path: "/admin/tenant-connectors", icon: Plug },
      { title: "QR Payments Audit", path: "/admin/qr-payments-audit", icon: ScrollText },
      { title: "Pay-by-Bank Inspector", path: "/admin/pay-by-bank-inspector", icon: Landmark },
      { title: "Capture-attempt Audit", path: "/admin/capture-events", icon: Shield },
    ],
  },
  {
    title: "Management",
    items: [
      { title: "Access & Roles", path: "/admin/access-roles", icon: Key },
      { title: "Banking Apps", path: "/admin/banking-apps", icon: CreditCard },
      { title: "Customer Apps", path: "/admin/customer-apps", icon: Smartphone },
      { title: "User Management", path: "/admin/users", icon: Users },
      { title: "Linked Account Requests", path: "/admin/linked-account-requests", icon: ArrowLeftRight },
      { title: "Branch Management", path: "/admin/branches", icon: Building2 },
      { title: "API Clients", path: "/admin/api-clients", icon: Key },
      { title: "Developer Management", path: "/admin/developer-management", icon: Code2 },
      { title: "Webhooks", path: "/admin/webhooks", icon: Webhook },
      { title: "Webhook Deliveries", path: "/admin/webhook-deliveries", icon: Webhook },
      { title: "Communications", path: "/admin/communications", icon: Mail },
      { title: "Email Templates", path: "/admin/email-templates", icon: FileCode },
      { title: "Managed Emails", path: "/admin/managed-emails", icon: Mail },
      { title: "WooCommerce Plugin", path: "/admin/woocommerce-plugin", icon: ShoppingCart },
      { title: "Sandbox", path: "/admin/sandbox", icon: Database },
      { title: "Institution App URLs", path: "/admin/institution-urls", icon: Link2 },
    ],
  },
  {
    title: "API & Performance",
    items: [
      { title: "API Testing", path: "/admin/api-testing", icon: Activity },
      { title: "API Performance", path: "/admin/api-performance", icon: Activity },
      { title: "Rate Limiting", path: "/admin/rate-limits", icon: Shield },
      { title: "API Documentation", path: "/admin/api-docs", icon: FileText },
      { title: "Load Testing", path: "/admin/load-testing", icon: Activity },
      { title: "Health Monitoring", path: "/admin/health", icon: Activity },
      { title: "AI Anomaly Detection", path: "/admin/anomaly-detection", icon: AlertTriangle },
      { title: "Deployment Status", path: "/developer/deployment-status", icon: Activity },
      { title: "Environment Variables", path: "/developer/env-vars", icon: FileText },
    ],
  },
  {
    title: "Security & Compliance",
    items: [
      { title: "Security Monitoring", path: "/admin/security", icon: Shield },
      { title: "Security Dashboard", path: "/admin/security-dashboard", icon: Shield },
      { title: "RLS Monitoring", path: "/admin/rls-monitoring", icon: Lock },
      { title: "PIN Lockout", path: "/admin/pin-lockout", icon: Key },
      { title: "Fraud Detection", path: "/admin/fraud-detection", icon: Search },
      { title: "Transaction Monitoring", path: "/admin/transactions", icon: Activity },
      { title: "Consent Data Management", path: "/admin/consent-data", icon: DatabaseIcon },
      { title: "Audit Logs", path: "/admin/audit-logs", icon: FileText },
      { title: "Audit Trail Viewer", path: "/admin/audit-trail", icon: ScrollText },
      { title: "Credit Management", path: "/admin/credit-management", icon: DollarSign },
      { title: "Exchange Rates", path: "/admin/exchange-rates", icon: ArrowLeftRight },
      { title: "Bill Management", path: "/admin/bill-management", icon: Receipt },
    ],
  },
  {
    title: "E-Commerce & POS",
    items: [
      { title: "Business App Management", path: "/admin/business-app-management", icon: Smartphone },
      { title: "Marketplace", path: "/admin/marketplace", icon: Store },
      { title: "Storefront Moderation", path: "/admin/marketplace-moderation", icon: Shield },
    ],
  },
  {
    title: "Remittance (RaaS)",
    items: [
      { title: "Remittance Overview", path: "/admin/remittance-overview", icon: Globe },
      { title: "Partners & Corridors", path: "/admin/remittance-partners", icon: Building2 },
      { title: "Bank Confirmations", path: "/admin/remittance-bank-confirmations", icon: CheckCircle2 },
      { title: "Settlements & Recon", path: "/admin/remittance-settlements", icon: ArrowLeftRight },
      { title: "Outbound Transfers", path: "/admin/remittance-outbound", icon: Send },
      { title: "Pay by Bank", path: "/admin/pay-by-bank", icon: Landmark },
    ],
  },
  {
    title: "Interbank Engine",
    items: [
      { title: "Interbank Payments", path: "/admin/interbank-payments", icon: ArrowLeftRight },
      { title: "Bank Directory", path: "/admin/bank-directory", icon: Building2 },
      { title: "Bank Onboarding", path: "/admin/bank-onboarding", icon: CheckCircle2 },
      { title: "Bank Operations Monitor", path: "/admin/bank-operations", icon: Activity },
    ],
  },
  {
    title: "Transport & Tourism",
    items: [
      { title: "Travel Management", path: "/admin/travel-management", icon: Activity },
    ],
  },
  {
    title: "Rewards",
    items: [
      { title: "Rewards & Referrals", path: "/admin/rewards-management", icon: DollarSign },
    ],
  },
  {
    title: "Support",
    items: [
      { title: "Live Support", path: "/admin/support-chat", icon: MessageCircle },
      { title: "Departments", path: "/admin/support-departments", icon: Settings },
      { title: "Agents", path: "/admin/support-agents", icon: Settings },
      { title: "Support Settings", path: "/admin/support-settings", icon: Settings },
    ],
  },
  {
    title: "Configuration",
    items: [
      { title: "System Config", path: "/admin/system-config", icon: Settings },
      { title: "OTP Providers", path: "/admin/otp-providers", icon: Smartphone },
      { title: "Supported Countries", path: "/admin/supported-countries", icon: Globe },
      { title: "Homepage Hero", path: "/admin/homepage-hero", icon: Palette },
      { title: "Bottom Navigation", path: "/admin/bottom-nav", icon: Palette },
      { title: "Auth Branding", path: "/admin/auth-branding", icon: Palette },
      { title: "Translations", path: "/admin/translations", icon: Languages },
      { title: "Compliance Dashboard", path: "/admin/compliance-dashboard", icon: ScrollText },
      { title: "API Health", path: "/admin/api-health", icon: Activity },
    ],
  },
];
