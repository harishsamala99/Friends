CREATE OR REPLACE FUNCTION public.delete_tournament_defensive_ratings(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  DELETE FROM public.fixture_player_ratings AS r
  USING public.fixtures AS f
  WHERE r.fixture_id = f.id
    AND f.tournament_id = p_tournament_id;

  DELETE FROM public.tournament_team_defensive_ratings
  WHERE tournament_id = p_tournament_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_tournament_defensive_ratings(uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tournament_defensive_ratings(uuid)
  TO anon, authenticated;
