/** Cameroon bank directory — used as fallback when Flutterwave API is unavailable */
export const CM_BANKS = [
  { code: '10005', name: 'Afriland First Bank', swift: 'AFRIACMCXXX' },
  { code: '10009', name: 'Atlantic Bank Cameroon', swift: 'ATCRCMCMXXX' },
  { code: '10017', name: 'Ecobank Cameroon', swift: 'ECOCCMCXXXX' },
  { code: '10023', name: 'Standard Chartered Bank Cameroon', swift: 'SCBLCMCXXXX' },
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
