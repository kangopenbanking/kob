/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props {
  name?: string; amount?: string; currency?: string; transactionType?: string
  account?: string; reference?: string; date?: string; ctaUrl?: string
}

const HighValueAlertEmail = ({ name, amount, currency, transactionType, account, reference, date, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>⚠️ High-value {transactionType || 'transaction'} alert — {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>⚠️ High-Value Transaction Alert</Heading>
          <Text style={s.text}>
            {name ? `Dear ${name}, a` : 'A'} high-value {transactionType || 'transaction'} has been detected on your account.
          </Text>
          <Section style={s.alertBox}>
            <Text style={{ ...(s.amountLarge as any), color: '#991B1B' }}>{amount || '0'} {currency || 'XAF'}</Text>
            <Text style={{ ...s.infoRow, textAlign: 'center' as const, margin: '0', color: '#991B1B' }}>
              {transactionType || 'Transaction'} • Requires Attention
            </Text>
          </Section>
          <Section style={s.infoBox}>
            {account && <Text style={s.infoRow}><span style={s.infoLabel}>Account: </span>{account}</Text>}
            {reference && <Text style={s.infoRow}><span style={s.infoLabel}>Reference: </span>{reference}</Text>}
            {date && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Date: </span>{date}</Text>}
          </Section>
          <Text style={s.text}>
            If you authorised this transaction, no further action is required. If this transaction appears suspicious, please contact support immediately.
          </Text>
          <CtaButton href={ctaUrl} label="Review transaction" fallbackPath="/dashboard" />
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>This is an automated high-value alert from {s.SITE_NAME}.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME} — Kang Standard for Innovation</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: HighValueAlertEmail,
  subject: (data: Record<string, any>) => `⚠️ High-value ${data.transactionType || 'transaction'} alert — ${data.amount || ''} ${data.currency || 'XAF'}`,
  displayName: 'High-value transaction alert',
  previewData: { name: 'Senior Manager', amount: '5,000,000', currency: 'XAF', transactionType: 'withdrawal', account: '****4521', reference: 'HVT-2026-001', date: '22 Mar 2026' },
} satisfies TemplateEntry
