
-- Fix remaining RLS gaps for tables with only SELECT policies

-- 1. CUSTOMER_REFERRALS - Users need INSERT for referral system
CREATE POLICY "Users can create own referrals" ON public.customer_referrals
FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Admins can manage all referrals" ON public.customer_referrals
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. CUSTOMER_REWARDS - Admin/service can insert
CREATE POLICY "Admins can manage all rewards" ON public.customer_rewards
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. DISPUTES - Users need to create their own
CREATE POLICY "Users can create own disputes" ON public.disputes
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own disputes" ON public.disputes
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. BRANCHES - Institution owners need write access
CREATE POLICY "Institution owners can manage branches" ON public.branches
FOR ALL TO authenticated 
USING (institution_id IN (SELECT id FROM institutions WHERE user_id = auth.uid()))
WITH CHECK (institution_id IN (SELECT id FROM institutions WHERE user_id = auth.uid()));

-- 5. INSTITUTION_INVOICES - Admins can manage
CREATE POLICY "Admins can manage invoices" ON public.institution_invoices
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. INSTITUTION_EMAIL_OVERRIDES/SETTINGS - Admins + institution owners
CREATE POLICY "Admins manage email overrides" ON public.institution_email_overrides
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage email settings" ON public.institution_email_settings
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. WALKTHROUGHS - Admins manage
CREATE POLICY "Admins manage walkthroughs" ON public.institution_walkthroughs
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
