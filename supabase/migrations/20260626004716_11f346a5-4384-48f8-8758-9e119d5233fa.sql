
CREATE OR REPLACE FUNCTION public.can_manage_tournament(_tournament_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments WHERE id = _tournament_id AND organizer_id = auth.uid()
    UNION
    SELECT 1 FROM public.tournament_organizers WHERE tournament_id = _tournament_id AND user_id = auth.uid()
    UNION
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_tournament(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_tournament(uuid) TO authenticated;
