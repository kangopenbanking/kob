import {
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
      { title: "KYC Verification", path: "/admin/kyc-verification", icon: Shield },
      { title: "Business KYC (KYB)", path: "/admin/business-kyc", icon: Building2 },
      { title: "TPP Registrations", path: "/admin/tpp-registrations", icon: Key },
    ],
  },
  {
    title: "Payments & Settlements",
    items: [
      { title: "Merchant Management", path: "/admin/merchants", icon: Store },
      { title: "Payment Facilitation", path: "/admin/payment-facilitation", icon: CreditCard },
      { title: "Dispute Management", path: "/admin/disputes", icon: Scale },
      { title: "Payout Management", path: "/admin/payouts", icon: Banknote },
      { title: "Funding Management", path: "/admin/funding", icon: Banknote },
      { title: "Reconciliation", path: "/admin/reconciliation", icon: RefreshCw },
    ],
  },
  {
    title: "Management",
    items: [
      { title: "Banking Apps", path: "/admin/banking-apps", icon: CreditCard },
      { title: "Customer Apps", path: "/admin/customer-apps", icon: Smartphone },
      { title: "User Management", path: "/admin/users", icon: Users },
      { title: "Linked Account Requests", path: "/admin/linked-account-requests", icon: ArrowLeftRight },
      { title: "Branch Management", path: "/admin/branches", icon: Building2 },
      { title: "API Clients", path: "/admin/api-clients", icon: Key },
      { title: "Webhooks", path: "/admin/webhooks", icon: Webhook },
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
      { title: "AI Anomaly Detection", path: "/admin/anomaly-detection", icon: AlertTriangle },
    ],
  },
  {
    title: "Security & Compliance",
    items: [
      { title: "Security Monitoring", path: "/admin/security", icon: Shield },
      { title: "Security Dashboard", path: "/admin/security-dashboard", icon: Shield },
      { title: "Fraud Detection", path: "/admin/fraud-detection", icon: Search },
      { title: "Transaction Monitoring", path: "/admin/transactions", icon: Activity },
      { title: "Consent Data Management", path: "/admin/consent-data", icon: DatabaseIcon },
      { title: "Audit Logs", path: "/admin/audit-logs", icon: FileText },
      { title: "Credit Management", path: "/admin/credit-management", icon: DollarSign },
      { title: "Exchange Rates", path: "/admin/exchange-rates", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Configuration",
    items: [
      { title: "System Config", path: "/admin/system-config", icon: Settings },
      { title: "Homepage Hero", path: "/admin/homepage-hero", icon: Palette },
      { title: "Auth Branding", path: "/admin/auth-branding", icon: Palette },
      { title: "Compliance Dashboard", path: "/admin/compliance-dashboard", icon: ScrollText },
      { title: "API Health", path: "/admin/api-health", icon: Activity },
    ],
  },
];
