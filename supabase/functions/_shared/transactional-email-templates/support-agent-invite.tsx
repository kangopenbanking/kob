/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props {
  agentName?: string
  departmentName?: string
  portalUrl?: string
  inviteSent?: boolean
}

const SupportAgentInviteEmail = ({ agentName, departmentName, portalUrl, inviteSent }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been added as a support agent — {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Welcome to the support team</Heading>
          <Text style={s.text}>
            {agentName ? `Hi ${agentName},` : 'Hello,'} you've been granted access as a support agent
            {departmentName ? ` for the ${departmentName} department` : ''}.
          </Text>
          {inviteSent && (
            <Section style={s.infoBox}>
              <Text style={{ ...s.infoRow, margin: '0' }}>
                <span style={s.infoLabel}>Next step: </span>
                A separate invitation email contains a secure link to set your password. Open that
                message first, then return here to sign in.
              </Text>
            </Section>
          )}
          <Text style={s.text}>
            Once your password is set, you can sign in to the support workspace at any time using the
            branded agent portal below.
          </Text>
          {portalUrl && (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={portalUrl} style={s.button}>Open agent portal</Button>
              <Text style={{ ...s.footerText, marginTop: '12px' }}>{portalUrl}</Text>
            </Section>
          )}
          <Text style={s.text}>
            If you weren't expecting this invitation, please ignore this email or contact your
            administrator.
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>This is an automated message from {s.SITE_NAME}.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SupportAgentInviteEmail,
  subject: (data: Record<string, any>) => `You've been added as a support agent${data?.departmentName ? ` · ${data.departmentName}` : ''}`,
  displayName: 'Support agent invitation',
  previewData: {
    agentName: 'Marie K.',
    departmentName: 'Technical Support',
    portalUrl: 'https://kob.lovable.app/support-agent',
    inviteSent: true,
  },
} satisfies TemplateEntry
