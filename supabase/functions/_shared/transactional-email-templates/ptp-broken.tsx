/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; missedAmount?: string; currency?: string; promisedDate?: string; ctaUrl?: string }

const PtpBrokenEmail = ({ name, missedAmount, currency, promisedDate, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Promise to Pay was not kept</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} /></Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Promise to Pay not kept</Heading>
          <Text style={s.text}>{name ? `Hi ${name},` : 'Hello,'} the Promise to Pay due on {promisedDate} was not settled in full. A credit score penalty has been applied.</Text>
          <Section style={s.alertBox}>
            <Text style={s.infoRow}><span style={s.infoLabel}>Missed amount: </span>{missedAmount} {currency || 'XAF'}</Text>
            <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Status: </span>Broken</Text>
          </Section>
          <Text style={s.text}>You can still settle the outstanding balance and set a new Promise to Pay. Consistent payments improve your credit score over time.</Text>
          <CtaButton href={ctaUrl} label="Settle now" fallbackPath="/app/more/loans/promise" />
        </Section>
        <Section style={s.footer}><Text style={s.footerText}>Automated notification from {s.SITE_NAME}.</Text></Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PtpBrokenEmail,
  subject: 'Your Promise to Pay was not kept',
  displayName: 'Promise to Pay — broken',
  previewData: { name: 'John', missedAmount: '30,000', currency: 'XAF', promisedDate: '2026-06-15' },
} satisfies TemplateEntry
