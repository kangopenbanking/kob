/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; amount?: string; currency?: string; promisedDate?: string; ctaUrl?: string }

const PtpKeptEmail = ({ name, amount, currency, promisedDate, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You kept your Promise to Pay — your credit score has improved</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} /></Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Promise to Pay kept</Heading>
          <Text style={s.text}>{name ? `Hi ${name},` : 'Hello,'} thank you for keeping your Promise to Pay. A positive credit event has been recorded.</Text>
          <Section style={s.successBox}>
            <Text style={s.infoRow}><span style={s.infoLabel}>Settled: </span>{amount} {currency || 'XAF'}</Text>
            <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Due date: </span>{promisedDate}</Text>
          </Section>
          <Text style={s.text}>Consistent on-time payments steadily improve your credit score and unlock better loan terms.</Text>
          <CtaButton href={ctaUrl} label="View credit score" fallbackPath="/app/more/credit" />
        </Section>
        <Section style={s.footer}><Text style={s.footerText}>Automated notification from {s.SITE_NAME}.</Text></Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PtpKeptEmail,
  subject: 'You kept your Promise to Pay',
  displayName: 'Promise to Pay — kept',
  previewData: { name: 'John', amount: '50,000', currency: 'XAF', promisedDate: '2026-07-01' },
} satisfies TemplateEntry
