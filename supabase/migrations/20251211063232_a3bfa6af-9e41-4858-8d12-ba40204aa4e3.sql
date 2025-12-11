-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'organizer', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create venues/locations table
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  capacity INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tournaments table
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  format TEXT NOT NULL DEFAULT 'T20',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  banner_url TEXT,
  organizer_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  logo_url TEXT,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  team_a_id UUID REFERENCES public.teams(id) NOT NULL,
  team_b_id UUID REFERENCES public.teams(id) NOT NULL,
  venue_id UUID REFERENCES public.venues(id),
  match_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'abandoned')),
  toss_winner_id UUID REFERENCES public.teams(id),
  toss_decision TEXT CHECK (toss_decision IN ('bat', 'bowl')),
  winner_id UUID REFERENCES public.teams(id),
  result_summary TEXT,
  overs_per_innings INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create live_scores table for real-time updates
CREATE TABLE public.live_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL UNIQUE,
  batting_team_id UUID REFERENCES public.teams(id) NOT NULL,
  runs INTEGER NOT NULL DEFAULT 0,
  wickets INTEGER NOT NULL DEFAULT 0,
  overs DECIMAL(4,1) NOT NULL DEFAULT 0,
  current_run_rate DECIMAL(4,2),
  required_run_rate DECIMAL(4,2),
  target INTEGER,
  innings INTEGER NOT NULL DEFAULT 1,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create tournament_organizers for co-organizers/scorers
CREATE TABLE public.tournament_organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'scorer' CHECK (role IN ('co_organizer', 'scorer')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_organizers ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user can manage tournament
CREATE OR REPLACE FUNCTION public.can_manage_tournament(_user_id UUID, _tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments WHERE id = _tournament_id AND organizer_id = _user_id
    UNION
    SELECT 1 FROM public.tournament_organizers WHERE tournament_id = _tournament_id AND user_id = _user_id
    UNION
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Venues policies (public read, organizers/admins can create)
CREATE POLICY "Anyone can view venues" ON public.venues FOR SELECT USING (true);
CREATE POLICY "Organizers can create venues" ON public.venues FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'organizer') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Creators can update venues" ON public.venues FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Tournaments policies (public read)
CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Organizers can create tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'organizer') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Organizers can update own tournaments" ON public.tournaments FOR UPDATE TO authenticated USING (organizer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Organizers can delete own tournaments" ON public.tournaments FOR DELETE TO authenticated USING (organizer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Teams policies
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Tournament managers can manage teams" ON public.teams FOR ALL TO authenticated USING (public.can_manage_tournament(auth.uid(), tournament_id));

-- Matches policies
CREATE POLICY "Anyone can view matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Tournament managers can manage matches" ON public.matches FOR ALL TO authenticated USING (public.can_manage_tournament(auth.uid(), tournament_id));

-- Live scores policies
CREATE POLICY "Anyone can view live scores" ON public.live_scores FOR SELECT USING (true);
CREATE POLICY "Tournament managers can update scores" ON public.live_scores FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.matches m 
    WHERE m.id = match_id 
    AND public.can_manage_tournament(auth.uid(), m.tournament_id)
  )
);

-- Tournament organizers policies
CREATE POLICY "Anyone can view tournament organizers" ON public.tournament_organizers FOR SELECT USING (true);
CREATE POLICY "Organizers can manage their tournament organizers" ON public.tournament_organizers FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t 
    WHERE t.id = tournament_id 
    AND (t.organizer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Default role is 'user'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for live_scores
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_scores;