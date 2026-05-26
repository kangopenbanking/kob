CREATE POLICY "Admins can insert reviewed linked accounts"
  ON public.customer_linked_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update linked accounts"
  ON public.customer_linked_accounts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));