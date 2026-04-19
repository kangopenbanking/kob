/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props { name?: string; score?: number; delta?: number; direction?: 'increased' | 'decreased'; cta_url?: string }

const CrediQScoreChange = ({ name, score, delta, direction, cta_url }: Props) => {
  const isUp = direction === 'increased';
  const sign = (delta ?? 0) > 0 ? '+' : '';
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your CrediQ score {direction || 'changed'} by {Math.abs(delta ?? 0)} points</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}><Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} /></Section>
          <Section style={s.body}>
            <Heading style={s.h1}>Your score {direction || 'changed'}{name ? `, ${name}` : ''}</Heading>
            <Section style={isUp ? s.successBox : s.alertBox}>
              <Text style={{ ...s.amountLarge, color: isUp ? '#166534' : '#991B1B', margin: 0 }}>
                {sign}{delta ?? 0} pts
              </Text>
              <Text style={{ ...s.text, textAlign: 'center', margin: '8px 0 0' }}>
                New score: <strong>{score ?? '—'}</strong>
              </Text>
            </Section>
            <Text style={s.text}>
              {isUp
                ? 'Nice work — keep doing what is moving you forward. See which factors helped most.'
                : 'A drop usually has a clear cause. Open CrediQ to see what changed and how to recover.'}
            </Text>
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={cta_url || 'https://kob.lovable.app/app/credit'} style={s.button}>See what changed</Button>
            </Section>
          </Section>
          <Section style={s.footer}>
            <Text style={s.footerText}>You receive change alerts because they are enabled in CrediQ.</Text>
            <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CrediQScoreChange,
  subject: (d: Record<string, any>) => `Your CrediQ score ${d.direction || 'changed'} by ${Math.abs(d.delta ?? 0)} points`,
  displayName: 'CrediQ — Score change alert',
  previewData: { name: 'Alex', score: 728, delta: 16, direction: 'increased', cta_url: 'https://kob.lovable.app/app/credit' },
} satisfies TemplateEntry
