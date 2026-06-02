// Per-page quick guide content for the Merchant Portal.
// Each entry powers the in-page help drawer AND the full /merchant/guide/:slug page.
import {
  LayoutDashboard, Receipt, Link2, Users, RefreshCw, Wallet, Banknote, ArrowLeftRight,
  Undo2, Key, Webhook, Download, Building2, Layers, ShieldCheck, MessagesSquare,
  UserCircle, BarChart3, Bus, Map, Armchair, Calendar, BookOpen, ClipboardList,
  Megaphone, Users2, ScanLine, Store, Coins, Receipt as Plan, MapPin, ShoppingBag,
  Palette, KeyRound, Database, Globe, LineChart, Smartphone, Bell, QrCode,
} from "lucide-react";

export interface MerchantGuide {
  slug: string;
  route: string;
  title: string;
  icon: any;
  summary: string;
  steps: string[];
  tips?: string[];
  fullGuide?: string; // deep link to /developer for technical docs
}

export const merchantGuides: MerchantGuide[] = [
  {
    slug: "dashboard",
    route: "/merchant",
    title: "Dashboard",
    icon: LayoutDashboard,
    summary: "Your business at a glance — revenue, transactions, setup progress, and quick actions.",
    steps: [
      "Review the setup checklist at the top — complete each step to go live.",
      "Use Quick Actions to create payment links, fund your wallet, or view transactions.",
      "Track 14-day revenue, success rate, and pending disputes from the main cards.",
      "Click any recent charge to open its full detail sheet.",
    ],
    tips: [
      "Toggle the eye icon to hide wallet balances when sharing your screen.",
      "Setup progress hits 100% only after KYB, API keys, webhooks and a settlement account are all set.",
    ],
  },
  {
    slug: "transactions",
    route: "/merchant/transactions",
    title: "Transactions",
    icon: Receipt,
    summary: "Search, filter and export every charge processed through your account.",
    steps: [
      "Filter by status, channel, date range or amount.",
      "Click a row to inspect provider data, fees and customer info.",
      "Use Export to download CSV/JSON for accounting.",
    ],
  },
  {
    slug: "payment-links",
    route: "/merchant/payment-links",
    title: "Payment Links",
    icon: Link2,
    summary: "Create shareable links to accept one-time or recurring payments without code.",
    steps: [
      "Click 'Create Link', enter amount, currency and description.",
      "Choose if customers can edit the amount or pay recurring.",
      "Copy the URL or QR code and share via WhatsApp, email or social.",
      "Track conversions and revenue per link in the table below.",
    ],
    tips: ["Payment links inherit your branding from Merchant → Branding."],
  },
  {
    slug: "customers",
    route: "/merchant/customers",
    title: "Customers",
    icon: Users,
    summary: "Centralised list of every payer with lifetime value and risk signals.",
    steps: [
      "Search by email, phone or Kang ID.",
      "Open a customer to view transactions, refunds and saved payment methods.",
      "Tag, block or whitelist customers from the actions menu.",
    ],
  },
  {
    slug: "subscriptions",
    route: "/merchant/subscriptions",
    title: "Subscriptions",
    icon: RefreshCw,
    summary: "Recurring billing plans, customer subscriptions and dunning.",
    steps: [
      "Create a plan in Plans first, then assign customers here.",
      "Monitor MRR, churn and upcoming renewals.",
      "Use 'Retry' on failed cycles or pause to keep customers active.",
    ],
  },
  {
    slug: "escrow",
    route: "/merchant/escrow",
    title: "Escrow",
    icon: ShieldCheck,
    summary: "Hold funds in sub-wallets until delivery is confirmed by either party.",
    steps: [
      "Open an escrow case — choose buyer, seller, amount and release conditions.",
      "Funds sit in a locked sub-wallet until both parties confirm.",
      "Dispute opens a case in Disputes for arbitration.",
    ],
  },
  {
    slug: "fund-wallet",
    route: "/merchant/fund-wallet",
    title: "Fund Wallet",
    icon: Wallet,
    summary: "Top up your merchant wallet to cover refunds, payouts and operational fees.",
    steps: [
      "Pick a wallet, enter amount and choose Mobile Money or Bank.",
      "Confirm with your PIN — funds appear in seconds.",
      "Use Transactions to download the funding receipt.",
    ],
  },
  {
    slug: "payouts",
    route: "/merchant/payouts",
    title: "Payouts",
    icon: Banknote,
    summary: "Move money from your wallet to bank accounts or mobile money instantly.",
    steps: [
      "Click 'New Payout', choose destination and amount.",
      "Review fees and ETA, confirm with PIN.",
      "Track status — Pending → Processing → Successful.",
    ],
    tips: ["Failed payouts auto-reverse to your wallet within minutes."],
  },
  {
    slug: "settlements",
    route: "/merchant/settlements",
    title: "Settlements",
    icon: ArrowLeftRight,
    summary: "Automatic batch transfers of successful charges to your settlement account.",
    steps: [
      "Settlements run daily at 02:00 UTC by default.",
      "Open a settlement to see the underlying charges and fees deducted.",
      "Use 'Statement' to download a finance-ready PDF/CSV.",
    ],
  },
  {
    slug: "refunds",
    route: "/merchant/refunds",
    title: "Refunds",
    icon: Undo2,
    summary: "Refund successful charges fully or partially in a few clicks.",
    steps: [
      "Search the charge in Transactions and click Refund, or initiate here.",
      "Choose Full or Partial and enter the reason.",
      "Customer receives an automatic notification once the refund completes.",
    ],
  },
  {
    slug: "api-keys",
    route: "/merchant/api-keys",
    title: "API Keys",
    icon: Key,
    summary: "Generate sandbox & production keys to integrate KOB into your stack.",
    steps: [
      "Click 'Create Key', choose environment (sandbox first).",
      "Copy the secret — it's shown ONCE. Store it in your server-side vault.",
      "Rotate keys regularly; revoke immediately if leaked.",
    ],
    tips: ["Never expose secret keys in mobile apps or browser code."],
    fullGuide: "/developer",
  },
  {
    slug: "webhooks",
    route: "/merchant/webhooks",
    title: "Webhooks",
    icon: Webhook,
    summary: "Real-time HTTPS notifications for payments, refunds, disputes and more.",
    steps: [
      "Add your endpoint URL — must be HTTPS and respond 2xx within 5 seconds.",
      "Pick events to subscribe to (payment.successful, refund.completed, etc).",
      "Copy the signing secret and verify the X-KOB-Signature header on every request.",
      "Use 'Send Test' to fire a sample event, then view Deliveries for live logs.",
    ],
    tips: ["Failed deliveries retry with exponential backoff for up to 24h."],
    fullGuide: "/developer/gateway-webhooks-guide",
  },
  {
    slug: "webhook-deliveries",
    route: "/merchant/webhooks/deliveries",
    title: "Webhook Deliveries",
    icon: Webhook,
    summary: "Inspect every webhook attempt with status, response and retry controls.",
    steps: [
      "Filter by event type or status to debug integration issues.",
      "Click a delivery to see request/response payloads.",
      "Use 'Replay' to re-send any past delivery to your endpoint.",
    ],
  },
  {
    slug: "export-center",
    route: "/merchant/export-center",
    title: "Export Center",
    icon: Download,
    summary: "Schedule large exports without blocking the UI — get them by email when ready.",
    steps: [
      "Pick the report (Transactions, Settlements, Customers...).",
      "Choose date range and format (CSV, XLSX, JSON).",
      "We'll email you a secure download link when the job completes.",
    ],
  },
  {
    slug: "settlement-accounts",
    route: "/merchant/settlement-accounts",
    title: "Settlement Accounts",
    icon: Building2,
    summary: "Where your money lands. Add bank or mobile money destinations.",
    steps: [
      "Click 'Add Account' and choose Bank or Mobile Money.",
      "Enter details — we run a micro-verification to confirm ownership.",
      "Mark one account as Primary; settlements default there.",
    ],
  },
  {
    slug: "subaccounts",
    route: "/merchant/subaccounts",
    title: "Sub-accounts",
    icon: Layers,
    summary: "Split incoming payments across multiple beneficiaries automatically.",
    steps: [
      "Add each beneficiary with a name and settlement destination.",
      "Define split rules: percentage or fixed amount per charge.",
      "Pass the split_id when creating a charge — funds route automatically.",
    ],
  },
  {
    slug: "kyb",
    route: "/merchant/kyb",
    title: "KYB Verification",
    icon: ShieldCheck,
    summary: "Verify your business to go live and unlock production payments.",
    steps: [
      "Upload your business registration, tax ID and proof of address.",
      "Add directors' IDs and beneficial owners.",
      "Submit — typical turnaround is 1–3 business days.",
      "You're notified by email and in-app once approved.",
    ],
    tips: ["You can still test in sandbox without completing KYB."],
  },
  {
    slug: "disputes",
    route: "/merchant/disputes",
    title: "Disputes",
    icon: MessagesSquare,
    summary: "Respond to chargebacks and customer claims with a clear Kanban workflow.",
    steps: [
      "Open a disputed case — review the customer's claim and uploaded evidence.",
      "Submit your defense with receipts, delivery proofs or screenshots.",
      "Track stage: Open → Under Review → Won/Lost.",
    ],
    tips: ["Respond within the SLA shown on each card to avoid auto-loss."],
  },
  {
    slug: "profile",
    route: "/merchant/profile",
    title: "Business Profile",
    icon: UserCircle,
    summary: "Your public-facing business identity used on receipts and checkouts.",
    steps: [
      "Update business name, logo, support contacts and country.",
      "Set default currency and timezone — they apply to all reports.",
      "Add team members and assign roles.",
    ],
  },
  {
    slug: "analytics",
    route: "/merchant/analytics",
    title: "Analytics",
    icon: BarChart3,
    summary: "Revenue, conversion, channel mix and cohort retention at a glance.",
    steps: [
      "Use the date picker top-right to compare any two periods.",
      "Drill into a channel (card, mobile money, bank) to see success rate.",
      "Export any chart as PNG or the underlying data as CSV.",
    ],
  },
  {
    slug: "advanced-analytics",
    route: "/merchant/advanced-analytics",
    title: "Advanced Analytics",
    icon: LineChart,
    summary: "Cohorts, funnels, LTV and forecasting for data-driven teams.",
    steps: [
      "Build a funnel from any event sequence (link viewed → paid).",
      "Run cohort retention by signup month.",
      "Schedule a weekly digest emailed to your team.",
    ],
  },
  {
    slug: "storefront",
    route: "/merchant/storefront",
    title: "Storefront",
    icon: ShoppingBag,
    summary: "Sell products online without building a site — Kang hosts your shop.",
    steps: [
      "Add products with images, prices and stock.",
      "Customise theme colours and your shop URL.",
      "Share the link — every order syncs to Transactions automatically.",
    ],
  },
  {
    slug: "plans",
    route: "/merchant/plans",
    title: "Plans",
    icon: Plan,
    summary: "Reusable pricing plans powering subscriptions.",
    steps: [
      "Create a plan with amount, interval (daily/weekly/monthly/yearly) and trial.",
      "Reference its plan_id when assigning customers in Subscriptions or via API.",
    ],
  },
  {
    slug: "locations",
    route: "/merchant/locations",
    title: "Locations",
    icon: MapPin,
    summary: "Manage physical branches, POS terminals and per-location reporting.",
    steps: [
      "Add a location with address, manager and operating hours.",
      "Assign POS terminals — each charge is tagged with its origin location.",
    ],
  },
  {
    slug: "woo-sync",
    route: "/merchant/woo-sync",
    title: "WooCommerce Sync",
    icon: Globe,
    summary: "Two-way sync with your WordPress + WooCommerce store.",
    steps: [
      "Install the Kang plugin in WordPress and paste your API key.",
      "Toggle sync for products, orders and refunds.",
      "Reconciliation runs hourly — view the report here.",
    ],
    fullGuide: "/developer",
  },
  {
    slug: "branding",
    route: "/merchant/branding",
    title: "Branding",
    icon: Palette,
    summary: "Logo, colours and copy applied to checkouts, receipts and emails.",
    steps: [
      "Upload your logo (SVG or PNG, transparent background recommended).",
      "Pick primary and accent colours; preview updates live.",
      "Customise receipt footer text and support email.",
    ],
  },
  {
    slug: "api-key-management",
    route: "/merchant/api-key-management",
    title: "API Key Management",
    icon: KeyRound,
    summary: "Advanced key lifecycle: scopes, IP allow-lists and audit logs.",
    steps: [
      "Restrict each key to specific scopes (read-only, payments-only...).",
      "Add IP allow-lists for production keys.",
      "Review the audit log — every create/rotate/revoke is recorded.",
    ],
  },
  {
    slug: "bulk-operations",
    route: "/merchant/bulk-operations",
    title: "Bulk Operations",
    icon: Database,
    summary: "Upload CSV files to create payment links, refund or invite customers in bulk.",
    steps: [
      "Download the template for the operation you want to run.",
      "Fill it in and upload — we validate every row before processing.",
      "Track progress and download a results file when done.",
    ],
  },
  {
    slug: "white-label",
    route: "/merchant/white-label",
    title: "White-label",
    icon: Globe,
    summary: "Run Kang under your own domain and brand for your customers.",
    steps: [
      "Add your domain and follow the DNS instructions.",
      "Upload brand assets — they replace Kang's everywhere your users see.",
      "We provision SSL automatically once DNS propagates.",
    ],
  },
  {
    slug: "pos-till",
    route: "/merchant/pos-till",
    title: "POS Till",
    icon: Smartphone,
    summary: "Accept in-person payments from your phone with QR or tap-to-pay.",
    steps: [
      "Enter the amount, optionally add a description.",
      "Show the QR or tap the customer's card/phone.",
      "Receipt appears instantly; sync to your accounting via Transactions.",
    ],
  },
  {
    slug: "fees",
    route: "/merchant/fees",
    title: "Fees",
    icon: Coins,
    summary: "Transparent breakdown of every fee category that applies to you.",
    steps: [
      "Browse fees by channel (card, mobile money, bank, payout, FX).",
      "Use the calculator to estimate net amount on a sample charge.",
    ],
  },
  {
    slug: "pay-by-bank",
    route: "/merchant/pay-by-bank",
    title: "Pay by Bank",
    icon: Banknote,
    summary: "Open-banking-powered payments — customers pay direct from their bank.",
    steps: [
      "Enable Pay-by-Bank in your checkout from this page.",
      "Customers pick their bank, authenticate, and funds settle to you the next day.",
      "Lower fees than cards; great for high-ticket items.",
    ],
    fullGuide: "/developer",
  },
  {
    slug: "qr-acceptance",
    route: "/merchant/qr-acceptance",
    title: "QR Acceptance",
    icon: QrCode,
    summary: "Generate static or dynamic QR codes for in-person collection.",
    steps: [
      "Pick Static (print and reuse) or Dynamic (one-off, amount-bound).",
      "Download as PNG/PDF or share a link.",
      "Every scan creates a charge tagged with the QR id.",
    ],
  },
  {
    slug: "notification-history",
    route: "/merchant/notification-history",
    title: "Notifications",
    icon: Bell,
    summary: "Every email, SMS and push notification sent on your behalf.",
    steps: [
      "Filter by channel, recipient or template.",
      "Re-send a notification if your customer reports they didn't receive it.",
    ],
  },
  // ───────── Travel Services ─────────
  { slug: "travel-services", route: "/merchant/travel-services", title: "Travel Services", icon: Bus, summary: "Set up your transport company on Kang.", steps: ["Create your company profile with logo, contact and service type.", "Add staff roles and routes once the profile is live."] },
  { slug: "travel-routes", route: "/merchant/travel-routes", title: "Routes", icon: Map, summary: "Define the routes you operate with stops and pricing.", steps: ["Add origin, destination and intermediate stops.", "Set base price; surge rules can be added later."] },
  { slug: "travel-seating", route: "/merchant/travel-seating", title: "Seating Plans", icon: Armchair, summary: "Design seat maps once and reuse across vehicles.", steps: ["Drag-drop seats on the canvas.", "Mark reserved, VIP or accessibility seats.", "Assign the plan to vehicles in Routes."] },
  { slug: "travel-timetable", route: "/merchant/travel-timetable", title: "Timetable", icon: Calendar, summary: "Schedule departures across routes.", steps: ["Pick a route and add departure times.", "Recurring schedules supported (daily, weekdays, weekends).", "Publish — slots appear in customer-facing search."] },
  { slug: "travel-bookings", route: "/merchant/travel-bookings", title: "Bookings", icon: BookOpen, summary: "Live list of seats sold with passenger info.", steps: ["Filter by date, route or status.", "Open a booking to refund, reseat or print the ticket."] },
  { slug: "travel-counter-booking", route: "/merchant/travel-counter-booking", title: "Counter Booking", icon: ClipboardList, summary: "Sell tickets at your physical counter in under 30 seconds.", steps: ["Pick route + departure.", "Tap a seat and enter passenger name/phone.", "Collect cash or scan customer QR; ticket prints/sends instantly."] },
  { slug: "travel-discounts", route: "/merchant/travel-discounts", title: "Discounts & Promos", icon: Megaphone, summary: "Coupons, loyalty discounts and seasonal promos.", steps: ["Create a code with discount % or fixed amount.", "Set usage limits and validity window.", "Share — track redemptions live."] },
  { slug: "travel-notifications", route: "/merchant/travel-notifications", title: "Travel Notifications", icon: Bell, summary: "Automated SMS/email to passengers (boarding, delays, cancellations).", steps: ["Toggle templates on/off.", "Customise wording and language.", "Delivery reports are kept for 90 days."] },
  { slug: "travel-staff-roles", route: "/merchant/travel-staff-roles", title: "Staff Roles", icon: Users2, summary: "Invite drivers, counter staff and scanners with scoped permissions.", steps: ["Add staff by phone/email.", "Pick a role (Counter, Driver, Scanner, Manager).", "They log in via the dedicated Staff Portal."] },
  { slug: "travel-scanner", route: "/merchant/travel-scanner", title: "Boarding Scanner", icon: ScanLine, summary: "Scan boarding QR codes from your phone — instant validation.", steps: ["Open scanner — point camera at the customer ticket QR.", "Green = boarded, red = invalid/already-used.", "Works offline; syncs when back online."] },
  { slug: "travel-guide", route: "/merchant/travel-guide", title: "Travel Operations Guide", icon: BookOpen, summary: "End-to-end manual for your transport operations on Kang.", steps: ["Read each section in order before going live.", "Bookmark common workflows for your team."] },
  // Catch-all
  { slug: "register", route: "/merchant-register", title: "Merchant Registration", icon: Store, summary: "Create your merchant account in under 5 minutes.", steps: ["Enter business name, country and contact info.", "Confirm your email and phone.", "You'll land in the Merchant Portal — start with KYB."] },
];

export function findGuideForRoute(pathname: string): MerchantGuide | undefined {
  // Exact match first
  const exact = merchantGuides.find(g => g.route === pathname);
  if (exact) return exact;
  // Longest-prefix
  return merchantGuides
    .filter(g => g.route !== "/merchant" && pathname.startsWith(g.route))
    .sort((a, b) => b.route.length - a.route.length)[0]
    ?? merchantGuides.find(g => g.slug === "dashboard");
}
