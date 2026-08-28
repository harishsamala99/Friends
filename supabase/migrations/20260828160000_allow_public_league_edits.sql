-- This league is intentionally community-editable: visitors can maintain the data without signing in.
DROP POLICY IF EXISTS "public manage competitions" ON public.competitions;
DROP POLICY IF EXISTS "public manage teams" ON public.teams;
DROP POLICY IF EXISTS "public manage players" ON public.players;
DROP POLICY IF EXISTS "public manage fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "public manage events" ON public.match_events;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions, public.teams, public.players, public.fixtures, public.match_events TO anon;

CREATE POLICY "public manage competitions" ON public.competitions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public manage teams" ON public.teams FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public manage players" ON public.players FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public manage fixtures" ON public.fixtures FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public manage events" ON public.match_events FOR ALL TO anon USING (true) WITH CHECK (true);