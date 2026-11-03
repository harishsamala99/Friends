CREATE OR REPLACE FUNCTION public.delete_player_tournament_defensive_ratings(
  p_tournament_id uuid,
  p_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  DELETE FROM public.fixture_player_ratings AS r
  USING public.fixtures AS f
  WHERE r.fixture_id = f.id
    AND f.tournament_id = p_tournament_id
    AND r.player_id = p_player_id;

  DELETE FROM public.tournament_team_defensive_ratings AS saved
  WHERE saved.tournament_id = p_tournament_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.fixture_player_ratings AS r
      JOIN public.fixtures AS f ON f.id = r.fixture_id
      JOIN public.players AS p ON p.id = r.player_id
      LEFT JOIN public.fixture_player_appearances AS a
        ON a.fixture_id = r.fixture_id AND a.player_id = r.player_id
      WHERE f.tournament_id = p_tournament_id
        AND coalesce(a.team_id, p.team_id) = saved.team_id
    );

  PERFORM public.refresh_tournament_team_defensive_rating_snapshot(p_tournament_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_player_tournament_defensive_ratings(uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_player_tournament_defensive_ratings(uuid, uuid)
  TO anon, authenticated;
