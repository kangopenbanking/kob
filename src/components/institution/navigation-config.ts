import {
  LayoutDashboard, Users, Settings, FileText, Activity, Key, Webhook,
  CreditCard, Building2, ArrowUpDown, DollarSign, TrendingUp, ShoppingCart,
  Store, Shield, UserCheck, Wallet, MapPin, Banknote, PiggyBank, BookOpen,
  Receipt, KeyRound, ScrollText, UserPlus, ShieldAlert, Bell, Mail,
  Link2, RefreshCw, GitBranch, Contact, ClipboardList, UserCog, HelpCircle,
  Landmark,
} from "lucide-react";

export const institutionNavigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", path: "/fi-portal", icon: LayoutDashboard, sectionKey: "dashboard" },
      { title: "Analytics", path: "/fi-portal/analytics", icon: Activity, sectionKey: "analytics" },
    ]
  },
  {
    title: "Banking Operations",
    items: [
      { title: "Accounts", path: "/fi-portal/accounts", icon: Wallet, sectionKey: "accounts" },
      { title: "Customer Onboarding", path: "/fi-portal/customer-onboarding", icon: UserPlus, sectionKey: "customer-onboarding" },
      { title: "Branches", path: "/fi-portal/branches", icon: MapPin, sectionKey: "branches" },
      { title: "Loans", path: "/fi-portal/loans", icon: Banknote, sectionKey: "loans" },
      { title: "Savings", path: "/fi-portal/savings", icon: PiggyBank, sectionKey: "savings" },
      { title: "Customers", path: "/fi-portal/customers", icon: UserCheck, sectionKey: "customers" },
      { title: "KYC Verification", path: "/fi-portal/kyc", icon: Shield, sectionKey: "customers" },
    ]
  },
  {
    title: "Payments & Transactions",
    items: [
      { title: "Transactions", path: "/fi-portal/transactions", icon: ArrowUpDown, sectionKey: "transactions" },
      { title: "Payments", path: "/fi-portal/payments", icon: CreditCard, sectionKey: "payments" },
      { title: "Settlement", path: "/fi-portal/settlement", icon: DollarSign, sectionKey: "settlement" },
    ]
  },
  {
    title: "Financial Management",
    items: [
      { title: "Fund Account", path: "/fi-portal/fund-account", icon: Wallet, sectionKey: "accounts" },
      { title: "Beneficiaries", path: "/fi-portal/beneficiaries", icon: Users, sectionKey: "beneficiaries" },
      { title: "Ledger", path: "/fi-portal/ledger", icon: BookOpen, sectionKey: "ledger" },
      { title: "Billing", path: "/fi-portal/billing", icon: Receipt, sectionKey: "billing" },
      { title: "Exchange Rates", path: "/fi-portal/exchange-rates", icon: TrendingUp, sectionKey: "exchange-rates" },
    ]
  },
  {
    title: "Operations & Risk",
    items: [
      { title: "Staff Management", path: "/fi-portal/staff", icon: Users, sectionKey: "staff" },
      { title: "Staff Authorizations", path: "/fi-portal/staff-authorizations", icon: UserCog, sectionKey: "staff-authorizations" },
      { title: "Withdrawal Policies", path: "/fi-portal/withdrawal-policies", icon: Shield, sectionKey: "withdrawal-policies" },
      { title: "Approval Queue", path: "/fi-portal/approvals", icon: ClipboardList, sectionKey: "approvals" },
      { title: "Disputes", path: "/fi-portal/disputes", icon: ShieldAlert, sectionKey: "disputes" },
      { title: "Overdraft Management", path: "/fi-portal/overdraft", icon: TrendingUp, sectionKey: "overdraft" },
      { title: "Incidents", path: "/fi-portal/incidents", icon: ShieldAlert, sectionKey: "incidents" },
      { title: "Alerts", path: "/fi-portal/alerts", icon: Bell, sectionKey: "alerts" },
    ]
  },
  {
    title: "API Management",
    items: [
      { title: "API Clients", path: "/fi-portal/api-clients", icon: Key, sectionKey: "api-clients" },
      { title: "API Keys", path: "/fi-portal/api-keys", icon: Key, sectionKey: "api-clients" },
      { title: "Webhooks", path: "/fi-portal/webhooks", icon: Webhook, sectionKey: "webhooks" },
      { title: "Credit API", path: "/fi-portal/credit-api", icon: TrendingUp, sectionKey: "credit-api" },
      { title: "Documentation", path: "/fi-portal/api-docs", icon: FileText, sectionKey: "api-clients" },
    ]
  },
  {
    title: "Payment Gateway",
    items: [
      { title: "Merchants", path: "/fi-portal/gateway-merchants", icon: Store, sectionKey: "gateway-merchants" },
      { title: "Pay by Bank", path: "/fi-portal/pay-by-bank", icon: Landmark, sectionKey: "payments" },
      { title: "Payment Links", path: "/fi-portal/gateway-payment-links", icon: Link2, sectionKey: "gateway-payment-links" },
      { title: "Subscriptions & Plans", path: "/fi-portal/gateway-subscriptions", icon: RefreshCw, sectionKey: "gateway-subscriptions" },
      { title: "Subaccounts", path: "/fi-portal/gateway-subaccounts", icon: GitBranch, sectionKey: "gateway-subaccounts" },
      { title: "Gateway Customers", path: "/fi-portal/gateway-customers", icon: Contact, sectionKey: "gateway-customers" },
    ]
  },
  {
    title: "E-Commerce",
    items: [
      { title: "WooCommerce", path: "/fi-portal/woocommerce", icon: ShoppingCart, sectionKey: "woocommerce" },
      { title: "Register Store", path: "/integrations/woocommerce-merchant-register", icon: Store, sectionKey: "woocommerce" },
    ]
  },
  {
    title: "Governance & Messaging",
    items: [
      { title: "Consents", path: "/fi-portal/consents", icon: KeyRound, sectionKey: "consents" },
      { title: "Audit Trail", path: "/fi-portal/audit", icon: ScrollText, sectionKey: "audit" },
      { title: "KYB Documents", path: "/business-kyb-submission", icon: FileText, sectionKey: "compliance" },
      { title: "Compliance", path: "/fi-portal/compliance", icon: Shield, sectionKey: "compliance" },
      { title: "Regulatory Reports", path: "/fi-portal/regulatory", icon: FileText, sectionKey: "regulatory" },
      { title: "SWIFT / ISO 20022", path: "/fi-portal/messaging", icon: Mail, sectionKey: "messaging" },
    ]
  },
  {
    title: "Banking Dashboard",
    items: [
      { title: "Bank Overview", path: "/fi-portal/banking", icon: Landmark, sectionKey: "banking" },
      { title: "Connector Setup", path: "/fi-portal/banking/connector-setup", icon: Settings, sectionKey: "banking" },
      { title: "Manual Approvals", path: "/fi-portal/banking/approvals", icon: ClipboardList, sectionKey: "banking" },
      { title: "Bank Customers", path: "/fi-portal/banking/customers", icon: Users, sectionKey: "banking" },
      { title: "Transfer Manager", path: "/fi-portal/banking/transfers", icon: ArrowUpDown, sectionKey: "banking" },
      { title: "Bank Reports", path: "/fi-portal/banking/reports", icon: FileText, sectionKey: "banking" },
      { title: "API Logs", path: "/fi-portal/banking/api-logs", icon: Activity, sectionKey: "banking" },
    ]
  },
  {
    title: "Bank Connector Kit",
    items: [
      { title: "Connector Overview", path: "/fi-portal/connector", icon: Activity, sectionKey: "connector" },
      { title: "Uploads & Imports", path: "/fi-portal/connector/uploads", icon: FileText, sectionKey: "connector" },
      { title: "Mapping Profiles", path: "/fi-portal/connector/mappings", icon: GitBranch, sectionKey: "connector" },
      { title: "Batch Payments", path: "/fi-portal/connector/batches", icon: Banknote, sectionKey: "connector" },
      { title: "Status Files", path: "/fi-portal/connector/status", icon: ClipboardList, sectionKey: "connector" },
      { title: "Reconciliation", path: "/fi-portal/connector/reconciliation", icon: ArrowUpDown, sectionKey: "connector" },
      { title: "Connector Health", path: "/fi-portal/connector/health", icon: Shield, sectionKey: "connector" },
      { title: "Audit Log", path: "/fi-portal/connector/audit", icon: ScrollText, sectionKey: "connector" },
      { title: "Templates & Guides", path: "/fi-portal/connector/templates", icon: BookOpen, sectionKey: "connector" },
      { title: "How It Works", path: "/fi-portal/connector/guide", icon: HelpCircle, sectionKey: "connector" },
      { title: "Onboard New Integration", path: "/fi-portal/connector/onboard", icon: UserPlus, sectionKey: "connector" },
    ]
  },
  {
    title: "Settings",
    items: [
      { title: "Institution Profile", path: "/fi-portal/profile", icon: Building2, sectionKey: "profile" },
      { title: "Team Members", path: "/fi-portal/team", icon: Users, sectionKey: "team" },
      { title: "Settings", path: "/fi-portal/settings", icon: Settings, sectionKey: "settings" },
    ]
  }
];

export const ROLE_TEMPLATES = {
  teller: { label: 'Teller', sections: ['dashboard', 'accounts', 'transactions', 'customers', 'payments', 'approvals'] },
  branch_manager: { label: 'Branch Manager', sections: ['dashboard', 'accounts', 'customer-onboarding', 'branches', 'loans', 'savings', 'customers', 'transactions', 'payments', 'staff', 'staff-authorizations', 'withdrawal-policies', 'approvals', 'overdraft', 'incidents'] },
  compliance_officer: { label: 'Compliance Officer', sections: ['dashboard', 'regulatory', 'audit', 'compliance', 'incidents', 'customers', 'consents'] },
  loan_officer: { label: 'Loan Officer', sections: ['dashboard', 'loans', 'customers', 'accounts', 'ledger', 'overdraft'] },
  it_api_manager: { label: 'IT / API Manager', sections: ['dashboard', 'api-clients', 'webhooks', 'credit-api', 'woocommerce', 'settings'] },
};

export const ALL_PORTAL_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'customer-onboarding', label: 'Customer Onboarding' },
  { key: 'branches', label: 'Branches' },
  { key: 'loans', label: 'Loans' },
  { key: 'savings', label: 'Savings' },
  { key: 'customers', label: 'Customers' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'payments', label: 'Payments' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'beneficiaries', label: 'Beneficiaries' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'billing', label: 'Billing' },
  { key: 'exchange-rates', label: 'Exchange Rates' },
  { key: 'staff', label: 'Staff Management' },
  { key: 'staff-authorizations', label: 'Staff Authorizations' },
  { key: 'withdrawal-policies', label: 'Withdrawal Policies' },
  { key: 'approvals', label: 'Approval Queue' },
  { key: 'overdraft', label: 'Overdraft Management' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'api-clients', label: 'API Clients' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'credit-api', label: 'Credit API' },
  { key: 'woocommerce', label: 'WooCommerce' },
  { key: 'consents', label: 'Consents' },
  { key: 'audit', label: 'Audit Trail' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'regulatory', label: 'Regulatory Reports' },
  { key: 'messaging', label: 'SWIFT / ISO 20022' },
  { key: 'profile', label: 'Institution Profile' },
  { key: 'team', label: 'Team Members' },
  { key: 'settings', label: 'Settings' },
  { key: 'gateway-merchants', label: 'Merchants' },
  { key: 'gateway-payment-links', label: 'Payment Links' },
  { key: 'gateway-subscriptions', label: 'Subscriptions & Plans' },
  { key: 'gateway-subaccounts', label: 'Subaccounts' },
  { key: 'gateway-customers', label: 'Gateway Customers' },
  { key: 'connector', label: 'Bank Connector Kit' },
  { key: 'banking', label: 'Banking Dashboard' },
  { key: 'disputes', label: 'Disputes' },
];
