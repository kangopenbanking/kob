/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; amount?: string; currency?: string; sender?: string; reference?: string; date?: string; ctaUrl?: string }

const PaymentReceivedEmail = ({ name, amount, currency, sender, reference, date, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You received {amount || ''} {currency || 'XAF'} — {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Payment Received</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, you` : 'You'} have received a new payment.
          </Text>
          <Section style={s.successBox}>
            <Text style={{ ...(s.amountLarge as any), color: '#166534' }}>+{amount || '0'} {currency || 'XAF'}</Text>
            {sender && <Text style={{ ...s.infoRow, textAlign: 'center' as const, margin: '0' }}>From: {sender}</Text>}
          </Section>
          <Section style={s.infoBox}>
            {reference && <Text style={s.infoRow}><span style={s.infoLabel}>Reference: </span>{reference}</Text>}
            {date && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Date: </span>{date}</Text>}
          </Section>
          <Text style={s.text}>
            The funds are now available in your account.
          </Text>
          <CtaButton href={ctaUrl} label="Open your wallet" fallbackPath="/dashboard" />
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
  component: PaymentReceivedEmail,
  subject: (data: Record<string, any>) => `You received ${data.amount || ''} ${data.currency || 'XAF'}`,
  displayName: 'Payment received',
  previewData: { name: 'John Doe', amount: '150,000', currency: 'XAF', sender: 'Acme Corp Ltd', reference: 'INV-2026-0091', date: '22 Mar 2026' },
} satisfies TemplateEntry
