/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props {
  subject?: string
  summaryLines?: string[]
  deepLink?: string
  conversationId?: string
  severity?: 'warning' | 'breach'
}

const SupportSlaSupervisorEmail = ({ subject, summaryLines, deepLink, severity }: Props) => {
  const isBreach = severity === 'breach'
  const boxStyle = isBreach ? s.alertBox : s.infoBox
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{subject || 'Support SLA notification'}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
          </Section>
          <Section style={s.body}>
            <Heading style={s.h1}>{subject || 'Service-level update'}</Heading>
            <Section style={boxStyle}>
              {(summaryLines || []).map((line, i) => (
                <Text key={i} style={{ ...s.infoRow, margin: i === (summaryLines!.length - 1) ? '0' : '0 0 8px' }}>
                  {line}
                </Text>
              ))}
            </Section>
            <Text style={s.text}>
              Open the conversation to review context and take action.
            </Text>
            {deepLink && (
              <Section style={{ textAlign: 'center', margin: '24px 0' }}>
                <Button href={deepLink} style={s.button}>Open conversation</Button>
                <Text style={{ ...s.footerText, marginTop: '12px' }}>{deepLink}</Text>
              </Section>
            )}
          </Section>
          <Section style={s.footer}>
            <Text style={s.footerText}>You're receiving this as the configured supervisor for this department.</Text>
            <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SupportSlaSupervisorEmail,
  subject: (data: Record<string, any>) => data?.subject || 'Support SLA notification',
  displayName: 'Support — SLA supervisor alert',
  previewData: {
    subject: 'SLA at risk · Technical Support',
    summaryLines: [
      'A live support chat has reached 80% of its 15-minute response target.',
      'Subject: Card declined on payment.',
      'No agent has responded yet.',
    ],
    deepLink: 'https://kob.lovable.app/admin/support-chat?conversation=demo',
    severity: 'warning',
  },
} satisfies TemplateEntry
