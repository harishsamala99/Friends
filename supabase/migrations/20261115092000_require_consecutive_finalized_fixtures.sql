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
    SELECT f.id, f.kickoff, f.home_score, f.away_score, f.home_team_id, f.away_team_id
    FROM public.fixtures f
    WHERE f.status = 'Full Time'
      AND f.home_score IS NOT NULL
      AND f.away_score IS NOT NULL
    ORDER BY f.kickoff, f.id
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.match_events e
      WHERE e.fixture_id = match_row.id
        AND e.player_id = p_player_id
        AND e.team_id IN (match_row.home_team_id, match_row.away_team_id)
        AND e.event_type = 'goal'
        AND coalesce(e.goal_type, '') <> 'Own Goal'
        AND (
          SELECT count(*)
          FROM public.match_events team_goals
          WHERE team_goals.fixture_id = match_row.id
            AND team_goals.team_id = e.team_id
            AND team_goals.event_type = 'goal'
            AND coalesce(team_goals.goal_type, '') <> 'Own Goal'
        ) <= CASE
          WHEN e.team_id = match_row.home_team_id THEN match_row.home_score
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
    SELECT a.player_id
    FROM public.player_achievements a
    WHERE a.achievement_key = 'on_fire'
    UNION
    SELECT e.player_id
    FROM public.match_events e
    WHERE e.fixture_id = NEW.id
      AND e.player_id IS NOT NULL
    UNION
    SELECT a.player_id
    FROM public.fixture_player_appearances a
    WHERE a.fixture_id = NEW.id
  LOOP
    PERFORM public.recalculate_player_achievements(affected_player_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  affected_player record;
BEGIN
  FOR affected_player IN
    SELECT a.player_id
    FROM public.player_achievements a
    UNION
    SELECT e.player_id
    FROM public.match_events e
    WHERE e.player_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_player_achievements(affected_player.player_id);
  END LOOP;
END;
$$;
