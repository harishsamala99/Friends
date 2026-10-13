CREATE TABLE public.mr_icon_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition integer NOT NULL UNIQUE CHECK (edition > 0),
  start_tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE RESTRICT,
  end_tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE RESTRICT,
  tournament_ids uuid[] NOT NULL,
  winning_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  winner_player_name text NOT NULL,
  winning_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  winner_team_name text NOT NULL,
  overall_score integer NOT NULL CHECK (overall_score >= 0),
  statistics jsonb NOT NULL,
  leaderboard jsonb NOT NULL,
  formula_version text NOT NULL,
  status text NOT NULL DEFAULT 'finalized' CHECK (status = 'finalized'),
  finalized_at timestamptz NOT NULL DEFAULT now(),
  finalized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.mr_icon_award_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id uuid NOT NULL REFERENCES public.mr_icon_awards(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('corrected', 'recalculated')),
  reason text NOT NULL,
  previous_snapshot jsonb NOT NULL,
  new_snapshot jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.mr_icon_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mr_icon_award_audit ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.mr_icon_awards TO anon, authenticated;
GRANT SELECT ON public.mr_icon_award_audit TO anon, authenticated;

CREATE POLICY "public read finalized mr icon awards"
  ON public.mr_icon_awards FOR SELECT TO anon, authenticated
  USING (status = 'finalized');

CREATE POLICY "public read mr icon award audit"
  ON public.mr_icon_award_audit FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.mr_icon_period_leaderboard(p_edition integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  period_ids uuid[];
  period_start uuid;
  period_end uuid;
  period_count integer;
  standings jsonb;
BEGIN
  IF p_edition IS NULL OR p_edition < 1 THEN
    RAISE EXCEPTION 'Award edition must be a positive integer';
  END IF;

  WITH numbered AS (
    SELECT
      t.id,
      row_number() OVER (ORDER BY t.created_at, t.id) AS tournament_number
    FROM public.tournaments t
  )
  SELECT
    array_agg(n.id ORDER BY n.tournament_number),
    count(*)::integer
  INTO period_ids, period_count
  FROM numbered n
  WHERE n.tournament_number BETWEEN ((p_edition - 1) * 10 + 1) AND (p_edition * 10);

  IF period_count > 0 THEN
    period_start := period_ids[1];
    period_end := period_ids[array_length(period_ids, 1)];
  END IF;

  WITH numbered AS (
    SELECT
      t.id,
      row_number() OVER (ORDER BY t.created_at, t.id) AS tournament_number
    FROM public.tournaments t
  ),
  period AS (
    SELECT n.id
    FROM numbered n
    WHERE n.tournament_number BETWEEN ((p_edition - 1) * 10 + 1) AND (p_edition * 10)
  ),
  completed_fixtures AS (
    SELECT f.*
    FROM public.fixtures f
    JOIN period p ON p.id = f.tournament_id
    WHERE f.status = 'Full Time'
      AND f.home_score IS NOT NULL
      AND f.away_score IS NOT NULL
  ),
  goal_events AS (
    SELECT e.fixture_id, e.player_id, e.team_id, e.assist_player_id
    FROM public.match_events e
    JOIN completed_fixtures f ON f.id = e.fixture_id
    WHERE e.event_type = 'goal'
      AND e.player_id IS NOT NULL
      AND e.team_id IN (f.home_team_id, f.away_team_id)
      AND lower(coalesce(e.goal_type, '')) <> 'own goal'
  ),
  player_fixture_goals AS (
    SELECT ge.fixture_id, ge.player_id, ge.team_id, count(*)::integer AS goals
    FROM goal_events ge
    GROUP BY ge.fixture_id, ge.player_id, ge.team_id
  ),
  goal_totals AS (
    SELECT
      g.player_id,
      sum(g.goals)::integer AS goals,
      count(*) FILTER (WHERE g.goals >= 3)::integer AS hattricks,
      count(*) FILTER (WHERE g.goals = 2)::integer AS braces
    FROM player_fixture_goals g
    GROUP BY g.player_id
  ),
  assist_totals AS (
    SELECT ge.assist_player_id AS player_id, count(*)::integer AS assists
    FROM goal_events ge
    WHERE ge.assist_player_id IS NOT NULL
      AND ge.assist_player_id <> ge.player_id
    GROUP BY ge.assist_player_id
  ),
  save_totals AS (
    SELECT e.player_id, count(*)::integer AS saves
    FROM public.match_events e
    JOIN completed_fixtures f ON f.id = e.fixture_id
    WHERE e.event_type = 'save'
      AND e.player_id IS NOT NULL
      AND e.team_id IN (f.home_team_id, f.away_team_id)
    GROUP BY e.player_id
  ),
  appearance_totals AS (
    SELECT a.player_id, count(DISTINCT a.fixture_id)::integer AS appearances
    FROM public.fixture_player_appearances a
    JOIN completed_fixtures f ON f.id = a.fixture_id
    WHERE a.team_id IN (f.home_team_id, f.away_team_id)
    GROUP BY a.player_id
  ),
  goalkeeper_clean_sheets AS (
    SELECT a.player_id, count(DISTINCT a.fixture_id)::integer AS clean_sheets
    FROM public.fixture_player_appearances a
    JOIN completed_fixtures f ON f.id = a.fixture_id
    JOIN public.players player ON player.id = a.player_id
    WHERE a.team_id IN (f.home_team_id, f.away_team_id)
      AND lower(coalesce(player.position, '')) IN ('gk', 'goalkeeper')
      AND (
        (a.team_id = f.home_team_id AND f.away_score = 0) OR
        (a.team_id = f.away_team_id AND f.home_score = 0)
      )
    GROUP BY a.player_id
  ),
  eligible_players AS (
    SELECT player_id FROM goal_totals
    UNION
    SELECT player_id FROM assist_totals
    UNION
    SELECT player_id FROM save_totals
    UNION
    SELECT player_id FROM appearance_totals
    UNION
    SELECT player_id FROM goalkeeper_clean_sheets
  ),
  player_team_stats AS (
    SELECT
      activity.player_id,
      activity.team_id,
      sum(activity.appearances)::integer AS appearances,
      sum(activity.goals)::integer AS goals,
      sum(activity.assists)::integer AS assists,
      sum(activity.saves)::integer AS saves
    FROM (
      SELECT a.player_id, a.team_id, count(DISTINCT a.fixture_id)::integer AS appearances,
        0::integer AS goals, 0::integer AS assists, 0::integer AS saves
      FROM public.fixture_player_appearances a
      JOIN completed_fixtures f ON f.id = a.fixture_id
      WHERE a.team_id IN (f.home_team_id, f.away_team_id)
      GROUP BY a.player_id, a.team_id
      UNION ALL
      SELECT g.player_id, g.team_id, 0::integer, sum(g.goals)::integer, 0::integer, 0::integer
      FROM player_fixture_goals g
      GROUP BY g.player_id, g.team_id
      UNION ALL
      SELECT ge.assist_player_id, ge.team_id, 0::integer, 0::integer, count(*)::integer, 0::integer
      FROM goal_events ge
      WHERE ge.assist_player_id IS NOT NULL
        AND ge.assist_player_id <> ge.player_id
      GROUP BY ge.assist_player_id, ge.team_id
      UNION ALL
      SELECT e.player_id, e.team_id, 0::integer, 0::integer, 0::integer, count(*)::integer
      FROM public.match_events e
      JOIN completed_fixtures f ON f.id = e.fixture_id
      WHERE e.event_type = 'save'
        AND e.player_id IS NOT NULL
        AND e.team_id IN (f.home_team_id, f.away_team_id)
      GROUP BY e.player_id, e.team_id
    ) activity
    GROUP BY activity.player_id, activity.team_id
  ),
  preferred_teams AS (
    SELECT
      pt.player_id,
      pt.team_id,
      row_number() OVER (
        PARTITION BY pt.player_id
        ORDER BY pt.appearances DESC, pt.goals DESC, pt.assists DESC, pt.saves DESC,
          lower(team.name), team.id
      ) AS team_rank
    FROM player_team_stats pt
    JOIN public.teams team ON team.id = pt.team_id
  ),
  player_rows AS (
    SELECT
      player.id AS player_id,
      player.name AS player_name,
      team.id AS team_id,
      team.name AS team_name,
      coalesce(gt.goals, 0)::integer AS goals,
      coalesce(at.assists, 0)::integer AS assists,
      coalesce(st.saves, 0)::integer AS saves,
      coalesce(gt.hattricks, 0)::integer AS hattricks,
      coalesce(gt.braces, 0)::integer AS braces,
      coalesce(ap.appearances, 0)::integer AS appearances,
      coalesce(gcs.clean_sheets, 0)::integer AS clean_sheets,
      (
        coalesce(gt.goals, 0) * 4 +
        coalesce(at.assists, 0) * 3 +
        coalesce(st.saves, 0) +
        coalesce(gt.hattricks, 0) * 2 +
        coalesce(gt.braces, 0) +
        coalesce(ap.appearances, 0) +
        coalesce(gcs.clean_sheets, 0) * 2
      )::integer AS overall_score
    FROM eligible_players eligible
    JOIN public.players player ON player.id = eligible.player_id
    LEFT JOIN goal_totals gt ON gt.player_id = player.id
    LEFT JOIN assist_totals at ON at.player_id = player.id
    LEFT JOIN save_totals st ON st.player_id = player.id
    LEFT JOIN appearance_totals ap ON ap.player_id = player.id
    LEFT JOIN goalkeeper_clean_sheets gcs ON gcs.player_id = player.id
    LEFT JOIN preferred_teams preferred
      ON preferred.player_id = player.id AND preferred.team_rank = 1
    LEFT JOIN public.teams team ON team.id = preferred.team_id
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', player_row.player_id,
        'player_name', player_row.player_name,
        'team_id', player_row.team_id,
        'team_name', player_row.team_name,
        'overall_score', player_row.overall_score,
        'goals', player_row.goals,
        'assists', player_row.assists,
        'saves', player_row.saves,
        'hattricks', player_row.hattricks,
        'braces', player_row.braces,
        'appearances', player_row.appearances,
        'clean_sheets', player_row.clean_sheets
      )
      ORDER BY player_row.overall_score DESC, player_row.goals DESC, player_row.assists DESC,
        player_row.saves DESC, player_row.hattricks DESC, player_row.braces DESC,
        player_row.appearances DESC, player_row.clean_sheets DESC,
        lower(player_row.player_name), player_row.player_id
    ),
    '[]'::jsonb
  )
  INTO standings
  FROM player_rows player_row;

  RETURN jsonb_build_object(
    'edition', p_edition,
    'start_tournament_id', period_start,
    'end_tournament_id', period_end,
    'tournament_ids', to_jsonb(coalesce(period_ids, ARRAY[]::uuid[])),
    'tournament_count', coalesce(period_count, 0),
    'formula_version', 'mr-icon-v2',
    'scoring_formula', jsonb_build_object(
      'goals', 4, 'assists', 3, 'hattricks', 2, 'braces', 1,
      'appearances', 1, 'clean_sheets', 2, 'saves', 1
    ),
    'leaderboard', standings
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_mr_icon_award(p_edition integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  period_stats jsonb;
  winner jsonb;
  new_award_id uuid;
  period_tournament_ids uuid[];
  tournament_id uuid;
  fixture_count integer;
BEGIN
  IF p_edition IS NULL OR p_edition < 1 THEN
    RAISE EXCEPTION 'Award edition must be a positive integer';
  END IF;
  IF p_edition > 1 AND NOT EXISTS (
    SELECT 1 FROM public.mr_icon_awards previous_award
    WHERE previous_award.edition = p_edition - 1
  ) THEN
    RAISE EXCEPTION 'MR. ICON editions must be finalized in chronological order';
  END IF;

  SELECT coalesce(array_agg(t.id ORDER BY t.created_at, t.id), ARRAY[]::uuid[])
  INTO period_tournament_ids
  FROM (
    SELECT numbered.id, numbered.created_at
    FROM (
      SELECT id, created_at, row_number() OVER (ORDER BY created_at, id) AS tournament_number
      FROM public.tournaments
    ) numbered
    WHERE numbered.tournament_number BETWEEN ((p_edition - 1) * 10 + 1) AND (p_edition * 10)
  ) t;

  IF coalesce(array_length(period_tournament_ids, 1), 0) <> 10 THEN
    RAISE EXCEPTION 'MR. ICON edition % requires 10 consecutive tournaments', p_edition;
  END IF;
  IF EXISTS (SELECT 1 FROM public.mr_icon_awards award WHERE award.edition = p_edition) THEN
    RAISE EXCEPTION 'MR. ICON edition % has already been finalized', p_edition;
  END IF;

  FOREACH tournament_id IN ARRAY period_tournament_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.status = 'completed'
    ) THEN
      RAISE EXCEPTION 'Every tournament in MR. ICON edition % must be completed', p_edition;
    END IF;
    SELECT count(*)::integer INTO fixture_count
    FROM public.fixtures f WHERE f.tournament_id = tournament_id;
    IF fixture_count = 0 OR EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.tournament_id = tournament_id
        AND (f.status IS DISTINCT FROM 'Full Time' OR f.home_score IS NULL OR f.away_score IS NULL)
    ) THEN
      RAISE EXCEPTION 'Every tournament in MR. ICON edition % must have all fixtures completed', p_edition;
    END IF;
  END LOOP;

  period_stats := public.mr_icon_period_leaderboard(p_edition);
  winner := period_stats->'leaderboard'->0;
  IF winner IS NULL OR winner->>'overall_score' IS NULL THEN
    RAISE EXCEPTION 'No eligible player records exist for MR. ICON edition %', p_edition;
  END IF;

  INSERT INTO public.mr_icon_awards (
    edition,
    start_tournament_id,
    end_tournament_id,
    tournament_ids,
    winning_player_id,
    winner_player_name,
    winning_team_id,
    winner_team_name,
    overall_score,
    statistics,
    leaderboard,
    formula_version,
    status,
    finalized_by
  )
  VALUES (
    p_edition,
    period_stats->>'start_tournament_id',
    period_stats->>'end_tournament_id',
    period_tournament_ids,
    (winner->>'player_id')::uuid,
    winner->>'player_name',
    nullif(winner->>'team_id', '')::uuid,
    coalesce(winner->>'team_name', 'Team not recorded'),
    (winner->>'overall_score')::integer,
    winner,
    period_stats->'leaderboard',
    'mr-icon-v2',
    'finalized',
    auth.uid()
  )
  RETURNING id INTO new_award_id;

  RETURN new_award_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.correct_mr_icon_award(
  p_award_id uuid,
  p_winning_player_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  award_row public.mr_icon_awards%ROWTYPE;
  period_stats jsonb;
  winner jsonb;
  old_snapshot jsonb;
  new_snapshot jsonb;
BEGIN
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A correction reason is required';
  END IF;

  SELECT * INTO award_row FROM public.mr_icon_awards WHERE id = p_award_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MR. ICON award was not found';
  END IF;

  period_stats := public.mr_icon_period_leaderboard(award_row.edition);
  SELECT value INTO winner
  FROM jsonb_array_elements(period_stats->'leaderboard') AS ranked(value)
  WHERE ranked.value->>'player_id' = p_winning_player_id::text
  LIMIT 1;
  IF winner IS NULL THEN
    RAISE EXCEPTION 'The selected player has no eligible statistics in this award period';
  END IF;

  old_snapshot := jsonb_build_object(
    'winning_player_id', award_row.winning_player_id,
    'winner_player_name', award_row.winner_player_name,
    'winning_team_id', award_row.winning_team_id,
    'winner_team_name', award_row.winner_team_name,
    'overall_score', award_row.overall_score,
    'statistics', award_row.statistics,
    'leaderboard', award_row.leaderboard,
    'formula_version', award_row.formula_version,
    'finalized_at', award_row.finalized_at,
    'finalized_by', award_row.finalized_by
  );
  new_snapshot := jsonb_build_object(
    'winning_player_id', p_winning_player_id,
    'winner_player_name', winner->>'player_name',
    'winning_team_id', nullif(winner->>'team_id', '')::uuid,
    'winner_team_name', coalesce(winner->>'team_name', 'Team not recorded'),
    'overall_score', (winner->>'overall_score')::integer,
    'statistics', winner,
    'leaderboard', period_stats->'leaderboard',
    'formula_version', award_row.formula_version,
    'finalized_at', award_row.finalized_at,
    'finalized_by', award_row.finalized_by
  );

  INSERT INTO public.mr_icon_award_audit (
    award_id, action, reason, previous_snapshot, new_snapshot, changed_by
  )
  VALUES (p_award_id, 'corrected', btrim(p_reason), old_snapshot, new_snapshot, auth.uid());

  UPDATE public.mr_icon_awards
  SET winning_player_id = p_winning_player_id,
      winner_player_name = winner->>'player_name',
      winning_team_id = nullif(winner->>'team_id', '')::uuid,
      winner_team_name = coalesce(winner->>'team_name', 'Team not recorded'),
      overall_score = (winner->>'overall_score')::integer,
      statistics = winner,
      leaderboard = period_stats->'leaderboard'
  WHERE id = p_award_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_mr_icon_award(p_award_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  award_row public.mr_icon_awards%ROWTYPE;
  period_stats jsonb;
  winner jsonb;
  old_snapshot jsonb;
  new_snapshot jsonb;
BEGIN
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A recalculation reason is required';
  END IF;

  SELECT * INTO award_row FROM public.mr_icon_awards WHERE id = p_award_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MR. ICON award was not found';
  END IF;

  period_stats := public.mr_icon_period_leaderboard(award_row.edition);
  winner := period_stats->'leaderboard'->0;
  IF winner IS NULL THEN
    RAISE EXCEPTION 'No eligible player records exist for this award period';
  END IF;

  old_snapshot := jsonb_build_object(
    'winning_player_id', award_row.winning_player_id,
    'winner_player_name', award_row.winner_player_name,
    'winning_team_id', award_row.winning_team_id,
    'winner_team_name', award_row.winner_team_name,
    'overall_score', award_row.overall_score,
    'statistics', award_row.statistics,
    'leaderboard', award_row.leaderboard,
    'formula_version', award_row.formula_version,
    'finalized_at', award_row.finalized_at,
    'finalized_by', award_row.finalized_by
  );
  new_snapshot := jsonb_build_object(
    'winning_player_id', (winner->>'player_id')::uuid,
    'winner_player_name', winner->>'player_name',
    'winning_team_id', nullif(winner->>'team_id', '')::uuid,
    'winner_team_name', coalesce(winner->>'team_name', 'Team not recorded'),
    'overall_score', (winner->>'overall_score')::integer,
    'statistics', winner,
    'leaderboard', period_stats->'leaderboard',
    'formula_version', coalesce(period_stats->>'formula_version', award_row.formula_version),
    'finalized_at', award_row.finalized_at,
    'finalized_by', award_row.finalized_by
  );

  INSERT INTO public.mr_icon_award_audit (
    award_id, action, reason, previous_snapshot, new_snapshot, changed_by
  )
  VALUES (p_award_id, 'recalculated', btrim(p_reason), old_snapshot, new_snapshot, auth.uid());

  UPDATE public.mr_icon_awards
  SET winning_player_id = (winner->>'player_id')::uuid,
      winner_player_name = winner->>'player_name',
      winning_team_id = nullif(winner->>'team_id', '')::uuid,
      winner_team_name = coalesce(winner->>'team_name', 'Team not recorded'),
      overall_score = (winner->>'overall_score')::integer,
      statistics = winner,
      leaderboard = period_stats->'leaderboard',
      formula_version = coalesce(period_stats->>'formula_version', award_row.formula_version)
  WHERE id = p_award_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_mr_icon_tournament_reordering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND EXISTS (SELECT 1 FROM public.mr_icon_awards) THEN
    RAISE EXCEPTION 'A tournament cannot be deleted after an MR. ICON award has been finalized';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.created_at IS DISTINCT FROM NEW.created_at AND EXISTS (
    SELECT 1 FROM public.mr_icon_awards
  ) THEN
    RAISE EXCEPTION 'Tournament order cannot change after an MR. ICON award has been finalized';
  END IF;

  IF TG_OP = 'INSERT'
    AND EXISTS (SELECT 1 FROM public.mr_icon_awards)
    AND EXISTS (
    SELECT 1 FROM public.tournaments tournament
    WHERE (NEW.created_at, NEW.id) <= (tournament.created_at, tournament.id)
  ) THEN
    RAISE EXCEPTION 'A new tournament cannot be inserted before an existing tournament';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tournaments_prevent_mr_icon_period_reordering
BEFORE INSERT OR UPDATE OF created_at OR DELETE ON public.tournaments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_mr_icon_tournament_reordering();

REVOKE ALL ON FUNCTION public.mr_icon_period_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mr_icon_period_leaderboard(integer) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_mr_icon_award(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_mr_icon_award(integer) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.correct_mr_icon_award(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_mr_icon_award(uuid, uuid, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_mr_icon_award(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_mr_icon_award(uuid, text) TO anon, authenticated;
