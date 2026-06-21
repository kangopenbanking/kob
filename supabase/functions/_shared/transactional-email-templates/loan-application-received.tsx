/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; loanType?: string; amount?: string; currency?: string; reference?: string; ctaUrl?: string }

const LoanApplicationReceivedEmail = ({ name, loanType, amount, currency, reference, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {loanType || 'loan'} application has been received — {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Loan Application Received</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, we` : 'We'} have received your {loanType || 'loan'} application and it is now under review.
          </Text>
          <Section style={s.infoBox}>
            {loanType && <Text style={s.infoRow}><span style={s.infoLabel}>Loan Type: </span>{loanType}</Text>}
            {amount && <Text style={s.infoRow}><span style={s.infoLabel}>Amount Requested: </span>{amount} {currency || 'XAF'}</Text>}
            {reference && <Text style={s.infoRow}><span style={s.infoLabel}>Reference: </span>{reference}</Text>}
            <Text style={{ ...s.infoRow, margin: '0' }}>
              <span style={s.infoLabel}>Status: </span>
              <span style={s.badgeInfo as any}>Under Review</span>
            </Text>
          </Section>
          <Text style={s.text}>
            Our team will review your application and you will be notified once a decision has been made.
            This typically takes 1–3 business days.
          </Text>
          <CtaButton href={ctaUrl} label="View loan status" fallbackPath="/loans" />
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
  component: LoanApplicationReceivedEmail,
  subject: (data: Record<string, any>) => `Your ${data.loanType || 'loan'} application has been received`,
  displayName: 'Loan application received',
  previewData: { name: 'John Doe', loanType: 'Personal Loan', amount: '2,000,000', currency: 'XAF', reference: 'LOAN-2026-0045' },
} satisfies TemplateEntry
