DROP POLICY IF EXISTS "Users can view relevant tournament organizers" ON public.tournament_organizers;

CREATE POLICY "Users can view scoped tournament organizer assignments"
ON public.tournament_organizers
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = tournament_organizers.tournament_id
      AND t.organizer_id = auth.uid()
  )
);