export const COUNTRY_CODES = [
  { code: '+237', country: 'Cameroon', flag: '🇨🇲' },
  { code: '+1', country: 'USA', flag: '🇺🇸' },
  { code: '+1', country: 'Canada', flag: '🇨🇦' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+223', country: 'Mali', flag: '🇲🇱' },
  { code: '+226', country: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];
