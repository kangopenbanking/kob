/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props { name?: string; score?: number; band?: string; premium?: boolean; cta_url?: string }

const CrediQMonthlyReport = ({ name, score, band, premium, cta_url }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your monthly CrediQ report is ready</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} /></Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Your monthly CrediQ report{name ? `, ${name}` : ''}</Heading>
          <Text style={s.text}>Here is your end-of-month credit summary.</Text>
          <Section style={s.infoBox}>
            <Text style={s.amountLarge}>{score ?? '—'}</Text>
            <Text style={{ ...s.text, textAlign: 'center', margin: 0 }}>Score this month · {band || 'Unrated'}</Text>
          </Section>
          {premium ? (
            <Text style={s.text}>Your full report includes payment history, utilization trends, AI tips, and detailed factors.</Text>
          ) : (
            <Text style={s.text}>Unlock your full bureau-grade report, AI tips and change alerts with CrediQ Premium for 1,500 XAF / month.</Text>
          )}
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={cta_url || 'https://kangopenbanking.com/app/credit'} style={s.button}>
              {premium ? 'View full report' : 'Upgrade to Premium'}
            </Button>
          </Section>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>You receive this report monthly when enabled in CrediQ.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CrediQMonthlyReport,
  subject: (d: Record<string, any>) => `Your monthly CrediQ report — ${d.score ?? ''}`.trim(),
  displayName: 'CrediQ — Monthly report',
  previewData: { name: 'Alex', score: 712, band: 'Good', premium: false, cta_url: 'https://kangopenbanking.com/app/credit' },
} satisfies TemplateEntry
