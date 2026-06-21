/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'
import { appUrl } from './_cta.tsx'

interface Props {
  name?: string
  plan_name?: string
  rent_reference?: string
  amount?: number
  currency?: string
  due_date?: string
  days_until_due?: number
  is_overdue?: boolean
  cta_url?: string
}

const RentPaymentReminder = ({
  name,
  plan_name,
  rent_reference,
  amount,
  currency = 'XAF',
  due_date,
  days_until_due,
  is_overdue,
  cta_url,
}: Props) => {
  const formattedAmount = amount != null ? Number(amount).toLocaleString() : '—'
  const headline = is_overdue
    ? 'Rent payment overdue'
    : days_until_due === 0
      ? 'Rent payment due today'
      : `Rent payment due in ${days_until_due} day${(days_until_due ?? 0) === 1 ? '' : 's'}`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {is_overdue
          ? 'Record your rent payment now to avoid further credit impact'
          : `Your ${plan_name || 'rent'} payment is coming up — keep your CrediQ score on track`}
      </Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
          </Section>
          <Section style={s.body}>
            <Heading style={s.h1}>
              {headline}{name ? `, ${name}` : ''}
            </Heading>
            <Section style={is_overdue ? s.alertBox : s.successBox}>
              <Text style={{ ...s.amountLarge, color: is_overdue ? '#991B1B' : '#0A3D91', margin: 0 }}>
                {formattedAmount} {currency}
              </Text>
              <Text style={{ ...s.text, textAlign: 'center', margin: '8px 0 0' }}>
                {plan_name ? <strong>{plan_name}</strong> : 'Your rent plan'}
                {rent_reference ? <> · <span style={{ fontFamily: 'monospace' }}>{rent_reference}</span></> : null}
              </Text>
              {due_date && (
                <Text style={{ ...s.text, textAlign: 'center', margin: '6px 0 0', fontSize: '12px', color: s.MUTED }}>
                  Due {due_date}
                </Text>
              )}
            </Section>
            <Text style={s.text}>
              {is_overdue
                ? 'This payment is now overdue. Recording it today still preserves part of your credit score and stops the missed-payment penalty (-30 pts).'
                : 'Recording your rent payment on time earns +5–10 CrediQ points. Late payments cost -10–25 pts, and missed payments cost -30 pts.'}
            </Text>
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={cta_url || appUrl('/rent-reporting')} style={s.button}>
                {is_overdue ? 'Record payment now' : 'Open Rent Reporting'}
              </Button>
            </Section>
          </Section>
          <Section style={s.footer}>
            <Text style={s.footerText}>You receive rent reminders because you have an active rent reporting plan in CrediQ.</Text>
            <Text style={s.footerBrand}>{s.SITE_NAME}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RentPaymentReminder,
  subject: (d: Record<string, any>) =>
    d.is_overdue
      ? `Action needed: rent payment overdue (${d.plan_name || 'rent plan'})`
      : d.days_until_due === 0
        ? `Rent payment due today — ${d.plan_name || 'rent plan'}`
        : `Rent payment due in ${d.days_until_due} day(s) — ${d.plan_name || 'rent plan'}`,
  displayName: 'CrediQ — Rent payment reminder',
  previewData: {
    name: 'Alex',
    plan_name: 'Bonanjo Apartment',
    rent_reference: 'KRENTS4821',
    amount: 75000,
    currency: 'XAF',
    due_date: 'May 1, 2026',
    days_until_due: 3,
    is_overdue: false,
    cta_url: 'https://info.kangfintechsolutions.com/rent-reporting',
  },
} satisfies TemplateEntry
