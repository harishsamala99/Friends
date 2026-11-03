WITH tournaments_to_keep AS (
  SELECT id
  FROM public.tournaments
  ORDER BY created_at DESC, id DESC
  LIMIT 2
)
DELETE FROM public.tournament_team_defensive_ratings
WHERE tournament_id NOT IN (SELECT id FROM tournaments_to_keep);

CREATE OR REPLACE FUNCTION public.trim_tournament_team_defensive_rating_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  previous_tournament_id uuid;
BEGIN
  SELECT id
  INTO previous_tournament_id
  FROM public.tournaments
  WHERE id <> NEW.id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  DELETE FROM public.tournament_team_defensive_ratings
  WHERE tournament_id IS DISTINCT FROM NEW.id
    AND tournament_id IS DISTINCT FROM previous_tournament_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tournaments_trim_defensive_rating_history
AFTER INSERT ON public.tournaments
FOR EACH ROW
EXECUTE FUNCTION public.trim_tournament_team_defensive_rating_history();
