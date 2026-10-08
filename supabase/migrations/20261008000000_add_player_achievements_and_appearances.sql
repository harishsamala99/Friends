CREATE TABLE public.fixture_player_appearances (
  fixture_id uuid NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fixture_id, player_id)
);

CREATE INDEX fixture_player_appearances_player_id_idx
  ON public.fixture_player_appearances (player_id);

ALTER TABLE public.fixture_player_appearances ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.fixture_player_appearances TO anon, authenticated;
CREATE POLICY "public read fixture appearances"
  ON public.fixture_player_appearances FOR SELECT TO anon, authenticated
  USING (true);

CREATE TABLE public.player_achievements (
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  achievement_key text NOT NULL CHECK (achievement_key IN ('hat_trick_hero', 'on_fire')),
  unlocked_at timestamptz NOT NULL,
  evidence_fixture_id uuid REFERENCES public.fixtures(id) ON DELETE SET NULL,
  PRIMARY KEY (player_id, achievement_key)
);

ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.player_achievements TO anon, authenticated;
CREATE POLICY "public read player achievements"
  ON public.player_achievements FOR SELECT TO anon, authenticated
  USING (true);

CREATE TABLE public.tournament_champion_captains (
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, team_id)
);

ALTER TABLE public.tournament_champion_captains ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tournament_champion_captains TO anon, authenticated;
CREATE POLICY "public read tournament champion captains"
  ON public.tournament_champion_captains FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.save_tournament_champion_captain(
  p_tournament_id uuid,
  p_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  tournament_winner text;
  champion_team_id uuid;
  matching_teams integer;
BEGIN
  SELECT t.winner INTO tournament_winner
  FROM public.tournaments t
  WHERE t.id = p_tournament_id AND t.status = 'completed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A completed tournament is required';
  END IF;

  SELECT count(*)::integer
  INTO matching_teams
  FROM public.teams team
  WHERE lower(btrim(team.name)) = lower(btrim(tournament_winner));
  IF matching_teams <> 1 THEN
    RAISE EXCEPTION 'The recorded tournament winner must match exactly one team';
  END IF;
  SELECT team.id INTO champion_team_id
  FROM public.teams team
  WHERE lower(btrim(team.name)) = lower(btrim(tournament_winner));

  IF NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id = p_player_id) THEN
    RAISE EXCEPTION 'Select a valid player for the official captain assignment';
  END IF;

  DELETE FROM public.tournament_champion_captains
  WHERE tournament_id = p_tournament_id;

  INSERT INTO public.tournament_champion_captains (tournament_id, team_id, player_id)
  VALUES (p_tournament_id, champion_team_id, p_player_id)
  ON CONFLICT (tournament_id, team_id)
  DO UPDATE SET player_id = EXCLUDED.player_id, recorded_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.save_fixture_player_appearances(
  p_fixture_id uuid,
  p_appearances jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF jsonb_typeof(p_appearances) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Appearances must be a JSON array';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_appearances) AS submitted(player_id uuid, team_id uuid)
    LEFT JOIN public.players p ON p.id = submitted.player_id
    WHERE p.id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.fixtures f
        WHERE f.id = p_fixture_id
          AND submitted.team_id IN (f.home_team_id, f.away_team_id)
      )
  ) THEN
    RAISE EXCEPTION 'Each appearance must reference an existing player and one of the fixture teams';
  END IF;

  DELETE FROM public.fixture_player_appearances
  WHERE fixture_id = p_fixture_id;

  INSERT INTO public.fixture_player_appearances (fixture_id, player_id, team_id)
  SELECT p_fixture_id, submitted.player_id, submitted.team_id
  FROM jsonb_to_recordset(p_appearances) AS submitted(player_id uuid, team_id uuid);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_player_achievements(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  hat_trick record;
  match_row record;
  scoring_streak integer := 0;
  on_fire_fixture_id uuid;
  on_fire_at timestamptz;
BEGIN
  DELETE FROM public.player_achievements
  WHERE player_id = p_player_id;

  SELECT f.id, f.kickoff
  INTO hat_trick
  FROM public.match_events e
  JOIN public.fixtures f ON f.id = e.fixture_id
  WHERE e.player_id = p_player_id
    AND e.event_type = 'goal'
    AND coalesce(e.goal_type, '') <> 'Own Goal'
    AND e.team_id IN (f.home_team_id, f.away_team_id)
    AND f.status = 'Full Time'
    AND f.home_score IS NOT NULL
    AND f.away_score IS NOT NULL
    AND (
      SELECT count(*)
      FROM public.match_events team_goals
      WHERE team_goals.fixture_id = f.id
        AND team_goals.team_id = e.team_id
        AND team_goals.event_type = 'goal'
        AND coalesce(team_goals.goal_type, '') <> 'Own Goal'
    ) <= CASE WHEN e.team_id = f.home_team_id THEN f.home_score ELSE f.away_score END
  GROUP BY f.id, f.kickoff, e.team_id
  HAVING count(*) >= 3
  ORDER BY f.kickoff, f.id
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.player_achievements (player_id, achievement_key, unlocked_at, evidence_fixture_id)
    VALUES (p_player_id, 'hat_trick_hero', hat_trick.kickoff, hat_trick.id);
  END IF;

  FOR match_row IN
    SELECT f.id, f.kickoff, f.status, f.home_score, f.away_score,
      f.home_team_id, f.away_team_id, a.team_id
    FROM public.fixture_player_appearances a
    JOIN public.fixtures f ON f.id = a.fixture_id
    WHERE a.player_id = p_player_id
    ORDER BY f.kickoff, f.id
  LOOP
    IF match_row.status <> 'Full Time'
      OR match_row.home_score IS NULL
      OR match_row.away_score IS NULL
      OR match_row.team_id NOT IN (match_row.home_team_id, match_row.away_team_id)
    THEN
      scoring_streak := 0;
    ELSIF EXISTS (
      SELECT 1
      FROM public.match_events e
      WHERE e.fixture_id = match_row.id
        AND e.player_id = p_player_id
        AND e.team_id = match_row.team_id
        AND e.event_type = 'goal'
        AND coalesce(e.goal_type, '') <> 'Own Goal'
        AND (
          SELECT count(*)
          FROM public.match_events team_goals
          WHERE team_goals.fixture_id = match_row.id
            AND team_goals.team_id = match_row.team_id
            AND team_goals.event_type = 'goal'
            AND coalesce(team_goals.goal_type, '') <> 'Own Goal'
        ) <= CASE
          WHEN match_row.team_id = match_row.home_team_id THEN match_row.home_score
          ELSE match_row.away_score
        END
    )
    THEN
      scoring_streak := scoring_streak + 1;
      IF scoring_streak >= 5 AND on_fire_fixture_id IS NULL THEN
        on_fire_fixture_id := match_row.id;
        on_fire_at := match_row.kickoff;
      END IF;
    ELSE
      scoring_streak := 0;
    END IF;
  END LOOP;

  IF on_fire_fixture_id IS NOT NULL THEN
    INSERT INTO public.player_achievements (player_id, achievement_key, unlocked_at, evidence_fixture_id)
    VALUES (p_player_id, 'on_fire', on_fire_at, on_fire_fixture_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_achievement_for_event_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.player_id IS NOT NULL THEN
      PERFORM public.recalculate_player_achievements(NEW.player_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.player_id IS NOT NULL THEN
      PERFORM public.recalculate_player_achievements(OLD.player_id);
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.player_id IS NOT NULL THEN
    PERFORM public.recalculate_player_achievements(OLD.player_id);
  END IF;
  IF NEW.player_id IS NOT NULL AND NEW.player_id IS DISTINCT FROM OLD.player_id THEN
    PERFORM public.recalculate_player_achievements(NEW.player_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_achievement_for_appearance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_player_achievements(NEW.player_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_player_achievements(OLD.player_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalculate_player_achievements(OLD.player_id);
  IF NEW.player_id IS DISTINCT FROM OLD.player_id THEN
    PERFORM public.recalculate_player_achievements(NEW.player_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_achievements_for_fixture_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  affected_player_id uuid;
BEGIN
  FOR affected_player_id IN
    SELECT e.player_id FROM public.match_events e WHERE e.fixture_id = NEW.id AND e.player_id IS NOT NULL
    UNION
    SELECT a.player_id FROM public.fixture_player_appearances a WHERE a.fixture_id = NEW.id
  LOOP
    PERFORM public.recalculate_player_achievements(affected_player_id);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER match_events_refresh_achievements
AFTER INSERT OR UPDATE OR DELETE ON public.match_events
FOR EACH ROW EXECUTE FUNCTION public.refresh_achievement_for_event_change();

CREATE TRIGGER fixture_appearances_refresh_achievements
AFTER INSERT OR UPDATE OR DELETE ON public.fixture_player_appearances
FOR EACH ROW EXECUTE FUNCTION public.refresh_achievement_for_appearance_change();

CREATE TRIGGER fixtures_refresh_achievements
AFTER UPDATE OF status, home_score, away_score, kickoff, home_team_id, away_team_id
ON public.fixtures
FOR EACH ROW EXECUTE FUNCTION public.refresh_achievements_for_fixture_change();

DO $$
DECLARE
  player_row record;
BEGIN
  FOR player_row IN
    SELECT DISTINCT e.player_id AS id
    FROM public.match_events e
    JOIN public.fixtures f ON f.id = e.fixture_id
    WHERE e.player_id IS NOT NULL AND e.event_type = 'goal' AND f.status = 'Full Time'
  LOOP
    PERFORM public.recalculate_player_achievements(player_row.id);
  END LOOP;
END;
$$;
