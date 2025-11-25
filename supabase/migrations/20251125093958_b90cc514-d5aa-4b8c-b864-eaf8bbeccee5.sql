-- Insert KYB request email template
INSERT INTO communication_templates (
  template_key,
  name,
  template_type,
  category,
  subject,
  body,
  is_active,
  is_system,
  description,
  variables
) VALUES (
  'kyb_request',
  'KYB Request Notification',
  'email',
  'institution_management',
  'Action Required: Submit Business KYC for {{institution_name}}',
  '<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; padding: 20px; color: #666; font-size: 12px; }
    .highlight { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏦 Business KYC Submission Required</h1>
    </div>
    <div class="content">
      <p>Dear {{recipient_name}},</p>
      
      <p>Thank you for registering <strong>{{institution_name}}</strong> with Kang Open Banking.</p>
      
      <div class="highlight">
        <strong>⚠️ Action Required:</strong> To continue with your institution verification, please submit your Business KYC (Know Your Business) documentation.
      </div>
      
      <p>The Business KYC process includes:</p>
      <ul>
        <li>✓ Business registration certificate</li>
        <li>✓ Tax identification documents</li>
        <li>✓ Proof of business address</li>
        <li>✓ Director/Owner identification</li>
        <li>✓ Bank statements (last 6 months)</li>
      </ul>
      
      <p style="text-align: center;">
        <a href="{{dashboard_url}}" class="button">Submit Business KYC Now →</a>
      </p>
      
      <p><strong>Next Steps After KYB Submission:</strong></p>
      <ol>
        <li>Our compliance team will review your documents (2-3 business days)</li>
        <li>Upon approval, you will be prompted to create your main branch</li>
        <li>Final approval and API credentials will be issued</li>
      </ol>
      
      <p>If you have any questions or need assistance, please contact our support team at <a href="mailto:support@kangopenbanking.com">support@kangopenbanking.com</a>.</p>
      
      <p>Best regards,<br>
      <strong>Kang Open Banking Team</strong></p>
    </div>
    <div class="footer">
      <p>© 2025 Kang Open Banking. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>',
  true,
  true,
  'Email notification sent to institution administrators requesting Business KYC submission',
  '["recipient_name", "institution_name", "dashboard_url"]'::jsonb
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active;