/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props { name?: string; tip?: string; impact?: number; cta_url?: string }

const CrediQTipRecommendation = ({ name, tip, impact, cta_url }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A high-impact tip to grow your CrediQ score</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} /></Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Your top tip this week{name ? `, ${name}` : ''}</Heading>
          <Text style={s.text}>Based on your latest score, here is the action with the biggest expected impact:</Text>
          <Section style={s.infoBox}>
            <Text style={{ ...s.textBold, margin: '0 0 8px' }}>{tip || 'Pay down a high-utilization card by 20%.'}</Text>
            {impact ? (
              <Text style={{ ...s.text, margin: 0 }}>Estimated impact: <strong>+{impact} pts</strong></Text>
            ) : null}
          </Section>
          <Text style={s.text}>Open CrediQ to mark this done or see your full action plan.</Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={cta_url || 'https://kob.lovable.app/app/credit'} style={s.button}>View my tips</Button>
          </Section>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>Tips are sent weekly to CrediQ Premium members.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CrediQTipRecommendation,
  subject: (d: Record<string, any>) => `Your top CrediQ tip${d.impact ? ` (+${d.impact} pts)` : ''}`,
  displayName: 'CrediQ — Tip recommendation',
  previewData: { name: 'Alex', tip: 'Pay down your highest-utilization card by 20%.', impact: 18, cta_url: 'https://kob.lovable.app/app/credit' },
} satisfies TemplateEntry
