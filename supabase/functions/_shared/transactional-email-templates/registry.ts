/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcome } from './welcome.tsx'
import { template as passwordChanged } from './password-changed.tsx'
import { template as loginAlert } from './login-alert.tsx'
import { template as paymentConfirmation } from './payment-confirmation.tsx'
import { template as paymentReceived } from './payment-received.tsx'
import { template as highValueAlert } from './high-value-alert.tsx'
import { template as statementReady } from './statement-ready.tsx'
import { template as loanApplicationReceived } from './loan-application-received.tsx'
import { template as loanStatusUpdate } from './loan-status-update.tsx'
import { template as kycStatusUpdate } from './kyc-status-update.tsx'
import { template as consentAuthorized } from './consent-authorized.tsx'
import { template as consentRevoked } from './consent-revoked.tsx'
import { template as merchantOnboarded } from './merchant-onboarded.tsx'
import { template as payoutProcessed } from './payout-processed.tsx'
import { template as supportTicketCreated } from './support-ticket-created.tsx'
import { template as supportReply } from './support-reply.tsx'
import { template as apiKeyCreated } from './api-key-created.tsx'
import { template as chatAssigned } from './chat-assigned.tsx'
import { template as supportAgentInvite } from './support-agent-invite.tsx'
import { template as supportNewChatAgent } from './support-new-chat-agent.tsx'
import { template as supportSlaSupervisor } from './support-sla-supervisor.tsx'
import { template as crediqWeeklyDigest } from './crediq-weekly-digest.tsx'
import { template as crediqMonthlyReport } from './crediq-monthly-report.tsx'
import { template as crediqScoreChange } from './crediq-score-change.tsx'
import { template as crediqTipRecommendation } from './crediq-tip-recommendation.tsx'
import { template as rentPaymentReminder } from './rent-payment-reminder.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcome,
  'password-changed': passwordChanged,
  'login-alert': loginAlert,
  'payment-confirmation': paymentConfirmation,
  'payment-received': paymentReceived,
  'high-value-alert': highValueAlert,
  'statement-ready': statementReady,
  'loan-application-received': loanApplicationReceived,
  'loan-status-update': loanStatusUpdate,
  'kyc-status-update': kycStatusUpdate,
  'consent-authorized': consentAuthorized,
  'consent-revoked': consentRevoked,
  'merchant-onboarded': merchantOnboarded,
  'payout-processed': payoutProcessed,
  'support-ticket-created': supportTicketCreated,
  'support-reply': supportReply,
  'api-key-created': apiKeyCreated,
  'chat-assigned': chatAssigned,
  'support-agent-invite': supportAgentInvite,
  'support-new-chat-agent': supportNewChatAgent,
  'support-sla-supervisor': supportSlaSupervisor,
  'crediq-weekly-digest': crediqWeeklyDigest,
  'crediq-monthly-report': crediqMonthlyReport,
  'crediq-score-change': crediqScoreChange,
  'crediq-tip-recommendation': crediqTipRecommendation,
  'rent-payment-reminder': rentPaymentReminder,
}
