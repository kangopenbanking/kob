/** Cameroon bank directory — single source of truth for all payment pages */
export const CM_BANKS = [
  { code: '10005', name: 'Afriland First Bank', swift: 'AFRIACMCXXX' },
  { code: '10009', name: 'Atlantic Bank Cameroon', swift: 'ATCRCMCMXXX' },
  { code: '10017', name: 'Ecobank Cameroon', swift: 'ECOCCMCXXXX' },
  { code: '10023', name: 'Standard Chartered Bank Cameroon', swift: 'SCBLCMCXXXX' },
  { code: '10025', name: 'Citibank N.A. Cameroon', swift: 'CITICMCXXXX' },
  { code: '10029', name: 'BICEC', swift: 'BICECMCXXXX' },
  { code: '10033', name: 'Société Générale Cameroun', swift: 'SGCMCMCXXXX' },
  { code: '10038', name: 'United Bank for Africa (UBA) Cameroon', swift: 'UNAFCMCXXXX' },
  { code: '10039', name: 'NFC Bank', swift: 'NFBKCMCXXXX' },
  { code: '10041', name: 'Commercial Bank of Cameroon (CBC)', swift: 'CBCRCMCXXXX' },
  { code: '10050', name: 'BGFI Bank Cameroon', swift: 'BGFICMCXXXX' },
  { code: '10055', name: 'CCA Bank', swift: 'CCAICMCXXXX' },
  { code: '10060', name: 'National Financial Credit Bank', swift: 'NFCBCMCXXXX' },
  { code: '10065', name: 'Banque Camerounaise des PME (BC-PME)', swift: 'BCPMCMCXXXX' },
  { code: '10070', name: 'Union Bank of Cameroon (UBC)', swift: 'UBCMCMCXXXX' },
] as const;

export type CameroonBank = typeof CM_BANKS[number];

/** RIB structure for Cameroon accounts */
export const CM_RIB_STRUCTURE = {
  bank_code: { position: '1-5', length: 5 },
  branch_code: { position: '6-10', length: 5 },
  account_number: { position: '11-21', length: 11 },
  rib_key: { position: '22-23', length: 2 },
  total_length: 23,
} as const;

/** IBAN format for Cameroon */
export const CM_IBAN = {
  prefix: 'CM21',
  length: 27,
} as const;

/** Mobile Money providers in Cameroon */
export const CM_MOMO_PROVIDERS = [
  { id: 'mtn_momo', name: 'MTN Mobile Money', prefix: '+237 67/65', ussd: '*126#' },
  { id: 'orange_money', name: 'Orange Money', prefix: '+237 69/65', ussd: '#150#' },
] as const;

/** Supported currencies for the Cameroon region */
export const CM_CURRENCIES = [
  { code: 'XAF', name: 'CFA Franc BEAC', symbol: 'FCFA', flag: '🇨🇲', decimals: 0 },
  { code: 'XOF', name: 'CFA Franc BCEAO', symbol: 'FCFA', flag: '🇸🇳', decimals: 0 },
] as const;

/** Resolve a bank name from its code */
export function getBankName(code: string): string {
  return CM_BANKS.find(b => b.code === code)?.name || code;
}

/** Resolve a bank SWIFT/BIC from its code */
export function getBankSwift(code: string): string | undefined {
  return CM_BANKS.find(b => b.code === code)?.swift;
}

/** Validate a 23-digit Cameroon RIB */
export function isValidRIB(rib: string): boolean {
  const clean = rib.replace(/\s/g, '');
  return /^\d{23}$/.test(clean);
}

/** Validate a Cameroon IBAN (CM21 + 23 digits = 27 chars) */
export function isValidCameroonIBAN(iban: string): boolean {
  const clean = iban.replace(/\s/g, '').toUpperCase();
  return /^CM21\d{23}$/.test(clean);
}

/** Parse a RIB into its components */
export function parseRIB(rib: string) {
  const clean = rib.replace(/\s/g, '');
  if (!isValidRIB(clean)) return null;
  return {
    bank_code: clean.slice(0, 5),
    branch_code: clean.slice(5, 10),
    account_number: clean.slice(10, 21),
    rib_key: clean.slice(21, 23),
  };
}
