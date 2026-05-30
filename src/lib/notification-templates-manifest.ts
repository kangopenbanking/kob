/**
 * Static manifest of in-app / push notification templates used across the
 * platform. The push-notification edge function accepts {title, message,
 * title_fr?, message_fr?, type, icon, metadata}; this manifest mirrors that
 * payload shape so the admin tester can preview, render variables, and
 * smoke-send any template without touching live triggers.
 */

export type NotificationVariable = {
  key: string;
  sample: string;
  description?: string;
  required?: boolean;
};

export type NotificationAction = { label_en: string; label_fr: string; url: string };

export type NotificationTemplate = {
  id: string;
  category: "transaction" | "security" | "marketing" | "system" | "kyc" | "remittance" | "savings";
  type: "info" | "success" | "warning" | "error" | "alert" | "reminder";
  name: string;
  description: string;
  icon: string;                        // Lucide / domain icon name
  title_en: string;
  title_fr: string;
  message_en: string;
  message_fr: string;
  variables: NotificationVariable[];
  actions?: NotificationAction[];
  triggered_by?: string;               // human label of the trigger
};

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: "welcome",
    category: "system",
    type: "info",
    name: "Welcome",
    description: "Sent on first sign-in to greet the user.",
    icon: "sparkles",
    title_en: "Welcome to Kang, {{firstName}}",
    title_fr: "Bienvenue chez Kang, {{firstName}}",
    message_en: "Your account is ready. Add money to get started.",
    message_fr: "Votre compte est prêt. Ajoutez de l'argent pour commencer.",
    variables: [{ key: "firstName", sample: "Amelia", description: "User first name" }],
    actions: [{ label_en: "Open app", label_fr: "Ouvrir", url: "/app" }],
    triggered_by: "First successful sign-in",
  },
  {
    id: "payment-received",
    category: "transaction",
    type: "success",
    name: "Payment received",
    description: "Incoming P2P or wallet credit.",
    icon: "arrow-down-circle",
    title_en: "You received {{amount}} {{currency}}",
    title_fr: "Vous avez reçu {{amount}} {{currency}}",
    message_en: "{{senderName}} sent you {{amount}} {{currency}}. New balance: {{balance}} {{currency}}.",
    message_fr: "{{senderName}} vous a envoyé {{amount}} {{currency}}. Nouveau solde : {{balance}} {{currency}}.",
    variables: [
      { key: "amount", sample: "25 000" , required: true },
      { key: "currency", sample: "XAF" , required: true },
      { key: "senderName", sample: "Jean Mbarga" , required: true },
      { key: "balance", sample: "184 250" },
    ],
    actions: [{ label_en: "View receipt", label_fr: "Voir le reçu", url: "/app/activity/{{txId}}" }],
    triggered_by: "ledger.credit on customer wallet",
  },
  {
    id: "payment-sent",
    category: "transaction",
    type: "info",
    name: "Payment sent",
    description: "Outgoing P2P or merchant payment confirmation.",
    icon: "arrow-up-circle",
    title_en: "Sent {{amount}} {{currency}}",
    title_fr: "{{amount}} {{currency}} envoyés",
    message_en: "Your payment of {{amount}} {{currency}} to {{recipient}} was successful.",
    message_fr: "Votre paiement de {{amount}} {{currency}} à {{recipient}} a réussi.",
    variables: [
      { key: "amount", sample: "5 000" , required: true },
      { key: "currency", sample: "XAF" , required: true },
      { key: "recipient", sample: "ENEO Cameroun" , required: true },
    ],
    triggered_by: "transfer.success",
  },
  {
    id: "login-new-device",
    category: "security",
    type: "warning",
    name: "New device sign-in",
    description: "Security alert for a sign-in from an unrecognized device.",
    icon: "shield-alert",
    title_en: "New sign-in to your account",
    title_fr: "Nouvelle connexion à votre compte",
    message_en: "Sign-in from {{device}} in {{location}} at {{time}}. If this wasn't you, secure your account.",
    message_fr: "Connexion depuis {{device}} à {{location}} le {{time}}. Si ce n'était pas vous, sécurisez votre compte.",
    variables: [
      { key: "device", sample: "iPhone 15 · Safari" },
      { key: "location", sample: "Douala, CM" },
      { key: "time", sample: "14:32" },
    ],
    actions: [
      { label_en: "It was me", label_fr: "C'était moi", url: "/app/settings/security?ack={{eventId}}" },
      { label_en: "Secure account", label_fr: "Sécuriser", url: "/app/settings/security" },
    ],
    triggered_by: "auth.signin from new fingerprint",
  },
  {
    id: "kyc-approved",
    category: "kyc",
    type: "success",
    name: "KYC approved",
    description: "Identity verification approved.",
    icon: "badge-check",
    title_en: "Identity verified",
    title_fr: "Identité vérifiée",
    message_en: "You're verified, {{firstName}}. All Kang features are now unlocked.",
    message_fr: "Vous êtes vérifié, {{firstName}}. Toutes les fonctionnalités Kang sont déverrouillées.",
    variables: [{ key: "firstName", sample: "Amelia" }],
    triggered_by: "admin-kyc-review.approve",
  },
  {
    id: "kyc-info-requested",
    category: "kyc",
    type: "warning",
    name: "KYC info requested",
    description: "Additional KYC documents required.",
    icon: "file-warning",
    title_en: "Additional documents required",
    title_fr: "Documents supplémentaires requis",
    message_en: "We need more information to verify your account: {{reason}}.",
    message_fr: "Nous avons besoin de plus d'informations pour vérifier votre compte : {{reason}}.",
    variables: [{ key: "reason", sample: "Proof of address (last 3 months)" }],
    actions: [{ label_en: "Upload now", label_fr: "Téléverser", url: "/kyc" }],
    triggered_by: "admin-kyc-review.request_info",
  },
  {
    id: "remittance-success",
    category: "remittance",
    type: "success",
    name: "Remittance delivered",
    description: "International transfer completed.",
    icon: "globe",
    title_en: "Transfer to {{recipient}} delivered",
    title_fr: "Transfert à {{recipient}} livré",
    message_en: "{{amount}} {{currency}} arrived in {{country}}. Reference: {{ref}}.",
    message_fr: "{{amount}} {{currency}} sont arrivés à {{country}}. Référence : {{ref}}.",
    variables: [
      { key: "recipient", sample: "Marie Kouassi" , required: true },
      { key: "amount", sample: "200" , required: true },
      { key: "currency", sample: "EUR" , required: true },
      { key: "country", sample: "Côte d'Ivoire" },
      { key: "ref", sample: "KOB-RMT-44821" , required: true },
    ],
    actions: [{ label_en: "View receipt", label_fr: "Voir le reçu", url: "/app/remittance/{{ref}}" }],
    triggered_by: "remittance.settled",
  },
  {
    id: "savings-goal-reached",
    category: "savings",
    type: "success",
    name: "Piggybank goal reached",
    description: "Savings goal completed.",
    icon: "piggy-bank",
    title_en: "Goal reached: {{goalName}}",
    title_fr: "Objectif atteint : {{goalName}}",
    message_en: "You saved {{target}} {{currency}}. Withdraw or roll into a new goal.",
    message_fr: "Vous avez économisé {{target}} {{currency}}. Retirez ou démarrez un nouvel objectif.",
    variables: [
      { key: "goalName", sample: "Vacation 2026" , required: true },
      { key: "target", sample: "500 000" , required: true },
      { key: "currency", sample: "XAF" , required: true },
    ],
    triggered_by: "piggybank.goal_completed",
  },
  {
    id: "bill-reminder",
    category: "transaction",
    type: "reminder",
    name: "Bill reminder",
    description: "Upcoming bill due in 3 days.",
    icon: "calendar-clock",
    title_en: "{{biller}} bill due in {{days}} days",
    title_fr: "Facture {{biller}} due dans {{days}} jours",
    message_en: "Pay {{amount}} {{currency}} by {{dueDate}} to avoid late fees.",
    message_fr: "Payez {{amount}} {{currency}} avant le {{dueDate}} pour éviter les frais de retard.",
    variables: [
      { key: "biller", sample: "ENEO" , required: true },
      { key: "days", sample: "3" },
      { key: "amount", sample: "18 400" , required: true },
      { key: "currency", sample: "XAF" , required: true },
      { key: "dueDate", sample: "2026-06-02" , required: true },
    ],
    actions: [{ label_en: "Pay now", label_fr: "Payer", url: "/app/bills/{{billId}}" }],
    triggered_by: "bills-cron daily scan",
  },
  {
    id: "card-frozen",
    category: "security",
    type: "alert",
    name: "Card frozen",
    description: "Card was frozen by the user or risk engine.",
    icon: "snowflake",
    title_en: "Card ending {{last4}} frozen",
    title_fr: "Carte se terminant par {{last4}} gelée",
    message_en: "Your card was frozen at {{time}}. Unfreeze it any time from the Cards screen.",
    message_fr: "Votre carte a été gelée à {{time}}. Dégelez-la depuis l'écran Cartes.",
    variables: [
      { key: "last4", sample: "4421" , required: true },
      { key: "time", sample: "09:14" },
    ],
    actions: [{ label_en: "Manage card", label_fr: "Gérer", url: "/app/cards" }],
    triggered_by: "card.freeze",
  },
  {
    id: "promo-launch",
    category: "marketing",
    type: "info",
    name: "Promotional announcement",
    description: "Marketing announcement (requires opt-in).",
    icon: "megaphone",
    title_en: "{{headline}}",
    title_fr: "{{headline}}",
    message_en: "{{body}} Tap to learn more.",
    message_fr: "{{body}} Appuyez pour en savoir plus.",
    variables: [
      { key: "headline", sample: "Send to Europe with 0 fees this week" , required: true },
      { key: "body", sample: "Limited-time promo on EUR remittances." },
    ],
    actions: [{ label_en: "Learn more", label_fr: "En savoir plus", url: "/app/promo/{{promoId}}" }],
    triggered_by: "marketing-campaign.publish",
  },
];

/** Substitute {{var}} placeholders with the provided values. Empty/undefined
 *  values are preserved as the literal placeholder so the tester can spot leaks. */
export function renderTemplate(
  text: string,
  values: Record<string, string>,
): { rendered: string; missing: string[] } {
  const missing: string[] = [];
  const rendered = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const v = values[key];
    if (v === undefined || v === null || v === "") {
      missing.push(key);
      return `{{${key}}}`;
    }
    return String(v);
  });
  return { rendered, missing: Array.from(new Set(missing)) };
}

export function defaultValues(t: NotificationTemplate): Record<string, string> {
  return Object.fromEntries(t.variables.map((v) => [v.key, v.sample]));
}
