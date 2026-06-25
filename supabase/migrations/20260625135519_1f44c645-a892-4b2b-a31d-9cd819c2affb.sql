ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER TABLE public.live_scores REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;