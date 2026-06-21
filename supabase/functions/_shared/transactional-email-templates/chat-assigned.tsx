/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { agentName?: string; customerName?: string; subject?: string; department?: string; priority?: string; ctaUrl?: string }

const ChatAssignedEmail = ({ agentName, customerName, subject, department, priority, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Support chat assigned to you — {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Chat Assigned to You</Heading>
          <Text style={s.text}>
            {agentName ? `Hi ${agentName}, a` : 'A'} support chat has been assigned to you.
          </Text>
          <Section style={s.infoBox}>
            {customerName && <Text style={s.infoRow}><span style={s.infoLabel}>Customer: </span>{customerName}</Text>}
            {subject && <Text style={s.infoRow}><span style={s.infoLabel}>Subject: </span>{subject}</Text>}
            {department && <Text style={s.infoRow}><span style={s.infoLabel}>Department: </span>{department}</Text>}
            {priority && <Text style={{ ...s.infoRow, margin: '0' }}>
              <span style={s.infoLabel}>Priority: </span>
              <span style={(priority === 'urgent' || priority === 'high' ? s.badgeDanger : priority === 'medium' ? s.badgeWarning : s.badgeInfo) as any}>{priority}</span>
            </Text>}
          </Section>
          <Text style={s.text}>
            Please log in to the admin dashboard to respond to this customer's request promptly.
          </Text>
          <CtaButton href={ctaUrl} label="Open admin support chat" fallbackPath="/admin/support-chat" />
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
  component: ChatAssignedEmail,
  subject: (data: Record<string, any>) => `Support chat assigned: ${data.subject || 'New conversation'}`,
  displayName: 'Chat assigned to agent',
  previewData: { agentName: 'Marie K.', customerName: 'John Doe', subject: 'Payment issue', department: 'Technical Support', priority: 'high' },
} satisfies TemplateEntry
