
-- Players (added on the fly)
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_team ON public.players(team_id);
GRANT SELECT ON public.players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players viewable by all" ON public.players FOR SELECT USING (true);
CREATE POLICY "Managers insert players" ON public.players FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t JOIN public.matches m ON (m.team_a_id = t.id OR m.team_b_id = t.id)
    WHERE t.id = team_id AND public.can_manage_tournament(m.tournament_id)));
CREATE POLICY "Managers update players" ON public.players FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t JOIN public.matches m ON (m.team_a_id = t.id OR m.team_b_id = t.id)
    WHERE t.id = team_id AND public.can_manage_tournament(m.tournament_id)));
CREATE POLICY "Managers delete players" ON public.players FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t JOIN public.matches m ON (m.team_a_id = t.id OR m.team_b_id = t.id)
    WHERE t.id = team_id AND public.can_manage_tournament(m.tournament_id)));

-- Balls (ball-by-ball log)
CREATE TABLE public.balls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  innings INT NOT NULL DEFAULT 1,
  batting_team_id UUID NOT NULL REFERENCES public.teams(id),
  bowling_team_id UUID NOT NULL REFERENCES public.teams(id),
  over_number INT NOT NULL,         -- 0-based over index
  ball_number INT NOT NULL,         -- 1..6 legal ball within over
  is_legal BOOLEAN NOT NULL DEFAULT true,  -- false for wd/nb (still recorded but does not advance ball_number)
  striker_id UUID REFERENCES public.players(id),
  non_striker_id UUID REFERENCES public.players(id),
  bowler_id UUID REFERENCES public.players(id),
  runs INT NOT NULL DEFAULT 0,           -- runs off bat (or runs taken on extra)
  extra_type TEXT,                       -- 'wd','nb','b','lb','p',null
  extra_runs INT NOT NULL DEFAULT 0,     -- penalty runs from extra (wd=1, nb=1, etc.)
  is_wicket BOOLEAN NOT NULL DEFAULT false,
  wicket_type TEXT,                      -- 'bowled','caught','lbw','runout','stumped','hitwicket','other'
  out_player_id UUID REFERENCES public.players(id),
  fielder_id UUID REFERENCES public.players(id),
  commentary TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_balls_match ON public.balls(match_id, innings, created_at);
ALTER TABLE public.balls REPLICA IDENTITY FULL;
GRANT SELECT ON public.balls TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.balls TO authenticated;
GRANT ALL ON public.balls TO service_role;
ALTER TABLE public.balls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Balls viewable by all" ON public.balls FOR SELECT USING (true);
CREATE POLICY "Managers insert balls" ON public.balls FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.can_manage_tournament(m.tournament_id)));
CREATE POLICY "Managers update balls" ON public.balls FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.can_manage_tournament(m.tournament_id)));
CREATE POLICY "Managers delete balls" ON public.balls FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.can_manage_tournament(m.tournament_id)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.balls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
