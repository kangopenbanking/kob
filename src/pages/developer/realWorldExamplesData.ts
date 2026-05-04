// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P2, P6, P9)
// Source of truth for /developer/examples/real-world cards. Each entry is
// validated by src/test/real-world-examples-openapi-sync.test.ts against
// public/openapi.json (method, path key, required body fields, base URL).
import {
  Building2, CreditCard, Wallet, RotateCcw, Send, Bell, BarChart3,
  Shield, Landmark, Banknote,
} from "lucide-react";

export const SANDBOX_BASE = "https://sandbox-api.kangopenbanking.com";
export const PRODUCTION_BASE = "https://api.kangopenbanking.com";
export const SANDBOX_KEY = "sk_test_kob_sandbox_demo_key_2024";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type Example = {
  slug: string;
  title: string;
  desc: string;
  icon: typeof Building2;
  tags: string[];
  time: string;
  category: "gateway" | "webhooks" | "openbanking" | "usecase";
  method: HttpMethod;
  // OpenAPI path key, including /v1 prefix and {curly} params
  specPath: string;
  // Concrete sample path with substituted IDs (used for cURL)
  samplePath: string;
  body?: Record<string, unknown>;
  pathParams?: Record<string, string>;
  notes?: string;
  // Required body fields per OpenAPI; the sync test enforces presence
  requiredFields?: string[];
  // Whether endpoint requires Idempotency-Key header
  idempotent?: boolean;
  // Whether endpoint requires FAPI interaction headers
  fapi?: boolean;
};

export const examples: Example[] = [
  {
    slug: "01-merchant-onboarding-kyb-api-keys",
    title: "Merchant Onboarding, KYB & API Keys",
    desc: "Register a merchant, submit KYB verification, and generate API keys for production access.",
    icon: Building2, tags: ["Gateway", "Merchant"], time: "8 min", category: "gateway",
    method: "POST", specPath: "/v1/merchants", samplePath: "/v1/merchants",
    body: {
      business_name: "Acme Trading SARL",
      business_type: "limited_company",
      contact_email: "ops@acme.cm",
      country: "CM",
      currency: "XAF",
    },
    requiredFields: ["business_name", "business_type", "contact_email"],
    idempotent: true,
  },
  {
    slug: "02-accept-payments-create-charge",
    title: "Accept Payments — Create a Charge",
    desc: "Collect payments via Mobile Money, Card, or PayPal with full webhook lifecycle.",
    icon: CreditCard, tags: ["Gateway", "Payments"], time: "10 min", category: "gateway",
    method: "POST", specPath: "/v1/gateway/charges", samplePath: "/v1/gateway/charges",
    body: {
      merchant_id: "mch_01HABCDXYZ",
      amount: "15000",
      channel: "mobile_money",
      tx_ref: "order_1001_20260504",
      currency: "XAF",
      customer: { phone: "+237670000001", name: "Jean Mballa", email: "jean@example.cm" },
      description: "Order #1001",
    },
    requiredFields: ["merchant_id", "amount", "channel", "tx_ref"],
    idempotent: true, fapi: true,
    notes: "Amounts for XAF/XOF are zero-decimal strings (^[0-9]{1,15}$).",
  },
  {
    slug: "03-add-money-account-funding",
    title: "Add Money — Account Funding",
    desc: "Fund wallets via Mobile Money, card tokenization, or bank transfer.",
    icon: Wallet, tags: ["Gateway", "Funding"], time: "7 min", category: "gateway",
    method: "POST", specPath: "/v1/gateway/funding-intents", samplePath: "/v1/gateway/funding-intents",
    body: {
      amount: "50000",
      currency: "XAF",
      source: { type: "mobile_money", msisdn: "+237670000001", provider: "MTN_CM" },
    },
    requiredFields: ["amount", "currency", "source"],
    idempotent: true,
  },
  {
    slug: "04-refunds",
    title: "Refunds",
    desc: "Process full and partial refunds on completed charges with idempotency.",
    icon: RotateCcw, tags: ["Gateway", "Refunds"], time: "5 min", category: "gateway",
    method: "POST", specPath: "/v1/gateway/refunds", samplePath: "/v1/gateway/refunds",
    body: {
      charge_id: "chg_01HABCDXYZ",
      amount: "5000",
      currency: "XAF",
      reason: "customer_request",
    },
    requiredFields: ["charge_id"],
    idempotent: true, fapi: true,
  },
  {
    slug: "05-payouts-single-bulk-paypal",
    title: "Payouts — Single, Bulk & PayPal",
    desc: "Disburse funds to bank accounts, Mobile Money wallets, or PayPal recipients.",
    icon: Send, tags: ["Gateway", "Payouts"], time: "12 min", category: "gateway",
    method: "POST", specPath: "/v1/gateway/payouts", samplePath: "/v1/gateway/payouts",
    body: {
      merchant_id: "mch_01HABCDXYZ",
      amount: "250000",
      channel: "mobile_money",
      currency: "XAF",
      destination: { type: "mobile_money", msisdn: "+237670000099", provider: "MTN_CM" },
      reference: "payroll_2026_05_01",
    },
    requiredFields: ["merchant_id", "amount", "channel"],
    idempotent: true, fapi: true,
  },
  {
    slug: "07-settlements-reporting-exports-reconciliation",
    title: "Settlements, Reporting & Reconciliation",
    desc: "Review settlement cycles, generate CSV/PDF reports, and reconcile transactions.",
    icon: BarChart3, tags: ["Gateway", "Reporting"], time: "8 min", category: "gateway",
    method: "GET", specPath: "/v1/gateway/settlements",
    samplePath: "/v1/gateway/settlements?merchant_id=mch_01HABCDXYZ&limit=50",
  },
  {
    slug: "08-disputes-chargebacks-evidence",
    title: "Disputes & Chargebacks",
    desc: "Handle dispute notifications and submit chargeback evidence within deadlines.",
    icon: Shield, tags: ["Gateway", "Disputes"], time: "7 min", category: "gateway",
    method: "POST", specPath: "/v1/gateway/disputes/{disputeId}/evidence",
    samplePath: "/v1/gateway/disputes/dsp_01HABCDXYZ/evidence",
    pathParams: { disputeId: "dsp_01HABCDXYZ" },
    body: {
      evidence_text: "Customer received the goods on 2026-04-22 — see signed delivery receipt.",
      receipt_url: "https://files.acme.cm/receipts/12345.pdf",
      shipping_url: "https://files.acme.cm/shipping/12345.pdf",
    },
    requiredFields: ["evidence_text"],
    idempotent: true,
  },
  {
    slug: "06-webhooks-merchant-outbound-deliveries-rotation",
    title: "Webhooks — Setup, Deliveries & Rotation",
    desc: "Configure endpoints, verify HMAC signatures, handle retries, and rotate secrets.",
    icon: Bell, tags: ["Webhooks"], time: "10 min", category: "webhooks",
    method: "POST", specPath: "/v1/webhooks/v2/endpoints", samplePath: "/v1/webhooks/v2/endpoints",
    body: {
      merchant_id: "mch_01HABCDXYZ",
      url: "https://api.acme.cm/kob/webhooks",
      events: ["charge.successful", "charge.failed", "payout.completed", "dispute.opened"],
      description: "Production webhook endpoint",
    },
    requiredFields: ["merchant_id", "url", "events"],
    idempotent: true,
    notes: "Verify deliveries with HMAC-SHA256 over the raw body using your endpoint secret.",
  },
  {
    slug: "09-open-banking-aisp-consent-accounts-transactions",
    title: "Open Banking AISP — Accounts & Transactions",
    desc: "Create consent, authorize via redirect, and retrieve account data via AISP flow.",
    icon: Landmark, tags: ["Open Banking", "AISP"], time: "12 min", category: "openbanking",
    method: "POST", specPath: "/v1/aisp/consents", samplePath: "/v1/aisp/consents",
    body: {
      permissions: ["ReadAccountsDetail", "ReadBalances", "ReadTransactionsDetail"],
      expiration_date: "2026-08-04T00:00:00Z",
      transaction_from_date: "2026-02-01T00:00:00Z",
      transaction_to_date: "2026-05-04T00:00:00Z",
    },
    requiredFields: ["permissions", "expiration_date"],
    idempotent: true,
  },
  {
    slug: "10-open-banking-pisp-consent-domestic-payment",
    title: "Open Banking PISP — Domestic Payment",
    desc: "Initiate a domestic payment via PISP consent and authorization flow.",
    icon: Banknote, tags: ["Open Banking", "PISP"], time: "10 min", category: "openbanking",
    method: "POST", specPath: "/v1/pisp/payment-submission", samplePath: "/v1/pisp/payment-submission",
    body: {
      payment_id: "pay_01HABCDXYZ",
      consent_id: "cnt_01HABCDXYZ",
      amount: "150000",
      currency: "XAF",
      debtor_account: { scheme_name: "IBAN", identification: "CM2110001000001234567890145" },
      creditor_account: { scheme_name: "IBAN", identification: "CM2110002000009876543210188", name: "Acme Trading SARL" },
    },
    requiredFields: ["payment_id", "consent_id", "amount", "currency", "debtor_account", "creditor_account"],
    idempotent: true, fapi: true,
    notes: "All six fields are required by PISP per FAPI-1.0-ADV §5.2.2.",
  },
  {
    slug: "11-build-marketplace-checkout",
    title: "Build a Marketplace Checkout",
    desc: "End-to-end guide: charge buyers, calculate commission, disburse to sellers, and reconcile.",
    icon: CreditCard, tags: ["Use Case", "Gateway"], time: "15 min", category: "usecase",
    method: "POST", specPath: "/v1/gateway/charges", samplePath: "/v1/gateway/charges",
    body: {
      merchant_id: "mch_marketplace_01",
      amount: "32000",
      channel: "mobile_money",
      tx_ref: "marketplace_order_5501",
      currency: "XAF",
      customer: { phone: "+237670000001" },
      splits: [
        { destination_account: "acc_seller_01", amount: "28800" },
        { destination_account: "acc_platform_fee", amount: "3200" },
      ],
    },
    requiredFields: ["merchant_id", "amount", "channel", "tx_ref"],
    idempotent: true, fapi: true,
  },
  {
    slug: "12-build-bank-data-aggregator",
    title: "Build a Bank Data Aggregator",
    desc: "End-to-end guide: AISP consent, account sync, transaction history, and token management.",
    icon: Landmark, tags: ["Use Case", "AISP"], time: "15 min", category: "usecase",
    method: "GET",
    specPath: "/v1/aisp/accounts/{accountId}/transactions",
    samplePath: "/v1/aisp/accounts/acc_01HABCDXYZ/transactions?from_date=2026-04-01&to_date=2026-04-30&limit=100",
    pathParams: { accountId: "acc_01HABCDXYZ" },
    fapi: true,
    notes: "AISP reads require an x-consent-id header from a previously authorized consent.",
  },
];

// ---------- Snippet builders ----------

export type Snippet = { language: "curl" | "node" | "python" | "php"; label: string; code: string };

function headerLines(ex: Example): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${SANDBOX_KEY}`,
    Accept: "application/json",
    "x-api-version": "2026-04-01",
  };
  if (ex.method !== "GET") h["Content-Type"] = "application/json";
  if (ex.idempotent) h["Idempotency-Key"] = "<UUID-v4>";
  if (ex.fapi) {
    h["x-fapi-interaction-id"] = "<UUID-v4>";
    h["x-fapi-customer-ip-address"] = "203.0.113.7";
    h["x-fapi-auth-date"] = new Date().toUTCString();
  }
  if (ex.specPath.startsWith("/v1/aisp/accounts") && ex.method === "GET") {
    h["x-consent-id"] = "cnt_01HABCDXYZ";
  }
  return h;
}

export function buildCurl(ex: Example): string {
  const headers = headerLines(ex);
  const lines = [`curl -X ${ex.method} "${SANDBOX_BASE}${ex.samplePath}" \\`];
  const headerEntries = Object.entries(headers);
  headerEntries.forEach(([k, v], i) => {
    const last = i === headerEntries.length - 1 && !ex.body;
    lines.push(`  -H "${k}: ${v}"${last ? "" : " \\"}`);
  });
  if (ex.body) {
    const json = JSON.stringify(ex.body, null, 2)
      .split("\n").map((l, i) => i === 0 ? l : "  " + l).join("\n");
    lines.push(`  -d '${json}'`);
  }
  return lines.join("\n");
}

export function buildNode(ex: Example): string {
  const fn = `${ex.method.toLowerCase()}`;
  const headers = headerLines(ex);
  const headerObj = JSON.stringify(
    Object.fromEntries(Object.entries(headers).filter(([k]) => k !== "Authorization" && k !== "Content-Type" && k !== "Accept")),
    null, 2,
  ).replace(/"<UUID-v4>"/g, "crypto.randomUUID()");
  const bodyArg = ex.body ? `, ${JSON.stringify(ex.body, null, 2)}` : "";
  return `import { KangOpenBanking } from "@kang/openbanking-node";
import crypto from "node:crypto";

const kob = new KangOpenBanking({
  apiKey: process.env.KOB_API_KEY!, // sandbox: ${SANDBOX_KEY}
  environment: "sandbox",
  apiVersion: "2026-04-01",
});

const response = await kob.request({
  method: "${ex.method}",
  path: "${ex.samplePath}",
  headers: ${headerObj}${bodyArg ? `,\n  body: ${bodyArg.trim().slice(2)}` : ""},
});

console.log(response);`;
}

export function buildPython(ex: Example): string {
  const headers = headerLines(ex);
  const filtered = Object.fromEntries(
    Object.entries(headers).filter(([k]) => k !== "Authorization" && k !== "Content-Type" && k !== "Accept"),
  );
  const headerPy = JSON.stringify(filtered, null, 4)
    .replace(/"<UUID-v4>"/g, "str(uuid.uuid4())")
    .replace(/^{/, "{").replace(/\n}/, "\n}");
  const bodyPy = ex.body ? `,\n    json=${JSON.stringify(ex.body, null, 4)}` : "";
  return `import os, uuid
from kang_openbanking import KangOpenBanking

kob = KangOpenBanking(
    api_key=os.environ["KOB_API_KEY"],  # sandbox: ${SANDBOX_KEY}
    environment="sandbox",
    api_version="2026-04-01",
)

response = kob.request(
    method="${ex.method}",
    path="${ex.samplePath}",
    headers=${headerPy}${bodyPy},
)

print(response)`;
}

export function buildPhp(ex: Example): string {
  const headers = headerLines(ex);
  const filtered = Object.entries(headers).filter(([k]) => k !== "Authorization" && k !== "Content-Type" && k !== "Accept");
  const headersPhp = filtered
    .map(([k, v]) => `        '${k}' => ${v === "<UUID-v4>" ? "Ramsey\\Uuid\\Uuid::uuid4()->toString()" : `'${v}'`},`)
    .join("\n");
  const bodyPhp = ex.body ? `,\n    'body' => ${jsonToPhp(ex.body, 1)}` : "";
  return `<?php
use Kang\\OpenBanking\\Client;

$kob = new Client([
    'api_key' => getenv('KOB_API_KEY'), // sandbox: ${SANDBOX_KEY}
    'environment' => 'sandbox',
    'api_version' => '2026-04-01',
]);

$response = $kob->request([
    'method' => '${ex.method}',
    'path' => '${ex.samplePath}',
    'headers' => [
${headersPhp}
    ]${bodyPhp},
]);

print_r($response);`;
}

function jsonToPhp(value: unknown, depth = 0): string {
  const pad = "    ".repeat(depth);
  const padInner = "    ".repeat(depth + 1);
  if (value === null) return "null";
  if (typeof value === "string") return `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[\n${value.map(v => `${padInner}${jsonToPhp(v, depth + 1)}`).join(",\n")}\n${pad}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return `[\n${entries.map(([k, v]) => `${padInner}'${k}' => ${jsonToPhp(v, depth + 1)}`).join(",\n")}\n${pad}]`;
}

export function buildSnippets(ex: Example): Snippet[] {
  return [
    { language: "curl",   label: "cURL",       code: buildCurl(ex) },
    { language: "node",   label: "Node.js",    code: buildNode(ex) },
    { language: "python", label: "Python",     code: buildPython(ex) },
    { language: "php",    label: "PHP",        code: buildPhp(ex) },
  ];
}

// ---------- Mock sandbox response (Try-it) ----------

export function mockResponse(ex: Example): { status: number; body: unknown } {
  const now = new Date().toISOString();
  const requestId = `req_${cryptoRand(24)}`;
  if (ex.method === "GET" && ex.specPath.includes("settlements")) {
    return {
      status: 200,
      body: {
        object: "list", livemode: false, has_more: false, request_id: requestId,
        data: [
          { id: `stl_${cryptoRand(20)}`, merchant_id: "mch_01HABCDXYZ", amount: "1245000", currency: "XAF", net_amount: "1208565", fees: "36435", status: "settled", settled_at: now },
          { id: `stl_${cryptoRand(20)}`, merchant_id: "mch_01HABCDXYZ", amount: "988000", currency: "XAF", net_amount: "958360", fees: "29640", status: "settled", settled_at: now },
        ],
      },
    };
  }
  if (ex.method === "GET" && ex.specPath.includes("transactions")) {
    return {
      status: 200,
      body: {
        object: "list", livemode: false, has_more: true, request_id: requestId,
        data: Array.from({ length: 3 }, (_, i) => ({
          transaction_id: `txn_${cryptoRand(20)}`, amount: String(15000 + i * 7500), currency: "XAF",
          credit_debit_indicator: i % 2 === 0 ? "Credit" : "Debit", status: "Booked",
          booking_datetime: now, transaction_information: ["Salary credit", "Mobile Money topup", "Acme Foods"][i],
        })),
      },
    };
  }
  // Default: echo created resource
  const id = ex.specPath.includes("merchants") ? `mch_${cryptoRand(20)}`
    : ex.specPath.includes("charges") ? `chg_${cryptoRand(20)}`
    : ex.specPath.includes("refunds") ? `rfn_${cryptoRand(20)}`
    : ex.specPath.includes("payouts") ? `pyt_${cryptoRand(20)}`
    : ex.specPath.includes("funding-intents") ? `fdi_${cryptoRand(20)}`
    : ex.specPath.includes("disputes") ? `evd_${cryptoRand(20)}`
    : ex.specPath.includes("webhooks") ? `whe_${cryptoRand(20)}`
    : ex.specPath.includes("consents") ? `cnt_${cryptoRand(20)}`
    : ex.specPath.includes("payment-submission") ? `psb_${cryptoRand(20)}`
    : `obj_${cryptoRand(20)}`;
  return {
    status: 201,
    body: {
      id, object: ex.specPath.split("/").pop(), livemode: false, status: "pending",
      created_at: now, request_id: requestId, ...(ex.body || {}),
    },
  };
}

function cryptoRand(n: number): string {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
