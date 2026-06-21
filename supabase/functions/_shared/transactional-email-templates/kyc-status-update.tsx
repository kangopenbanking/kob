/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { CtaButton } from './_cta.tsx'

interface Props { name?: string; status?: string; reason?: string; level?: string; ctaUrl?: string }

const KycStatusUpdateEmail = ({ name, status, reason, level, ctaUrl }: Props) => {
  const isApproved = status?.toLowerCase() === 'approved' || status?.toLowerCase() === 'verified'
  const boxStyle = isApproved ? s.successBox : s.alertBox
  const icon = isApproved ? '✓' : '✗'
  const color = isApproved ? '#166534' : '#991B1B'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your KYC verification has been {status || 'updated'} — {s.BRAND_SHORT}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
          </Section>
          <Section style={s.body}>
            <Heading style={s.h1}>KYC Verification {isApproved ? 'Approved' : 'Update'}</Heading>
            <Text style={s.text}>
              {name ? `Hi ${name}, your` : 'Your'} identity verification{level ? ` (${level})` : ''} has been reviewed.
            </Text>
            <Section style={boxStyle}>
              <Text style={{ ...(s.amountLarge as any), color, fontSize: '20px' }}>
                {icon} {isApproved ? 'Verification Approved' : `Verification ${status || 'Requires Action'}`}
              </Text>
            </Section>
            {reason && <Text style={s.text}><span style={s.infoLabel}>Note: </span>{reason}</Text>}
            <Text style={s.text}>
              {isApproved
                ? 'You now have full access to all banking services on the platform. Thank you for completing your verification.'
                : 'Please review the requirements and resubmit your verification documents through the app.'}
            </Text>
            <CtaButton
              href={ctaUrl}
              label={isApproved ? 'Open your dashboard' : 'Complete verification'}
              fallbackPath={isApproved ? '/dashboard' : '/kyc-verification'}
            />
          </Section>
          <Section style={s.footer}>
            <Text style={s.footerText}>This is an automated notification from {s.SITE_NAME}.</Text>
            <Text style={s.footerBrand}>{s.SITE_NAME} — Kang Standard for Innovation</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: KycStatusUpdateEmail,
  subject: (data: Record<string, any>) => `Your KYC verification has been ${data.status || 'updated'}`,
  displayName: 'KYC status update',
  previewData: { name: 'John Doe', status: 'Approved', level: 'Tier 2' },
} satisfies TemplateEntry
