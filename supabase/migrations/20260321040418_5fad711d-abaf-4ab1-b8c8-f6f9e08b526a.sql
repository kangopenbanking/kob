
-- Support Departments
CREATE TABLE public.support_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'headphones',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.support_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active departments" ON public.support_departments
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage departments" ON public.support_departments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Support Agents
CREATE TABLE public.support_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.support_departments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy')),
  max_concurrent_chats INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, department_id)
);

ALTER TABLE public.support_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents see own record" ON public.support_agents
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins manage agents" ON public.support_agents
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Support Conversations
CREATE TABLE public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  department_id UUID REFERENCES public.support_departments(id),
  assigned_agent_id UUID REFERENCES public.support_agents(id),
  channel TEXT NOT NULL DEFAULT 'website' CHECK (channel IN ('website', 'consumer_app', 'merchant_app', 'banking_app')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  subject TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own conversations" ON public.support_conversations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users create conversations" ON public.support_conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own conversations" ON public.support_conversations
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins manage all conversations" ON public.support_conversations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents see assigned conversations" ON public.support_conversations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.support_agents sa
      WHERE sa.user_id = auth.uid()
        AND (sa.id = assigned_agent_id OR (assigned_agent_id IS NULL AND sa.department_id = department_id))
    )
  );

CREATE POLICY "Agents update assigned conversations" ON public.support_conversations
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.support_agents sa
      WHERE sa.user_id = auth.uid() AND sa.id = assigned_agent_id
    )
  );

-- Support Messages
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),
  sender_id UUID,
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see messages in own conversations" ON public.support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Users send messages in own conversations" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_type = 'user' AND sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.support_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Admins manage all messages" ON public.support_messages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents see messages in assigned conversations" ON public.support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      JOIN public.support_agents sa ON sa.user_id = auth.uid()
      WHERE c.id = conversation_id AND (c.assigned_agent_id = sa.id OR (c.assigned_agent_id IS NULL AND c.department_id = sa.department_id))
    )
  );

CREATE POLICY "Agents send messages in assigned conversations" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_type = 'agent' AND
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      JOIN public.support_agents sa ON sa.user_id = auth.uid()
      WHERE c.id = conversation_id AND c.assigned_agent_id = sa.id
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('support-attachments', 'support-attachments', true, 5242880);

CREATE POLICY "Authenticated users upload support files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'support-attachments');

CREATE POLICY "Anyone can view support files" ON storage.objects
  FOR SELECT USING (bucket_id = 'support-attachments');

-- Seed default departments
INSERT INTO public.support_departments (name, description, icon, display_order) VALUES
  ('General Support', 'General questions and help', 'headphones', 1),
  ('Payments & Transfers', 'Issues with payments, transfers, and transactions', 'credit-card', 2),
  ('Account & Security', 'Account access, security, and verification', 'shield', 3),
  ('Technical Support', 'API, integration, and technical issues', 'code', 4),
  ('Billing & Fees', 'Questions about fees, invoices, and billing', 'receipt', 5);
