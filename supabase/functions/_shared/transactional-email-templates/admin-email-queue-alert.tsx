/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props {
  adminName?: string
  alertTitle?: string
  alertMessage?: string
  severity?: 'info' | 'warning' | 'critical'
  metadata?: Record<string, any>
  dashboardUrl?: string
}

const AdminEmailQueueAlert = ({ adminName, alertTitle, alertMessage, severity, metadata, dashboardUrl }: Props) => {
  const sevColor = severity === 'critical' ? '#B91C1C' : severity === 'warning' ? '#B45309' : s.PRIMARY
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{alertTitle || 'Email queue alert'} — {s.BRAND_SHORT}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
          </Section>
          <Section style={s.body}>
            <Heading style={s.h1}>{alertTitle || 'Email queue alert'}</Heading>
            <Text style={s.text}>{adminName ? `Hi ${adminName},` : 'Hello admin,'}</Text>
            <Section style={{ ...s.infoBox, borderLeft: `4px solid ${sevColor}` }}>
              <Text style={{ ...s.infoRow, margin: '0 0 8px', fontWeight: 600, color: sevColor, textTransform: 'uppercase' as const, fontSize: '12px', letterSpacing: '0.05em' }}>
                {severity || 'warning'} severity
              </Text>
              <Text style={{ ...s.infoRow, margin: '0' }}>{alertMessage}</Text>
            </Section>
            {metadata && Object.keys(metadata).length > 0 && (
              <Section style={{ ...s.infoBox, marginTop: '16px' }}>
                {Object.entries(metadata).map(([k, v]) => (
                  <Text key={k} style={{ ...s.infoRow, margin: '0 0 4px' }}>
                    <span style={s.infoLabel}>{k}: </span>
                    <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </Text>
                ))}
              </Section>
            )}
            {dashboardUrl && (
              <Section style={{ textAlign: 'center', margin: '24px 0' }}>
                <Button href={dashboardUrl} style={s.button}>Open admin dashboard</Button>
              </Section>
            )}
            <Text style={s.text}>
              This is an automated alert. Please review the email queue dashboard
              and take corrective action.
            </Text>
          </Section>
          <Section style={s.footer}>
            <Text style={s.footerText}>This is an automated alert from {s.SITE_NAME}.</Text>
            <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AdminEmailQueueAlert,
  subject: (data: Record<string, any>) =>
    `[${(data?.severity || 'WARNING').toString().toUpperCase()}] ${data?.alertTitle || 'Email queue alert'}`,
  displayName: 'Admin email queue alert',
  previewData: {
    adminName: 'Admin',
    alertTitle: 'Email dead-letter queue is growing',
    alertMessage: '12 emails moved to the dead-letter queue in the last hour.',
    severity: 'critical',
    metadata: { dlq_count: 12, window: '1h', threshold: 5 },
    dashboardUrl: 'https://info.kangfintechsolutions.com/admin/invite-email-history',
  },
} satisfies TemplateEntry
