CREATE TABLE public.house_of_icons (
  group_id text PRIMARY KEY,
  group_start integer NOT NULL,
  group_end integer NOT NULL,
  tournament_ids uuid[] NOT NULL,
  status text NOT NULL CHECK (status IN ('complete', 'insufficient_data')),
  selections jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_fingerprint text NOT NULL,
  selection_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT house_of_icons_group_range CHECK (group_end = group_start + 2)
);

GRANT SELECT, INSERT, UPDATE ON public.house_of_icons TO anon, authenticated;

ALTER TABLE public.house_of_icons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read house of icons"
  ON public.house_of_icons FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public create house of icons"
  ON public.house_of_icons FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "public update house of icons"
  ON public.house_of_icons FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
