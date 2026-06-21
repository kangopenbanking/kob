/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; agentName?: string; messagePreview?: string; subject?: string; ctaUrl?: string }

const SupportReplyEmail = ({ name, agentName, messagePreview, subject, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New reply from {s.BRAND_SHORT} Support{agentName ? ` — ${agentName}` : ''}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>New Support Reply</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, ` : ''}{agentName || 'A support agent'} has replied to your support chat{subject ? ` regarding "${subject}"` : ''}.
          </Text>
          {messagePreview && (
            <Section style={s.infoBox}>
              <Text style={{ ...s.text, margin: '0', fontStyle: 'italic' as const }}>"{messagePreview}"</Text>
            </Section>
          )}
          <Text style={s.text}>
            Open your {s.BRAND_SHORT} app to view the full conversation and respond.
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
  component: SupportReplyEmail,
  subject: (data: Record<string, any>) => `New reply from ${s.BRAND_SHORT} Support${data.subject ? `: ${data.subject}` : ''}`,
  displayName: 'Support agent reply',
  previewData: { name: 'John Doe', agentName: 'Marie K.', messagePreview: 'I have looked into your issue and here is what I found...', subject: 'Payment issue' },
} satisfies TemplateEntry
