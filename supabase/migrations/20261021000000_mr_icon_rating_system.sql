CREATE OR REPLACE FUNCTION public.validate_mr_icon_save()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  player_position text;
BEGIN
  IF NEW.event_type = 'save' AND NEW.player_id IS NOT NULL THEN
    SELECT position INTO player_position
    FROM public.players
    WHERE id = NEW.player_id;

    IF NOT FOUND OR lower(btrim(player_position)) NOT IN ('gk', 'goalkeeper') THEN
      RAISE EXCEPTION 'Saves can only be credited to a goalkeeper';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER match_events_validate_mr_icon_save
BEFORE INSERT OR UPDATE OF event_type, player_id ON public.match_events
FOR EACH ROW EXECUTE FUNCTION public.validate_mr_icon_save();

CREATE OR REPLACE FUNCTION public.mr_icon_calculate_rating(
  p_goals integer,
  p_saves integer,
  p_hattricks integer,
  p_braces integer,
  p_clean_sheets integer
)
RETURNS TABLE (
  goals_points integer,
  saves_points numeric,
  hattricks_points integer,
  braces_points integer,
  clean_sheets_points integer,
  overall_score numeric
)
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT
    coalesce(p_goals, 0) * 10,
    coalesce(p_saves, 0)::numeric * 1.5,
    coalesce(p_hattricks, 0) * 5,
    coalesce(p_braces, 0) * 3,
    coalesce(p_clean_sheets, 0) * 10,
    coalesce(p_goals, 0) * 10
      + coalesce(p_saves, 0)::numeric * 1.5
      + coalesce(p_hattricks, 0) * 5
      + coalesce(p_braces, 0) * 3
      + coalesce(p_clean_sheets, 0) * 10;
$$;

CREATE OR REPLACE VIEW public.mr_icon_player_match_ratings
WITH (security_invoker = on)
AS
WITH completed_fixtures AS (
  SELECT f.id, f.tournament_id, f.competition_id, f.kickoff, f.home_team_id,
    f.away_team_id, f.home_score, f.away_score
  FROM public.fixtures f
  WHERE f.status = 'Full Time'
    AND f.home_score IS NOT NULL
    AND f.away_score IS NOT NULL
),
valid_goals AS (
  SELECT e.fixture_id, e.player_id, e.team_id
  FROM public.match_events e
  JOIN completed_fixtures f ON f.id = e.fixture_id
  WHERE e.event_type = 'goal'
    AND e.player_id IS NOT NULL
    AND e.team_id IN (f.home_team_id, f.away_team_id)
    AND lower(btrim(coalesce(e.goal_type, ''))) NOT IN ('own goal', 'own_goal', 'own-goal')
),
goal_totals AS (
  SELECT fixture_id, player_id, count(*)::integer AS goals
  FROM valid_goals
  GROUP BY fixture_id, player_id
),
valid_saves AS (
  SELECT e.fixture_id, e.player_id, count(*)::integer AS saves
  FROM public.match_events e
  JOIN completed_fixtures f ON f.id = e.fixture_id
  JOIN public.players p ON p.id = e.player_id
  WHERE e.event_type = 'save'
    AND e.player_id IS NOT NULL
    AND e.team_id IN (f.home_team_id, f.away_team_id)
    AND lower(btrim(p.position)) IN ('gk', 'goalkeeper')
  GROUP BY e.fixture_id, e.player_id
),
valid_appearances AS (
  SELECT a.fixture_id, a.player_id, a.team_id
  FROM public.fixture_player_appearances a
  JOIN completed_fixtures f ON f.id = a.fixture_id
  WHERE a.team_id IN (f.home_team_id, f.away_team_id)
),
player_match_keys AS (
  SELECT
    fixture_id,
    player_id,
    min(team_id::text)::uuid AS team_id,
    count(DISTINCT team_id)::integer AS team_count
  FROM (
    SELECT fixture_id, player_id, team_id FROM valid_goals
    UNION ALL
    SELECT fixture_id, player_id, team_id FROM valid_appearances
    UNION ALL
    SELECT e.fixture_id, e.player_id, e.team_id
    FROM public.match_events e
    JOIN completed_fixtures f ON f.id = e.fixture_id
    JOIN public.players p ON p.id = e.player_id
    WHERE e.event_type = 'save'
      AND e.player_id IS NOT NULL
      AND e.team_id IN (f.home_team_id, f.away_team_id)
      AND lower(btrim(p.position)) IN ('gk', 'goalkeeper')
  ) player_teams
  GROUP BY fixture_id, player_id
),
player_match_stats AS (
  SELECT
    f.id AS fixture_id,
    f.tournament_id,
    f.competition_id,
    f.kickoff,
    f.home_team_id,
    f.away_team_id,
    f.home_score,
    f.away_score,
    p.id AS player_id,
    p.name AS player_name,
    p.position,
    p.photo_url,
    team.id AS team_id,
    team.name AS team_name,
    team.short_name,
    coalesce(g.goals, 0)::integer AS goals,
    CASE WHEN coalesce(g.goals, 0) >= 3 THEN 1 ELSE 0 END::integer AS hattricks,
    CASE WHEN coalesce(g.goals, 0) = 2 THEN 1 ELSE 0 END::integer AS braces,
    coalesce(s.saves, 0)::integer AS saves,
    CASE
      WHEN a.player_id IS NOT NULL
        AND k.team_count = 1
        AND (
          lower(btrim(p.position)) IN ('gk', 'goalkeeper')
          OR lower(btrim(p.position)) LIKE '%defender%'
          OR lower(btrim(p.position)) LIKE '%back%'
        )
        AND (
          (k.team_id = f.home_team_id AND f.away_score = 0)
          OR (k.team_id = f.away_team_id AND f.home_score = 0)
        )
      THEN 1
      ELSE 0
    END::integer AS clean_sheets
  FROM player_match_keys k
  JOIN completed_fixtures f ON f.id = k.fixture_id
  JOIN public.players p ON p.id = k.player_id
  JOIN public.teams team ON team.id = k.team_id
  LEFT JOIN goal_totals g
    ON g.fixture_id = k.fixture_id AND g.player_id = k.player_id
  LEFT JOIN valid_saves s
    ON s.fixture_id = k.fixture_id AND s.player_id = k.player_id
  LEFT JOIN valid_appearances a
    ON a.fixture_id = k.fixture_id AND a.player_id = k.player_id AND a.team_id = k.team_id
)
SELECT
  match_stats.fixture_id,
  match_stats.tournament_id,
  match_stats.competition_id,
  match_stats.kickoff,
  match_stats.home_team_id,
  match_stats.away_team_id,
  match_stats.home_score,
  match_stats.away_score,
  match_stats.player_id,
  match_stats.player_name,
  match_stats.position,
  match_stats.photo_url,
  match_stats.team_id,
  match_stats.team_name,
  match_stats.short_name,
  match_stats.goals,
  match_stats.hattricks,
  match_stats.braces,
  match_stats.saves,
  match_stats.clean_sheets,
  rating.goals_points,
  rating.saves_points,
  rating.hattricks_points,
  rating.braces_points,
  rating.clean_sheets_points,
  rating.overall_score
FROM player_match_stats match_stats
CROSS JOIN LATERAL public.mr_icon_calculate_rating(
  match_stats.goals,
  match_stats.saves,
  match_stats.hattricks,
  match_stats.braces,
  match_stats.clean_sheets
) rating;

CREATE OR REPLACE VIEW public.mr_icon_review_flags
WITH (security_invoker = on)
AS
SELECT
  e.fixture_id,
  f.kickoff,
  e.id AS event_id,
  e.event_type,
  'Missing player assignment for recorded ' || e.event_type AS issue
FROM public.match_events e
JOIN public.fixtures f ON f.id = e.fixture_id
WHERE f.status = 'Full Time'
  AND e.event_type IN ('goal', 'save')
  AND e.player_id IS NULL
UNION ALL
SELECT
  e.fixture_id,
  f.kickoff,
  e.id AS event_id,
  e.event_type,
  CASE
    WHEN e.team_id IS NULL THEN 'Missing team assignment for recorded ' || e.event_type
    ELSE 'Recorded ' || e.event_type || ' is assigned to a team outside the fixture'
  END AS issue
FROM public.match_events e
JOIN public.fixtures f ON f.id = e.fixture_id
WHERE f.status = 'Full Time'
  AND e.event_type IN ('goal', 'save')
  AND (e.team_id IS NULL OR e.team_id NOT IN (f.home_team_id, f.away_team_id))
UNION ALL
SELECT
  e.fixture_id,
  f.kickoff,
  e.id AS event_id,
  e.event_type,
  'Recorded save is assigned to a non-goalkeeper' AS issue
FROM public.match_events e
JOIN public.fixtures f ON f.id = e.fixture_id
JOIN public.players p ON p.id = e.player_id
WHERE f.status = 'Full Time'
  AND e.event_type = 'save'
  AND lower(btrim(p.position)) NOT IN ('gk', 'goalkeeper')
UNION ALL
SELECT
  f.id AS fixture_id,
  f.kickoff,
  NULL::uuid AS event_id,
  'player_assignment'::text AS event_type,
  'Player is recorded for both teams in the same match' AS issue
FROM public.fixtures f
JOIN (
  SELECT fixture_id, player_id, team_id
  FROM public.fixture_player_appearances
  UNION ALL
  SELECT fixture_id, player_id, team_id
  FROM public.match_events
  WHERE event_type IN ('goal', 'save')
    AND player_id IS NOT NULL
    AND team_id IS NOT NULL
) assignments ON assignments.fixture_id = f.id
WHERE f.status = 'Full Time'
GROUP BY f.id, f.kickoff, assignments.player_id
HAVING count(DISTINCT assignments.team_id) > 1
UNION ALL
SELECT
  f.id AS fixture_id,
  f.kickoff,
  NULL::uuid AS event_id,
  'goal'::text AS event_type,
  'Recorded goal events do not match the final score for ' || team.name AS issue
FROM public.fixtures f
JOIN public.teams team
  ON team.id IN (f.home_team_id, f.away_team_id)
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS goals
  FROM public.match_events e
  WHERE e.fixture_id = f.id
    AND e.event_type IN ('goal', 'own_goal')
    AND e.team_id = team.id
) recorded ON true
WHERE f.status = 'Full Time'
  AND f.home_score IS NOT NULL
  AND f.away_score IS NOT NULL
  AND recorded.goals <> CASE
    WHEN team.id = f.home_team_id THEN f.home_score
    ELSE f.away_score
  END
UNION ALL
SELECT
  f.id AS fixture_id,
  f.kickoff,
  NULL::uuid AS event_id,
  'clean_sheet'::text AS event_type,
  'No eligible goalkeeper or defender appearance is recorded for ' || team.name AS issue
FROM public.fixtures f
JOIN public.teams team ON team.id IN (f.home_team_id, f.away_team_id)
WHERE f.status = 'Full Time'
  AND f.home_score IS NOT NULL
  AND f.away_score IS NOT NULL
  AND CASE
    WHEN team.id = f.home_team_id THEN f.away_score
    ELSE f.home_score
  END = 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.fixture_player_appearances a
    JOIN public.players p ON p.id = a.player_id
    WHERE a.fixture_id = f.id
      AND a.team_id = team.id
      AND (
        lower(btrim(p.position)) IN ('gk', 'goalkeeper')
        OR lower(btrim(p.position)) LIKE '%defender%'
        OR lower(btrim(p.position)) LIKE '%back%'
      )
  );

GRANT SELECT ON public.mr_icon_player_match_ratings TO anon, authenticated, service_role;
GRANT SELECT ON public.mr_icon_review_flags TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mr_icon_calculate_rating(integer, integer, integer, integer, integer)
  TO anon, authenticated, service_role;
