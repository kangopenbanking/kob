/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface ActivityRow { label: string; value: string }
interface Props {
  name?: string
  weekStart?: string
  weekEnd?: string
  totalTransactions?: number
  totalInflow?: string
  totalOutflow?: string
  topCategory?: string
  alertsCount?: number
  dashboardUrl?: string
  rows?: ActivityRow[]
}

const WeeklyActivityDigestEmail = ({
  name, weekStart, weekEnd, totalTransactions = 0, totalInflow = '0',
  totalOutflow = '0', topCategory = 'N/A', alertsCount = 0, dashboardUrl, rows = [],
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your weekly account activity from {s.BRAND_SHORT}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Your weekly account summary</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name},` : 'Hello,'} here is a summary of your account activity
            {weekStart && weekEnd ? ` from ${weekStart} to ${weekEnd}` : ' for the past week'}.
          </Text>
          <Section style={s.infoBox}>
            <Text style={s.infoRow}><span style={s.infoLabel}>Transactions: </span>{totalTransactions}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>Total inflow: </span>{totalInflow}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>Total outflow: </span>{totalOutflow}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>Top category: </span>{topCategory}</Text>
            <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Security alerts: </span>{alertsCount}</Text>
          </Section>
          {rows.length > 0 && (
            <Section style={s.infoBox}>
              {rows.map((r, i) => (
                <Text key={i} style={i === rows.length - 1 ? { ...s.infoRow, margin: '0' } : s.infoRow}>
                  <span style={s.infoLabel}>{r.label}: </span>{r.value}
                </Text>
              ))}
            </Section>
          )}
          {dashboardUrl && (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={dashboardUrl} style={s.button}>Open your dashboard</Button>
            </Section>
          )}
          <Text style={s.text}>
            You can adjust your email preferences in your account settings at any time.
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>This is an automated weekly summary from {s.SITE_NAME}.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME} — Kang Standard for Innovation</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyActivityDigestEmail,
  subject: (d: Record<string, any>) => `Your weekly activity summary${d.weekEnd ? ` — ${d.weekEnd}` : ''}`,
  displayName: 'Weekly activity digest',
  previewData: {
    name: 'Jane', weekStart: 'May 24, 2026', weekEnd: 'May 30, 2026',
    totalTransactions: 12, totalInflow: '2,500.00 XAF', totalOutflow: '1,180.00 XAF',
    topCategory: 'Bills', alertsCount: 0,
  },
} satisfies TemplateEntry
