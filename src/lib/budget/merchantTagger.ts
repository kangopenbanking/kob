// Client-side merchant → category classifier for Cameroon mobile money flows
const MERCHANT_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /MTN\s*(AIRTIME|DATA|BUNDLE|CREDIT)/i, category: "cat_airtime" },
  { pattern: /ORANGE\s*(CREDIT|DATA|BUNDLE|AIRTIME)/i, category: "cat_airtime" },
  { pattern: /NEXTTEL|CAMTEL/i, category: "cat_airtime" },
  { pattern: /ENEO/i, category: "cat_utilities" },
  { pattern: /CAMWATER|CDE\s*EAU/i, category: "cat_utilities" },
  { pattern: /CANAL\s*\+?|CANALSAT|DSTV/i, category: "cat_entertainment" },
  { pattern: /YANGO|INDRIVER|UBER|TAXI|BOLT/i, category: "cat_transport" },
  { pattern: /CAMRAIL|BUS\s*(STATION|VOYAGEUR)|GENERAL\s*VOYAGE/i, category: "cat_transport" },
  { pattern: /SCHOOL\s*FEES|FRAIS\s*SCOL|UNIVERSITY|ÉCOLE|LYCÉE|COLLEGE/i, category: "cat_education" },
  { pattern: /PHARMACIE|PHARMACY|HOPITAL|HOSPITAL|CLINIQUE|CLINIC|MEDECIN/i, category: "cat_health" },
  { pattern: /MARCHÉ|MARCHE|MARKET|SUPERMARCHE|SUPERMARKET|AUCHAN|SCORE|MAHIMA|DOVV/i, category: "cat_food" },
  { pattern: /BOULANGERIE|BAKERY|RESTAURANT|RESTO|MAQUIS/i, category: "cat_food" },
  { pattern: /NJANGI|TONTINE|COTISATION\s*GROUPE/i, category: "cat_njangi" },
  { pattern: /WESTERN\s*UNION|MONEY\s*GRAM|WAVE|WIZALL|CEMAC\s*TRANSFER|RIA/i, category: "cat_remittance" },
];

export function tagMerchant(description: string): string {
  if (!description) return "cat_other";
  for (const rule of MERCHANT_RULES) if (rule.pattern.test(description)) return rule.category;
  return "cat_other";
}
