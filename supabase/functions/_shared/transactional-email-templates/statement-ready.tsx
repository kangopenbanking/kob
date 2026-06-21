/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; period?: string; accountNumber?: string; ctaUrl?: string }

const StatementReadyEmail = ({ name, period, accountNumber, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {period || ''} account statement is ready — {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Account Statement Ready</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, your` : 'Your'} account statement{period ? ` for ${period}` : ''} is now available.
          </Text>
          <Section style={s.infoBox}>
            <Text style={s.infoRow}><span style={s.infoLabel}>Statement Period: </span>{period || 'Current'}</Text>
            {accountNumber && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Account: </span>{accountNumber}</Text>}
          </Section>
          <Text style={s.text}>
            You can download your statement from the Statements section in your {s.BRAND_SHORT} app.
          </Text>
          <CtaButton href={ctaUrl} label="Download statement" fallbackPath="/dashboard" />
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
  component: StatementReadyEmail,
  subject: (data: Record<string, any>) => `Your ${data.period || ''} statement is ready`,
  displayName: 'Account statement ready',
  previewData: { name: 'John Doe', period: 'March 2026', accountNumber: '****4521' },
} satisfies TemplateEntry
