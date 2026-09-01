-- Create top_saves view for goalkeepers
CREATE OR REPLACE VIEW public.top_saves AS
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
  c.id AS competition_id,
  COALESCE(SUM(CASE WHEN me.event_type = 'save' THEN 1 ELSE 0 END), 0) AS saves,
  COUNT(DISTINCT CASE 
    WHEN f.status = 'Full Time' AND (
      (f.home_team_id = p.team_id AND f.away_score = 0) OR 
      (f.away_team_id = p.team_id AND f.home_score = 0)
    ) THEN f.id 
  END) AS clean_sheets,
  COUNT(DISTINCT CASE 
    WHEN f.status = 'Full Time' AND (f.home_team_id = p.team_id OR f.away_team_id = p.team_id)
    THEN f.id 
  END) AS matches
FROM public.players p
LEFT JOIN public.teams t ON p.team_id = t.id
LEFT JOIN public.competitions c ON t.competition_id = c.id
LEFT JOIN public.fixtures f ON (f.home_team_id = p.team_id OR f.away_team_id = p.team_id)
LEFT JOIN public.match_events me ON p.id = me.player_id AND me.fixture_id = f.id AND me.event_type = 'save'
WHERE LOWER(p.position) LIKE '%goalkeeper%'
GROUP BY p.id, p.name, p.position, p.photo_url, p.jersey_number, p.team_id, 
         t.id, t.name, t.short_name, t.crest_color, c.id;

GRANT SELECT ON public.top_saves TO anon, authenticated;
ALTER VIEW public.top_saves SET (security_invoker = on);

