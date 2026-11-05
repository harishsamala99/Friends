ALTER TABLE public.tournaments
ADD COLUMN winner_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
ADD COLUMN winner_player_ids uuid[];

UPDATE public.tournaments AS tournament
SET
  winner_team_id = team.id,
  winner_player_ids = COALESCE(
    (
      SELECT array_agg(player.id ORDER BY player.id)
      FROM public.players AS player
      WHERE player.team_id = team.id
        AND player.status = 'Active'
    ),
    ARRAY[]::uuid[]
  )
FROM public.teams AS team
WHERE tournament.status = 'completed'
  AND tournament.winner = team.name
  AND team.name IN (tournament.home_team, tournament.away_team);
