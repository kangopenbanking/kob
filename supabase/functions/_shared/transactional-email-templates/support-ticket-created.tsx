/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; subject?: string; department?: string; ticketId?: string; ctaUrl?: string }

const SupportTicketCreatedEmail = ({ name, subject, department, ticketId, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Support chat received — {s.BRAND_SHORT} team will respond shortly</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Support Chat Received</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, we` : 'We'} have received your support request and a member of our team will respond shortly.
          </Text>
          <Section style={s.infoBox}>
            {subject && <Text style={s.infoRow}><span style={s.infoLabel}>Subject: </span>{subject}</Text>}
            {department && <Text style={s.infoRow}><span style={s.infoLabel}>Department: </span>{department}</Text>}
            {ticketId && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Ticket: </span>{ticketId}</Text>}
          </Section>
          <Text style={s.text}>
            Our team typically responds within 15 minutes to 24 hours depending on the nature of your issue. You will be notified when an agent replies.
          </Text>
          <CtaButton href={ctaUrl} label="Open support chat" fallbackPath="/support" />
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
  component: SupportTicketCreatedEmail,
  subject: 'Your support request has been received',
  displayName: 'Support ticket created',
  previewData: { name: 'John Doe', subject: 'Unable to process payment', department: 'Technical Support', ticketId: 'SUP-2026-0189' },
} satisfies TemplateEntry
