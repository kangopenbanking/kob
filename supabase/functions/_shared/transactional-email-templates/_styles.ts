/**
 * Shared KOB email styles — single source of truth for all transactional templates.
 */

export const SITE_NAME = 'Kang Open Banking'
export const BRAND_SHORT = 'KOB'
export const LOGO_URL = 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/storage/v1/object/public/email-assets/kob-logo-email.png'

// Brand colors (from index.css)
export const PRIMARY = '#0A3D91'       // hsl(217, 91%, 35%)
export const PRIMARY_LIGHT = '#2563EB' // hsl(217, 91%, 60%)
export const SECONDARY = '#16A34A'     // hsl(142, 76%, 36%)
export const FOREGROUND = '#1D2B3A'
export const MUTED = '#6B7B8D'
export const BORDER = '#E5E7EB'
export const BG_LIGHT = '#F9FAFB'

export const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
}

export const container = {
  padding: '0',
  maxWidth: '600px',
  margin: '0 auto',
}

export const header = {
  textAlign: 'center' as const,
  padding: '32px 40px 24px',
  borderBottom: `3px solid ${PRIMARY}`,
}

export const logo = {
  margin: '0 auto',
}

export const body = {
  padding: '32px 40px',
}

export const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: FOREGROUND,
  margin: '0 0 16px',
  lineHeight: '1.3',
}

export const text = {
  fontSize: '15px',
  color: MUTED,
  lineHeight: '1.7',
  margin: '0 0 20px',
}

export const textBold = {
  ...text,
  color: FOREGROUND,
  fontWeight: '600' as const,
}

export const button = {
  backgroundColor: PRIMARY,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block' as const,
  textAlign: 'center' as const,
}

export const buttonSecondary = {
  ...button,
  backgroundColor: SECONDARY,
}

export const infoBox = {
  backgroundColor: BG_LIGHT,
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 24px',
  border: `1px solid ${BORDER}`,
}

export const infoRow = {
  fontSize: '14px',
  color: MUTED,
  lineHeight: '1.6',
  margin: '0 0 8px',
}

export const infoLabel = {
  color: FOREGROUND,
  fontWeight: '600' as const,
}

export const alertBox = {
  backgroundColor: '#FEF2F2',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 24px',
  border: '1px solid #FECACA',
}

export const successBox = {
  backgroundColor: '#F0FDF4',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 24px',
  border: '1px solid #BBF7D0',
}

export const divider = {
  borderTop: `1px solid ${BORDER}`,
  margin: '24px 0',
}

export const footer = {
  padding: '24px 40px',
  backgroundColor: BG_LIGHT,
  borderTop: `1px solid ${BORDER}`,
  textAlign: 'center' as const,
}

export const footerText = {
  fontSize: '12px',
  color: '#9CA3AF',
  margin: '0 0 8px',
  lineHeight: '1.5',
}

export const footerBrand = {
  fontSize: '12px',
  color: PRIMARY,
  fontWeight: '600' as const,
  margin: '0',
}

export const badge = {
  display: 'inline-block' as const,
  padding: '4px 12px',
  borderRadius: '20px',
  fontSize: '13px',
  fontWeight: '600' as const,
}

export const badgeSuccess = {
  ...badge,
  backgroundColor: '#DCFCE7',
  color: '#166534',
}

export const badgeWarning = {
  ...badge,
  backgroundColor: '#FEF3C7',
  color: '#92400E',
}

export const badgeDanger = {
  ...badge,
  backgroundColor: '#FEE2E2',
  color: '#991B1B',
}

export const badgeInfo = {
  ...badge,
  backgroundColor: '#DBEAFE',
  color: '#1E40AF',
}

export const amountLarge = {
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: FOREGROUND,
  margin: '0 0 4px',
  textAlign: 'center' as const,
}
