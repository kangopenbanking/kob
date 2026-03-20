INSERT INTO public.managed_email_types (email_key, name, category, default_subject, default_body_html, description, is_active)
VALUES
  ('merchant_subscription_expiring_7d', 'Subscription Expiring (7 days)', 'merchant', 'Subscription Renewal Reminder — {{plan_name}}',
   '<p>Dear {{customer_name}},</p><p>Your <strong>{{plan_name}}</strong> subscription for <strong>"{{store_name}}"</strong> will expire on <strong>{{expiry_date}}</strong> ({{days_left}} days from now).</p><p>Renew early to ensure uninterrupted service and keep your store visible on the marketplace.</p><p>Best regards,<br/>Kang Open Banking</p>',
   'Sent 7 days before merchant storefront subscription expires', true),
  ('merchant_subscription_expiring_3d', 'Subscription Expiring (3 days)', 'merchant', 'Urgent: Subscription Expiring in {{days_left}} Days',
   '<p>Dear {{customer_name}},</p><p>Your <strong>{{plan_name}}</strong> subscription for <strong>"{{store_name}}"</strong> expires in just <strong>{{days_left}} days</strong> on {{expiry_date}}.</p><p>Please renew now to avoid losing your store''s visibility and features.</p><p>Best regards,<br/>Kang Open Banking</p>',
   'Sent 3 days before merchant storefront subscription expires', true),
  ('merchant_subscription_expiring_1d', 'Subscription Expiring (1 day)', 'merchant', 'Final Notice: Subscription Expires Tomorrow!',
   '<p>Dear {{customer_name}},</p><p>This is your final reminder — your <strong>{{plan_name}}</strong> subscription for <strong>"{{store_name}}"</strong> expires <strong>tomorrow</strong> ({{expiry_date}}).</p><p>Renew immediately to prevent service interruption.</p><p>Best regards,<br/>Kang Open Banking</p>',
   'Sent 1 day before merchant storefront subscription expires', true),
  ('merchant_subscription_expired', 'Subscription Expired', 'merchant', 'Subscription Expired — {{plan_name}}',
   '<p>Dear {{customer_name}},</p><p>Your <strong>{{plan_name}}</strong> subscription for <strong>"{{store_name}}"</strong> has expired as of {{expiry_date}}.</p><p>Your store is no longer visible on the marketplace. Renew your subscription to restore your store and continue accepting orders.</p><p>Best regards,<br/>Kang Open Banking</p>',
   'Sent when merchant storefront subscription has expired', true)
ON CONFLICT (email_key) DO NOTHING;