/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; amount?: string; currency?: string; promisedDate?: string; reference?: string; ctaUrl?: string }

const PtpCreatedEmail = ({ name, amount, currency, promisedDate, reference, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Promise to Pay is scheduled — {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} /></Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Promise to Pay scheduled</Heading>
          <Text style={s.text}>{name ? `Hi ${name},` : 'Hello,'} we have recorded your Promise to Pay. Keeping to it will help build your credit score.</Text>
          <Section style={s.infoBox}>
            <Text style={s.infoRow}><span style={s.infoLabel}>Amount: </span>{amount} {currency || 'XAF'}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>Due: </span>{promisedDate}</Text>
            {reference && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Reference: </span>{reference}</Text>}
          </Section>
          <Text style={s.text}>You can reschedule from the app if circumstances change. Repeated rescheduling may impact your credit score.</Text>
          <CtaButton href={ctaUrl} label="View promise" fallbackPath="/app/more/loans/promise" />
        </Section>
        <Section style={s.footer}><Text style={s.footerText}>Automated notification from {s.SITE_NAME}.</Text></Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PtpCreatedEmail,
  subject: 'Your Promise to Pay is scheduled',
  displayName: 'Promise to Pay — created',
  previewData: { name: 'John', amount: '50,000', currency: 'XAF', promisedDate: '2026-07-01', reference: 'PTP-1234' },
} satisfies TemplateEntry
