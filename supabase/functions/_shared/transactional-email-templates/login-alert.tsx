/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; device?: string; location?: string; time?: string; ctaUrl?: string }

const LoginAlertEmail = ({ name, device, location, time, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New sign-in to your {s.BRAND_SHORT} account</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>New Sign-In Detected</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, we` : 'We'} detected a new sign-in to your {s.BRAND_SHORT} account.
          </Text>
          <Section style={s.infoBox}>
            {device && <Text style={s.infoRow}><span style={s.infoLabel}>Device: </span>{device}</Text>}
            {location && <Text style={s.infoRow}><span style={s.infoLabel}>Location: </span>{location}</Text>}
            {time && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Time: </span>{time}</Text>}
          </Section>
          <Section style={s.alertBox}>
            <Text style={{ ...s.text, margin: '0', color: '#991B1B' }}>
              If this wasn't you, please change your password immediately and contact support.
            </Text>
          </Section>
          <CtaButton href={ctaUrl} label="Review security settings" fallbackPath="/security" />
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>This is an automated security notification from {s.SITE_NAME}.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME} — Kang Standard for Innovation</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LoginAlertEmail,
  subject: `New sign-in to your ${s.BRAND_SHORT} account`,
  displayName: 'New device login alert',
  previewData: { name: 'John Doe', device: 'Chrome on macOS', location: 'Douala, Cameroon', time: '22 Mar 2026, 14:30 UTC' },
} satisfies TemplateEntry
