/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props {
  agentName?: string
  departmentName?: string
  subject?: string
  customerName?: string
  channel?: string
  portalUrl?: string
}

const SupportNewChatAgentEmail = ({ agentName, departmentName, subject, customerName, channel, portalUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New support chat waiting · {departmentName || 'Support'}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>New support chat waiting</Heading>
          <Text style={s.text}>
            {agentName ? `Hi ${agentName},` : 'Hello,'} a new conversation has been routed to your
            queue and is awaiting a response.
          </Text>
          <Section style={s.infoBox}>
            {customerName && <Text style={s.infoRow}><span style={s.infoLabel}>Customer: </span>{customerName}</Text>}
            {subject && <Text style={s.infoRow}><span style={s.infoLabel}>Subject: </span>{subject}</Text>}
            {departmentName && <Text style={s.infoRow}><span style={s.infoLabel}>Department: </span>{departmentName}</Text>}
            {channel && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Channel: </span>{channel}</Text>}
          </Section>
          <Text style={s.text}>
            Please respond promptly to meet our service-level targets and provide the best
            experience for the customer.
          </Text>
          {portalUrl && (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={portalUrl} style={s.button}>Open conversation</Button>
            </Section>
          )}
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>You're receiving this because you're a support agent for this department.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SupportNewChatAgentEmail,
  subject: (data: Record<string, any>) => `New support chat · ${data?.subject || 'Awaiting response'}`,
  displayName: 'Support — new chat (agent alert)',
  previewData: {
    agentName: 'Marie K.',
    departmentName: 'Technical Support',
    subject: 'Card declined on payment',
    customerName: 'John Doe',
    channel: 'website',
    portalUrl: 'https://kob.lovable.app/admin/support-chat',
  },
} satisfies TemplateEntry
