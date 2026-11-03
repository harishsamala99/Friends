CREATE TABLE public.tournament_team_defensive_ratings (
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  team_name text NOT NULL,
  total_rating numeric(12, 1) NOT NULL,
  average_rating numeric(3, 1) NOT NULL,
  ratings_count integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, team_id)
);

CREATE INDEX tournament_team_defensive_ratings_tournament_id_idx
  ON public.tournament_team_defensive_ratings (tournament_id);

ALTER TABLE public.tournament_team_defensive_ratings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tournament_team_defensive_ratings TO anon, authenticated;
CREATE POLICY "public read tournament team defensive ratings"
  ON public.tournament_team_defensive_ratings FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.refresh_tournament_team_defensive_rating_snapshot(
  p_tournament_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.tournament_team_defensive_ratings (
    tournament_id,
    team_id,
    team_name,
    total_rating,
    average_rating,
    ratings_count
  )
  SELECT
    f.tournament_id,
    player_team.team_id,
    team.name,
    round(sum(r.rating), 1),
    round(avg(r.rating), 1),
    count(*)::integer
  FROM public.fixture_player_ratings r
  JOIN public.fixtures f ON f.id = r.fixture_id
  JOIN public.players p ON p.id = r.player_id
  LEFT JOIN public.fixture_player_appearances a
    ON a.fixture_id = r.fixture_id AND a.player_id = r.player_id
  CROSS JOIN LATERAL (
    SELECT coalesce(a.team_id, p.team_id) AS team_id
  ) player_team
  JOIN public.teams team ON team.id = player_team.team_id
  WHERE f.tournament_id IS NOT NULL
    AND (p_tournament_id IS NULL OR f.tournament_id = p_tournament_id)
  GROUP BY f.tournament_id, player_team.team_id, team.name
  ON CONFLICT (tournament_id, team_id) DO UPDATE SET
    team_name = EXCLUDED.team_name,
    total_rating = EXCLUDED.total_rating,
    average_rating = EXCLUDED.average_rating,
    ratings_count = EXCLUDED.ratings_count,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_tournament_team_defensive_rating_snapshot(uuid)
  FROM PUBLIC, anon, authenticated;

SELECT public.refresh_tournament_team_defensive_rating_snapshot(NULL);

CREATE OR REPLACE FUNCTION public.refresh_tournament_team_defensive_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  rating_tournament_id uuid;
BEGIN
  SELECT f.tournament_id
  INTO rating_tournament_id
  FROM public.fixtures f
  WHERE f.id = NEW.fixture_id;

  IF rating_tournament_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(rating_tournament_id::text, 0));

  PERFORM public.refresh_tournament_team_defensive_rating_snapshot(rating_tournament_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER fixture_player_ratings_refresh_team_defense
AFTER INSERT OR UPDATE ON public.fixture_player_ratings
FOR EACH ROW
EXECUTE FUNCTION public.refresh_tournament_team_defensive_rating();

CREATE OR REPLACE FUNCTION public.reset_tournament_data_after_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.refresh_tournament_team_defensive_rating_snapshot(NULL);

  DELETE FROM public.best_xi
  WHERE tournament_id <> NEW.id;

  DELETE FROM public.tournament_champion_captains
  WHERE tournament_id <> NEW.id;

  DELETE FROM public.player_achievements;

  DELETE FROM public.mr_icon_award_audit;

  DELETE FROM public.mr_icon_awards;

  DELETE FROM public.fixtures
  WHERE tournament_id IS DISTINCT FROM NEW.id;

  UPDATE public.tournaments
  SET
    home_team = 'TBD',
    away_team = 'TBD',
    home_score = 0,
    away_score = 0,
    winner = 'TBD',
    top_scorer_name = NULL,
    top_scorer_goals = NULL,
    top_assister_name = NULL,
    top_assister_assists = NULL,
    top_saver_name = NULL,
    top_saver_saves = NULL,
    status = 'draft',
    fixture_status = 'in_progress'
  WHERE id <> NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tournaments_reset_data_after_creation
AFTER INSERT ON public.tournaments
FOR EACH ROW
EXECUTE FUNCTION public.reset_tournament_data_after_creation();
