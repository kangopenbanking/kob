/**
 * Email Template Manifest
 *
 * Single source of truth for all transactional and auth email templates
 * registered in the platform, their trigger conditions, required template
 * variables, and a representative sample payload used by the admin
 * "Send Test Email" suite.
 *
 * Keep this file in sync with:
 *   supabase/functions/_shared/transactional-email-templates/registry.ts
 *   supabase/functions/_shared/email-templates/*.tsx (auth)
 */

export type EmailCategory =
  | "auth"
  | "account"
  | "payments"
  | "lending"
  | "kyc"
  | "consent"
  | "merchant"
  | "support"
  | "developer"
  | "crediq"
  | "admin"
  | "reminders";

export interface EmailTemplateSpec {
  /** Template name as registered in TEMPLATES map (transactional) or auth event name. */
  name: string;
  /** Pipeline: 'transactional' (send-transactional-email) or 'auth' (auth-email-hook). */
  pipeline: "transactional" | "auth";
  category: EmailCategory;
  /** Friendly title shown in admin UI. */
  displayName: string;
  /** When this email is sent — the user-facing trigger condition. */
  trigger: string;
  /** Variables interpolated into the template via templateData props. */
  variables: string[];
  /** Realistic sample payload for test sends and variable validation. */
  sampleData: Record<string, unknown>;
}

export const EMAIL_TEMPLATES: EmailTemplateSpec[] = [
  // ── Account ────────────────────────────────────────────────────────────
  {
    name: "welcome",
    pipeline: "transactional",
    category: "account",
    displayName: "Welcome to Kang",
    trigger: "First successful sign-up & email verification.",
    variables: ["name", "loginUrl"],
    sampleData: { name: "Jane Doe", loginUrl: "https://kob.lovable.app/auth" },
  },
  {
    name: "password-changed",
    pipeline: "transactional",
    category: "account",
    displayName: "Password changed",
    trigger: "User completes a password update or reset.",
    variables: ["name", "changedAt", "ipAddress"],
    sampleData: { name: "Jane Doe", changedAt: new Date().toISOString(), ipAddress: "203.0.113.42" },
  },
  {
    name: "login-alert",
    pipeline: "transactional",
    category: "account",
    displayName: "New sign-in alert",
    trigger: "Sign-in from a new device, browser, or location.",
    variables: ["name", "device", "location", "loggedInAt"],
    sampleData: {
      name: "Jane Doe",
      device: "Chrome on macOS",
      location: "Douala, Cameroon",
      loggedInAt: new Date().toISOString(),
    },
  },

  // ── Payments ───────────────────────────────────────────────────────────
  {
    name: "payment-confirmation",
    pipeline: "transactional",
    category: "payments",
    displayName: "Payment confirmation (payer)",
    trigger: "A payment the user initiated completes successfully.",
    variables: ["name", "amount", "currency", "reference", "merchantName"],
    sampleData: {
      name: "Jane Doe",
      amount: "25,000",
      currency: "XAF",
      reference: "PAY-TEST-0001",
      merchantName: "Sample Merchant",
    },
  },
  {
    name: "payment-received",
    pipeline: "transactional",
    category: "payments",
    displayName: "Payment received (merchant)",
    trigger: "A merchant's account is credited from a customer payment.",
    variables: ["merchantName", "amount", "currency", "reference", "payerName"],
    sampleData: {
      merchantName: "Sample Merchant",
      amount: "25,000",
      currency: "XAF",
      reference: "PAY-TEST-0001",
      payerName: "Jane Doe",
    },
  },
  {
    name: "high-value-alert",
    pipeline: "transactional",
    category: "payments",
    displayName: "High-value transaction alert",
    trigger: "A single transaction exceeds the user's high-value threshold.",
    variables: ["name", "amount", "currency", "reference"],
    sampleData: { name: "Jane Doe", amount: "1,500,000", currency: "XAF", reference: "TX-TEST-9001" },
  },
  {
    name: "statement-ready",
    pipeline: "transactional",
    category: "payments",
    displayName: "Statement ready",
    trigger: "Monthly account statement has been generated.",
    variables: ["name", "periodLabel", "downloadUrl"],
    sampleData: {
      name: "Jane Doe",
      periodLabel: "May 2026",
      downloadUrl: "https://kob.lovable.app/statements/test",
    },
  },
  {
    name: "payout-processed",
    pipeline: "transactional",
    category: "payments",
    displayName: "Payout processed",
    trigger: "A scheduled payout to the merchant's bank account is released.",
    variables: ["merchantName", "amount", "currency", "bankLast4", "reference"],
    sampleData: {
      merchantName: "Sample Merchant",
      amount: "500,000",
      currency: "XAF",
      bankLast4: "4242",
      reference: "PO-TEST-7001",
    },
  },

  // ── Lending ────────────────────────────────────────────────────────────
  {
    name: "loan-application-received",
    pipeline: "transactional",
    category: "lending",
    displayName: "Loan application received",
    trigger: "A loan application is submitted and queued for review.",
    variables: ["name", "applicationId", "amount", "currency"],
    sampleData: {
      name: "Jane Doe",
      applicationId: "LN-TEST-1001",
      amount: "750,000",
      currency: "XAF",
    },
  },
  {
    name: "loan-status-update",
    pipeline: "transactional",
    category: "lending",
    displayName: "Loan status update",
    trigger: "A loan application's status changes (approved/declined/info).",
    variables: ["name", "applicationId", "status", "message"],
    sampleData: {
      name: "Jane Doe",
      applicationId: "LN-TEST-1001",
      status: "approved",
      message: "Funds will be disbursed within 24 hours.",
    },
  },

  // ── KYC ────────────────────────────────────────────────────────────────
  {
    name: "kyc-status-update",
    pipeline: "transactional",
    category: "kyc",
    displayName: "KYC status update",
    trigger: "KYC review concludes: approved, rejected, or info requested.",
    variables: ["name", "status", "reviewerNotes", "actionUrl"],
    sampleData: {
      name: "Jane Doe",
      status: "info_requested",
      reviewerNotes: "Please upload a clearer photo of your ID front side.",
      actionUrl: "https://kob.lovable.app/app/verify-identity",
    },
  },

  // ── Consent / Open Banking ─────────────────────────────────────────────
  {
    name: "consent-authorized",
    pipeline: "transactional",
    category: "consent",
    displayName: "Consent authorized",
    trigger: "User authorizes a TPP consent (AISP/PISP).",
    variables: ["name", "tppName", "scopes", "expiresAt"],
    sampleData: {
      name: "Jane Doe",
      tppName: "Sample TPP",
      scopes: "accounts.read, transactions.read",
      expiresAt: new Date(Date.now() + 90 * 86400_000).toISOString(),
    },
  },
  {
    name: "consent-revoked",
    pipeline: "transactional",
    category: "consent",
    displayName: "Consent revoked",
    trigger: "User or admin revokes an active consent.",
    variables: ["name", "tppName", "revokedAt"],
    sampleData: {
      name: "Jane Doe",
      tppName: "Sample TPP",
      revokedAt: new Date().toISOString(),
    },
  },

  // ── Merchant / Onboarding ──────────────────────────────────────────────
  {
    name: "merchant-onboarded",
    pipeline: "transactional",
    category: "merchant",
    displayName: "Merchant onboarded",
    trigger: "A new merchant is approved and activated.",
    variables: ["merchantName", "dashboardUrl"],
    sampleData: {
      merchantName: "Sample Merchant",
      dashboardUrl: "https://kob.lovable.app/business",
    },
  },

  // ── Support ────────────────────────────────────────────────────────────
  {
    name: "support-ticket-created",
    pipeline: "transactional",
    category: "support",
    displayName: "Support ticket created",
    trigger: "User opens a new support ticket.",
    variables: ["name", "ticketId", "subject"],
    sampleData: { name: "Jane Doe", ticketId: "TCK-TEST-001", subject: "Card declined at checkout" },
  },
  {
    name: "support-reply",
    pipeline: "transactional",
    category: "support",
    displayName: "Support reply",
    trigger: "A support agent replies to an open ticket.",
    variables: ["name", "ticketId", "agentName", "replyExcerpt", "ticketUrl"],
    sampleData: {
      name: "Jane Doe",
      ticketId: "TCK-TEST-001",
      agentName: "Alex (Support)",
      replyExcerpt: "Thanks for the details — could you confirm the merchant name?",
      ticketUrl: "https://kob.lovable.app/support/TCK-TEST-001",
    },
  },
  {
    name: "support-agent-invite",
    pipeline: "transactional",
    category: "support",
    displayName: "Support agent invite",
    trigger: "An admin invites a new agent to a support department.",
    variables: ["agentName", "inviteUrl", "departmentName"],
    sampleData: {
      agentName: "Alex Banda",
      inviteUrl: "https://kob.lovable.app/support/accept-invite?token=test",
      departmentName: "Tier 1 Support",
    },
  },
  {
    name: "chat-assigned",
    pipeline: "transactional",
    category: "support",
    displayName: "Chat assigned to agent",
    trigger: "A live chat conversation is assigned to an agent.",
    variables: ["agentName", "customerName", "conversationUrl"],
    sampleData: {
      agentName: "Alex Banda",
      customerName: "Jane Doe",
      conversationUrl: "https://kob.lovable.app/admin/support-chat/test",
    },
  },

  // ── Developer ──────────────────────────────────────────────────────────
  {
    name: "api-key-created",
    pipeline: "transactional",
    category: "developer",
    displayName: "API key created",
    trigger: "A developer or admin creates a new API key.",
    variables: ["name", "keyLabel", "createdAt", "environment"],
    sampleData: {
      name: "Jane Doe",
      keyLabel: "Sandbox – default",
      createdAt: new Date().toISOString(),
      environment: "sandbox",
    },
  },

  // ── CrediQ ─────────────────────────────────────────────────────────────
  {
    name: "crediq-weekly-digest",
    pipeline: "transactional",
    category: "crediq",
    displayName: "CrediQ weekly digest",
    trigger: "Weekly summary of credit score & spending insights.",
    variables: ["name", "score", "scoreDelta", "highlights"],
    sampleData: {
      name: "Jane Doe",
      score: 712,
      scoreDelta: "+8",
      highlights: "On-time payments improved your utilization ratio.",
    },
  },
  {
    name: "crediq-monthly-report",
    pipeline: "transactional",
    category: "crediq",
    displayName: "CrediQ monthly report",
    trigger: "Monthly credit health and recommendations report.",
    variables: ["name", "month", "score", "reportUrl"],
    sampleData: {
      name: "Jane Doe",
      month: "May 2026",
      score: 712,
      reportUrl: "https://kob.lovable.app/crediq/report/test",
    },
  },
  {
    name: "crediq-score-change",
    pipeline: "transactional",
    category: "crediq",
    displayName: "CrediQ score change",
    trigger: "Credit score crosses a significant change threshold.",
    variables: ["name", "previousScore", "newScore", "reason"],
    sampleData: {
      name: "Jane Doe",
      previousScore: 700,
      newScore: 712,
      reason: "Reduced credit utilization across 2 accounts.",
    },
  },
  {
    name: "crediq-tip-recommendation",
    pipeline: "transactional",
    category: "crediq",
    displayName: "CrediQ tip / recommendation",
    trigger: "A personalized credit improvement tip is generated.",
    variables: ["name", "tipTitle", "tipBody"],
    sampleData: {
      name: "Jane Doe",
      tipTitle: "Lower your card utilization",
      tipBody: "Keeping card usage below 30% can lift your score by ~10 points.",
    },
  },

  // ── Reminders ──────────────────────────────────────────────────────────
  {
    name: "rent-payment-reminder",
    pipeline: "transactional",
    category: "reminders",
    displayName: "Rent payment reminder",
    trigger: "Scheduled reminder before a rent payment is due.",
    variables: ["name", "amount", "currency", "dueDate", "payUrl"],
    sampleData: {
      name: "Jane Doe",
      amount: "120,000",
      currency: "XAF",
      dueDate: new Date(Date.now() + 3 * 86400_000).toISOString(),
      payUrl: "https://kob.lovable.app/app/rent/pay/test",
    },
  },

  // ── Admin ──────────────────────────────────────────────────────────────
  {
    name: "admin-email-queue-alert",
    pipeline: "transactional",
    category: "admin",
    displayName: "Admin email queue alert",
    trigger: "Email queue backlog or DLQ threshold breached.",
    variables: ["queueDepth", "dlqDepth", "alertedAt"],
    sampleData: { queueDepth: 142, dlqDepth: 6, alertedAt: new Date().toISOString() },
  },

  // ── Auth (handled by auth-email-hook) ──────────────────────────────────
  {
    name: "signup",
    pipeline: "auth",
    category: "auth",
    displayName: "Sign-up confirmation",
    trigger: "User signs up — confirm email address.",
    variables: ["confirmation_url", "token", "email"],
    sampleData: {},
  },
  {
    name: "magic-link",
    pipeline: "auth",
    category: "auth",
    displayName: "Magic link",
    trigger: "User requests a passwordless magic-link sign-in.",
    variables: ["confirmation_url", "token"],
    sampleData: {},
  },
  {
    name: "recovery",
    pipeline: "auth",
    category: "auth",
    displayName: "Password recovery",
    trigger: "User requests a password reset link.",
    variables: ["confirmation_url", "token"],
    sampleData: {},
  },
  {
    name: "invite",
    pipeline: "auth",
    category: "auth",
    displayName: "User invite",
    trigger: "Admin invites a new user to the platform.",
    variables: ["confirmation_url", "token", "email"],
    sampleData: {},
  },
  {
    name: "email-change",
    pipeline: "auth",
    category: "auth",
    displayName: "Email change confirmation",
    trigger: "User requests to change their email address.",
    variables: ["confirmation_url", "token", "new_email"],
    sampleData: {},
  },
  {
    name: "reauthentication",
    pipeline: "auth",
    category: "auth",
    displayName: "Re-authentication challenge",
    trigger: "Sensitive action requires re-authentication via OTP.",
    variables: ["token"],
    sampleData: {},
  },
];

export const CATEGORY_LABEL: Record<EmailCategory, string> = {
  auth: "Authentication",
  account: "Account",
  payments: "Payments",
  lending: "Lending",
  kyc: "KYC",
  consent: "Consent & Open Banking",
  merchant: "Merchant",
  support: "Support",
  developer: "Developer",
  crediq: "CrediQ",
  admin: "Admin",
  reminders: "Reminders",
};

export function getTemplateByName(name: string): EmailTemplateSpec | undefined {
  return EMAIL_TEMPLATES.find((t) => t.name === name);
}
