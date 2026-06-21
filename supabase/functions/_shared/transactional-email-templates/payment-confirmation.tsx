/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props {
  name?: string; amount?: string; currency?: string; recipient?: string
  reference?: string; date?: string; status?: string; ctaUrl?: string
}

const PaymentConfirmationEmail = ({ name, amount, currency, recipient, reference, date, status, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Payment of {amount || ''} {currency || 'XAF'} confirmed — {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Payment Confirmed</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, your` : 'Your'} payment has been processed successfully.
          </Text>
          <Section style={s.infoBox}>
            <Text style={{ ...(s.amountLarge as any) }}>{amount || '0'} {currency || 'XAF'}</Text>
            {recipient && <Text style={s.infoRow}><span style={s.infoLabel}>To: </span>{recipient}</Text>}
            {reference && <Text style={s.infoRow}><span style={s.infoLabel}>Reference: </span>{reference}</Text>}
            {date && <Text style={s.infoRow}><span style={s.infoLabel}>Date: </span>{date}</Text>}
            <Text style={{ ...s.infoRow, margin: '0' }}>
              <span style={s.infoLabel}>Status: </span>
              <span style={s.badgeSuccess as any}>{status || 'Completed'}</span>
            </Text>
          </Section>
          <Text style={s.text}>
            You can view the full transaction details in your {s.BRAND_SHORT} app.
          </Text>
          <CtaButton href={ctaUrl} label="View transaction" fallbackPath="/dashboard" />
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
  component: PaymentConfirmationEmail,
  subject: (data: Record<string, any>) => `Payment of ${data.amount || ''} ${data.currency || 'XAF'} confirmed`,
  displayName: 'Payment confirmation',
  previewData: { name: 'John Doe', amount: '250,000', currency: 'XAF', recipient: 'Jane Smith', reference: 'TXN-2026-0322-ABC', date: '22 Mar 2026', status: 'Completed' },
} satisfies TemplateEntry
