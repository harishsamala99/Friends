ALTER FUNCTION public.mr_icon_period_leaderboard(integer)
  RENAME TO mr_icon_period_leaderboard_v2;

REVOKE ALL ON FUNCTION public.mr_icon_period_leaderboard_v2(integer)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.mr_icon_period_leaderboard(p_edition integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  period_stats jsonb;
  standings jsonb;
BEGIN
  period_stats := public.mr_icon_period_leaderboard_v2(p_edition);

  SELECT coalesce(
    jsonb_agg(
      adjusted.player - 'assists' - 'appearances'
      ORDER BY adjusted.overall_score DESC,
        (adjusted.player->>'goals')::integer DESC,
        (adjusted.player->>'saves')::integer DESC,
        (adjusted.player->>'hattricks')::integer DESC,
        (adjusted.player->>'braces')::integer DESC,
        (adjusted.player->>'clean_sheets')::integer DESC,
        lower(adjusted.player->>'player_name'),
        adjusted.player->>'player_id'
    ),
    '[]'::jsonb
  )
  INTO standings
  FROM (
    SELECT
      entry - 'assists' - 'appearances' AS player,
      (
        (entry->>'overall_score')::integer
        - coalesce((entry->>'assists')::integer, 0) * 3
        - coalesce((entry->>'appearances')::integer, 0)
      ) AS overall_score
    FROM jsonb_array_elements(period_stats->'leaderboard') AS entries(entry)
  ) adjusted
  WHERE adjusted.overall_score > 0;

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(period_stats, '{leaderboard}', standings),
      '{formula_version}',
      '"mr-icon-v3"'::jsonb
    ),
    '{scoring_formula}',
    '{"goals":4,"hattricks":2,"braces":1,"saves":1,"clean_sheets":2}'::jsonb
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
    period_stats->>'formula_version',
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
    'formula_version', period_stats->>'formula_version',
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
      leaderboard = period_stats->'leaderboard',
      formula_version = period_stats->>'formula_version'
  WHERE id = p_award_id;
END;
$$;
