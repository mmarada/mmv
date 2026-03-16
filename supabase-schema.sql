-- Supabase Schema for NestDirect

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create listings table
CREATE TABLE public.listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  domain TEXT,
  points INTEGER DEFAULT 1,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  type TEXT NOT NULL,
  rent NUMERIC,
  budget NUMERIC,
  neighborhood TEXT NOT NULL,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_username TEXT NOT NULL,
  receiver_username TEXT NOT NULL,
  listing_id TEXT,
  text TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Listings Policies
-- Anyone can read listings
CREATE POLICY "Listings are viewable by everyone" 
  ON public.listings FOR SELECT 
  USING (true);

-- Authenticated users can insert listings
CREATE POLICY "Authenticated users can insert listings" 
  ON public.listings FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Users can update their own listings
CREATE POLICY "Users can update own listings" 
  ON public.listings FOR UPDATE 
  USING (auth.uid() = user_id);

-- Messages Policies
-- Users can read messages they sent or received
CREATE POLICY "Users can read their own messages" 
  ON public.messages FOR SELECT 
  USING (
    auth.uid() = sender_id OR 
    receiver_username = COALESCE(
      auth.jwt() -> 'user_metadata' ->> 'username',
      split_part(auth.jwt() ->> 'email', '@', 1)
    )
  );

-- Authenticated users can insert messages
CREATE POLICY "Authenticated users can insert messages" 
  ON public.messages FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = sender_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.raw_user_meta_data->>'username');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create enquiries table
CREATE TABLE public.enquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- Enquiries Policies
-- Authenticated users can insert enquiries
CREATE POLICY "Authenticated users can insert enquiries" 
  ON public.enquiries FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');
