// KOB Integration Layer — Smart Routing Engine
// Picks the right upstream connector for a given payment intent.
// Pure decision logic — does NOT call upstreams; returns a route descriptor.

export type PaymentMethod = "card" | "mobile_money" | "bank" | "wallet";

export interface RouteRequest {
  method: PaymentMethod;
  country?: string;       // ISO-3166-1 alpha-2, e.g. "CM"
  currency?: string;      // ISO 4217, e.g. "XAF"
  msisdn?: string;        // for mobile_money — full intl format e.g. "237670000000"
  amount?: number;
  preferred_connector?: string;
}

export interface RouteDecision {
  primary: string;         // edge function name to invoke
  fallback?: string[];     // ordered fallback chain
  connector: string;       // logical connector id
  reason: string;
}

const MOMO_PREFIXES = {
  mtn_cm: ["67", "65", "68"],
  orange_cm: ["69", "655", "656", "657", "658", "659"],
};

function detectMomoOperator(msisdn?: string): "mtn_momo" | "orange_money" | null {
  if (!msisdn) return null;
  const local = msisdn.replace(/^\+?237/, "");
  if (MOMO_PREFIXES.orange_cm.some(p => local.startsWith(p))) return "orange_money";
  if (MOMO_PREFIXES.mtn_cm.some(p => local.startsWith(p))) return "mtn_momo";
  return null;
}

export function routePayment(req: RouteRequest): RouteDecision {
  const country = (req.country ?? "CM").toUpperCase();

  if (req.preferred_connector) {
    return {
      primary: "payment-router-charge",
      fallback: ["gateway-create-charge"],
      connector: req.preferred_connector,
      reason: `merchant preferred connector: ${req.preferred_connector}`,
    };
  }

  switch (req.method) {
    case "card":
      return {
        primary: "gateway-create-charge",
        fallback: ["payment-router-charge"],
        connector: country === "CM" ? "flutterwave" : "stripe",
        reason: `card payments routed to ${country === "CM" ? "Flutterwave" : "Stripe"}`,
      };

    case "mobile_money": {
      const op = detectMomoOperator(req.msisdn);
      if (op) {
        return {
          primary: "payment-router-charge",
          fallback: ["facilitated-mobile-money-charge", "gateway-create-charge"],
          connector: op,
          reason: `MSISDN prefix matched ${op}`,
        };
      }
      return {
        primary: "facilitated-mobile-money-charge",
        fallback: ["payment-router-charge"],
        connector: "flutterwave",
        reason: "MSISDN prefix unknown — using facilitated rail",
      };
    }

    case "bank":
      return {
        primary: "pisp-domestic-payment",
        fallback: ["pay-by-bank", "facilitated-bank-transfer"],
        connector: "pisp",
        reason: "bank transfers routed via PISP first, fallback to PayByBank/facilitated",
      };

    case "wallet":
    default:
      return {
        primary: "api-transfers",
        connector: "internal_ledger",
        reason: "wallet-to-wallet via internal ledger",
      };
  }
}

export function routeTransfer(args: { rail?: "internal" | "interbank" | "mobile_money" }): RouteDecision {
  switch (args.rail) {
    case "interbank":
      return { primary: "interbank-engine", connector: "interbank", reason: "interbank rail explicitly requested" };
    case "mobile_money":
      return { primary: "mobile-money-transfer", connector: "mobile_money", reason: "MoMo transfer rail" };
    case "internal":
    default:
      return { primary: "api-transfers", connector: "internal_ledger", reason: "default internal ledger transfer" };
  }
}
