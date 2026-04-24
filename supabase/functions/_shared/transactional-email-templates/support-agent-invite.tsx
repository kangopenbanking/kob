/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props {
  agentName?: string;
  email?: string;
  tempPassword?: string;
  loginUrl?: string;
  inviterName?: string;
  departments?: string;
}

const SupportAgentInviteEmail = ({ agentName, email, tempPassword, loginUrl, inviterName, departments }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join the {s.BRAND_SHORT} Support team</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Welcome to the Support Team</Heading>
          <Text style={s.text}>
            {agentName ? `Hi ${agentName},` : 'Hello,'} {inviterName ? `${inviterName} has invited you` : 'You have been invited'} to join the {s.SITE_NAME} support team as a live chat agent.
          </Text>

          <Section style={s.infoBox}>
            <Text style={s.infoRow}><span style={s.infoLabel}>Email: </span>{email}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>Temporary password: </span><code style={{ fontFamily: 'monospace', background: s.BG_LIGHT, padding: '2px 6px', borderRadius: '4px' }}>{tempPassword}</code></Text>
            {departments && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Departments: </span>{departments}</Text>}
          </Section>

          <Text style={s.text}>
            Sign in below using the credentials above. You will be required to set a new password on your first login.
          </Text>

          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={loginUrl} style={s.button}>Sign in to Agent Console</Button>
          </Section>

          <Text style={{ ...s.text, fontSize: '13px', color: s.MUTED }}>
            For security, please do not share this password. If you did not expect this invitation, you can safely ignore this email.
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>This is an automated invitation from {s.SITE_NAME}.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME} — Kang Standard for Innovation</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SupportAgentInviteEmail,
  subject: 'You have been invited to join the support team',
  displayName: 'Support agent invitation',
  previewData: {
    agentName: 'Marie K.',
    email: 'marie@example.com',
    tempPassword: 'Tmp-A8x3-Kq9z',
    loginUrl: 'https://info.kangfintechsolutions.com/support-agent',
    inviterName: 'Admin',
    departments: 'Technical Support, Billing',
  },
} satisfies TemplateEntry
