ALTER TABLE public.institutions 
ADD COLUMN IF NOT EXISTS app_config jsonb DEFAULT '{
  "features": {
    "cards": true,
    "savings": true,
    "loans": true,
    "credit_score": true,
    "mobile_money": true,
    "qr_payments": true,
    "bill_payments": true
  },
  "home_layout": {
    "show_balance_card": true,
    "show_account_carousel": true,
    "show_financial_services": true,
    "show_recent_transactions": true
  }
}'::jsonb;