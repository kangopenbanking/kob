/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { appUrl } from './_cta.tsx'

interface Props { name?: string; cta_url?: string }

const CrediQBasicCheckUnlocked = ({ name, cta_url }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your CrediQ basic check is complete — your score is unlocking</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} /></Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Basic check complete{name ? `, ${name}` : ''}</Heading>
          <Section style={s.successBox}>
            <Text style={{ ...s.text, textAlign: 'center', margin: 0 }}>
              Your identity, phone and profile checks all passed. Your CrediQ score is being calculated now.
            </Text>
          </Section>
          <Text style={s.text}>
            You can view your score, boost factors, and see personalised tips in the CrediQ dashboard.
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={cta_url || appUrl('/app/credit')} style={s.button}>View my score</Button>
          </Section>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>You received this because you just completed identity verification with CrediQ.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CrediQBasicCheckUnlocked,
  subject: 'Your CrediQ basic check is complete',
  displayName: 'CrediQ — Basic check complete',
  previewData: { name: 'Alex', cta_url: 'https://info.kangfintechsolutions.com/app/credit' },
} satisfies TemplateEntry
