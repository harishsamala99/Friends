ALTER TABLE public.tournaments
  ADD COLUMN status text NOT NULL DEFAULT 'draft';

UPDATE public.tournaments
SET status = 'completed'
WHERE status = 'draft';

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_status_check CHECK (status IN ('draft', 'completed'));