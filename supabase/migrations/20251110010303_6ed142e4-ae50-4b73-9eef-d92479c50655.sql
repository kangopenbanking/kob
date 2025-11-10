-- Create dashboard widgets table for customizable dashboard
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL, -- 'balance', 'transactions', 'credit_score', 'quick_actions', 'activity_feed'
  position INTEGER NOT NULL DEFAULT 0,
  size TEXT NOT NULL DEFAULT 'medium', -- 'small', 'medium', 'large'
  is_visible BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Users can only see their own widgets
CREATE POLICY "Users can view their own widgets"
  ON public.dashboard_widgets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own widgets
CREATE POLICY "Users can create their own widgets"
  ON public.dashboard_widgets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own widgets
CREATE POLICY "Users can update their own widgets"
  ON public.dashboard_widgets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own widgets
CREATE POLICY "Users can delete their own widgets"
  ON public.dashboard_widgets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_dashboard_widgets_user_id ON public.dashboard_widgets(user_id);
CREATE INDEX idx_dashboard_widgets_position ON public.dashboard_widgets(user_id, position);

-- Create trigger to update updated_at
CREATE TRIGGER update_dashboard_widgets_updated_at
  BEFORE UPDATE ON public.dashboard_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
