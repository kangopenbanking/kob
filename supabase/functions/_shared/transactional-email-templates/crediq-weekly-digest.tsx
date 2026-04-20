/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props { name?: string; score?: number; band?: string; cta_url?: string }

const CrediQWeeklyDigest = ({ name, score, band, cta_url }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your CrediQ weekly digest — score {score ?? '—'}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} /></Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Your weekly CrediQ digest{name ? `, ${name}` : ''}</Heading>
          <Text style={s.text}>Here's a quick snapshot of your credit health this week.</Text>
          <Section style={s.infoBox}>
            <Text style={s.amountLarge}>{score ?? '—'}</Text>
            <Text style={{ ...s.text, textAlign: 'center', margin: 0 }}>Current score · {band || 'Unrated'}</Text>
          </Section>
          <Text style={s.text}>Open CrediQ to see what changed and how to keep climbing.</Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={cta_url || 'https://kangopenbanking.com/app/credit'} style={s.button}>View my score</Button>
          </Section>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>You receive this digest because weekly updates are enabled in CrediQ.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CrediQWeeklyDigest,
  subject: (d: Record<string, any>) => `Your weekly CrediQ digest — score ${d.score ?? ''}`.trim(),
  displayName: 'CrediQ — Weekly digest',
  previewData: { name: 'Alex', score: 712, band: 'Good', cta_url: 'https://kangopenbanking.com/app/credit' },
} satisfies TemplateEntry
