/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { EMAIL_LOGO_URL } from '../email-config.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password — Kang Open Banking</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={logoUrl} alt="Kang Open Banking" height="40" style={{ margin: '0 auto' }} />
        </Section>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset the password for your Kang account. Click the button below to choose a new password.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={text}>
          Or copy and paste this link into your browser:
        </Text>
        <Text style={urlText}>
          <Link href={confirmationUrl} style={link}>{confirmationUrl}</Link>
        </Text>
        <Section style={divider} />
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
        </Text>
        <Text style={footerBrand}>
          Kang Open Banking — Kang Standard for Innovation
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const logoUrl = EMAIL_LOGO_URL

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 40px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px', borderBottom: '3px solid #0A3D91' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1D2B3A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#6B7B8D', lineHeight: '1.6', margin: '0 0 20px' }
const urlText = { fontSize: '13px', color: '#6B7B8D', lineHeight: '1.5', margin: '0 0 24px', wordBreak: 'break-all' as const }
const link = { color: '#0A3D91', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0A3D91',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'block' as const,
  textAlign: 'center' as const,
  marginBottom: '20px',
}
const divider = { borderTop: '1px solid #E5E7EB', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#9CA3AF', margin: '0 0 8px' }
const footerBrand = { fontSize: '12px', color: '#0A3D91', fontWeight: '600' as const, margin: '0' }
