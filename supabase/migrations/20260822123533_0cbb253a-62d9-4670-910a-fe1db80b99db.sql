
-- ROLES
CREATE TYPE public.app_role AS ENUM ('super_admin','competition_admin','match_official','viewer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_manage(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','competition_admin'))
$$;

CREATE OR REPLACE FUNCTION public.can_officiate(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','competition_admin','match_official'))
$$;

-- New signups become super_admin if first user, else viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN (SELECT count(*) FROM public.profiles) <= 1 THEN 'super_admin'::public.app_role ELSE 'viewer'::public.app_role END);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- COMPETITIONS
CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  season text NOT NULL,
  start_date date,
  end_date date,
  description text,
  location text,
  num_teams int,
  format text NOT NULL DEFAULT 'league',
  points_win int NOT NULL DEFAULT 3,
  points_draw int NOT NULL DEFAULT 1,
  points_loss int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES public.competitions(id) ON DELETE CASCADE,
  name text NOT NULL,
  short_name text,
  logo_url text,
  crest_color text DEFAULT '#0b6b3a',
  manager text,
  stadium text,
  city text,
  founded_year int,
  contact text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text,
  jersey_number int,
  position text NOT NULL DEFAULT 'Midfielder',
  date_of_birth date,
  nationality text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  matchday int NOT NULL DEFAULT 1,
  home_team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  kickoff timestamptz NOT NULL,
  venue text,
  referee text,
  status text NOT NULL DEFAULT 'Scheduled',
  home_score int,
  away_score int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT different_teams CHECK (home_team_id <> away_team_id)
);

CREATE TABLE public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id uuid NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  assist_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  minute int NOT NULL DEFAULT 1,
  event_type text NOT NULL,
  goal_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.fixtures (competition_id, matchday);
CREATE INDEX ON public.match_events (fixture_id);
CREATE INDEX ON public.players (team_id);
CREATE INDEX ON public.teams (competition_id);

-- grants + rls
GRANT SELECT ON public.competitions, public.teams, public.players, public.fixtures, public.match_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions, public.teams, public.players, public.fixtures, public.match_events TO authenticated;
GRANT ALL ON public.competitions, public.teams, public.players, public.fixtures, public.match_events TO service_role;

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read competitions" ON public.competitions FOR SELECT USING (true);
CREATE POLICY "public read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "public read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "public read fixtures" ON public.fixtures FOR SELECT USING (true);
CREATE POLICY "public read events" ON public.match_events FOR SELECT USING (true);

CREATE POLICY "manage competitions" ON public.competitions FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "manage teams" ON public.teams FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "manage players" ON public.players FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "manage fixtures" ON public.fixtures FOR ALL TO authenticated USING (public.can_officiate(auth.uid())) WITH CHECK (public.can_officiate(auth.uid()));
CREATE POLICY "manage events" ON public.match_events FOR ALL TO authenticated USING (public.can_officiate(auth.uid())) WITH CHECK (public.can_officiate(auth.uid()));

-- keep fixture score in sync with goal events
CREATE OR REPLACE FUNCTION public.recalc_fixture_score(_fixture_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h uuid; a uuid; hs int; asc_ int;
BEGIN
  SELECT home_team_id, away_team_id INTO h, a FROM public.fixtures WHERE id = _fixture_id;
  IF h IS NULL THEN RETURN; END IF;
  SELECT
    count(*) FILTER (WHERE (event_type='goal' AND team_id=h) OR (event_type='own_goal' AND team_id=a)),
    count(*) FILTER (WHERE (event_type='goal' AND team_id=a) OR (event_type='own_goal' AND team_id=h))
  INTO hs, asc_ FROM public.match_events WHERE fixture_id=_fixture_id;
  UPDATE public.fixtures SET home_score=hs, away_score=asc_ WHERE id=_fixture_id;
END; $$;

CREATE OR REPLACE FUNCTION public.match_events_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_fixture_score(COALESCE(NEW.fixture_id, OLD.fixture_id));
  RETURN NULL;
END; $$;
CREATE TRIGGER match_events_sync_trg AFTER INSERT OR UPDATE OR DELETE ON public.match_events
FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION public.match_events_sync();

-- STANDINGS VIEW
CREATE VIEW public.standings AS
WITH results AS (
  SELECT f.competition_id, f.home_team_id AS team_id, f.home_score AS gf, f.away_score AS ga, f.kickoff, true AS home FROM public.fixtures f WHERE f.status='Full Time' AND f.home_score IS NOT NULL
  UNION ALL
  SELECT f.competition_id, f.away_team_id, f.away_score, f.home_score, f.kickoff, false FROM public.fixtures f WHERE f.status='Full Time' AND f.away_score IS NOT NULL
)
SELECT
  t.competition_id,
  t.id AS team_id,
  t.name AS team_name,
  t.short_name,
  t.crest_color,
  t.logo_url,
  count(r.team_id)::int AS played,
  count(*) FILTER (WHERE r.gf > r.ga)::int AS won,
  count(*) FILTER (WHERE r.gf = r.ga)::int AS drawn,
  count(*) FILTER (WHERE r.gf < r.ga)::int AS lost,
  COALESCE(sum(r.gf),0)::int AS goals_for,
  COALESCE(sum(r.ga),0)::int AS goals_against,
  COALESCE(sum(r.gf) - sum(r.ga),0)::int AS goal_difference,
  (count(*) FILTER (WHERE r.gf > r.ga) * COALESCE(c.points_win,3) + count(*) FILTER (WHERE r.gf = r.ga) * COALESCE(c.points_draw,1))::int AS points,
  count(*) FILTER (WHERE r.home AND r.gf > r.ga)::int AS home_won,
  count(*) FILTER (WHERE NOT r.home AND r.gf > r.ga)::int AS away_won,
  count(*) FILTER (WHERE r.ga = 0)::int AS clean_sheets
FROM public.teams t
LEFT JOIN public.competitions c ON c.id = t.competition_id
LEFT JOIN results r ON r.team_id = t.id
GROUP BY t.competition_id, t.id, t.name, t.short_name, t.crest_color, t.logo_url, c.points_win, c.points_draw;
GRANT SELECT ON public.standings TO anon, authenticated, service_role;

-- TOP SCORERS VIEW
CREATE VIEW public.top_scorers AS
SELECT
  p.id AS player_id, p.name AS player_name, p.position, p.photo_url, p.jersey_number,
  t.id AS team_id, t.name AS team_name, t.short_name, t.crest_color, t.competition_id,
  count(*) FILTER (WHERE e.event_type='goal')::int AS goals,
  (SELECT count(*) FROM public.match_events a WHERE a.assist_player_id = p.id AND a.event_type='goal')::int AS assists,
  (SELECT count(DISTINCT e2.fixture_id) FROM public.match_events e2 WHERE e2.player_id = p.id)::int AS matches
FROM public.players p
JOIN public.teams t ON t.id = p.team_id
LEFT JOIN public.match_events e ON e.player_id = p.id AND e.event_type='goal'
GROUP BY p.id, p.name, p.position, p.photo_url, p.jersey_number, t.id, t.name, t.short_name, t.crest_color, t.competition_id;
GRANT SELECT ON public.top_scorers TO anon, authenticated, service_role;

-- PLAYER STATS VIEW
CREATE VIEW public.player_stats AS
SELECT
  p.id AS player_id, p.name AS player_name, p.position, p.jersey_number, p.nationality, p.photo_url,
  t.id AS team_id, t.name AS team_name, t.crest_color, t.competition_id,
  count(*) FILTER (WHERE e.event_type='goal' AND e.player_id=p.id)::int AS goals,
  (SELECT count(*) FROM public.match_events a WHERE a.assist_player_id=p.id)::int AS assists,
  count(*) FILTER (WHERE e.event_type='yellow_card')::int AS yellow_cards,
  count(*) FILTER (WHERE e.event_type='red_card')::int AS red_cards,
  count(DISTINCT e.fixture_id)::int AS matches
FROM public.players p
JOIN public.teams t ON t.id=p.team_id
LEFT JOIN public.match_events e ON e.player_id=p.id
GROUP BY p.id, p.name, p.position, p.jersey_number, p.nationality, p.photo_url, t.id, t.name, t.crest_color, t.competition_id;
GRANT SELECT ON public.player_stats TO anon, authenticated, service_role;

-- ===== DEMO DATA =====
DO $$
DECLARE
  comp uuid;
  team_names text[] := ARRAY['Northgate United','Riverside FC','Ashford Rovers','Kingsbridge City','Marlow Athletic','Eastvale Town','Brackenhill Wanderers','Selby Albion','Thornwood FC','Havenport Rangers'];
  shorts text[] := ARRAY['NGU','RIV','ASH','KBC','MAR','EAS','BRK','SEL','THW','HAV'];
  colors text[] := ARRAY['#0b6b3a','#123a6b','#8a1c2b','#1f6f8b','#4b2e83','#b45309','#0f766e','#7c2d12','#1e3a8a','#065f46'];
  cities text[] := ARRAY['Northgate','Riverside','Ashford','Kingsbridge','Marlow','Eastvale','Brackenhill','Selby','Thornwood','Havenport'];
  firsts text[] := ARRAY['James','Liam','Noah','Ethan','Lucas','Mason','Logan','Owen','Caleb','Isaac','Diego','Mateo','Andre','Kofi','Yusuf','Samuel','Oliver','Harry','Marco','Luka'];
  lasts text[] := ARRAY['Smith','Brown','Walker','Hughes','Bennett','Fletcher','Doyle','Kane','Mensah','Ferrari','Novak','Okafor','Silva','Marsh','Whitfield','Ellis','Norton','Baptiste','Vargas','Holt'];
  positions text[] := ARRAY['Goalkeeper','Goalkeeper','Defender','Defender','Defender','Defender','Defender','Defender','Midfielder','Midfielder','Midfielder','Midfielder','Midfielder','Forward','Forward','Forward','Forward','Forward'];
  nats text[] := ARRAY['England','Scotland','Wales','Ireland','Ghana','Brazil','Spain','Portugal','France','Nigeria'];
  refs text[] := ARRAY['M. Oliver','A. Taylor','C. Pawson','S. Attwell','P. Tierney','J. Moss'];
  tid uuid; i int; j int; r int; n int := 10; rounds int; md int;
  arr uuid[]; tmp uuid; home uuid; away uuid; fid uuid;
  hs int; as_ int; k int; scorer uuid; assist uuid; base date := date '2026-02-07';
  played_cut int := 13;
BEGIN
  INSERT INTO public.competitions (name, season, start_date, end_date, description, location, num_teams, format, published)
  VALUES ('Premier Shield League','2026/27', base, base + 200, 'The flagship national league competition featuring ten of the finest clubs battling across a full round-robin season.','United Kingdom', 10, 'league', true)
  RETURNING id INTO comp;

  FOR i IN 1..n LOOP
    INSERT INTO public.teams (competition_id, name, short_name, crest_color, manager, stadium, city, founded_year, contact)
    VALUES (comp, team_names[i], shorts[i], colors[i], firsts[i] || ' ' || lasts[i+3], cities[i] || ' Park', cities[i], 1880 + i*4, lower(shorts[i]) || '@psl.example')
    RETURNING id INTO tid;
    arr := array_append(arr, tid);
    FOR j IN 1..18 LOOP
      INSERT INTO public.players (team_id, name, jersey_number, position, date_of_birth, nationality, status)
      VALUES (tid,
        firsts[1 + ((i*7 + j*3) % 20)] || ' ' || lasts[1 + ((i*5 + j*11) % 20)],
        j, positions[j],
        date '1994-01-01' + ((i*37 + j*53) % 3000),
        nats[1 + ((i+j) % 10)], 'Active');
    END LOOP;
  END LOOP;

  -- single round robin, circle method
  rounds := n - 1;
  FOR r IN 1..rounds LOOP
    FOR j IN 1..(n/2) LOOP
      home := arr[j];
      away := arr[n + 1 - j];
      IF (r % 2 = 0) THEN tmp := home; home := away; away := tmp; END IF;
      INSERT INTO public.fixtures (competition_id, matchday, home_team_id, away_team_id, kickoff, venue, referee, status)
      VALUES (comp, r, home, away,
        (base + (r-1)*7)::timestamptz + make_interval(hours => 12 + (j*2)),
        (SELECT stadium FROM public.teams WHERE id=home),
        refs[1 + ((r+j) % 6)],
        CASE WHEN r <= played_cut THEN 'Full Time' ELSE 'Scheduled' END)
      RETURNING id INTO fid;

      IF r <= played_cut THEN
        hs := (r*3 + j*5) % 4;
        as_ := (r*2 + j*7) % 3;
        FOR k IN 1..hs LOOP
          SELECT id INTO scorer FROM public.players WHERE team_id=home AND position IN ('Forward','Midfielder') ORDER BY ((r*13 + j*7 + k*29) % 100), id LIMIT 1 OFFSET ((r+j+k) % 9);
          SELECT id INTO assist FROM public.players WHERE team_id=home AND id <> scorer ORDER BY ((r*17 + k*11) % 100), id LIMIT 1 OFFSET ((r+k) % 12);
          INSERT INTO public.match_events (fixture_id, team_id, player_id, assist_player_id, minute, event_type, goal_type)
          VALUES (fid, home, scorer, assist, 5 + ((r*7 + k*23 + j*13) % 85), 'goal',
            CASE (k + r) % 5 WHEN 0 THEN 'Penalty' WHEN 1 THEN 'Header' WHEN 2 THEN 'Free Kick' ELSE 'Open Play' END);
        END LOOP;
        FOR k IN 1..as_ LOOP
          SELECT id INTO scorer FROM public.players WHERE team_id=away AND position IN ('Forward','Midfielder') ORDER BY ((r*19 + j*3 + k*31) % 100), id LIMIT 1 OFFSET ((r+j+k) % 9);
          SELECT id INTO assist FROM public.players WHERE team_id=away AND id <> scorer ORDER BY ((r*23 + k*7) % 100), id LIMIT 1 OFFSET ((r+k) % 12);
          INSERT INTO public.match_events (fixture_id, team_id, player_id, assist_player_id, minute, event_type, goal_type)
          VALUES (fid, away, scorer, assist, 5 + ((r*11 + k*17 + j*5) % 85), 'goal',
            CASE (k + j) % 5 WHEN 0 THEN 'Penalty' WHEN 1 THEN 'Header' ELSE 'Open Play' END);
        END LOOP;
        -- cards
        SELECT id INTO scorer FROM public.players WHERE team_id=home ORDER BY ((r*29 + j*13) % 100), id LIMIT 1;
        INSERT INTO public.match_events (fixture_id, team_id, player_id, minute, event_type)
        VALUES (fid, home, scorer, 20 + ((r*3+j) % 60), 'yellow_card');
        SELECT id INTO scorer FROM public.players WHERE team_id=away ORDER BY ((r*31 + j*17) % 100), id LIMIT 1;
        INSERT INTO public.match_events (fixture_id, team_id, player_id, minute, event_type)
        VALUES (fid, away, scorer, 20 + ((r*5+j) % 60), CASE WHEN (r+j) % 11 = 0 THEN 'red_card' ELSE 'yellow_card' END);
        UPDATE public.fixtures SET home_score=hs, away_score=as_ WHERE id=fid;
      END IF;
    END LOOP;
    -- rotate (keep first fixed)
    tmp := arr[n];
    FOR j IN REVERSE n..3 LOOP
      arr[j] := arr[j-1];
    END LOOP;
    arr[2] := tmp;
  END LOOP;
END $$;
