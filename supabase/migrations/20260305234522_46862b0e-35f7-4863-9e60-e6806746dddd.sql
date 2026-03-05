
-- Merchant staff roles table for role-based access to merchant services
CREATE TABLE public.merchant_staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  staff_email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  permissions JSONB NOT NULL DEFAULT '{"bookings": true, "routes": false, "services": false, "discounts": false, "scanner": true, "reports": false, "notifications": false, "seating": false, "timetable": false}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, user_id)
);

ALTER TABLE public.merchant_staff_roles ENABLE ROW LEVEL SECURITY;

-- Owner can manage their staff
CREATE POLICY "Merchant owner manages staff" ON public.merchant_staff_roles
  FOR ALL TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

-- Merchant push notifications table
CREATE TABLE public.merchant_travel_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.travel_trips(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'all_passengers',
  sent_at TIMESTAMPTZ DEFAULT now(),
  recipients_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.merchant_travel_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant owner manages notifications" ON public.merchant_travel_notifications
  FOR ALL TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

-- Trigger for updated_at on merchant_staff_roles
CREATE TRIGGER update_merchant_staff_roles_timestamp
  BEFORE UPDATE ON public.merchant_staff_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_travel_updated_at();
