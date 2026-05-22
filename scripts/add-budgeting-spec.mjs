#!/usr/bin/env node
/**
 * Adds the /v1/budgeting/* endpoint group to public/openapi.json.
 * Idempotent: safe to run multiple times.
 * Justification: KOB Standing Orders 1, 2, 4, 5, 6 + Order P7 (Changelog Rule).
 * All additions are surgical and additive — no rename or removal.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const specPath = path.join(root, 'public/openapi.json');
const changelogPath = path.join(root, 'public/changelog.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const NEW_VERSION = '4.41.0';
const TODAY = '2026-05-21';

// --- 1. Bump version ---
spec.info.version = NEW_VERSION;

// --- 2. Add Budgeting tag (if missing) ---
spec.tags = spec.tags || [];
if (!spec.tags.find((t) => t.name === 'Budgeting')) {
  spec.tags.push({
    name: 'Budgeting',
    description:
      'Smart budgeting, spending analytics, XAF-native savings goals, Njangi integration, and trilingual (EN/FR/Pidgin) AI-powered financial advice. Reads from existing charge, transaction, account, and savings data streams — no new data collection.',
    externalDocs: {
      description: 'Budgeting integration guide',
      url: '/developer/guides/budgeting',
    },
  });
}

// --- 3. Schemas ---
spec.components = spec.components || {};
spec.components.schemas = spec.components.schemas || {};

const intXaf = { type: 'integer', format: 'int64', minimum: 0, description: 'Amount in XAF (zero-decimal).' };
const isoDate = { type: 'string', format: 'date' };
const isoDateTime = { type: 'string', format: 'date-time' };
const lang = { type: 'string', enum: ['en', 'fr', 'pid'], description: 'Response language: English, French, or Cameroon Pidgin.' };

const schemas = {
  BudgetCategory: {
    type: 'object',
    required: ['id', 'name', 'icon', 'colour', 'limit', 'spent'],
    properties: {
      id: { type: 'string', example: 'cat_food' },
      name: { type: 'string', example: 'Food & Market' },
      icon: { type: 'string', example: 'ShoppingCart' },
      colour: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', example: '#10D9A0' },
      limit: intXaf,
      spent: intXaf,
      remaining: intXaf,
      percentage_used: { type: 'number', format: 'float', minimum: 0 },
      transaction_count: { type: 'integer', minimum: 0 },
      top_merchant: { type: 'string', nullable: true },
    },
  },
  Budget: {
    type: 'object',
    required: ['id', 'consumer_id', 'name', 'period', 'start_date', 'end_date', 'total_limit', 'currency', 'status', 'created_at'],
    properties: {
      id: { type: 'string', example: 'bgt_01HXYZ' },
      consumer_id: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'May 2026 Budget' },
      period: { type: 'string', enum: ['monthly', 'weekly', 'custom'] },
      start_date: isoDate,
      end_date: isoDate,
      total_limit: intXaf,
      categories: { type: 'array', items: { $ref: '#/components/schemas/BudgetCategory' } },
      currency: { type: 'string', enum: ['XAF'], default: 'XAF' },
      status: { type: 'string', enum: ['active', 'paused', 'archived'] },
      created_at: isoDateTime,
      updated_at: isoDateTime,
    },
  },
  BudgetCreateRequest: {
    type: 'object',
    required: ['name', 'period', 'start_date', 'end_date', 'total_limit'],
    properties: {
      name: { type: 'string', maxLength: 80 },
      period: { type: 'string', enum: ['monthly', 'weekly', 'custom'] },
      start_date: isoDate,
      end_date: isoDate,
      total_limit: intXaf,
      categories: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'limit'],
          properties: { id: { type: 'string' }, limit: intXaf },
        },
      },
    },
  },
  BudgetSummary: {
    type: 'object',
    required: ['budget_id', 'period_start', 'period_end', 'total_limit', 'total_spent', 'total_remaining', 'percentage_used', 'currency'],
    properties: {
      budget_id: { type: 'string' },
      period_start: isoDate,
      period_end: isoDate,
      total_limit: intXaf,
      total_spent: intXaf,
      total_remaining: intXaf,
      percentage_used: { type: 'number', format: 'float' },
      days_remaining: { type: 'integer' },
      projected_overspend: { type: 'boolean' },
      projected_end_balance: intXaf,
      categories: { type: 'array', items: { $ref: '#/components/schemas/BudgetCategory' } },
      currency: { type: 'string', enum: ['XAF'] },
    },
  },
  CategoryCreateRequest: {
    type: 'object',
    required: ['name', 'icon', 'colour', 'limit'],
    properties: {
      name: { type: 'string' },
      icon: { type: 'string' },
      colour: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      limit: intXaf,
    },
  },
  CategoryRule: {
    type: 'object',
    required: ['id', 'pattern', 'category_id'],
    properties: {
      id: { type: 'string' },
      pattern: { type: 'string', description: 'Substring or regex applied to transaction description.' },
      category_id: { type: 'string' },
      priority: { type: 'integer', default: 100 },
      created_at: isoDateTime,
    },
  },
  SavingsGoal: {
    type: 'object',
    required: ['id', 'name', 'target_amount', 'current_amount', 'status', 'created_at'],
    properties: {
      id: { type: 'string', example: 'goal_01HXYZ' },
      name: { type: 'string' },
      target_amount: intXaf,
      current_amount: intXaf,
      deadline: isoDate,
      icon: { type: 'string' },
      colour: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      round_up_enabled: { type: 'boolean', default: false },
      round_up_nearest: { type: 'integer', enum: [500, 1000, 2000], nullable: true },
      linked_piggy_bank_id: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['active', 'completed', 'paused'] },
      created_at: isoDateTime,
    },
  },
  GoalProgress: {
    type: 'object',
    required: ['goal_id', 'percentage_complete', 'amount_remaining'],
    properties: {
      goal_id: { type: 'string' },
      percentage_complete: { type: 'number', format: 'float' },
      amount_remaining: intXaf,
      projected_completion_date: isoDate,
      weekly_required: intXaf,
      on_track: { type: 'boolean' },
      milestones_reached: { type: 'array', items: { type: 'integer', enum: [25, 50, 75, 100] } },
      next_milestone: { type: 'integer', nullable: true },
      round_up_total_this_month: intXaf,
    },
  },
  NjangiSchedule: {
    type: 'object',
    required: ['group_id', 'next_contribution_date', 'next_contribution_amount'],
    properties: {
      group_id: { type: 'string' },
      group_name: { type: 'string' },
      next_contribution_date: isoDate,
      next_contribution_amount: intXaf,
      days_until_due: { type: 'integer' },
      budget_impact_xaf: intXaf,
      reminder_enabled: { type: 'boolean' },
    },
  },
  BudgetInsight: {
    type: 'object',
    required: ['answer', 'lang', 'generated_at'],
    properties: {
      answer: { type: 'string' },
      lang,
      confidence: { type: 'number', format: 'float', minimum: 0, maximum: 1 },
      suggested_action: {
        type: 'object',
        nullable: true,
        properties: {
          type: { type: 'string', enum: ['update_category_limit', 'create_goal', 'pause_category', 'enable_roundup'] },
          category_id: { type: 'string', nullable: true },
          suggested_limit: { type: 'integer', nullable: true },
        },
      },
      generated_at: isoDateTime,
    },
  },
  InsightAskRequest: {
    type: 'object',
    required: ['question', 'lang'],
    properties: {
      question: { type: 'string', maxLength: 500 },
      lang,
      context: { type: 'string', enum: ['budget_summary', 'category', 'goal', 'general'] },
    },
  },
  InsightAskResponse: { $ref: '#/components/schemas/BudgetInsight' },
  BudgetAlert: {
    type: 'object',
    required: ['id', 'type', 'severity', 'message', 'created_at', 'dismissed'],
    properties: {
      id: { type: 'string' },
      type: {
        type: 'string',
        enum: ['budget.threshold_reached', 'budget.overspent', 'goal.milestone_reached', 'njangi.contribution_due', 'budget.unusual_transaction'],
      },
      severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
      message: { type: 'string' },
      category_id: { type: 'string', nullable: true },
      created_at: isoDateTime,
      dismissed: { type: 'boolean' },
    },
  },
  MonthlyAnalytics: {
    type: 'object',
    required: ['months'],
    properties: {
      months: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            month: { type: 'string', example: '2026-03' },
            total_spent: intXaf,
            by_category: {
              type: 'object',
              additionalProperties: intXaf,
            },
          },
        },
      },
    },
  },
  MerchantAnalytics: {
    type: 'object',
    required: ['period', 'merchants'],
    properties: {
      period: { type: 'string' },
      merchants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            category_id: { type: 'string' },
            total_spent: intXaf,
            transaction_count: { type: 'integer' },
          },
        },
      },
    },
  },
};

for (const [name, schema] of Object.entries(schemas)) {
  spec.components.schemas[name] = schema;
}

// --- 4. Reusable params/responses ---
spec.components.parameters = spec.components.parameters || {};
if (!spec.components.parameters.BudgetingLangQuery) {
  spec.components.parameters.BudgetingLangQuery = {
    name: 'lang',
    in: 'query',
    required: false,
    schema: { type: 'string', enum: ['en', 'fr', 'pid'], default: 'en' },
    description: 'Response language for budgeting insights.',
  };
}

const sec = [{ bearerAuth: [] }];
const json = (ref) => ({ 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } });
const okResp = (ref) => ({ '200': { description: 'OK', content: json(ref) } });
const createdResp = (ref) => ({ '201': { description: 'Created', content: json(ref) } });
const noContent = { '204': { description: 'No Content' } };

const pathParam = (name, desc) => ({ name, in: 'path', required: true, schema: { type: 'string' }, description: desc });

// --- 5. Paths ---
const newPaths = {
  '/v1/budgeting/budgets': {
    get: { tags: ['Budgeting'], operationId: 'budgetingListBudgets', summary: 'List budgets', security: sec, responses: okResp('Budget') },
    post: { tags: ['Budgeting'], operationId: 'budgetingCreateBudget', summary: 'Create budget', security: sec,
      requestBody: { required: true, content: json('BudgetCreateRequest') }, responses: createdResp('Budget') },
  },
  '/v1/budgeting/budgets/{budgetId}': {
    parameters: [pathParam('budgetId', 'Budget identifier')],
    get: { tags: ['Budgeting'], operationId: 'budgetingGetBudget', summary: 'Get budget', security: sec, responses: okResp('Budget') },
    patch: { tags: ['Budgeting'], operationId: 'budgetingUpdateBudget', summary: 'Update budget', security: sec,
      requestBody: { content: json('BudgetCreateRequest') }, responses: okResp('Budget') },
    delete: { tags: ['Budgeting'], operationId: 'budgetingDeleteBudget', summary: 'Archive budget', security: sec, responses: noContent },
  },
  '/v1/budgeting/budgets/{budgetId}/summary': {
    parameters: [pathParam('budgetId', 'Budget identifier')],
    get: { tags: ['Budgeting'], operationId: 'budgetingGetBudgetSummary', summary: 'Get budget summary', security: sec, responses: okResp('BudgetSummary') },
  },
  '/v1/budgeting/categories': {
    get: { tags: ['Budgeting'], operationId: 'budgetingListCategories', summary: 'List categories', security: sec, responses: okResp('BudgetCategory') },
    post: { tags: ['Budgeting'], operationId: 'budgetingCreateCategory', summary: 'Create category', security: sec,
      requestBody: { required: true, content: json('CategoryCreateRequest') }, responses: createdResp('BudgetCategory') },
  },
  '/v1/budgeting/categories/{categoryId}': {
    parameters: [pathParam('categoryId', 'Category identifier')],
    patch: { tags: ['Budgeting'], operationId: 'budgetingUpdateCategory', summary: 'Update category', security: sec,
      requestBody: { content: json('CategoryCreateRequest') }, responses: okResp('BudgetCategory') },
    delete: { tags: ['Budgeting'], operationId: 'budgetingDeleteCategory', summary: 'Delete category', security: sec, responses: noContent },
  },
  '/v1/budgeting/categories/rules': {
    get: { tags: ['Budgeting'], operationId: 'budgetingListRules', summary: 'List categorisation rules', security: sec, responses: okResp('CategoryRule') },
    post: { tags: ['Budgeting'], operationId: 'budgetingCreateRule', summary: 'Create categorisation rule', security: sec,
      requestBody: { required: true, content: json('CategoryRule') }, responses: createdResp('CategoryRule') },
  },
  '/v1/budgeting/categories/rules/{ruleId}': {
    parameters: [pathParam('ruleId', 'Rule identifier')],
    delete: { tags: ['Budgeting'], operationId: 'budgetingDeleteRule', summary: 'Delete rule', security: sec, responses: noContent },
  },
  '/v1/budgeting/transactions/{transactionId}/recategorise': {
    parameters: [pathParam('transactionId', 'Transaction identifier')],
    post: { tags: ['Budgeting'], operationId: 'budgetingRecategoriseTransaction', summary: 'Re-categorise a transaction', security: sec,
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['category_id'], properties: { category_id: { type: 'string' } } } } } },
      responses: okResp('BudgetCategory') },
  },
  '/v1/budgeting/goals': {
    get: { tags: ['Budgeting'], operationId: 'budgetingListGoals', summary: 'List savings goals', security: sec, responses: okResp('SavingsGoal') },
    post: { tags: ['Budgeting'], operationId: 'budgetingCreateGoal', summary: 'Create savings goal', security: sec,
      requestBody: { required: true, content: json('SavingsGoal') }, responses: createdResp('SavingsGoal') },
  },
  '/v1/budgeting/goals/{goalId}': {
    parameters: [pathParam('goalId', 'Goal identifier')],
    get: { tags: ['Budgeting'], operationId: 'budgetingGetGoal', summary: 'Get goal', security: sec, responses: okResp('SavingsGoal') },
    patch: { tags: ['Budgeting'], operationId: 'budgetingUpdateGoal', summary: 'Update goal', security: sec,
      requestBody: { content: json('SavingsGoal') }, responses: okResp('SavingsGoal') },
    delete: { tags: ['Budgeting'], operationId: 'budgetingDeleteGoal', summary: 'Delete goal', security: sec, responses: noContent },
  },
  '/v1/budgeting/goals/{goalId}/progress': {
    parameters: [pathParam('goalId', 'Goal identifier')],
    get: { tags: ['Budgeting'], operationId: 'budgetingGetGoalProgress', summary: 'Get goal progress', security: sec, responses: okResp('GoalProgress') },
  },
  '/v1/budgeting/goals/{goalId}/round-up': {
    parameters: [pathParam('goalId', 'Goal identifier')],
    post: { tags: ['Budgeting'], operationId: 'budgetingEnableRoundUp', summary: 'Enable round-up for goal', security: sec,
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nearest'], properties: { nearest: { type: 'integer', enum: [500, 1000, 2000] } } } } } },
      responses: okResp('SavingsGoal') },
    delete: { tags: ['Budgeting'], operationId: 'budgetingDisableRoundUp', summary: 'Disable round-up for goal', security: sec, responses: noContent },
  },
  '/v1/budgeting/goals/{goalId}/contribute': {
    parameters: [pathParam('goalId', 'Goal identifier')],
    post: { tags: ['Budgeting'], operationId: 'budgetingContributeToGoal', summary: 'Manual goal contribution', security: sec,
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'integer', minimum: 1 }, idempotency_key: { type: 'string', format: 'uuid' } } } } } },
      responses: okResp('SavingsGoal') },
  },
  '/v1/budgeting/njangi/{groupId}/schedule': {
    parameters: [pathParam('groupId', 'Njangi group identifier')],
    get: { tags: ['Budgeting'], operationId: 'budgetingGetNjangiSchedule', summary: 'Get Njangi schedule', security: sec, responses: okResp('NjangiSchedule') },
  },
  '/v1/budgeting/njangi/{groupId}/budget-impact': {
    parameters: [pathParam('groupId', 'Njangi group identifier')],
    get: { tags: ['Budgeting'], operationId: 'budgetingGetNjangiBudgetImpact', summary: 'Get Njangi budget impact', security: sec, responses: okResp('NjangiSchedule') },
  },
  '/v1/budgeting/njangi/{groupId}/set-reminder': {
    parameters: [pathParam('groupId', 'Njangi group identifier')],
    post: { tags: ['Budgeting'], operationId: 'budgetingSetNjangiReminder', summary: 'Set Njangi contribution reminder', security: sec,
      requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { days_before: { type: 'integer', default: 3 } } } } } },
      responses: okResp('NjangiSchedule') },
  },
  '/v1/budgeting/insights': {
    get: { tags: ['Budgeting'], operationId: 'budgetingGetInsights', summary: 'Get cached AI insight', security: sec,
      parameters: [{ $ref: '#/components/parameters/BudgetingLangQuery' }], responses: okResp('BudgetInsight') },
  },
  '/v1/budgeting/insights/ask': {
    post: { tags: ['Budgeting'], operationId: 'budgetingAskInsight', summary: 'Ask the AI adviser (rate-limited 10/day)', security: sec,
      requestBody: { required: true, content: json('InsightAskRequest') }, responses: okResp('InsightAskResponse') },
  },
  '/v1/budgeting/alerts': {
    get: { tags: ['Budgeting'], operationId: 'budgetingListAlerts', summary: 'List budget alerts', security: sec, responses: okResp('BudgetAlert') },
  },
  '/v1/budgeting/alerts/{alertId}/dismiss': {
    parameters: [pathParam('alertId', 'Alert identifier')],
    patch: { tags: ['Budgeting'], operationId: 'budgetingDismissAlert', summary: 'Dismiss alert', security: sec, responses: okResp('BudgetAlert') },
  },
  '/v1/budgeting/analytics/monthly': {
    get: { tags: ['Budgeting'], operationId: 'budgetingGetMonthlyAnalytics', summary: 'Monthly spending analytics', security: sec,
      parameters: [{ name: 'months', in: 'query', schema: { type: 'integer', default: 3, minimum: 1, maximum: 12 } }],
      responses: okResp('MonthlyAnalytics') },
  },
  '/v1/budgeting/analytics/merchants': {
    get: { tags: ['Budgeting'], operationId: 'budgetingGetMerchantAnalytics', summary: 'Top merchants analytics', security: sec,
      parameters: [{ name: 'period', in: 'query', schema: { type: 'string', enum: ['this_week', 'this_month', 'last_month'], default: 'this_month' } }],
      responses: okResp('MerchantAnalytics') },
  },
  '/v1/budgeting/analytics/categories/trends': {
    get: { tags: ['Budgeting'], operationId: 'budgetingGetCategoryTrends', summary: 'Category spending trends', security: sec, responses: okResp('MonthlyAnalytics') },
  },
};

for (const [p, op] of Object.entries(newPaths)) {
  spec.paths[p] = op;
}

// --- 6. Webhook events ---
const webhooks = spec['x-webhooks'] || spec.webhooks || {};
const targetKey = spec['x-webhooks'] ? 'x-webhooks' : 'webhooks';
const newWebhooks = {
  'budget.threshold_reached': {
    post: { summary: '80% of category limit reached', tags: ['Budgeting'], operationId: 'webhookBudgetThresholdReached',
      requestBody: { content: json('BudgetAlert') }, responses: { '200': { description: 'Acknowledged' } } },
  },
  'budget.overspent': {
    post: { summary: 'Category limit exceeded', tags: ['Budgeting'], operationId: 'webhookBudgetOverspent',
      requestBody: { content: json('BudgetAlert') }, responses: { '200': { description: 'Acknowledged' } } },
  },
  'budget.period_ended': {
    post: { summary: 'Budget period closed with summary', tags: ['Budgeting'], operationId: 'webhookBudgetPeriodEnded',
      requestBody: { content: json('BudgetSummary') }, responses: { '200': { description: 'Acknowledged' } } },
  },
  'goal.milestone_reached': {
    post: { summary: 'Savings goal hit 25/50/75%', tags: ['Budgeting'], operationId: 'webhookGoalMilestoneReached',
      requestBody: { content: json('GoalProgress') }, responses: { '200': { description: 'Acknowledged' } } },
  },
  'goal.completed': {
    post: { summary: 'Savings goal fully funded', tags: ['Budgeting'], operationId: 'webhookGoalCompleted',
      requestBody: { content: json('SavingsGoal') }, responses: { '200': { description: 'Acknowledged' } } },
  },
  'njangi.contribution_due': {
    post: { summary: '3 days before Njangi contribution', tags: ['Budgeting'], operationId: 'webhookNjangiContributionDue',
      requestBody: { content: json('NjangiSchedule') }, responses: { '200': { description: 'Acknowledged' } } },
  },
  'insight.new': {
    post: { summary: 'Weekly AI insight generated', tags: ['Budgeting'], operationId: 'webhookInsightNew',
      requestBody: { content: json('BudgetInsight') }, responses: { '200': { description: 'Acknowledged' } } },
  },
  'budget.unusual_transaction': {
    post: { summary: 'Single transaction 3× above category average', tags: ['Budgeting'], operationId: 'webhookBudgetUnusualTransaction',
      requestBody: { content: json('BudgetAlert') }, responses: { '200': { description: 'Acknowledged' } } },
  },
};
for (const [k, v] of Object.entries(newWebhooks)) webhooks[k] = v;
spec[targetKey] = webhooks;

// --- 7. Write spec ---
fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n');
console.log(`OK openapi.json: v${NEW_VERSION}, +${Object.keys(newPaths).length} paths, +${Object.keys(schemas).length} schemas, +${Object.keys(newWebhooks).length} webhooks`);

// --- 8. Changelog entry (required by Order P7 + version sync gate) ---
const cl = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
if (!cl.entries.some((e) => e.version === NEW_VERSION)) {
  cl.entries.unshift({
    version: NEW_VERSION,
    date: TODAY,
    type: 'minor',
    breaking_changes: false,
    summary: 'Smart Budgeting — new /v1/budgeting/* endpoint group with trilingual AI adviser (EN/FR/Pidgin), savings goals, Njangi integration, and XAF-native spending analytics.',
    highlights: [
      `Added ${Object.keys(newPaths).length} new /v1/budgeting/* endpoints (Budgets, Categories, Goals, Njangi, AI Adviser, Analytics).`,
      `Added ${Object.keys(schemas).length} new schemas to components/schemas — all referenced by at least one operation (Standing Order 5).`,
      `Added ${Object.keys(newWebhooks).length} new webhook events: budget.threshold_reached, budget.overspent, budget.period_ended, goal.milestone_reached, goal.completed, njangi.contribution_due, insight.new, budget.unusual_transaction.`,
      'Added new Budgeting tag with externalDocs pointing to /developer/guides/budgeting.',
      'AI insights endpoint supports lang=en|fr|pid query parameter; ask endpoint rate-limited to 10 requests/day per consumer.',
      'All changes additive — no operationId, path, schema, or required field renamed or removed (Standing Orders 1 & 4).',
    ],
    standard_citations: [
      'KOB Standing Orders 1 (Lock), 2 (Ratchet), 4 (Surgeon), 5 (Dead Code), 6 (Version Gate)',
      'KOB Docs Standing Order P7 (Changelog Rule), P9 (Multi-Language Rule), P10 (Living Docs Rule)',
      'BEAC instruction n°01/2018/CR — XAF zero-decimal currency precision',
    ],
  });
}
cl.apiVersion = NEW_VERSION;
cl.lastUpdated = TODAY;
fs.writeFileSync(changelogPath, JSON.stringify(cl, null, 2) + '\n');
console.log(`OK changelog.json: entry for v${NEW_VERSION}`);
