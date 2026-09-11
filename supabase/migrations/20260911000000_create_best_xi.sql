CREATE TABLE public.best_xi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL UNIQUE REFERENCES public.tournaments(id) ON DELETE CASCADE,
  forward_1 uuid NOT NULL REFERENCES public.players(id),
  forward_2 uuid NOT NULL REFERENCES public.players(id),
  forward_3 uuid NOT NULL REFERENCES public.players(id),
  midfielder_1 uuid NOT NULL REFERENCES public.players(id),
  midfielder_2 uuid NOT NULL REFERENCES public.players(id),
  midfielder_3 uuid NOT NULL REFERENCES public.players(id),
  defender_1 uuid NOT NULL REFERENCES public.players(id),
  defender_2 uuid NOT NULL REFERENCES public.players(id),
  defender_3 uuid NOT NULL REFERENCES public.players(id),
  defender_4 uuid NOT NULL REFERENCES public.players(id),
  goalkeeper uuid NOT NULL REFERENCES public.players(id),
  finalized_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.best_xi TO anon, authenticated;
ALTER TABLE public.best_xi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read best xi" ON public.best_xi FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public create best xi" ON public.best_xi FOR INSERT TO anon, authenticated WITH CHECK (true);