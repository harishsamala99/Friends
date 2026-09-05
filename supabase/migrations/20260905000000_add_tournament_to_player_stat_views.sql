UPDATE public.fixtures
SET tournament_id = (
  SELECT id FROM public.tournaments ORDER BY created_at DESC LIMIT 1
)
WHERE tournament_id IS NULL
  AND EXISTS (SELECT 1 FROM public.tournaments);

DROP VIEW IF EXISTS public.top_scorers;
CREATE VIEW public.top_scorers AS
SELECT
  p.id AS player_id,
  p.name AS player_name,
  p.position,
  p.photo_url,
  p.jersey_number,
  t.id AS team_id,
  t.name AS team_name,
  t.short_name,
  t.crest_color,
  t.competition_id,
  f.tournament_id,
  count(*)::int AS goals,
  (
    SELECT count(*)::int
    FROM public.match_events a
    JOIN public.fixtures af ON af.id = a.fixture_id
    WHERE a.assist_player_id = p.id
      AND a.event_type = 'goal'
      AND af.tournament_id = f.tournament_id
  ) AS assists,
  count(DISTINCT e.fixture_id)::int AS matches
FROM public.players p
JOIN public.teams t ON t.id = p.team_id
JOIN public.match_events e ON e.player_id = p.id AND e.event_type = 'goal'
JOIN public.fixtures f ON f.id = e.fixture_id
GROUP BY p.id, p.name, p.position, p.photo_url, p.jersey_number, t.id, t.name, t.short_name, t.crest_color, t.competition_id, f.tournament_id;

DROP VIEW IF EXISTS public.top_saves;
CREATE VIEW public.top_saves AS
SELECT
  p.id AS player_id,
  p.name AS player_name,
  p.position,
  p.photo_url,
  p.jersey_number,
  p.team_id,
  t.name AS team_name,
  t.short_name,
  t.crest_color,
  t.competition_id,
  f.tournament_id,
  count(*)::int AS saves,
  count(DISTINCT CASE
    WHEN f.status = 'Full Time' AND (
      (f.home_team_id = p.team_id AND f.away_score = 0) OR
      (f.away_team_id = p.team_id AND f.home_score = 0)
    ) THEN f.id
  END)::int AS clean_sheets,
  count(DISTINCT CASE
    WHEN f.status = 'Full Time' AND (f.home_team_id = p.team_id OR f.away_team_id = p.team_id)
    THEN f.id
  END)::int AS matches
FROM public.players p
JOIN public.teams t ON p.team_id = t.id
JOIN public.match_events me ON p.id = me.player_id AND me.event_type = 'save'
JOIN public.fixtures f ON f.id = me.fixture_id
GROUP BY p.id, p.name, p.position, p.photo_url, p.jersey_number, p.team_id, t.name, t.short_name, t.crest_color, t.competition_id, f.tournament_id;

GRANT SELECT ON public.top_scorers TO anon, authenticated, service_role;
GRANT SELECT ON public.top_saves TO anon, authenticated, service_role;
ALTER VIEW public.top_scorers SET (security_invoker = on);
ALTER VIEW public.top_saves SET (security_invoker = on);