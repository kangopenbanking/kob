/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; businessName?: string; merchantId?: string; ctaUrl?: string }

const MerchantOnboardedEmail = ({ name, businessName, merchantId, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {s.BRAND_SHORT} — {businessName || 'Your business'} is now live</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Merchant Account Activated</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, congratulations!` : 'Congratulations!'} {businessName || 'Your business'} has been successfully onboarded to {s.SITE_NAME}.
          </Text>
          <Section style={s.successBox}>
            <Text style={{ ...s.text, margin: '0', color: '#166534' }}>
              ✓ Your merchant account is active and ready to accept payments
            </Text>
          </Section>
          <Section style={s.infoBox}>
            {businessName && <Text style={s.infoRow}><span style={s.infoLabel}>Business: </span>{businessName}</Text>}
            {merchantId && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Merchant ID: </span>{merchantId}</Text>}
          </Section>
          <Text style={s.text}>
            You can now:
          </Text>
          <Text style={s.text}>
            • Accept payments via POS, QR code, and online checkout{'\n'}
            • View real-time transaction analytics{'\n'}
            • Manage payouts and settlements{'\n'}
            • Access the merchant API for custom integrations
          </Text>
          <CtaButton href={ctaUrl} label="Open merchant dashboard" fallbackPath="/merchant" />
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>This is an automated notification from {s.SITE_NAME}.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME} — Kang Standard for Innovation</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MerchantOnboardedEmail,
  subject: (data: Record<string, any>) => `${data.businessName || 'Your business'} is now live on ${s.BRAND_SHORT}`,
  displayName: 'Merchant onboarded',
  previewData: { name: 'Jane Smith', businessName: 'Café Prestige Douala', merchantId: 'MRC-2026-0012' },
} satisfies TemplateEntry
