/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; changedAt?: string; ctaUrl?: string }

const PasswordChangedEmail = ({ name, changedAt, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {s.BRAND_SHORT} password was changed</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Password Changed</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, your` : 'Your'} {s.BRAND_SHORT} account password was successfully changed
            {changedAt ? ` on ${changedAt}` : ''}.
          </Text>
          <Section style={s.alertBox}>
            <Text style={{ ...s.text, margin: '0', color: '#991B1B' }}>
              ⚠️ If you did not make this change, please contact our support team immediately via live chat or secure your account by resetting your password.
            </Text>
          </Section>
          <Text style={s.text}>
            For your security, all other active sessions have been signed out.
          </Text>
          <CtaButton href={ctaUrl} label="Review security settings" fallbackPath="/security" />
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>This is an automated security notification from {s.SITE_NAME}.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME} — Kang Standard for Innovation</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PasswordChangedEmail,
  subject: `Your ${s.BRAND_SHORT} password was changed`,
  displayName: 'Password changed',
  previewData: { name: 'John Doe', changedAt: '22 Mar 2026, 14:30 UTC' },
} satisfies TemplateEntry
