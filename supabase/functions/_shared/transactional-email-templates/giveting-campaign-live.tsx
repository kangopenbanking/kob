import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  title?: string
  campaignUrl?: string
}

const APP_URL = 'https://kangopenbanking.com'

const Email = ({ name, title, campaignUrl }: Props) => {
  const url = campaignUrl?.startsWith('http') ? campaignUrl : `${APP_URL}${campaignUrl ?? '/app/giveting'}`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{title ? `${title} is live and ready to accept donations` : 'Your fundraiser is live'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your fundraiser is live</Heading>
          <Text style={text}>{name ? `Hi ${name},` : 'Hello,'}</Text>
          <Text style={text}>
            Great news — your identity has been verified and{' '}
            <strong>{title ?? 'your fundraiser'}</strong> is now published on Giveting.
            Supporters can view and donate right away.
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={url} style={button}>View fundraiser</Button>
          </Section>
          <Text style={muted}>
            Share the link with friends, family and your community to build momentum
            in the first 48 hours — that is when campaigns raise the most.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => (d?.title ? `${d.title} is live` : 'Your fundraiser is live'),
  displayName: 'Giveting campaign live',
  previewData: { name: 'Sam', title: 'Support Amina at university', campaignUrl: '/app/giveting/c/demo' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#1f2937', margin: '0 0 12px' }
const muted = { fontSize: '13px', lineHeight: '20px', color: '#64748b', margin: '16px 0 0' }
const button = {
  backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 24px', borderRadius: '999px',
  fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'inline-block',
}
