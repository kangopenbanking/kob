/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; portal?: string; ctaUrl?: string }

const WelcomeEmail = ({ name, portal, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {s.SITE_NAME} — Your Open Banking journey starts now</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>{name ? `Welcome, ${name}!` : 'Welcome to Kang Open Banking!'}</Heading>
          <Text style={s.text}>
            Thank you for joining {s.SITE_NAME}. Your account has been created and you're ready to explore
            the future of open banking{portal ? ` on the ${portal}` : ''}.
          </Text>
          <Section style={s.successBox}>
            <Text style={{ ...s.text, margin: '0', color: '#166534' }}>
              ✓ Your account is active and ready to use
            </Text>
          </Section>
          <Text style={s.text}>
            Here's what you can do next:
          </Text>
          <Text style={s.text}>
            • Complete your profile and KYC verification{'\n'}
            • Explore available banking services{'\n'}
            • Connect with financial institutions{'\n'}
            • Access the API developer portal
          </Text>
          <Text style={s.text}>
            If you need any assistance, our support team is available via live chat in your app.
          </Text>
          <CtaButton href={ctaUrl} label="Open your dashboard" fallbackPath="/dashboard" />
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>This is an automated message from {s.SITE_NAME}.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME} — Kang Standard for Innovation</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: (data: Record<string, any>) => `Welcome to ${s.SITE_NAME}${data.name ? `, ${data.name}` : ''}`,
  displayName: 'Welcome',
  previewData: { name: 'John Doe', portal: 'Consumer App' },
} satisfies TemplateEntry
