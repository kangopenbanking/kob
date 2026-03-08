
# Phase 3: Multi-Tenancy Merchant/Business Native PWA

This phase will introduce a dedicated, mobile-first PWA for Merchants and Businesses, structured similarly to the existing Customer and Banking PWAs. It will use a modern, bold flat-card UI with strict adherence to color outline icons and seamless integration with the Consumer ecosystem.

## Architectural Approach
- **Routing Namespace:** Introduce `/biz` or `/biz/:merchantId` for the multi-tenant Business App.
- **Layout & Navigation:** Implement `BusinessAppLayout.tsx` utilizing the existing PWA components (`TenantProvider`, `PullToRefresh`, `OfflineIndicator`) and a 5-tab mobile bottom navigation.
- **Design System:** Enforce the "bold flat-card" international aesthetic. No gradients, no emojis. Only Lucide React color outline icons.

## Execution Sprints

### Sprint 1: Core Foundation & Security Framework
- **Scaffolding:** Create the base `/biz` routes in `App.tsx` and the `BusinessAppLayout` shell.
- **Authentication:** Implement PIN-first authentication (matching the Customer app) with Staff/Role-based routing constraints.
- **App Management:** Extend the Admin Portal (`/admin/banking-app-management` equivalent) to allow Super Admins to manage Business App deployments, feature toggles, and URL structures.

### Sprint 2: Business Dashboard & Wallet Operations
- **Overview Dashboard:** High-contrast metric grids with dynamic status badges for daily revenue, pending settlements, and active orders.
- **Wallet Controls:** Implement `PinConfirmDialog` gated wallet operations (Fund Wallet, Request Payout, View Ledgers).
- **Testing Gate:** Validate idempotency on all wallet interactions within the mobile view.

### Sprint 3: Consumer ↔ Business Integration (POS & Payments)
- **Receive Money (QR):** Physically centered "Scan & Receive" tab. Generate static/dynamic QR codes for the Customer App to scan and pay instantly via atomic wallet-to-wallet transfer.
- **Payment Links:** Mobile-friendly generation of payment links with native Web Share API integration.
- **Ticketing & Scanning:** Integrate the ticket/booking scanner for travel and events, directly verifying purchases made on the Customer App.

### Sprint 4: Commerce & Storefront Oversight
- **Order Management:** Real-time push notifications for new POS/Storefront orders.
- **Quick Inventory:** Mobile interface to adjust stock levels or mark items out-of-stock instantly.
- **Dispute & Refund Handling:** Streamlined mobile views to approve or reject customer refunds.

### Sprint 5: End-to-End Testing & Auditing
- **Flow Validation:** Execute full tests covering a Consumer opening their app, scanning a Business QR code, and the Business receiving the push notification and wallet credit.
- **UI Audit:** Ensure 100% compliance with the color outline icon rule and check responsiveness across simulated native mobile viewports.
- **Offline & Cache:** Verify Service Worker caching and offline fallback screens for the Business PWA.

Once you approve this plan, we can immediately begin **Sprint 1** by scaffolding the new Business PWA routes, the application layout, and the PIN-first authentication flow.
