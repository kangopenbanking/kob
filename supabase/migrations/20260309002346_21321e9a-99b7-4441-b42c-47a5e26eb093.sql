-- Customer Favorite Merchants
CREATE TABLE public.customer_favorite_merchants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, merchant_id)
);

-- Customer Wishlist Items
CREATE TABLE public.customer_wishlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- Order Reviews
CREATE TABLE public.pos_order_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  helpful_count INTEGER DEFAULT 0,
  merchant_response TEXT,
  merchant_responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reward Transactions
CREATE TABLE public.customer_reward_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  points_change INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_id TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_favorite_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_order_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_reward_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for favorites
CREATE POLICY "Users can view their own favorites" ON public.customer_favorite_merchants
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own favorites" ON public.customer_favorite_merchants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own favorites" ON public.customer_favorite_merchants
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for wishlist
CREATE POLICY "Users can view their own wishlist" ON public.customer_wishlist_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create wishlist items" ON public.customer_wishlist_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own wishlist items" ON public.customer_wishlist_items
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for reviews
CREATE POLICY "Anyone can view reviews" ON public.pos_order_reviews
  FOR SELECT USING (true);
CREATE POLICY "Users can create their own reviews" ON public.pos_order_reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Users can update their own reviews" ON public.pos_order_reviews
  FOR UPDATE USING (auth.uid() = customer_id);

-- Policies for reward transactions
CREATE POLICY "Users can view their own reward transactions" ON public.customer_reward_transactions
  FOR SELECT USING (auth.uid() = user_id);