/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props {
  agentName?: string
  departmentName?: string
  setupUrl?: string
}

const SupportAgentPasswordSetupEmail = ({ agentName, departmentName, setupUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Set your password to activate your support agent access</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Set your password</Heading>
          <Text style={s.text}>
            {agentName ? `Hi ${agentName},` : 'Hello,'} your support agent access
            {departmentName ? ` for ${departmentName}` : ''} is ready.
          </Text>
          <Section style={s.infoBox}>
            <Text style={{ ...s.infoRow, margin: '0' }}>
              <span style={s.infoLabel}>Important: </span>
              Use the secure button below to choose your password before signing in to the support workspace.
            </Text>
          </Section>
          {setupUrl && (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={setupUrl} style={s.button}>Set password</Button>
              <Text style={{ ...s.footerText, marginTop: '12px' }}>{setupUrl}</Text>
            </Section>
          )}
          <Text style={s.text}>
            If you were not expecting this access, you can safely ignore this email and contact your administrator.
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>This secure link was generated automatically by {s.SITE_NAME}.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SupportAgentPasswordSetupEmail,
  subject: (data: Record<string, any>) => `Set your ${s.BRAND_SHORT} support password${data?.departmentName ? ` · ${data.departmentName}` : ''}`,
  displayName: 'Support agent password setup',
  previewData: {
    agentName: 'Marie K.',
    departmentName: 'Technical Support',
    setupUrl: 'https://info.kangfintechsolutions.com/reset-password#type=recovery',
  },
} satisfies TemplateEntry