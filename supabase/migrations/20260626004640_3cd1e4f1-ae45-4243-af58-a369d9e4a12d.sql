
-- 1. Profiles: restrict SELECT to own row
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2. Tournament organizers: restrict SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can view tournament organizers" ON public.tournament_organizers;
CREATE POLICY "Authenticated can view tournament organizers"
  ON public.tournament_organizers FOR SELECT
  TO authenticated
  USING (true);

-- 3. Move security definer helpers to a private schema not exposed via API
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- Drop dependent policies first
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Creators can update venues" ON public.venues;
DROP POLICY IF EXISTS "Organizers can create venues" ON public.venues;
DROP POLICY IF EXISTS "Tournament managers can update scores" ON public.live_scores;
DROP POLICY IF EXISTS "Tournament managers can manage matches" ON public.matches;
DROP POLICY IF EXISTS "Organizers can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can delete own tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can update own tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Tournament managers can manage teams" ON public.teams;
DROP POLICY IF EXISTS "Organizers can manage their tournament organizers" ON public.tournament_organizers;

-- Recreate functions in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.can_manage_tournament(_user_id uuid, _tournament_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
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

-- Drop the public versions
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.can_manage_tournament(uuid, uuid);

-- Recreate policies using private.* functions
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Creators can update venues" ON public.venues
  FOR UPDATE TO authenticated
  USING ((created_by = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Organizers can create venues" ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'organizer'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Tournament managers can update scores" ON public.live_scores
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = live_scores.match_id AND private.can_manage_tournament(auth.uid(), m.tournament_id)));

CREATE POLICY "Tournament managers can manage matches" ON public.matches
  FOR ALL TO authenticated
  USING (private.can_manage_tournament(auth.uid(), tournament_id));

CREATE POLICY "Organizers can create tournaments" ON public.tournaments
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'organizer'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Organizers can delete own tournaments" ON public.tournaments
  FOR DELETE TO authenticated
  USING ((organizer_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Organizers can update own tournaments" ON public.tournaments
  FOR UPDATE TO authenticated
  USING ((organizer_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Tournament managers can manage teams" ON public.teams
  FOR ALL TO authenticated
  USING (private.can_manage_tournament(auth.uid(), tournament_id));

CREATE POLICY "Organizers can manage their tournament organizers" ON public.tournament_organizers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_organizers.tournament_id AND ((t.organizer_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role))));

-- 4. Revoke GraphQL schema usage from anon/authenticated
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'graphql_public') THEN
    EXECUTE 'REVOKE USAGE ON SCHEMA graphql_public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA graphql_public FROM anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'graphql') THEN
    EXECUTE 'REVOKE USAGE ON SCHEMA graphql FROM anon, authenticated';
  END IF;
END $$;
