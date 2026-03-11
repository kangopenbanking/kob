/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { EMAIL_LOGO_URL } from '../email-config.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code — Kang Open Banking</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={logoUrl} alt="Kang Open Banking" height="40" style={{ margin: '0 auto' }} />
        </Section>
        <Heading style={h1}>Verify your identity</Heading>
        <Text style={text}>Use the code below to confirm your identity on Kang:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={text}>This code will expire shortly. Do not share it with anyone.</Text>
        <Section style={divider} />
        <Text style={footer}>
          If you didn't request this code, please secure your account immediately.
        </Text>
        <Text style={footerBrand}>
          Kang Open Banking — Kang Standard for Innovation
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const logoUrl = EMAIL_LOGO_URL

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 40px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px', borderBottom: '3px solid #0A3D91' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1D2B3A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#6B7B8D', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#0A3D91',
  letterSpacing: '6px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
  padding: '16px 0',
  backgroundColor: '#F3F4F6',
  borderRadius: '12px',
}
const divider = { borderTop: '1px solid #E5E7EB', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#9CA3AF', margin: '0 0 8px' }
const footerBrand = { fontSize: '12px', color: '#0A3D91', fontWeight: '600' as const, margin: '0' }
