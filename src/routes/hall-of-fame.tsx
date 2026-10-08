import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Award, Flame, Goal, Shield, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { EmptyState, PageHeader, TeamBadge, ListSkeleton } from "@/components/football-ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchAllFixtureAppearances,
  fetchAllMatchEvents,
  fetchBestXIs,
  fetchCompetitions,
  fetchFixtures,
  fetchPlayerAchievements,
  fetchPlayers,
  fetchTournamentChampionCaptains,
  fetchTeams,
  fetchTournaments,
  saveTournamentChampionCaptain,
  type Fixture,
  type Competition,
  type Player,
  type Team,
  type Tournament,
} from "@/lib/football";

export const Route = createFileRoute("/hall-of-fame")({
  head: () => ({
    meta: [
      { title: "Hall of Fame — FRIENDS LEAGUE" },
      {
        name: "description",
        content: "The players, teams, matches and performances that shaped FRIENDS LEAGUE.",
      },
    ],
  }),
  component: HallOfFamePage,
});

type HallData = {
  fixtures: Fixture[];
  competitions: Competition[];
  tournaments: Tournament[];
  teams: Team[];
  players: Player[];
  events: Awaited<ReturnType<typeof fetchAllMatchEvents>>;
  appearances: Awaited<ReturnType<typeof fetchAllFixtureAppearances>>;
  achievements: Awaited<ReturnType<typeof fetchPlayerAchievements>>;
  captains: Awaited<ReturnType<typeof fetchTournamentChampionCaptains>>;
  bestXIs: Awaited<ReturnType<typeof fetchAllBestXIs>>;
};

type CompletedFixture = Fixture & { home_score: number; away_score: number };

async function fetchAllBestXIs(tournaments: Tournament[]) {
  const completedTournamentIds = new Set(
    tournaments
      .filter((tournament) => tournament.status === "completed")
      .map((tournament) => tournament.id),
  );
  return (await fetchBestXIs())
    .filter((selection) => completedTournamentIds.has(selection.tournament_id))
    .map((selection) => ({ tournamentId: selection.tournament_id, selection }));
}

function HallOfFamePage() {
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ["hall-of-fame"],
    queryFn: async (): Promise<HallData> => {
      const [
        fixtures,
        competitions,
        tournaments,
        teams,
        players,
        events,
        appearances,
        achievements,
        captains,
      ] = await Promise.all([
        fetchFixtures(),
        fetchCompetitions(),
        fetchTournaments(),
        fetchTeams(),
        fetchPlayers(),
        fetchAllMatchEvents(),
        fetchAllFixtureAppearances(),
        fetchPlayerAchievements(),
        fetchTournamentChampionCaptains(),
      ]);
      const bestXIs = await fetchAllBestXIs(tournaments);
      return {
        fixtures,
        competitions,
        tournaments,
        teams,
        players,
        events,
        appearances,
        achievements,
        captains,
        bestXIs,
      };
    },
  });

  const d = data.data;
  const teams = d?.teams ?? [];
  const players = d?.players ?? [];
  const completedFixtures = (d?.fixtures ?? []).filter(
    (fixture): fixture is CompletedFixture =>
      fixture.status === "Full Time" && fixture.home_score !== null && fixture.away_score !== null,
  );
  const tournaments = (d?.tournaments ?? []).filter(
    (tournament) => tournament.status === "completed",
  );
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const playersById = new Map(players.map((player) => [player.id, player]));
  const fixturesById = new Map((d?.fixtures ?? []).map((fixture) => [fixture.id, fixture]));
  const tournamentsById = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const events = (d?.events ?? []).filter((event) => {
    const fixture = fixturesById.get(event.fixture_id);
    return (
      fixture?.status === "Full Time" &&
      fixture.home_score !== null &&
      fixture.away_score !== null &&
      event.player_id !== null &&
      event.team_id !== null &&
      (event.team_id === fixture.home_team_id || event.team_id === fixture.away_team_id)
    );
  });

  const playerTournamentIds = new Map<string, Set<string>>();
  const recordPlayerTournament = (playerId: string, tournamentId: string | null) => {
    if (!tournamentId) return;
    const tournamentIds = playerTournamentIds.get(playerId) ?? new Set<string>();
    tournamentIds.add(tournamentId);
    playerTournamentIds.set(playerId, tournamentIds);
  };
  const playerMetrics = new Map<
    string,
    { titles: number; awards: number; bestXI: number; goals: number; saves: number; badges: number }
  >();
  const metricsFor = (playerId: string) => {
    const current = playerMetrics.get(playerId) ?? {
      titles: 0,
      awards: 0,
      bestXI: 0,
      goals: 0,
      saves: 0,
      badges: 0,
    };
    playerMetrics.set(playerId, current);
    return current;
  };
  for (const event of events) {
    if (!event.player_id) continue;
    const fixture = fixturesById.get(event.fixture_id);
    if (event.event_type === "goal" && event.goal_type?.toLowerCase() !== "own goal") {
      metricsFor(event.player_id).goals += 1;
      recordPlayerTournament(event.player_id, fixture?.tournament_id ?? null);
    } else if (event.event_type === "save") {
      metricsFor(event.player_id).saves += 1;
      recordPlayerTournament(event.player_id, fixture?.tournament_id ?? null);
    }
  }

  const teamTitles = new Map<string, Tournament[]>();
  const teamByRecordedName = (name: string) => matchingTeam(name, teams);
  for (const tournament of tournaments) {
    const winner = teamByRecordedName(tournament.winner);
    if (!winner) continue;
    const titles = teamTitles.get(winner.id) ?? [];
    titles.push(tournament);
    teamTitles.set(winner.id, titles);
    const playedWithWinner = new Set(
      (d?.appearances ?? [])
        .filter((appearance) => appearance.team_id === winner.id)
        .filter((appearance) => {
          const fixture = fixturesById.get(appearance.fixture_id);
          return fixture?.tournament_id === tournament.id && fixture.status === "Full Time";
        })
        .map((appearance) => appearance.player_id),
    );
    for (const event of events) {
      const fixture = fixturesById.get(event.fixture_id);
      if (
        fixture?.tournament_id === tournament.id &&
        event.team_id === winner.id &&
        event.player_id
      ) {
        playedWithWinner.add(event.player_id);
      }
    }
    for (const playerId of playedWithWinner) {
      if (playersById.has(playerId)) {
        metricsFor(playerId).titles += 1;
        recordPlayerTournament(playerId, tournament.id);
      }
    }
  }

  for (const tournament of tournaments) {
    for (const personName of [
      tournament.top_scorer_goals ? tournament.top_scorer_name : null,
      tournament.top_assister_assists ? tournament.top_assister_name : null,
      tournament.top_saver_saves ? tournament.top_saver_name : null,
    ]) {
      if (!personName) continue;
      const matches = players.filter((player) => normalize(player.name) === normalize(personName));
      const matchedPlayer = matches.length === 1 ? matches[0] : undefined;
      if (matchedPlayer) metricsFor(matchedPlayer.id).awards += 1;
    }
  }
  for (const { selection } of d?.bestXIs ?? []) {
    const members = [
      selection.forward_1,
      selection.forward_2,
      selection.forward_3,
      selection.midfielder_1,
      selection.midfielder_2,
      selection.midfielder_3,
      selection.defender_1,
      selection.defender_2,
      selection.defender_3,
      selection.defender_4,
      selection.goalkeeper,
    ];
    for (const playerId of new Set(members)) {
      if (playersById.has(playerId)) metricsFor(playerId).bestXI += 1;
    }
  }
  for (const achievement of d?.achievements ?? []) {
    if (playersById.has(achievement.player_id)) metricsFor(achievement.player_id).badges += 1;
  }

  const rankedPlayers = [...playerMetrics.entries()]
    .map(([playerId, metrics]) => ({ player: playersById.get(playerId), metrics }))
    .filter((item): item is typeof item & { player: Player } => Boolean(item.player))
    .sort((a, b) => a.player.name.localeCompare(b.player.name));
  const isGoalkeeper = (player: Player) => /goal\s*keeper|^gk$/i.test(player.position.trim());
  const goalkeepers = rankedPlayers.filter(({ player }) => isGoalkeeper(player));
  const goalScorers = rankedPlayers.filter(({ player }) => !isGoalkeeper(player));
  const topGoalkeeperSaves = Math.max(0, ...goalkeepers.map(({ metrics }) => metrics.saves));
  const topScorerGoals = Math.max(0, ...goalScorers.map(({ metrics }) => metrics.goals));
  const goalkeeperLeaders = goalkeepers
    .filter(
      ({ metrics }) =>
        metrics.titles > 0 || (topGoalkeeperSaves > 0 && metrics.saves === topGoalkeeperSaves),
    )
    .sort(
      (a, b) =>
        b.metrics.titles - a.metrics.titles ||
        b.metrics.saves - a.metrics.saves ||
        a.player.name.localeCompare(b.player.name),
    );
  const goalScorerLeaders = goalScorers
    .filter(
      ({ metrics }) =>
        metrics.titles > 0 || (topScorerGoals > 0 && metrics.goals === topScorerGoals),
    )
    .sort(
      (a, b) =>
        b.metrics.titles - a.metrics.titles ||
        b.metrics.goals - a.metrics.goals ||
        a.player.name.localeCompare(b.player.name),
    );
  const titleLeaders = [...teamTitles.entries()]
    .map(([teamId, wins]) => ({ team: teamsById.get(teamId), wins }))
    .filter((item): item is typeof item & { team: Team } => Boolean(item.team))
    .sort((a, b) => b.wins.length - a.wins.length || a.team.name.localeCompare(b.team.name));
  const captainTitles = new Map<string, Tournament[]>();
  for (const assignment of d?.captains ?? []) {
    const tournament = tournamentsById.get(assignment.tournament_id);
    const officialChampion = tournament ? teamByRecordedName(tournament.winner) : undefined;
    if (
      !tournament ||
      !officialChampion ||
      officialChampion.id !== assignment.team_id ||
      !playersById.has(assignment.player_id)
    ) {
      continue;
    }
    const wins = captainTitles.get(assignment.player_id) ?? [];
    wins.push(tournament);
    captainTitles.set(assignment.player_id, wins);
  }
  const captainLeaders = [...captainTitles.entries()]
    .map(([playerId, wins]) => ({ player: playersById.get(playerId), wins }))
    .filter((item): item is typeof item & { player: Player } => Boolean(item.player))
    .sort((a, b) => b.wins.length - a.wins.length || a.player.name.localeCompare(b.player.name));

  const finals = [...tournaments].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const highestScoring = getHighestScoringMatches(completedFixtures);
  const upsets = findHistoricalUpsets(completedFixtures, teamsById, d?.competitions ?? []);
  const bestPerformances = getBestTournamentPerformances(
    tournaments,
    completedFixtures,
    events,
    fixturesById,
    teams,
    playersById,
  );
  const bestXIByTournament = new Set((d?.bestXIs ?? []).map((item) => item.tournamentId));

  return (
    <SiteLayout>
      <PageHeader
        title="Hall of Fame"
        subtitle="Celebrating the people, teams and matches behind the league's history."
      />
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        {data.isLoading ? (
          <ListSkeleton rows={8} />
        ) : data.isError || !d ? (
          <EmptyState message="Hall of Fame data could not be loaded. Refresh the page to try again." />
        ) : (
          <>
            <PlayerRecognitionSection
              title="Goalkeepers"
              icon={<Shield />}
              players={goalkeeperLeaders}
              stat="saves"
              playerTournamentIds={playerTournamentIds}
              tournamentsById={tournamentsById}
              emptyMessage="Tournament title-winning goalkeepers and the leaders in recorded saves will appear here."
            />
            <PlayerRecognitionSection
              title="Goal Scorers"
              icon={<Goal />}
              players={goalScorerLeaders}
              stat="goals"
              playerTournamentIds={playerTournamentIds}
              tournamentsById={tournamentsById}
              emptyMessage="Tournament title-winning goal scorers and the leaders in recorded goals will appear here."
            />

            <section>
              <SectionTitle icon={<Shield />} title="Most Successful Captains" />
              {captainLeaders.length === 0 ? (
                <EmptyState message="No official champion-captain assignments are recorded yet. The section will rank captains only after their winning-team assignments are confirmed." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {captainLeaders.map(({ player, wins }, index) => (
                    <Card key={player.id}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <span className="font-display text-2xl font-bold text-primary">
                          {sharedRank(
                            captainLeaders,
                            index,
                            (a, b) => a.wins.length === b.wins.length,
                          )}
                        </span>
                        <PlayerAvatar player={player} />
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/players/$playerId"
                            params={{ playerId: player.id }}
                            className="font-semibold hover:underline"
                          >
                            {player.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {wins.length} champion captaincy{wins.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {wins.map((tournament) => (
                            <Link
                              key={tournament.id}
                              to="/fixtures"
                              search={{ tournamentId: tournament.id }}
                            >
                              <Badge variant="secondary">{tournament.tournament_name}</Badge>
                            </Link>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <TournamentCaptainEditor
                tournaments={tournaments}
                teams={teams}
                players={players}
                assignments={d.captains}
                onSaved={() => {
                  void queryClient.invalidateQueries({ queryKey: ["hall-of-fame"] });
                }}
              />
            </section>

            <section>
              <SectionTitle icon={<Trophy />} title="Most Tournament Titles" />
              {titleLeaders.length === 0 ? (
                <EmptyState message="No completed tournament winners could be matched unambiguously to a team." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {titleLeaders.map(({ team, wins }, index) => (
                    <Card key={team.id}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <span className="font-display text-2xl font-bold text-primary">
                          {sharedRank(
                            titleLeaders,
                            index,
                            (a, b) => a.wins.length === b.wins.length,
                          )}
                        </span>
                        <TeamBadge team={team} size={44} />
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/teams"
                            search={{ teamId: team.id }}
                            className="font-semibold hover:underline"
                          >
                            {team.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {wins.length} title{wins.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {wins.map((tournament) => (
                            <Link
                              key={tournament.id}
                              to="/fixtures"
                              search={{ tournamentId: tournament.id }}
                            >
                              <Badge variant="secondary">{tournament.tournament_name}</Badge>
                            </Link>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle icon={<Trophy />} title="Most Memorable Finals" />
              {finals.length === 0 ? (
                <EmptyState message="No completed tournament finals with an unambiguous champion are available yet." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {finals.map((tournament) => {
                    const champion = teamByRecordedName(tournament.winner);
                    const close = Math.abs(tournament.home_score - tournament.away_score) === 1;
                    return (
                      <Link
                        key={tournament.id}
                        to="/fixtures"
                        search={{ tournamentId: tournament.id }}
                      >
                        <Card className="h-full transition-shadow hover:shadow-elevated">
                          <CardContent className="space-y-3 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                                  {tournament.tournament_name}
                                </p>
                                <p className="mt-1 font-display text-lg font-bold">
                                  {tournament.home_team}{" "}
                                  <span className="text-muted-foreground">vs</span>{" "}
                                  {tournament.away_team}
                                </p>
                              </div>
                              {champion && <TeamBadge team={champion} size={34} />}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-display text-2xl font-bold tabular-nums">
                                {tournament.home_score} – {tournament.away_score}
                              </span>
                              <span className="text-sm font-semibold text-primary">
                                Champion: {tournament.winner}
                              </span>
                            </div>
                            {close && <Badge variant="secondary">One-goal finish</Badge>}
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <SectionTitle icon={<Shield />} title="Biggest Upsets" />
              {upsets.length === 0 ? (
                <EmptyState message="There is not enough finalized match history to compare teams before a match. Upsets are shown only when both teams have at least three prior results and the winner had a lower points-per-match record." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {upsets.map(({ fixture, winner, opponent, gap }) => (
                    <Link
                      key={fixture.id}
                      to="/match/$fixtureId"
                      params={{ fixtureId: fixture.id }}
                    >
                      <Card className="h-full transition-shadow hover:shadow-elevated">
                        <CardContent className="flex items-center gap-3 p-4">
                          <Flame className="size-6 shrink-0 text-orange-500" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">
                              {winner.name} beat {opponent.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {fixture.home_score}–{fixture.away_score} · pre-match gap{" "}
                              {gap.toFixed(2)} points per match
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle icon={<Goal />} title="Highest-Scoring Matches" />
              {highestScoring.length === 0 ? (
                <EmptyState message="No finalized match scores are available yet." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {highestScoring.map((fixture) => {
                    const home = teamsById.get(fixture.home_team_id);
                    const away = teamsById.get(fixture.away_team_id);
                    const tournament = fixture.tournament_id
                      ? tournamentsById.get(fixture.tournament_id)
                      : undefined;
                    return (
                      <Link
                        key={fixture.id}
                        to="/match/$fixtureId"
                        params={{ fixtureId: fixture.id }}
                      >
                        <Card className="h-full transition-shadow hover:shadow-elevated">
                          <CardContent className="flex items-center gap-3 p-4">
                            {home && <TeamBadge team={home} size={34} />}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">
                                {home?.name} <span className="text-muted-foreground">vs</span>{" "}
                                {away?.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {tournament?.tournament_name ?? "League match"} ·{" "}
                                {formatDate(fixture.kickoff)}
                              </p>
                            </div>
                            <span className="font-display text-xl font-bold tabular-nums">
                              {fixture.home_score}–{fixture.away_score}
                            </span>
                            {away && <TeamBadge team={away} size={34} />}
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <SectionTitle icon={<Award />} title="Best Tournament Performances" />
              {bestPerformances.length === 0 && bestXIByTournament.size === 0 ? (
                <EmptyState message="No recorded tournament goal totals or Best XI selections are available yet." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {bestPerformances.map((performance) => (
                    <Link
                      key={`${performance.tournamentId}-${performance.label}`}
                      to="/fixtures"
                      search={{ tournamentId: performance.tournamentId }}
                    >
                      <Card className="h-full transition-shadow hover:shadow-elevated">
                        <CardContent className="flex items-start gap-3 p-4">
                          <Trophy className="mt-0.5 size-5 shrink-0 text-primary" />
                          <div>
                            <p className="font-semibold">{performance.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {performance.tournamentName}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                  {[...bestXIByTournament]
                    .filter(
                      (tournamentId) =>
                        !bestPerformances.some((p) => p.tournamentId === tournamentId),
                    )
                    .map((tournamentId) => {
                      const tournament = tournamentsById.get(tournamentId);
                      return tournament ? (
                        <Link
                          key={`${tournamentId}-best-xi`}
                          to="/fixtures"
                          search={{ tournamentId }}
                        >
                          <Card className="transition-shadow hover:shadow-elevated">
                            <CardContent className="flex items-center gap-3 p-4">
                              <Award className="size-5 text-primary" />
                              <span className="font-semibold">Best XI finalized</span>
                              <span className="ml-auto text-sm text-muted-foreground">
                                {tournament.tournament_name}
                              </span>
                            </CardContent>
                          </Card>
                        </Link>
                      ) : null;
                    })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </SiteLayout>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
    </div>
  );
}

function TournamentCaptainEditor({
  tournaments,
  teams,
  players,
  assignments,
  onSaved,
}: {
  tournaments: Tournament[];
  teams: Team[];
  players: Player[];
  assignments: HallData["captains"];
  onSaved: () => void;
}) {
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, string>>({});
  const [savingTournamentId, setSavingTournamentId] = useState<string | null>(null);
  const eligibleTournaments = tournaments.filter(
    (tournament) =>
      tournament.status === "completed" && matchingTeam(tournament.winner, teams) !== undefined,
  );

  useEffect(() => {
    setSelectedPlayers(
      Object.fromEntries(
        assignments.map((assignment) => [assignment.tournament_id, assignment.player_id]),
      ),
    );
  }, [assignments]);

  async function saveCaptain(tournamentId: string) {
    const playerId = selectedPlayers[tournamentId];
    if (!playerId) {
      toast.error("Select the officially recorded champion captain first.");
      return;
    }
    setSavingTournamentId(tournamentId);
    try {
      await saveTournamentChampionCaptain(tournamentId, playerId);
      toast.success("Champion captain assignment saved");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save captain assignment");
    } finally {
      setSavingTournamentId(null);
    }
  }

  if (eligibleTournaments.length === 0) return null;

  return (
    <details className="mt-5 rounded-xl border border-border/60 bg-card p-4">
      <summary className="cursor-pointer font-semibold">Record official champion captains</summary>
      <p className="my-3 text-sm text-muted-foreground">
        Record a captain only when official tournament records confirm they captained the champion.
        This does not infer captains from managers or current squad membership.
      </p>
      <div className="space-y-3">
        {eligibleTournaments.map((tournament) => {
          const champion = matchingTeam(tournament.winner, teams);
          if (!champion) return null;
          const isSaving = savingTournamentId === tournament.id;
          return (
            <div
              key={tournament.id}
              className="flex flex-col gap-3 rounded-lg border border-border/50 p-3 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{tournament.tournament_name}</p>
                <p className="mb-2 text-sm text-muted-foreground">Champion: {champion.name}</p>
                <label className="block text-sm font-medium">
                  Official captain
                  <select
                    aria-label={`Official captain for ${tournament.tournament_name}`}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedPlayers[tournament.id] ?? ""}
                    onChange={(event) =>
                      setSelectedPlayers((current) => ({
                        ...current,
                        [tournament.id]: event.target.value,
                      }))
                    }
                    disabled={isSaving}
                  >
                    <option value="">Select a player</option>
                    {players.map((player) => {
                      const playerTeam = player.team_id
                        ? teams.find((team) => team.id === player.team_id)
                        : undefined;
                      return (
                        <option key={player.id} value={player.id}>
                          {player.name}
                          {playerTeam ? ` · ${playerTeam.name}` : ""}
                          {player.status !== "Active" ? " · inactive" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
              <Button
                size="sm"
                disabled={isSaving || !selectedPlayers[tournament.id]}
                onClick={() => void saveCaptain(tournament.id)}
              >
                {isSaving ? "Saving…" : "Save captain"}
              </Button>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function matchingTeam(name: string, teams: Team[]) {
  const matching = teams.filter((team) => normalize(team.name) === normalize(name));
  return matching.length === 1 ? matching[0] : undefined;
}

function sharedRank<T>(items: T[], index: number, equal: (left: T, right: T) => boolean) {
  const current = items[index];
  return current ? items.findIndex((item) => equal(item, current)) + 1 : index + 1;
}

function PlayerAvatar({ player }: { player: Player }) {
  return (
    <Avatar className="size-11">
      <AvatarImage src={player.photo_url ?? undefined} alt={player.name} />
      <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

type RecognitionPlayer = {
  player: Player;
  metrics: { titles: number; goals: number; saves: number };
};

function PlayerRecognitionSection({
  title,
  icon,
  players,
  stat,
  playerTournamentIds,
  tournamentsById,
  emptyMessage,
}: {
  title: string;
  icon: ReactNode;
  players: RecognitionPlayer[];
  stat: "goals" | "saves";
  playerTournamentIds: Map<string, Set<string>>;
  tournamentsById: Map<string, Tournament>;
  emptyMessage: string;
}) {
  return (
    <section>
      <SectionTitle icon={icon} title={title} />
      {players.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="space-y-6">
          {groupRecognitionPlayers(players, playerTournamentIds, tournamentsById).map((group) => (
            <div key={group.key} className="space-y-3">
              <h3 className="font-display text-lg font-semibold">{group.title}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.players.map(({ player, metrics }, index) => (
                  <Link key={player.id} to="/players/$playerId" params={{ playerId: player.id }}>
                    <Card className="h-full transition-shadow hover:shadow-elevated">
                      <CardContent className="flex items-center gap-3 p-4">
                        <span className="font-display text-xl font-bold text-primary">
                          {sharedRank(
                            group.players,
                            index,
                            (left, right) =>
                              left.metrics.titles === right.metrics.titles &&
                              left.metrics[stat] === right.metrics[stat],
                          )}
                        </span>
                        <PlayerAvatar player={player} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{player.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {stat === "goals" &&
                              `${metrics.goals} goal${metrics.goals === 1 ? "" : "s"} · `}
                            {metrics.titles} title{metrics.titles === 1 ? "" : "s"}
                            {stat === "saves" &&
                              ` · ${metrics.saves} save${metrics.saves === 1 ? "" : "s"}`}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function groupRecognitionPlayers(
  players: RecognitionPlayer[],
  playerTournamentIds: Map<string, Set<string>>,
  tournamentsById: Map<string, Tournament>,
) {
  const groups = new Map<string, { key: string; title: string; players: RecognitionPlayer[] }>();
  for (const recognition of players) {
    const tournamentIds = [...(playerTournamentIds.get(recognition.player.id) ?? [])].sort();
    const key =
      tournamentIds.length === 0
        ? "unrecorded"
        : tournamentIds.length === 1
          ? (tournamentIds[0] ?? "unrecorded")
          : "multiple";
    const tournament =
      key !== "unrecorded" && key !== "multiple" ? tournamentsById.get(key) : undefined;
    const title =
      key === "unrecorded"
        ? "Tournament not recorded"
        : key === "multiple"
          ? "Multiple tournaments"
          : (tournament?.tournament_name ?? "Tournament");
    const group = groups.get(key) ?? { key, title, players: [] };
    group.players.push(recognition);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => {
    if (left.key === "unrecorded") return 1;
    if (right.key === "unrecorded") return -1;
    if (left.key === "multiple") return 1;
    if (right.key === "multiple") return -1;
    return left.title.localeCompare(right.title);
  });
}

function getHighestScoringMatches(fixtures: CompletedFixture[]) {
  const sorted = [...fixtures].sort(
    (a, b) =>
      (b.home_score ?? 0) + (b.away_score ?? 0) - ((a.home_score ?? 0) + (a.away_score ?? 0)) ||
      +new Date(b.kickoff) - +new Date(a.kickoff),
  );
  const cutoffMatch = sorted[Math.min(4, sorted.length - 1)];
  if (!cutoffMatch) return [];
  const cutoff = cutoffMatch.home_score + cutoffMatch.away_score;
  return sorted.filter((fixture) => fixture.home_score + fixture.away_score >= cutoff);
}

function findHistoricalUpsets(
  fixtures: CompletedFixture[],
  teamsById: Map<string, Team>,
  competitions: Competition[],
) {
  const ordered = [...fixtures].sort(
    (a, b) => +new Date(a.kickoff) - +new Date(b.kickoff) || a.id.localeCompare(b.id),
  );
  const records = new Map<string, { played: number; points: number }>();
  const competitionsById = new Map(
    competitions.map((competition) => [competition.id, competition]),
  );
  const upsets: {
    fixture: CompletedFixture;
    winner: Team;
    opponent: Team;
    gap: number;
  }[] = [];
  for (let index = 0; index < ordered.length;) {
    const firstFixture = ordered[index];
    if (!firstFixture) break;
    let end = index + 1;
    while (end < ordered.length && ordered[end]?.kickoff === firstFixture.kickoff) end += 1;
    const sameKickoff = ordered.slice(index, end);
    for (const fixture of sameKickoff) {
      const competition = competitionsById.get(fixture.competition_id);
      if (!competition) continue;
      const home = records.get(`${fixture.competition_id}:${fixture.home_team_id}`) ?? {
        played: 0,
        points: 0,
      };
      const away = records.get(`${fixture.competition_id}:${fixture.away_team_id}`) ?? {
        played: 0,
        points: 0,
      };
      if (home.played >= 3 && away.played >= 3 && fixture.home_score !== fixture.away_score) {
        const homeWon = fixture.home_score > fixture.away_score;
        const winnerRecord = homeWon ? home : away;
        const opponentRecord = homeWon ? away : home;
        const gap =
          opponentRecord.points / opponentRecord.played - winnerRecord.points / winnerRecord.played;
        if (gap > 0) {
          const winner = teamsById.get(homeWon ? fixture.home_team_id : fixture.away_team_id);
          const opponent = teamsById.get(homeWon ? fixture.away_team_id : fixture.home_team_id);
          if (winner && opponent) upsets.push({ fixture, winner, opponent, gap });
        }
      }
    }
    for (const fixture of sameKickoff) {
      const homeKey = `${fixture.competition_id}:${fixture.home_team_id}`;
      const awayKey = `${fixture.competition_id}:${fixture.away_team_id}`;
      const home = records.get(homeKey) ?? { played: 0, points: 0 };
      const away = records.get(awayKey) ?? { played: 0, points: 0 };
      home.played += 1;
      away.played += 1;
      const competition = competitionsById.get(fixture.competition_id);
      if (!competition) continue;
      if (fixture.home_score > fixture.away_score) {
        home.points += competition.points_win;
        away.points += competition.points_loss;
      } else if (fixture.home_score < fixture.away_score) {
        away.points += competition.points_win;
        home.points += competition.points_loss;
      } else {
        home.points += competition.points_draw;
        away.points += competition.points_draw;
      }
      records.set(homeKey, home);
      records.set(awayKey, away);
    }
    index = end;
  }
  return upsets.sort((a, b) => b.gap - a.gap).slice(0, 8);
}

function getBestTournamentPerformances(
  tournaments: Tournament[],
  fixtures: Fixture[],
  events: Awaited<ReturnType<typeof fetchAllMatchEvents>>,
  fixturesById: Map<string, Fixture>,
  teams: Team[],
  playersById: Map<string, Player>,
) {
  const results: { tournamentId: string; tournamentName: string; label: string }[] = [];
  const teamForName = (name: string) => {
    const matching = teams.filter((team) => normalize(team.name) === normalize(name));
    return matching.length === 1 ? matching[0] : undefined;
  };
  for (const tournament of tournaments) {
    if (tournament.top_scorer_name && (tournament.top_scorer_goals ?? 0) > 0) {
      results.push({
        tournamentId: tournament.id,
        tournamentName: tournament.tournament_name ?? tournament.type,
        label: `${tournament.top_scorer_name} — tournament top scorer (${tournament.top_scorer_goals} goals)`,
      });
    }
    if (tournament.fixture_status !== "fixtures_completed") continue;
    const matches = fixtures.filter((fixture) => fixture.tournament_id === tournament.id);
    const scorerTotals = new Map<string, number>();
    for (const event of events) {
      const fixture = fixturesById.get(event.fixture_id);
      if (
        fixture?.tournament_id === tournament.id &&
        fixture.status === "Full Time" &&
        event.event_type === "goal" &&
        event.goal_type !== "Own Goal" &&
        event.player_id &&
        playersById.has(event.player_id)
      ) {
        scorerTotals.set(event.player_id, (scorerTotals.get(event.player_id) ?? 0) + 1);
      }
    }
    const maxGoals = Math.max(0, ...scorerTotals.values());
    if (maxGoals > 0) {
      for (const [playerId, goals] of scorerTotals) {
        if (goals === maxGoals) {
          results.push({
            tournamentId: tournament.id,
            tournamentName: tournament.tournament_name ?? tournament.type,
            label: `${playersById.get(playerId)?.name} — ${goals} tournament goals`,
          });
        }
      }
    }

    const totals = new Map<string, number>();
    for (const fixture of matches) {
      if (fixture.status !== "Full Time") continue;
      totals.set(
        fixture.home_team_id,
        (totals.get(fixture.home_team_id) ?? 0) + (fixture.home_score ?? 0),
      );
      totals.set(
        fixture.away_team_id,
        (totals.get(fixture.away_team_id) ?? 0) + (fixture.away_score ?? 0),
      );
    }
    const maxTeamGoals = Math.max(0, ...totals.values());
    if (maxTeamGoals > 0) {
      for (const [teamId, goals] of totals) {
        if (goals === maxTeamGoals) {
          const team = teams.find((entry) => entry.id === teamId);
          if (team) {
            results.push({
              tournamentId: tournament.id,
              tournamentName: tournament.tournament_name ?? tournament.type,
              label: `${team.name} — most goals (${goals})`,
            });
          }
        }
      }
    }

    const champion = teamForName(tournament.winner);
    const championMatches = champion
      ? matches.filter(
          (fixture) =>
            fixture.status === "Full Time" &&
            (fixture.home_team_id === champion.id || fixture.away_team_id === champion.id),
        )
      : [];
    if (
      champion &&
      championMatches.length > 0 &&
      championMatches.every((fixture) =>
        fixture.home_team_id === champion.id
          ? (fixture.home_score ?? 0) >= (fixture.away_score ?? 0)
          : (fixture.away_score ?? 0) >= (fixture.home_score ?? 0),
      )
    ) {
      results.push({
        tournamentId: tournament.id,
        tournamentName: tournament.tournament_name ?? tournament.type,
        label: `${champion.name} — unbeaten champion`,
      });
    }
  }
  return results;
}
