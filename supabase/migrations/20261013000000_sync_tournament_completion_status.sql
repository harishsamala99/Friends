CREATE OR REPLACE FUNCTION public.refresh_tournament_fixture_status(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tournaments AS t
  SET fixture_status = CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.fixtures AS f
          WHERE f.tournament_id = p_tournament_id
        ) AND NOT EXISTS (
          SELECT 1
          FROM public.fixtures AS f
          WHERE f.tournament_id = p_tournament_id
            AND (f.status IS DISTINCT FROM 'Full Time'
              OR f.home_score IS NULL
              OR f.away_score IS NULL)
        ) THEN 'fixtures_completed'
        ELSE 'in_progress'
      END,
      status = CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.fixtures AS f
          WHERE f.tournament_id = p_tournament_id
        ) THEN CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM public.fixtures AS f
            WHERE f.tournament_id = p_tournament_id
              AND (f.status IS DISTINCT FROM 'Full Time'
                OR f.home_score IS NULL
                OR f.away_score IS NULL)
          ) THEN 'completed'
          ELSE 'draft'
        END
        ELSE t.status
      END
  WHERE t.id = p_tournament_id;
END;
$$;

DO $$
DECLARE
  tournament_row record;
BEGIN
  FOR tournament_row IN SELECT id FROM public.tournaments LOOP
    PERFORM public.refresh_tournament_fixture_status(tournament_row.id);
  END LOOP;
END;
$$;
