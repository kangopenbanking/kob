/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; paidAmount?: string; remaining?: string; currency?: string; promisedDate?: string; ctaUrl?: string }

const PtpPartialEmail = ({ name, paidAmount, remaining, currency, promisedDate, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Partial payment received on your Promise to Pay</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} /></Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Partial payment received</Heading>
          <Text style={s.text}>{name ? `Hi ${name},` : 'Hello,'} thank you for your payment toward your Promise to Pay.</Text>
          <Section style={s.infoBox}>
            <Text style={s.infoRow}><span style={s.infoLabel}>Received: </span>{paidAmount} {currency || 'XAF'}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>Remaining: </span>{remaining} {currency || 'XAF'}</Text>
            <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Due: </span>{promisedDate}</Text>
          </Section>
          <Text style={s.text}>Settle the remaining balance before the due date to keep your promise and avoid a credit score penalty.</Text>
          <CtaButton href={ctaUrl} label="Pay remaining" fallbackPath="/app/more/loans/promise" />
        </Section>
        <Section style={s.footer}><Text style={s.footerText}>Automated notification from {s.SITE_NAME}.</Text></Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PtpPartialEmail,
  subject: 'Partial payment received on your Promise to Pay',
  displayName: 'Promise to Pay — partial',
  previewData: { name: 'John', paidAmount: '20,000', remaining: '30,000', currency: 'XAF', promisedDate: '2026-07-01' },
} satisfies TemplateEntry
