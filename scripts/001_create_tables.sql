-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'document', 'crypto', 'account', 'digital', etc.
  name TEXT NOT NULL,
  details JSONB DEFAULT '{}', -- flexible storage for asset-specific details
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create nominees table
CREATE TABLE IF NOT EXISTS public.nominees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  relationship TEXT, -- 'spouse', 'child', 'parent', 'sibling', 'friend', 'lawyer', 'executor', etc.
  access_level TEXT DEFAULT 'view', -- 'view', 'edit', 'full'
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nominees ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only access their own profile
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- Assets: Users can only access their own assets
CREATE POLICY "assets_select_own" ON public.assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "assets_insert_own" ON public.assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "assets_update_own" ON public.assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "assets_delete_own" ON public.assets FOR DELETE USING (auth.uid() = user_id);

-- Nominees: Users can only access their own nominees
CREATE POLICY "nominees_select_own" ON public.nominees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nominees_insert_own" ON public.nominees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nominees_update_own" ON public.nominees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "nominees_delete_own" ON public.nominees FOR DELETE USING (auth.uid() = user_id);
