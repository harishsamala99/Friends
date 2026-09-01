-- Create tournaments table to persist tournament winners
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  winner text NOT NULL,
  manager text,
  participants integer,
  top_scorer_name text,
  top_scorer_goals integer,
  top_assister_name text,
  top_assister_assists integer,
  top_saver_name text,
  top_saver_saves integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.tournaments TO anon, authenticated;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public manage tournaments" ON public.tournaments FOR ALL TO anon USING (true) WITH CHECK (true);
