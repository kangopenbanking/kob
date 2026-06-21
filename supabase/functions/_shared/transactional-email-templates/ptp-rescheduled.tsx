/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; newDate?: string; amount?: string; currency?: string; reason?: string; isRepeat?: boolean; ctaUrl?: string }

const PtpRescheduledEmail = ({ name, newDate, amount, currency, reason, isRepeat, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Promise to Pay has been rescheduled</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} /></Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Promise to Pay rescheduled</Heading>
          <Text style={s.text}>{name ? `Hi ${name},` : 'Hello,'} your Promise to Pay has been moved to a new date.</Text>
          <Section style={s.infoBox}>
            <Text style={s.infoRow}><span style={s.infoLabel}>Amount: </span>{amount} {currency || 'XAF'}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>New due date: </span>{newDate}</Text>
            {reason && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Reason: </span>{reason}</Text>}
          </Section>
          {isRepeat
            ? <Text style={s.text}>This is a repeat reschedule within 30 days, which applies a small credit score penalty. Keeping the new date will protect your score from further impact.</Text>
            : <Text style={s.text}>One-off reschedules do not affect your credit score, but keeping the new date is important.</Text>}
          <CtaButton href={ctaUrl} label="View promise" fallbackPath="/app/more/loans/promise" />
        </Section>
        <Section style={s.footer}><Text style={s.footerText}>Automated notification from {s.SITE_NAME}.</Text></Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PtpRescheduledEmail,
  subject: 'Your Promise to Pay has been rescheduled',
  displayName: 'Promise to Pay — rescheduled',
  previewData: { name: 'John', newDate: '2026-07-15', amount: '50,000', currency: 'XAF', reason: 'Salary delay', isRepeat: false },
} satisfies TemplateEntry
