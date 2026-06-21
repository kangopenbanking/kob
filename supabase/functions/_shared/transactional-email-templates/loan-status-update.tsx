/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; loanType?: string; amount?: string; currency?: string; status?: string; reason?: string; reference?: string; ctaUrl?: string }

const LoanStatusUpdateEmail = ({ name, loanType, amount, currency, status, reason, reference, ctaUrl }: Props) => {
  const isApproved = status?.toLowerCase() === 'approved'
  const isRejected = status?.toLowerCase() === 'rejected'
  const boxStyle = isApproved ? s.successBox : isRejected ? s.alertBox : s.infoBox
  const statusColor = isApproved ? '#166534' : isRejected ? '#991B1B' : s.FOREGROUND
  const statusBadge = isApproved ? s.badgeSuccess : isRejected ? s.badgeDanger : s.badgeInfo

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {loanType || 'loan'} application has been {status || 'updated'} — {s.BRAND_SHORT}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
          </Section>
          <Section style={s.body}>
            <Heading style={s.h1}>Loan Application {isApproved ? 'Approved' : isRejected ? 'Declined' : 'Updated'}</Heading>
            <Text style={s.text}>
              {name ? `Hi ${name}, your` : 'Your'} {loanType || 'loan'} application has been reviewed.
            </Text>
            <Section style={boxStyle}>
              <Text style={{ ...(s.amountLarge as any), color: statusColor }}>{isApproved ? '✓' : isRejected ? '✗' : 'ℹ'} {status || 'Updated'}</Text>
              {amount && <Text style={{ ...s.infoRow, textAlign: 'center' as const, margin: '0' }}>{amount} {currency || 'XAF'}</Text>}
            </Section>
            <Section style={s.infoBox}>
              {reference && <Text style={s.infoRow}><span style={s.infoLabel}>Reference: </span>{reference}</Text>}
              <Text style={{ ...s.infoRow, margin: '0' }}>
                <span style={s.infoLabel}>Decision: </span>
                <span style={statusBadge as any}>{status || 'Pending'}</span>
              </Text>
            </Section>
            {reason && <Text style={s.text}><span style={s.infoLabel}>Note: </span>{reason}</Text>}
            <Text style={s.text}>
              {isApproved
                ? 'The approved funds will be disbursed to your designated account. You will receive a confirmation once the transfer is complete.'
                : isRejected
                  ? 'If you have questions about this decision or would like to discuss alternative options, please contact our support team.'
                  : 'Please log in to your app for full details.'}
            </Text>
            <CtaButton href={ctaUrl} label="View loan details" fallbackPath="/loans" />
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
  component: LoanStatusUpdateEmail,
  subject: (data: Record<string, any>) => `Your ${data.loanType || 'loan'} application has been ${data.status || 'updated'}`,
  displayName: 'Loan status update',
  previewData: { name: 'John Doe', loanType: 'Personal Loan', amount: '2,000,000', currency: 'XAF', status: 'Approved', reference: 'LOAN-2026-0045' },
} satisfies TemplateEntry
