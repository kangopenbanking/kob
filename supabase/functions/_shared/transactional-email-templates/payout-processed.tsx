/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; amount?: string; currency?: string; bankAccount?: string; reference?: string; date?: string; status?: string; ctaUrl?: string }

const PayoutProcessedEmail = ({ name, amount, currency, bankAccount, reference, date, status, ctaUrl }: Props) => {
  const isFailed = status?.toLowerCase() === 'failed'
  const boxStyle = isFailed ? s.alertBox : s.successBox
  const color = isFailed ? '#991B1B' : '#166534'
  const icon = isFailed ? '✗' : '✓'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Payout of {amount || ''} {currency || 'XAF'} {isFailed ? 'failed' : 'processed'} — {s.BRAND_SHORT}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
          </Section>
          <Section style={s.body}>
            <Heading style={s.h1}>Payout {isFailed ? 'Failed' : 'Processed'}</Heading>
            <Text style={s.text}>
              {name ? `Hi ${name}, your` : 'Your'} merchant payout has been {isFailed ? 'unsuccessful' : 'processed'}.
            </Text>
            <Section style={boxStyle}>
              <Text style={{ ...(s.amountLarge as any), color }}>{icon} {amount || '0'} {currency || 'XAF'}</Text>
            </Section>
            <Section style={s.infoBox}>
              {bankAccount && <Text style={s.infoRow}><span style={s.infoLabel}>Bank Account: </span>{bankAccount}</Text>}
              {reference && <Text style={s.infoRow}><span style={s.infoLabel}>Reference: </span>{reference}</Text>}
              {date && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Date: </span>{date}</Text>}
            </Section>
            <Text style={s.text}>
              {isFailed
                ? 'Please verify your bank details and contact support if the issue persists.'
                : 'The funds should arrive in your bank account within 1–2 business days.'}
            </Text>
            <CtaButton href={ctaUrl} label="View payout details" fallbackPath="/merchant" />
          </Section>
          <Section style={s.footer}>
            <Text style={s.footerText}>This is an automated notification from {s.SITE_NAME}.</Text>
            <Text style={s.footerBrand}>{s.SITE_NAME} — Kang Standard for Innovation</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PayoutProcessedEmail,
  subject: (data: Record<string, any>) => `Payout of ${data.amount || ''} ${data.currency || 'XAF'} ${data.status?.toLowerCase() === 'failed' ? 'failed' : 'processed'}`,
  displayName: 'Payout processed',
  previewData: { name: 'Jane Smith', amount: '1,500,000', currency: 'XAF', bankAccount: '****7890', reference: 'PAY-2026-0034', date: '22 Mar 2026', status: 'Completed' },
} satisfies TemplateEntry
