import {
  LayoutDashboard, Activity, ArrowUpDown, Link2, RefreshCw, Users,
  Wallet, DollarSign, Undo2, Key, Webhook, Building2, GitBranch,
  ShieldCheck, AlertTriangle, Store, BarChart3,
} from "lucide-react";

export const merchantNavigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", path: "/merchant", icon: LayoutDashboard },
      { title: "Analytics", path: "/merchant/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Payments",
    items: [
      { title: "Transactions", path: "/merchant/transactions", icon: ArrowUpDown },
      { title: "Payment Links", path: "/merchant/payment-links", icon: Link2 },
      { title: "Subscriptions", path: "/merchant/subscriptions", icon: RefreshCw },
      { title: "Customers", path: "/merchant/customers", icon: Users },
    ],
  },
  {
    title: "Money Out",
    items: [
      { title: "Payouts", path: "/merchant/payouts", icon: Wallet },
      { title: "Settlements", path: "/merchant/settlements", icon: DollarSign },
      { title: "Refunds", path: "/merchant/refunds", icon: Undo2 },
    ],
  },
  {
    title: "Configuration",
    items: [
      { title: "API Keys", path: "/merchant/api-keys", icon: Key },
      { title: "Webhooks", path: "/merchant/webhooks", icon: Webhook },
      { title: "Settlement Accounts", path: "/merchant/settlement-accounts", icon: Building2 },
      { title: "Subaccounts", path: "/merchant/subaccounts", icon: GitBranch },
    ],
  },
  {
    title: "Compliance",
    items: [
      { title: "KYB Status", path: "/merchant/kyb", icon: ShieldCheck },
      { title: "Disputes", path: "/merchant/disputes", icon: AlertTriangle },
    ],
  },
  {
    title: "Settings",
    items: [
      { title: "Business Profile", path: "/merchant/profile", icon: Store },
    ],
  },
];
