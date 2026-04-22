-- Add two managed email types used by the Support Agent flows.

INSERT INTO public.managed_email_types
  (email_key, category, name, description, default_subject, default_body_html,
   available_variables, trigger_event, is_system, is_active, sort_order)
VALUES
  (
    'support_new_chat_agent',
    'support',
    'Support — New Chat Notification (Agent)',
    'Sent to every agent in a department when a new live support chat is started.',
    'New support chat in {{department_name}}: {{subject}}',
    '<p>Hi <strong>{{agent_name}}</strong>,</p>
     <p>A new support chat has just been started in the <strong>{{department_name}}</strong> queue.</p>
     <ul>
       <li><strong>Subject:</strong> {{subject}}</li>
       <li><strong>Customer:</strong> {{customer_name}}</li>
       <li><strong>Channel:</strong> {{channel}}</li>
     </ul>
     <p>Please log in to the support workspace to claim and respond to this conversation.</p>
     <p><a href="{{portal_url}}" style="display:inline-block;padding:12px 24px;background:#0A3D91;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Open Support Workspace</a></p>',
    '["agent_name","department_name","subject","customer_name","channel","portal_url"]'::jsonb,
    'support_chat_created',
    true,
    true,
    120
  ),
  (
    'support_agent_invite',
    'support',
    'Support — Agent Invitation',
    'Sent to a user when an admin invites them as a support agent for a department.',
    'You have been invited as a support agent — {{department_name}}',
    '<p>Hi <strong>{{agent_name}}</strong>,</p>
     <p>You have been invited to join the <strong>{{department_name}}</strong> support team on Kang Open Banking.</p>
     <p>As a support agent you can respond to live customer chats, transfer conversations, and help resolve issues quickly.</p>
     <p><a href="{{portal_url}}" style="display:inline-block;padding:12px 24px;background:#0A3D91;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Open Support Workspace</a></p>
     <p style="font-size:13px;color:#6B7B8D;">If this is your first time signing in, check your inbox for a separate account invitation email so you can set your password.</p>',
    '["agent_name","department_name","portal_url","invite_sent"]'::jsonb,
    'support_agent_invited',
    true,
    true,
    121
  )
ON CONFLICT (email_key) DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_subject = EXCLUDED.default_subject,
  default_body_html = EXCLUDED.default_body_html,
  available_variables = EXCLUDED.available_variables,
  trigger_event = EXCLUDED.trigger_event,
  is_active = true,
  updated_at = now();