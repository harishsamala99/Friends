CREATE OR REPLACE FUNCTION public.record_goal_scorer_appearance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.event_type = 'goal'
    AND NEW.player_id IS NOT NULL
    AND NEW.team_id IS NOT NULL
  THEN
    INSERT INTO public.fixture_player_appearances (fixture_id, player_id, team_id)
    SELECT NEW.fixture_id, NEW.player_id, NEW.team_id
    FROM public.fixtures f
    WHERE f.id = NEW.fixture_id
      AND NEW.team_id IN (f.home_team_id, f.away_team_id)
    ON CONFLICT (fixture_id, player_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_events_record_goal_scorer_appearance ON public.match_events;

CREATE TRIGGER match_events_record_goal_scorer_appearance
AFTER INSERT OR UPDATE ON public.match_events
FOR EACH ROW
WHEN (NEW.event_type = 'goal' AND NEW.player_id IS NOT NULL AND NEW.team_id IS NOT NULL)
EXECUTE FUNCTION public.record_goal_scorer_appearance();

INSERT INTO public.fixture_player_appearances (fixture_id, player_id, team_id)
SELECT DISTINCT ON (e.fixture_id, e.player_id)
  e.fixture_id,
  e.player_id,
  e.team_id
FROM public.match_events e
JOIN public.fixtures f ON f.id = e.fixture_id
WHERE e.event_type = 'goal'
  AND e.player_id IS NOT NULL
  AND e.team_id IN (f.home_team_id, f.away_team_id)
ORDER BY e.fixture_id, e.player_id, e.team_id
ON CONFLICT (fixture_id, player_id) DO NOTHING;

DO $$
DECLARE
  scorer record;
BEGIN
  FOR scorer IN
    SELECT DISTINCT e.player_id
    FROM public.match_events e
    JOIN public.fixtures f ON f.id = e.fixture_id
    WHERE e.event_type = 'goal'
      AND e.player_id IS NOT NULL
      AND f.status = 'Full Time'
  LOOP
    PERFORM public.recalculate_player_achievements(scorer.player_id);
  END LOOP;
END;
$$;
