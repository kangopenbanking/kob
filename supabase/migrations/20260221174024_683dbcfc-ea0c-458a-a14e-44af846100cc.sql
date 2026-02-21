
-- Fix critical security: restrict communication_templates to admin-only
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.communication_templates;

CREATE POLICY "Only admins can view templates"
ON public.communication_templates
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
