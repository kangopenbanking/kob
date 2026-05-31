/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import * as s from './_styles.ts'

interface Props {
  name?: string
  month?: string            // e.g. "May 2026"
  accountNumber?: string
  openingBalance?: string
  closingBalance?: string
  totalDebits?: string
  totalCredits?: string
  transactionCount?: number
  statementUrl?: string     // pre-signed PDF/CSV download URL
  csvUrl?: string
}

const MonthlyStatementEmail = ({
  name, month, accountNumber, openingBalance = '0', closingBalance = '0',
  totalDebits = '0', totalCredits = '0', transactionCount = 0, statementUrl, csvUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {month || 'monthly'} statement is ready to download</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Img src={s.LOGO_URL} alt={s.SITE_NAME} height="40" style={s.logo} />
        </Section>
        <Section style={s.body}>
          <Heading style={s.h1}>Your {month || 'monthly'} statement</Heading>
          <Text style={s.text}>
            {name ? `Hi ${name}, ` : ''}your statement is ready. You can review the summary below and download the full statement.
          </Text>
          <Section style={s.infoBox}>
            {accountNumber && <Text style={s.infoRow}><span style={s.infoLabel}>Account: </span>{accountNumber}</Text>}
            <Text style={s.infoRow}><span style={s.infoLabel}>Period: </span>{month || 'Last month'}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>Opening balance: </span>{openingBalance}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>Total credits: </span>{totalCredits}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>Total debits: </span>{totalDebits}</Text>
            <Text style={s.infoRow}><span style={s.infoLabel}>Transactions: </span>{transactionCount}</Text>
            <Text style={{ ...s.infoRow, margin: '0' }}><span style={s.infoLabel}>Closing balance: </span>{closingBalance}</Text>
          </Section>
          {(statementUrl || csvUrl) && (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              {statementUrl && <Button href={statementUrl} style={s.button}>Download statement (PDF)</Button>}
              {csvUrl && (
                <Text style={{ ...s.text, marginTop: '12px' }}>
                  Prefer CSV? <a href={csvUrl} style={{ color: '#0a66c2' }}>Download CSV</a>
                </Text>
              )}
            </Section>
          )}
          <Text style={s.text}>
            Download links remain valid for 7 days. After that, sign in and request a fresh copy from the Statements section.
          </Text>
        </Section>
        <Section style={s.footer}>
          <Text style={s.footerText}>This monthly statement is sent automatically. Adjust your preferences in account settings.</Text>
          <Text style={s.footerBrand}>{s.SITE_NAME} — Kang Standard for Innovation</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MonthlyStatementEmail,
  subject: (d: Record<string, any>) => `Your ${d.month || 'monthly'} statement is ready`,
  displayName: 'Monthly statement',
  previewData: {
    name: 'Jane', month: 'May 2026', accountNumber: '****4521',
    openingBalance: '12,400.00 XAF', closingBalance: '13,820.00 XAF',
    totalCredits: '5,200.00 XAF', totalDebits: '3,780.00 XAF', transactionCount: 27,
  },
} satisfies TemplateEntry
