-- Enable realtime for account_balances and transactions tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;