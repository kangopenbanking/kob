import {
  LayoutDashboard, ArrowUpDown, Link2, RefreshCw, Users,
  Wallet, DollarSign, Undo2, Key, Webhook, Building2, GitBranch,
  ShieldCheck, AlertTriangle, Store, BarChart3, PlusCircle,
  Bus, Map, Grid3X3, Calendar, BookOpen, QrCode, Receipt,
  MapPin, ShoppingCart, CreditCard, Palette, Globe, FileSpreadsheet, LineChart,
  Package, Plug, Monitor, Landmark,
} from "lucide-react";

export const merchantNavigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", path: "/merchant", icon: LayoutDashboard },
      { title: "Analytics", path: "/merchant/analytics", icon: BarChart3 },
      { title: "Advanced Analytics", path: "/merchant/advanced-analytics", icon: LineChart },
      { title: "Fees", path: "/merchant/fees", icon: Receipt },
    ],
  },
  {
    title: "Payments",
    items: [
      { title: "Transactions", path: "/merchant/transactions", icon: ArrowUpDown },
      { title: "Payment Links", path: "/merchant/payment-links", icon: Link2 },
      { title: "Pay by Bank", path: "/merchant/pay-by-bank", icon: Landmark },
      { title: "Subscriptions", path: "/merchant/subscriptions", icon: RefreshCw },
      { title: "Customers", path: "/merchant/customers", icon: Users },
    ],
  },
  {
    title: "Money Out",
    items: [
      { title: "Escrow", path: "/merchant/escrow", icon: ShieldCheck },
      { title: "Fund Wallet", path: "/merchant/fund-wallet", icon: PlusCircle },
      { title: "Payouts", path: "/merchant/payouts", icon: Wallet },
      { title: "Settlements", path: "/merchant/settlements", icon: DollarSign },
      { title: "Refunds", path: "/merchant/refunds", icon: Undo2 },
      { title: "Bulk Operations", path: "/merchant/bulk-operations", icon: FileSpreadsheet },
      { title: "Export Center", path: "/merchant/export-center", icon: FileSpreadsheet },
    ],
  },
  {
    title: "Configuration",
    items: [
      { title: "API Keys", path: "/merchant/api-keys", icon: Key },
      { title: "API Key Management", path: "/merchant/api-key-management", icon: Key },
      { title: "Webhooks", path: "/merchant/webhooks", icon: Webhook },
      { title: "Webhook Deliveries", path: "/merchant/webhooks/deliveries", icon: Webhook },
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
    title: "Travel Services",
    items: [
      { title: "Service Setup", path: "/merchant/travel-services", icon: Bus },
      { title: "Routes & Trips", path: "/merchant/travel-routes", icon: Map },
      { title: "Seating Plans", path: "/merchant/travel-seating", icon: Grid3X3 },
      { title: "Timetable", path: "/merchant/travel-timetable", icon: Calendar },
      { title: "Bookings", path: "/merchant/travel-bookings", icon: BookOpen },
      { title: "Ticket Scanner", path: "/merchant/travel-scanner", icon: QrCode },
    ],
  },
  {
    title: "Storefront",
    items: [
      { title: "Store & Marketplace", path: "/merchant/storefront", icon: Store },
      { title: "Payment Plans", path: "/merchant/plans", icon: CreditCard },
      { title: "WooCommerce Sync", path: "/merchant/woo-sync", icon: ShoppingCart },
    ],
  },
  {
    title: "Point of Sale",
    items: [
      { title: "POS Till", path: "/merchant/pos-till", icon: Monitor },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Locations & Staff", path: "/merchant/locations", icon: MapPin },
    ],
  },
  {
    title: "Enterprise",
    items: [
      { title: "Custom Branding", path: "/merchant/branding", icon: Palette },
      { title: "White-Label", path: "/merchant/white-label", icon: Globe },
    ],
  },
  {
    title: "Settings",
    items: [
      { title: "Business Profile", path: "/merchant/profile", icon: Store },
    ],
  },
];
