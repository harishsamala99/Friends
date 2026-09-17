GRANT UPDATE ON public.best_xi TO anon, authenticated;

CREATE POLICY "public update best xi" ON public.best_xi
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);