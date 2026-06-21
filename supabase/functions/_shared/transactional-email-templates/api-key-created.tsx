/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; clientName?: string; environment?: string; createdAt?: string; ctaUrl?: string }

const ApiKeyCreatedEmail = ({ name, clientName, environment, createdAt, ctaUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New API credentials generated — {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>API Credentials Created</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, new` : 'New'} API credentials have been generated for your application.
          </Text>
          <Section style={s.infoBox}>
            {clientName && <Text style={s.infoRow}><span style={s.infoLabel}>Application: </span>{clientName}</Text>}
            {environment && <Text style={s.infoRow}><span style={s.infoLabel}>Environment: </span><span style={s.badgeInfo as any}>{environment}</span></Text>}
            {createdAt && <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Created: </span>{createdAt}</Text>}
          </Section>
          <Section style={s.alertBox}>
            <Text style={{ ...s.text, margin: '0', color: '#991B1B' }}>
              ⚠️ Your API secret was shown only once during creation. If you did not save it, you will need to regenerate your credentials.
            </Text>
          </Section>
          <Text style={s.text}>
            Refer to the {s.BRAND_SHORT} API documentation for integration guides and endpoint references.
          </Text>
          <CtaButton href={ctaUrl} label="Open developer portal" fallbackPath="/developer" />
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
  component: ApiKeyCreatedEmail,
  subject: `New API credentials generated — ${s.BRAND_SHORT}`,
  displayName: 'API key created',
  previewData: { name: 'Developer', clientName: 'My Banking App', environment: 'Sandbox', createdAt: '22 Mar 2026' },
} satisfies TemplateEntry
