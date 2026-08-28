-- Scores represent completed matches, so keep standings in sync with saved results.
UPDATE public.fixtures
SET status = 'Full Time'
WHERE home_score IS NOT NULL
  AND away_score IS NOT NULL
  AND status <> 'Full Time';
