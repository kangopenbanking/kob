-- Create user addresses table for verified locations
CREATE TABLE public.user_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  full_address TEXT,
  postiq_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_method TEXT, -- 'gps', 'manual', 'import'
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create address collections/folders table
CREATE TABLE public.address_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6', -- hex color for folder
  icon TEXT DEFAULT 'folder', -- icon name
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Junction table for addresses in collections
CREATE TABLE public.address_collection_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.address_collections(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES public.user_addresses(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(collection_id, address_id)
);

-- Address imports tracking
CREATE TABLE public.address_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT, -- 'csv', 'xlsx'
  total_rows INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_details JSONB DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.address_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.address_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.address_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_addresses
CREATE POLICY "Users can manage own addresses" ON public.user_addresses
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for address_collections
CREATE POLICY "Users can manage own collections" ON public.address_collections
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for address_collection_items
CREATE POLICY "Users can manage own collection items" ON public.address_collection_items
  FOR ALL USING (
    collection_id IN (
      SELECT id FROM public.address_collections WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for address_imports
CREATE POLICY "Users can manage own imports" ON public.address_imports
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX idx_user_addresses_postiq_code ON public.user_addresses(postiq_code);
CREATE INDEX idx_address_collections_user_id ON public.address_collections(user_id);
CREATE INDEX idx_address_imports_user_id ON public.address_imports(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_addresses_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_address_collections_updated_at
  BEFORE UPDATE ON public.address_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();