ALTER TABLE public.tournaments
  ADD COLUMN fixture_status text NOT NULL DEFAULT 'in_progress'
  CHECK (fixture_status IN ('in_progress', 'fixtures_completed'));

UPDATE public.tournaments AS t
SET fixture_status = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.fixtures AS f
    WHERE f.tournament_id = t.id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.fixtures AS f
    WHERE f.tournament_id = t.id
      AND (f.status IS DISTINCT FROM 'Full Time'
        OR f.home_score IS NULL
        OR f.away_score IS NULL)
  ) THEN 'fixtures_completed'
  ELSE 'in_progress'
END;

CREATE OR REPLACE FUNCTION public.refresh_tournament_fixture_status(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tournaments AS t
  SET fixture_status = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.fixtures AS f
      WHERE f.tournament_id = p_tournament_id
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.fixtures AS f
      WHERE f.tournament_id = p_tournament_id
        AND (f.status IS DISTINCT FROM 'Full Time'
          OR f.home_score IS NULL
          OR f.away_score IS NULL)
    ) THEN 'fixtures_completed'
    ELSE 'in_progress'
  END
  WHERE t.id = p_tournament_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tournament_fixture_status_from_fixture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_tournament_fixture_status(OLD.tournament_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_tournament_fixture_status(NEW.tournament_id);
  IF TG_OP = 'UPDATE' THEN
    IF OLD.tournament_id IS DISTINCT FROM NEW.tournament_id THEN
      PERFORM public.refresh_tournament_fixture_status(OLD.tournament_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tournament_fixture_status_from_tournament()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_tournament_fixture_status(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER fixtures_sync_tournament_fixture_status
AFTER INSERT OR UPDATE OR DELETE ON public.fixtures
FOR EACH ROW
EXECUTE FUNCTION public.sync_tournament_fixture_status_from_fixture();

CREATE TRIGGER tournaments_sync_fixture_status
AFTER INSERT ON public.tournaments
FOR EACH ROW
EXECUTE FUNCTION public.sync_tournament_fixture_status_from_tournament();