-- PickSlate Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  email TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- GROUPS
-- ============================================
CREATE TABLE public.groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GROUP MEMBERS
-- ============================================
CREATE TABLE public.group_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ============================================
-- DAILY SLATES
-- ============================================
CREATE TABLE public.slates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'locked', 'finalized')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GAMES (within a slate)
-- ============================================
CREATE TABLE public.games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slate_id UUID REFERENCES public.slates(id) ON DELETE CASCADE,
  external_id TEXT, -- from The Odds API
  sport TEXT NOT NULL, -- 'nba', 'nfl', 'nhl', 'mlb', 'ncaab', 'ncaaf'
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_abbr TEXT,
  away_team_abbr TEXT,
  commence_time TIMESTAMPTZ NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  winner TEXT CHECK (winner IN ('home', 'away', NULL)),
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'final')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PICKS
-- ============================================
CREATE TABLE public.picks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  slate_id UUID REFERENCES public.slates(id) ON DELETE CASCADE,
  pick TEXT NOT NULL CHECK (pick IN ('home', 'away')),
  is_correct BOOLEAN,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- ============================================
-- DAILY SCORES (aggregated per user per day)
-- ============================================
CREATE TABLE public.daily_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  slate_id UUID REFERENCES public.slates(id) ON DELETE CASCADE,
  correct_picks INTEGER DEFAULT 0,
  total_picks INTEGER DEFAULT 0,
  base_points INTEGER DEFAULT 0,
  performance_points INTEGER DEFAULT 0,
  perfect_bonus INTEGER DEFAULT 0,
  streak_bonus INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slate_id)
);

-- ============================================
-- STREAKS
-- ============================================
CREATE TABLE public.streaks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_played_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles: users can read all, update own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Groups: viewable by members
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Groups are viewable by members" ON public.groups
  FOR SELECT USING (
    id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Groups viewable for join flow" ON public.groups
  FOR SELECT USING (true);

-- Group members: viewable by group members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members viewable by group members" ON public.group_members
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can join groups" ON public.group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Slates: viewable by all authenticated
ALTER TABLE public.slates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Slates are viewable by authenticated" ON public.slates
  FOR SELECT USING (auth.role() = 'authenticated');

-- Games: viewable by all authenticated
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are viewable by authenticated" ON public.games
  FOR SELECT USING (auth.role() = 'authenticated');

-- Picks: users can read own, insert own
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own picks" ON public.picks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view picks after slate finalized" ON public.picks
  FOR SELECT USING (
    slate_id IN (SELECT id FROM public.slates WHERE status = 'finalized')
  );

CREATE POLICY "Users can insert own picks" ON public.picks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own picks" ON public.picks
  FOR UPDATE USING (auth.uid() = user_id);

-- Daily scores: viewable by all authenticated (leaderboard)
ALTER TABLE public.daily_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily scores viewable by authenticated" ON public.daily_scores
  FOR SELECT USING (auth.role() = 'authenticated');

-- Streaks: viewable by all authenticated
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Streaks viewable by authenticated" ON public.streaks
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_games_slate_id ON public.games(slate_id);
CREATE INDEX idx_picks_user_id ON public.picks(user_id);
CREATE INDEX idx_picks_slate_id ON public.picks(slate_id);
CREATE INDEX idx_picks_game_id ON public.picks(game_id);
CREATE INDEX idx_daily_scores_user_id ON public.daily_scores(user_id);
CREATE INDEX idx_daily_scores_slate_id ON public.daily_scores(slate_id);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_slates_date ON public.slates(date);

-- ============================================
-- SEED DATA: Create First Class Dicks group
-- ============================================
-- NOTE: Run this AFTER your first admin user signs up.
-- Replace the UUID below with your actual user ID from auth.users
-- 
-- INSERT INTO public.groups (name, invite_code, created_by)
-- VALUES ('First Class Dicks', 'DICKS', 'YOUR_USER_UUID_HERE');
