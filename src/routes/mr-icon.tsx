import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Award, Crown, Medal, Search, Shield, Trophy } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/football-ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchAllFixturePlayerRatings,
  fetchFixtures,
  fetchMrIconMatchRatings,
  fetchPlayers,
  fetchTeams,
  fetchTournaments,
  type MrIconMatchRating,
} from "@/lib/football";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/mr-icon")({
  head: () => ({
    meta: [
      { title: "MR. ICON — FRIENDS LEAGUE" },
      {
        name: "description",
        content: "The live Friends League best-player leaderboard, calculated from match records.",
      },
    ],
  }),
  component: MrIconPage,
});

type RankedPlayer = Pick<
  MrIconMatchRating,
  | "player_id"
  | "player_name"
  | "position"
  | "photo_url"
  | "team_id"
  | "team_name"
  | "goals"
  | "saves"
  | "hattricks"
  | "braces"
  | "clean_sheets"
  | "goals_points"
  | "saves_points"
  | "hattricks_points"
  | "braces_points"
  | "clean_sheets_points"
  | "overall_score"
  | "kickoff"
>;

function MrIconPage() {
  const [tournamentId, setTournamentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [position, setPosition] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const ratings = useQuery({
    queryKey: ["mr-icon-match-ratings"],
    queryFn: () => fetchMrIconMatchRatings(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const playerRatings = useQuery({
    queryKey: ["fixture-player-ratings"],
    queryFn: fetchAllFixturePlayerRatings,
    refetchOnMount: "always",
  });
  const playersQuery = useQuery({ queryKey: ["players"], queryFn: () => fetchPlayers() });
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const fixtures = useQuery({ queryKey: ["fixtures"], queryFn: () => fetchFixtures() });

  const allRows = useMemo(() => ratings.data ?? [], [ratings.data]);
  const teams = useMemo<[string, string][]>(
    () =>
      [
        ...new Map(
          allRows.map((row) => [row.team_id, row.team_name] as [string, string]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [allRows],
  );
  const positions = useMemo(
    () => [...new Set(allRows.map((row) => row.position))].sort((a, b) => a.localeCompare(b)),
    [allRows],
  );
  const playerStatistics = useMemo(() => {
    const grouped = new Map<
      string,
      {
        player_id: string;
        player_name: string;
        position: string;
        team_id: string;
        team_name: string;
        goals: number;
        saves: number;
        clean_sheets: number;
        matches: Set<string>;
        kickoff: string;
      }
    >();
    for (const row of allRows) {
      const key = row.player_id;
      const existing = grouped.get(key);
      if (existing) {
        existing.goals += row.goals;
        existing.saves += row.saves;
        existing.clean_sheets += row.clean_sheets;
        existing.matches.add(row.fixture_id);
        if (row.kickoff > existing.kickoff) {
          existing.kickoff = row.kickoff;
          existing.team_id = row.team_id;
          existing.team_name = row.team_name;
          existing.position = row.position;
          existing.player_name = row.player_name;
        }
      } else {
        grouped.set(key, {
          player_id: row.player_id,
          player_name: row.player_name,
          position: row.position,
          team_id: row.team_id,
          team_name: row.team_name,
          goals: row.goals,
          saves: row.saves,
          clean_sheets: row.clean_sheets,
          matches: new Set([row.fixture_id]),
          kickoff: row.kickoff,
        });
      }
    }
    return [...grouped.values()].map(({ matches, ...player }) => ({
      ...player,
      matches: matches.size,
    }));
  }, [allRows]);
  const topScorers = useMemo(
    () =>
      playerStatistics
        .filter((player) => player.goals > 0)
        .sort(
          (a, b) =>
            b.goals - a.goals ||
            a.player_name.localeCompare(b.player_name),
        )
        .slice(0, 10),
    [playerStatistics],
  );
  const topGoalkeepers = useMemo(
    () =>
      playerStatistics
        .filter(
          (player) =>
            (player.position.trim().toLowerCase() === "gk" ||
              player.position.trim().toLowerCase().includes("goalkeeper")) &&
            player.saves > 0,
        )
        .sort(
          (a, b) =>
            b.saves - a.saves ||
            b.clean_sheets - a.clean_sheets ||
            a.player_name.localeCompare(b.player_name),
        )
        .slice(0, 10),
    [playerStatistics],
  );
  const completedTournamentFixtureIds = useMemo(
    () =>
      new Set(
        (fixtures.data ?? [])
          .filter(
            (fixture) =>
              fixture.tournament_id !== null &&
              fixture.status === "Full Time" &&
              fixture.home_score != null &&
              fixture.away_score != null,
          )
          .map((fixture) => fixture.id),
      ),
    [fixtures.data],
  );
  const ratingTotalsByPlayer = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>();
    for (const rating of playerRatings.data ?? []) {
      if (!completedTournamentFixtureIds.has(rating.fixture_id)) continue;
      const current = totals.get(rating.player_id) ?? { total: 0, count: 0 };
      current.total += rating.rating;
      current.count += 1;
      totals.set(rating.player_id, current);
    }
    return totals;
  }, [completedTournamentFixtureIds, playerRatings.data]);
  const topDefenders = useMemo(() => {
    const playersById = new Map(
      (playersQuery.data ?? []).map((player) => [player.id, player] as const),
    );
    const teamsById = new Map((teamsQuery.data ?? []).map((team) => [team.id, team.name] as const));
    return [...ratingTotalsByPlayer.entries()]
      .flatMap(([playerId, ratingPoints]) => {
        const player = playersById.get(playerId);
        const normalizedPosition = player?.position.trim().toLowerCase() ?? "";
        if (
          !player ||
          !(normalizedPosition.includes("defender") || normalizedPosition.includes("back"))
        ) {
          return [];
        }
        return [
          {
            id: player.id,
            name: player.name,
            team: player.team_id ? (teamsById.get(player.team_id) ?? "—") : "—",
            totalRatingPoints: ratingPoints.total,
            averageRating: ratingPoints.total / ratingPoints.count,
          },
        ];
      })
      .sort(
        (a, b) =>
          b.totalRatingPoints - a.totalRatingPoints ||
          b.averageRating - a.averageRating ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 10);
  }, [ratingTotalsByPlayer, playersQuery.data, teamsQuery.data]);
  const goalkeeperRatings = useMemo(() => {
    const totals = new Map<string, { total: number; matches: number }>();
    for (const row of allRows) {
      const position = row.position.trim().toLowerCase();
      if (position !== "gk" && !position.includes("goalkeeper")) continue;

      const matchRating = Math.min(10, 6 + row.saves * 0.25 + (row.clean_sheets > 0 ? 2 : 0));
      const current = totals.get(row.player_id) ?? { total: 0, matches: 0 };
      current.total += matchRating;
      current.matches += 1;
      totals.set(row.player_id, current);
    }
    return new Map(
      [...totals].map(([playerId, rating]) => [playerId, rating.total / rating.matches] as const),
    );
  }, [allRows]);

  const leaderboard = useMemo(() => {
    const grouped = new Map<string, RankedPlayer>();
    const nameFilter = playerName.trim().toLocaleLowerCase();
    for (const row of allRows) {
      if (tournamentId === "__unassigned__" && row.tournament_id !== null) continue;
      if (tournamentId && tournamentId !== "__unassigned__" && row.tournament_id !== tournamentId)
        continue;
      if (teamId && row.team_id !== teamId) continue;
      if (position && row.position !== position) continue;
      if (nameFilter && !row.player_name.toLocaleLowerCase().includes(nameFilter)) continue;
      const matchDate = row.kickoff.slice(0, 10);
      if (periodStart && matchDate < periodStart) continue;
      if (periodEnd && matchDate > periodEnd) continue;

      const existing = grouped.get(row.player_id);
      if (existing) {
        existing.goals += row.goals;
        existing.saves += row.saves;
        existing.hattricks += row.hattricks;
        existing.braces += row.braces;
        existing.clean_sheets += row.clean_sheets;
        existing.goals_points += row.goals_points;
        existing.saves_points += row.saves_points;
        existing.hattricks_points += row.hattricks_points;
        existing.braces_points += row.braces_points;
        existing.clean_sheets_points += row.clean_sheets_points;
        existing.overall_score += row.overall_score;
        if (row.kickoff > existing.kickoff) {
          existing.team_id = row.team_id;
          existing.team_name = row.team_name;
          existing.kickoff = row.kickoff;
        }
      } else {
        grouped.set(row.player_id, {
          player_id: row.player_id,
          player_name: row.player_name,
          position: row.position,
          photo_url: row.photo_url,
          team_id: row.team_id,
          team_name: row.team_name,
          goals: row.goals,
          saves: row.saves,
          hattricks: row.hattricks,
          braces: row.braces,
          clean_sheets: row.clean_sheets,
          goals_points: row.goals_points,
          saves_points: row.saves_points,
          hattricks_points: row.hattricks_points,
          braces_points: row.braces_points,
          clean_sheets_points: row.clean_sheets_points,
          overall_score: row.overall_score,
          kickoff: row.kickoff,
        });
      }
    }
    return [...grouped.values()].sort(
      (a, b) => b.overall_score - a.overall_score || a.player_name.localeCompare(b.player_name),
    );
  }, [allRows, tournamentId, teamId, position, playerName, periodStart, periodEnd]);

  const leaderScore = leaderboard[0]?.overall_score;
  const topTenLeaderboard = leaderboard.slice(0, 10);
  const coLeaders =
    leaderScore === undefined
      ? []
      : leaderboard.filter((player) => player.overall_score === leaderScore);
  const queryError =
    ratings.error ??
    tournaments.error ??
    playerRatings.error ??
    playersQuery.error ??
    teamsQuery.error ??
    fixtures.error;
  const isLoading =
    ratings.isLoading ||
    tournaments.isLoading ||
    playerRatings.isLoading ||
    playersQuery.isLoading ||
    teamsQuery.isLoading ||
    fixtures.isLoading;
  const rankFor = (index: number) => {
    let rank = index + 1;
    while (rank > 1 && leaderboard[index]?.overall_score === leaderboard[rank - 2]?.overall_score) {
      rank -= 1;
    }
    return rank;
  };
  const scorerRankFor = (index: number) => {
    let rank = index + 1;
    while (rank > 1 && topScorers[index]?.goals === topScorers[rank - 2]?.goals) rank -= 1;
    return rank;
  };

  return (
    <SiteLayout>
      <PageHeader
        title="MR. ICON — PLAYER STATISTICS"
        subtitle="Top goal scorers, goalkeepers, and defender ratings, alongside the player leaderboard."
      />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10">
        {isLoading ? (
          <ListSkeleton rows={8} />
        ) : queryError ? (
          <EmptyState message="The MR. ICON leaderboard could not be loaded. Confirm the latest Supabase migration is applied, then refresh." />
        ) : (
          <>
            <Card className="overflow-hidden border-amber-400/40 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.18),transparent_42%),linear-gradient(135deg,#111827,#1e293b_55%,#111827)] text-white shadow-xl">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-6 flex items-center gap-3 text-amber-200">
                  <Crown className="size-6" />
                  <p className="text-xs font-bold uppercase tracking-[0.24em]">Current MR. ICON</p>
                </div>
                {coLeaders.length === 0 ? (
                  <p className="text-sm text-slate-300">
                    No finalized match statistics are recorded for this selection yet.
                  </p>
                ) : (
                  <>
                    <p className="mb-4 text-sm font-semibold text-amber-100">
                      {coLeaders.length > 1
                        ? `Tied for first · ${coLeaders.length} players`
                        : "Tournament leader"}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {coLeaders.map((player) => (
                        <Link
                          key={player.player_id}
                          to="/players/$playerId"
                          params={{ playerId: player.player_id }}
                          className="rounded-2xl border border-white/15 bg-white/5 p-4 transition hover:bg-white/10"
                        >
                          <div className="flex items-center gap-4">
                            <Avatar className="size-16 border border-amber-200/40">
                              <AvatarImage
                                src={player.photo_url ?? undefined}
                                alt={player.player_name}
                              />
                              <AvatarFallback>
                                {player.player_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <h2 className="truncate font-display text-xl font-bold">
                                {player.player_name}
                              </h2>
                              <p className="mt-1 text-sm text-slate-300">
                                {player.position} · {player.team_name}
                              </p>
                            </div>
                            <Trophy className="size-5 shrink-0 text-amber-300" />
                          </div>
                          <p className="mt-4 font-display text-3xl font-bold tabular-nums text-amber-200">
                            {formatScore(player.overall_score)}
                            <span className="ml-2 text-sm font-medium text-slate-300">points</span>
                          </p>
                          <p className="mt-2 text-xs text-slate-300">
                            Goals {player.goals_points} · Saves {formatScore(player.saves_points)} ·
                            Hat-tricks {player.hattricks_points} · Braces {player.braces_points} ·
                            Clean sheets {player.clean_sheets_points}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <section className="space-y-3" aria-labelledby="mr-icon-top-scorers">
              <div className="flex items-center gap-2">
                <Award className="size-5 text-primary" />
                <h2 id="mr-icon-top-scorers" className="font-display text-xl font-bold">
                  Top Goal Scorers
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">Ranked across finalized matches.</p>
              {topScorers.length === 0 ? (
                <EmptyState message="No goal-scorer statistics are available yet." />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="p-3 text-left">Rank</th>
                        <th className="p-3 text-left">Player</th>
                        <th className="p-3 text-left">Team</th>
                        <th className="p-3 text-center">Goals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topScorers.map((player, index) => (
                        <tr
                          key={player.player_id}
                          className={`border-t border-border/50 ${
                            scorerRankFor(index) === 1 ? "mr-icon-first-place-row" : ""
                          }`}
                        >
                          <td className="p-3 font-semibold">{scorerRankFor(index)}</td>
                          <td className="p-3">
                            <Link
                              to="/players/$playerId"
                              params={{ playerId: player.player_id }}
                              className="font-semibold hover:text-primary hover:underline"
                            >
                              {player.player_name}
                            </Link>
                          </td>
                          <td className="p-3 text-muted-foreground">{player.team_name}</td>
                          <td className="p-3 text-center tabular-nums">{player.goals}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-3" aria-labelledby="mr-icon-top-saves">
              <div className="flex items-center gap-2">
                <Medal className="size-5 text-primary" />
                <h2 id="mr-icon-top-saves" className="font-display text-xl font-bold">
                  Top Saves
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Ranked by recorded saves. Match rating = 6.0 base + 0.25 per save + 2.0 for a clean
                sheet, capped at 10; the displayed value is the average across recorded matches.
              </p>
              {topGoalkeepers.length === 0 ? (
                <EmptyState message="No goalkeeper save statistics are available yet." />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="p-3 text-left">Rank</th>
                        <th className="p-3 text-left">Goalkeeper</th>
                        <th className="p-3 text-left">Team</th>
                        <th className="p-3 text-center">Total saves</th>
                        <th className="p-3 text-center">Clean sheets</th>
                        <th className="p-3 text-center">Average match rating / 10</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topGoalkeepers.map((player, index) => (
                        <tr
                          key={player.player_id}
                          className={`border-t border-border/50 ${
                            index === 0 ? "mr-icon-first-place-row" : ""
                          }`}
                        >
                          <td className="p-3 font-semibold">{index + 1}</td>
                          <td className="p-3">
                            <Link
                              to="/players/$playerId"
                              params={{ playerId: player.player_id }}
                              className="font-semibold hover:text-primary hover:underline"
                            >
                              {player.player_name}
                            </Link>
                          </td>
                          <td className="p-3 text-muted-foreground">{player.team_name}</td>
                          <td className="p-3 text-center tabular-nums">{player.saves}</td>
                          <td className="p-3 text-center tabular-nums">{player.clean_sheets}</td>
                          <td className="p-3 text-center tabular-nums">
                            {goalkeeperRatings.get(player.player_id) !== undefined
                              ? `${goalkeeperRatings.get(player.player_id)?.toFixed(1)} / 10`
                              : "Not rated"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-3" aria-labelledby="mr-icon-defender-ratings">
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                <h2 id="mr-icon-defender-ratings" className="font-display text-xl font-bold">
                  Defender Ratings
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Total rating points from completed tournaments and average match rating, out of 10.
              </p>
              {topDefenders.length === 0 ? (
                <EmptyState message="No defender match ratings are available yet." />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="p-3 text-left">Rank</th>
                        <th className="p-3 text-left">Defender</th>
                        <th className="p-3 text-left">Team</th>
                        <th className="p-3 text-right">Overall rating points</th>
                        <th className="p-3 text-right">Overall rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topDefenders.map((defender, index) => (
                        <tr
                          key={defender.id}
                          className={`border-t border-border/50 ${
                            index === 0 ? "mr-icon-first-place-row" : ""
                          }`}
                        >
                          <td className="p-3 font-semibold">{index + 1}</td>
                          <td className="p-3">
                            <Link
                              to="/players/$playerId"
                              params={{ playerId: defender.id }}
                              className="font-semibold hover:text-primary hover:underline"
                            >
                              {defender.name}
                            </Link>
                          </td>
                          <td className="p-3 text-muted-foreground">{defender.team}</td>
                          <td className="p-3 text-right font-semibold tabular-nums">
                            {formatScore(defender.totalRatingPoints)}
                          </td>
                          <td className="p-3 text-right font-semibold tabular-nums">
                            {defender.averageRating.toFixed(1)} / 10
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section
              aria-label="Leaderboard filters"
              className="grid gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            >
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                Tournament
                <select
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  value={tournamentId}
                  onChange={(event) => setTournamentId(event.target.value)}
                >
                  <option value="">All tournaments</option>
                  {(tournaments.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.tournament_name ?? item.type}
                    </option>
                  ))}
                  <option value="__unassigned__">Unassigned matches</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                Team
                <select
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                >
                  <option value="">All teams</option>
                  {teams.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                Position
                <select
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                >
                  <option value="">All positions</option>
                  {positions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                Player
                <span className="relative">
                  <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <input
                    className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground"
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="Search player"
                  />
                </span>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                From
                <input
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                Through
                <input
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  type="date"
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                />
              </label>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Medal className="size-5 text-primary" />
                <h2 className="font-display text-xl font-bold">Player leaderboard</h2>
              </div>
              {leaderboard.length === 0 ? (
                <EmptyState message="No player rating records match these filters." />
              ) : (
                <>
                  {leaderboard.length > topTenLeaderboard.length && (
                    <p className="mb-2 text-sm text-muted-foreground">
                      Showing the top 10 of {leaderboard.length} players.
                    </p>
                  )}
                  <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
                    <table className="w-full min-w-[1180px] text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="p-3 text-left">Rank</th>
                          <th className="p-3 text-left">Player</th>
                          <th className="p-3 text-left">Team</th>
                          <th className="p-3 text-center">Goals</th>
                          <th className="p-3 text-center">Saves</th>
                          <th className="p-3 text-center">Hat-tricks</th>
                          <th className="p-3 text-center">Braces</th>
                          <th className="p-3 text-center">Clean sheets</th>
                          <th className="p-3 text-right">Goal pts</th>
                          <th className="p-3 text-right">Save pts</th>
                          <th className="p-3 text-right">Hat-trick pts</th>
                          <th className="p-3 text-right">Brace pts</th>
                          <th className="p-3 text-right">Clean-sheet pts</th>
                          <th className="p-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topTenLeaderboard.map((player, index) => {
                          const tied =
                            leaderboard[index - 1]?.overall_score === player.overall_score ||
                            leaderboard[index + 1]?.overall_score === player.overall_score;
                          return (
                            <tr
                              key={player.player_id}
                              className={`border-t border-border/50 ${index === 0 ? "bg-primary/5" : ""}`}
                            >
                              <td className="p-3">
                                <span
                                  className={`rank-badge ${rankFor(index) === 1 ? "rank-badge--gold" : ""}`}
                                >
                                  {tied ? `${rankFor(index)} · Tied` : rankFor(index)}
                                </span>
                              </td>
                              <td className="p-3">
                                <Link
                                  to="/players/$playerId"
                                  params={{ playerId: player.player_id }}
                                  className="font-semibold hover:text-primary hover:underline"
                                >
                                  {index === 0 && (
                                    <Crown className="mr-1 inline size-4 text-amber-500" />
                                  )}
                                  {player.player_name}
                                </Link>
                                <div className="text-xs text-muted-foreground">
                                  {player.position}
                                </div>
                              </td>
                              <td className="p-3 text-muted-foreground">{player.team_name}</td>
                              <td className="p-3 text-center tabular-nums">{player.goals}</td>
                              <td className="p-3 text-center tabular-nums">{player.saves}</td>
                              <td className="p-3 text-center tabular-nums">{player.hattricks}</td>
                              <td className="p-3 text-center tabular-nums">{player.braces}</td>
                              <td className="p-3 text-center tabular-nums">
                                {player.clean_sheets}
                              </td>
                              <td className="p-3 text-right tabular-nums">{player.goals_points}</td>
                              <td className="p-3 text-right tabular-nums">
                                {formatScore(player.saves_points)}
                              </td>
                              <td className="p-3 text-right tabular-nums">
                                {player.hattricks_points}
                              </td>
                              <td className="p-3 text-right tabular-nums">
                                {player.braces_points}
                              </td>
                              <td className="p-3 text-right tabular-nums">
                                {player.clean_sheets_points}
                              </td>
                              <td className="p-3 text-right font-bold tabular-nums">
                                {formatScore(player.overall_score)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Rating = goals × 10 + saves × 1.5 + hat-tricks × 5 + braces × 3 + clean sheets × 10.
                A player with the same rating shares the rank; names do not break ties.
              </p>
            </section>
          </>
        )}
      </div>
    </SiteLayout>
  );
}

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
