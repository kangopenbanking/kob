/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { EMAIL_LOGO_URL } from '../email-config.ts'
import { emailChange as E, pickLocale } from './i18n.ts'

interface EmailChangeEmailProps { siteName: string; email: string; newEmail: string; confirmationUrl: string; locale?: 'en' | 'fr' }

export const EmailChangeEmail = ({ email, newEmail, confirmationUrl, locale }: EmailChangeEmailProps) => {
  const L = E[pickLocale(locale)]
  return (
    <Html lang={pickLocale(locale)} dir="ltr">
      <Head />
      <Preview>{L.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={EMAIL_LOGO_URL} alt="Kang Open Banking" height="40" style={{ margin: '0 auto' }} />
          </Section>
          <Heading style={h1}>{L.h1}</Heading>
          <Text style={text}>
            {L.intro}{' '}
            <Link href={`mailto:${email}`} style={link}>{email}</Link> {L.to}{' '}
            <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
          </Text>
          <Text style={text}>{L.clickToConfirm}</Text>
          <Button style={button} href={confirmationUrl}>{L.cta}</Button>
          <Section style={divider} />
          <Text style={footer}>{L.secure}</Text>
          <Text style={footerBrand}>{L.brand}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 40px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px', borderBottom: '3px solid #0A3D91' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1D2B3A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#6B7B8D', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#0A3D91', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0A3D91', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const,
  borderRadius: '12px', padding: '14px 28px', textDecoration: 'none',
  display: 'block' as const, textAlign: 'center' as const, marginBottom: '20px',
}
const divider = { borderTop: '1px solid #E5E7EB', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#9CA3AF', margin: '0 0 8px' }
const footerBrand = { fontSize: '12px', color: '#0A3D91', fontWeight: '600' as const, margin: '0' }
