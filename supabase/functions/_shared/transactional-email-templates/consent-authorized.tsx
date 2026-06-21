/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; tppName?: string; permissions?: string; expiresAt?: string; consentId?: string; ctaUrl?: string }

const ConsentAuthorizedEmail = ({ name, tppName, permissions, expiresAt, consentId, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Open Banking consent granted to {tppName || 'a third party'} — {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Consent Authorised</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, you` : 'You'} have authorised {tppName || 'a third-party provider'} to access your account data.
          </Text>
          <Section style={s.infoBox}>
            {tppName && <Text style={s.infoRow}><span style={s.infoLabel}>Provider: </span>{tppName}</Text>}
            {permissions && <Text style={s.infoRow}><span style={s.infoLabel}>Permissions: </span>{permissions}</Text>}
            {expiresAt && <Text style={s.infoRow}><span style={s.infoLabel}>Expires: </span>{expiresAt}</Text>}
            {consentId && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Consent ID: </span>{consentId}</Text>}
          </Section>
          <Text style={s.text}>
            You can revoke this consent at any time from the Consents section in your {s.BRAND_SHORT} app.
          </Text>
          <CtaButton href={ctaUrl} label="Manage consents" fallbackPath="/consents" />
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
  component: ConsentAuthorizedEmail,
  subject: (data: Record<string, any>) => `Open Banking consent granted to ${data.tppName || 'a third party'}`,
  displayName: 'Consent authorised',
  previewData: { name: 'John Doe', tppName: 'FinTech Solutions Ltd', permissions: 'Account balance, Transaction history', expiresAt: '22 Jun 2026', consentId: 'CST-2026-0088' },
} satisfies TemplateEntry
