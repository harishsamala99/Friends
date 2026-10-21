import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Award,
  ChartNoAxesCombined,
  Crown,
  Goal,
  Hand,
  Medal,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { EmptyState, TeamBadge } from "@/components/football-ui";
import {
  fetchFixtures,
  fetchAllFixtureAppearances,
  fetchEventsForFixtures,
  fetchPlayers,
  fetchTeams,
  fetchTopScorers,
  fetchTopSaves,
  fetchTournamentStandings,
  fetchTournaments,
  type FixtureAppearance,
  type Fixture,
  type MatchEvent,
  type Player,
  type ScorerRow,
  type StandingRow,
  type Team,
} from "@/lib/football";

export const Route = createFileRoute("/statistics")({
  head: () => ({
    meta: [
      { title: "Tournament Statistics — FRIENDS LEAGUE" },
      {
        name: "description",
        content: "Tournament champions, player awards, match records and season statistics.",
      },
      { property: "og:title", content: "Tournament Statistics — FRIENDS LEAGUE" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatisticsPage,
});

function StatisticsPage() {
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const [tournamentId, setTournamentId] = useState("");
  const tournamentList = useMemo(
    () => (Array.isArray(tournaments.data) ? tournaments.data : []),
    [tournaments.data],
  );
  const tournament = tournamentList.find((item) => item.id === tournamentId);
  const fixtures = useQuery({
    queryKey: ["fixtures", tournamentId],
    queryFn: () => fetchFixtures(undefined, tournamentId),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const scorers = useQuery({
    queryKey: ["scorers", tournamentId],
    queryFn: () => fetchTopScorers(tournamentId),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const saves = useQuery({
    queryKey: ["saves", tournamentId],
    queryFn: () => fetchTopSaves(tournamentId),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const standings = useQuery({
    queryKey: ["standings", tournamentId],
    queryFn: () => fetchTournamentStandings(tournamentId),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const events = useQuery({
    queryKey: [
      "match-events",
      tournamentId,
      (fixtures.data ?? [])
        .filter(
          (fixture) =>
            fixture.status === "Full Time" &&
            fixture.home_score != null &&
            fixture.away_score != null,
        )
        .map((fixture) => fixture.id)
        .join(","),
    ],
    queryFn: () =>
      fetchEventsForFixtures(
        (fixtures.data ?? [])
          .filter(
            (fixture) =>
              fixture.status === "Full Time" &&
              fixture.home_score != null &&
              fixture.away_score != null,
          )
          .map((fixture) => fixture.id),
      ),
    enabled: Boolean(tournamentId && fixtures.data),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const appearances = useQuery({
    queryKey: ["appearances", tournamentId],
    queryFn: fetchAllFixtureAppearances,
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const players = useQuery({
    queryKey: ["players"],
    queryFn: () => fetchPlayers(),
    enabled: Boolean(tournamentId),
  });
  const teams = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeams(),
    enabled: Boolean(tournamentId),
  });

  useEffect(() => {
    const storedId = localStorage.getItem("current-tournament-id");
    const selectedId = tournamentList.some((item) => item.id === storedId)
      ? storedId
      : (tournamentList[0]?.id ?? "");
    setTournamentId(selectedId);
  }, [tournamentList]);

  const completedFixtures = useMemo(
    () =>
      (fixtures.data ?? []).filter(
        (fixture) =>
          fixture.status === "Full Time" &&
          fixture.home_score != null &&
          fixture.away_score != null,
      ),
    [fixtures.data],
  );
  const goals = completedFixtures.reduce(
    (total, fixture) => total + (fixture.home_score ?? 0) + (fixture.away_score ?? 0),
    0,
  );
  const highestScoringFixture = [...completedFixtures].sort(
    (a, b) =>
      (b.home_score ?? 0) + (b.away_score ?? 0) - ((a.home_score ?? 0) + (a.away_score ?? 0)),
  )[0];
  const biggestWin = [...completedFixtures]
    .filter((fixture) => fixture.home_score !== fixture.away_score)
    .sort(
      (a, b) =>
        Math.abs((b.home_score ?? 0) - (b.away_score ?? 0)) -
        Math.abs((a.home_score ?? 0) - (a.away_score ?? 0)),
    )[0];
  const topScorer = scorers.data?.[0];
  const topGoalkeeper = (saves.data ?? []).find((player) => {
    const position = player.position.trim().toLowerCase();
    return position === "gk" || position.includes("goalkeeper");
  });
  const topContribution = [...(scorers.data ?? [])].sort(
    (a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals,
  )[0];
  const mostValuablePlayer = [...(scorers.data ?? [])].sort(
    (a, b) =>
      contributionRate(b) - contributionRate(a) || b.goals + b.assists - (a.goals + a.assists),
  )[0];
  const playerRecords = useMemo(
    () =>
      calculatePlayerRecords(
        completedFixtures,
        events.data ?? [],
        appearances.data ?? [],
        players.data ?? [],
        teams.data ?? [],
      ),
    [completedFixtures, events.data, appearances.data, players.data, teams.data],
  );
  const goalkeeperRecords = useMemo(
    () =>
      calculateGoalkeeperRecords(
        completedFixtures,
        appearances.data ?? [],
        players.data ?? [],
        teams.data ?? [],
      ),
    [completedFixtures, appearances.data, players.data, teams.data],
  );
  const topGoalkeeperCleanSheets =
    goalkeeperRecords.find(
      (record) =>
        record.player_id === topGoalkeeper?.player_id && record.team_id === topGoalkeeper?.team_id,
    )?.clean_sheets ?? 0;
  const rows: StandingRow[] = standings.data ?? [];
  const recordedWinner = tournament?.winner?.trim();
  const winnerIsRecorded = Boolean(
    recordedWinner && recordedWinner !== "TBD" && recordedWinner.toLowerCase() !== "draw",
  );
  const winningTeam = rows.find(
    (row) => row.team_name.trim().toLowerCase() === recordedWinner?.toLowerCase(),
  );
  const champion = winnerIsRecorded ? (winningTeam ?? null) : null;
  const championName = winnerIsRecorded ? recordedWinner : undefined;

  const isLoading =
    tournaments.isLoading ||
    (Boolean(tournamentId) &&
      (fixtures.isLoading ||
        scorers.isLoading ||
        saves.isLoading ||
        standings.isLoading ||
        events.isLoading ||
        appearances.isLoading ||
        players.isLoading ||
        teams.isLoading)) ||
    (tournamentList.length > 0 && !tournamentId);
  const hasError =
    tournaments.isError ||
    fixtures.isError ||
    scorers.isError ||
    saves.isError ||
    standings.isError ||
    events.isError ||
    appearances.isError ||
    players.isError ||
    teams.isError;

  return (
    <SiteLayout>
      <section className="page-header relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(90deg,transparent_49.8%,var(--primary)_50%,transparent_50.2%),linear-gradient(var(--primary)_1px,transparent_1px)] [background-size:50%_100%,100%_56px]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-7 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:py-14">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">
              <ChartNoAxesCombined className="size-4" />
              Friends League · Matchday
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Tournament statistics
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              The standout performances, matchday milestones and numbers behind the tournament.
            </p>
          </div>
          {tournamentList.length > 0 && (
            <div className="flex w-full flex-col gap-2 sm:w-64">
              <label
                htmlFor="statistics-tournament"
                className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Select tournament
              </label>
              <select
                id="statistics-tournament"
                className="h-11 w-full rounded-xl border border-primary/20 bg-card px-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={tournamentId}
                onChange={(event) => {
                  setTournamentId(event.target.value);
                  localStorage.setItem("current-tournament-id", event.target.value);
                }}
              >
                {tournamentList.map((item) => (
                  <option key={item.id} value={item.id} className="bg-card text-foreground">
                    {item.tournament_name || item.type}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:py-10">
        {hasError ? (
          <EmptyState message="Unable to load tournament statistics. Refresh the page and try again." />
        ) : isLoading ? (
          <div className="space-y-5" aria-label="Loading tournament statistics">
            <div className="h-52 animate-pulse rounded-3xl bg-muted" />
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          </div>
        ) : !tournament ? (
          <EmptyState message="No tournaments are available yet." />
        ) : (
          <>
            <section aria-labelledby="champion-heading">
              <SectionHeading
                eyebrow="The season's finest"
                title="Tournament Champion"
                icon={Trophy}
                id="champion-heading"
              />
              <div className="relative mt-4 overflow-hidden rounded-3xl bg-linear-to-br from-[#82452f] via-[#5e3b30] to-[#382f2b] p-6 text-white shadow-xl sm:p-9">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-14 size-64 rounded-full border border-white/10 sm:right-20"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-1 -top-7 size-48 rounded-full border border-white/10 sm:right-28"
                />
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-5">
                    <div className="grid size-20 shrink-0 place-items-center rounded-2xl border border-[#e3c96e]/30 bg-[#e3c96e]/15 text-[#f4d875] shadow-inner sm:size-24">
                      <Trophy className="size-10 sm:size-12" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e3c96e]">
                        {championName ? "Tournament winner" : "Still to play for"}
                      </p>
                      <h3 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
                        {championName || "Champion to be decided"}
                      </h3>
                      {champion && (
                        <p className="mt-2 text-sm text-white/65">
                          {champion.points} points
                          <span className="px-2 text-white/35">·</span>
                          {champion.won} wins
                          <span className="px-2 text-white/35">·</span>
                          {champion.goals_for} goals scored
                        </p>
                      )}
                    </div>
                  </div>
                  {champion && (
                    <TeamBadge
                      team={{
                        name: champion.team_name,
                        short_name: champion.short_name,
                        crest_color: champion.crest_color,
                        logo_url: champion.logo_url,
                      }}
                      size={64}
                    />
                  )}
                </div>
              </div>
            </section>

            <section aria-labelledby="overview-heading">
              <SectionHeading
                eyebrow="By the numbers"
                title="Tournament Overview"
                icon={ChartNoAxesCombined}
                id="overview-heading"
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <OverviewCard
                  icon={Goal}
                  label="Goals scored"
                  value={goals.toLocaleString()}
                  detail={`${completedFixtures.length} completed ${completedFixtures.length === 1 ? "match" : "matches"}`}
                  color="text-primary"
                />
                <OverviewCard
                  icon={ChartNoAxesCombined}
                  label="Avg. goals per match"
                  value={
                    completedFixtures.length ? (goals / completedFixtures.length).toFixed(1) : "—"
                  }
                  detail="Across completed matches"
                  color="text-sky-700 dark:text-sky-300"
                />
                <OverviewCard
                  icon={Sparkles}
                  label="Highest score"
                  value={
                    highestScoringFixture
                      ? `${highestScoringFixture.home_score}–${highestScoringFixture.away_score}`
                      : "—"
                  }
                  detail={
                    highestScoringFixture
                      ? fixtureTeams(highestScoringFixture, rows)
                      : "No completed matches yet"
                  }
                  color="text-amber-700 dark:text-amber-300"
                />
              </div>
            </section>

            <section aria-labelledby="awards-heading">
              <SectionHeading
                eyebrow="Individual excellence"
                title="Player Awards"
                icon={Award}
                id="awards-heading"
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <AwardCard
                  icon={Goal}
                  title="Golden Boot"
                  player={topScorer}
                  stat={topScorer ? `${topScorer.goals} goals` : undefined}
                  accent="bg-amber-100 text-amber-800 dark:bg-amber-300/15 dark:text-amber-200"
                />
                <AwardCard
                  icon={Hand}
                  title="Most Saves · Goalkeeper"
                  player={topGoalkeeper}
                  stat={
                    topGoalkeeper
                      ? `${topGoalkeeper.saves} saves · ${topGoalkeeperCleanSheets} clean sheets`
                      : undefined
                  }
                  accent="bg-sky-100 text-sky-800 dark:bg-sky-300/15 dark:text-sky-200"
                />
                <AwardCard
                  icon={Crown}
                  title="MVP"
                  player={mostValuablePlayer}
                  stat={
                    mostValuablePlayer
                      ? `${contributionRate(mostValuablePlayer).toFixed(2)} contributions / match`
                      : undefined
                  }
                  accent="bg-violet-100 text-violet-800 dark:bg-violet-300/15 dark:text-violet-200"
                />
                <AwardCard
                  icon={Medal}
                  title="Top Contribution"
                  player={topContribution}
                  stat={
                    topContribution
                      ? `${topContribution.goals + topContribution.assists} G+A`
                      : undefined
                  }
                  accent="bg-orange-100 text-orange-800 dark:bg-orange-300/15 dark:text-orange-200"
                />
              </div>
            </section>

            <section aria-labelledby="player-records-heading">
              <SectionHeading
                eyebrow="Milestones by match"
                title="PLAYER RECORDS"
                icon={Medal}
                id="player-records-heading"
              />
              <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                <StatisticsTable
                  headers={["Team", "Player", "Hatricks", "Brace"]}
                  emptyMessage="No player match records are available for this tournament yet."
                  isEmpty={playerRecords.length === 0}
                >
                  {playerRecords.map((record) => (
                    <tr
                      key={`${record.player_id}:${record.team_id}`}
                      className="border-t border-border/60 transition-colors hover:bg-primary/[0.04]"
                    >
                      <td className="px-4 py-3 text-left text-muted-foreground">
                        {record.team_name}
                      </td>
                      <td className="px-4 py-3 text-left font-semibold">{record.player_name}</td>
                      <td className="px-4 py-3 text-center">
                        <StatPill value={record.hattricks} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatPill value={record.braces} />
                      </td>
                    </tr>
                  ))}
                </StatisticsTable>
              </div>
            </section>

            <section aria-labelledby="goalkeeper-records-heading">
              <SectionHeading
                eyebrow="Shutouts by confirmed appearance"
                title="GOALKEEPER RECORDS"
                icon={Shield}
                id="goalkeeper-records-heading"
              />
              <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                <StatisticsTable
                  headers={["Team", "GK", "Clean Sheets"]}
                  emptyMessage="No goalkeeper appearances are recorded for this tournament yet."
                  isEmpty={goalkeeperRecords.length === 0}
                >
                  {goalkeeperRecords.map((record) => (
                    <tr
                      key={`${record.player_id}:${record.team_id}`}
                      className="border-t border-border/60 transition-colors hover:bg-primary/[0.04]"
                    >
                      <td className="px-4 py-3 text-left text-muted-foreground">
                        {record.team_name}
                      </td>
                      <td className="px-4 py-3 text-left font-semibold">{record.player_name}</td>
                      <td className="px-4 py-3 text-center">
                        <StatPill value={record.clean_sheets} />
                      </td>
                    </tr>
                  ))}
                </StatisticsTable>
              </div>
            </section>

            <section aria-labelledby="records-heading">
              <SectionHeading
                eyebrow="Written into the record books"
                title="Tournament Records"
                icon={Shield}
                id="records-heading"
              />
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <RecordCard
                  icon={Goal}
                  title="Highest scoring game"
                  primary={
                    highestScoringFixture
                      ? `${highestScoringFixture.home_score} – ${highestScoringFixture.away_score}`
                      : "—"
                  }
                  detail={
                    highestScoringFixture
                      ? fixtureTeams(highestScoringFixture, rows)
                      : "No completed matches yet"
                  }
                />
                <RecordCard
                  icon={Trophy}
                  title="Biggest win"
                  primary={
                    biggestWin
                      ? `+${Math.abs((biggestWin.home_score ?? 0) - (biggestWin.away_score ?? 0))}`
                      : "—"
                  }
                  detail={biggestWin ? fixtureWinner(biggestWin, rows) : "No decisive matches yet"}
                />
                <RecordCard
                  icon={Users}
                  title="Most goals by player"
                  primary={topScorer?.player_name ?? "—"}
                  detail={
                    topScorer
                      ? `${topScorer.goals} goals · ${topScorer.team_name}`
                      : "No goals recorded yet"
                  }
                />
              </div>
            </section>
          </>
        )}
      </div>
    </SiteLayout>
  );
}

type PlayerRecord = {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  goals: number;
  hattricks: number;
  braces: number;
};

type GoalkeeperRecord = {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  clean_sheets: number;
};

function calculatePlayerRecords(
  fixtures: Fixture[],
  events: MatchEvent[],
  appearances: FixtureAppearance[],
  players: Player[],
  teams: Team[],
): PlayerRecord[] {
  const fixturesById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const playersById = new Map(players.map((player) => [player.id, player]));
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const records = new Map<string, PlayerRecord>();
  const goalsByPlayerPerFixture = new Map<string, number>();

  const ensureRecord = (playerId: string, teamId: string) => {
    const player = playersById.get(playerId);
    const team = teamsById.get(teamId);
    if (!player || !team) return undefined;

    const key = `${playerId}:${teamId}`;
    let record = records.get(key);
    if (!record) {
      record = {
        player_id: player.id,
        player_name: player.name,
        team_id: team.id,
        team_name: team.name,
        goals: 0,
        hattricks: 0,
        braces: 0,
      };
      records.set(key, record);
    }
    return record;
  };

  for (const appearance of appearances) {
    const fixture = fixturesById.get(appearance.fixture_id);
    if (
      fixture &&
      (appearance.team_id === fixture.home_team_id || appearance.team_id === fixture.away_team_id)
    ) {
      ensureRecord(appearance.player_id, appearance.team_id);
    }
  }

  for (const event of events) {
    const fixture = fixturesById.get(event.fixture_id);
    if (
      !fixture ||
      event.event_type !== "goal" ||
      !event.player_id ||
      !event.team_id ||
      event.goal_type?.trim().toLowerCase() === "own goal" ||
      (event.team_id !== fixture.home_team_id && event.team_id !== fixture.away_team_id)
    ) {
      continue;
    }
    const record = ensureRecord(event.player_id, event.team_id);
    if (!record) continue;

    record.goals += 1;
    const key = `${fixture.id}:${event.player_id}:${event.team_id}`;
    goalsByPlayerPerFixture.set(key, (goalsByPlayerPerFixture.get(key) ?? 0) + 1);
  }

  for (const [key, goals] of goalsByPlayerPerFixture) {
    const [, playerId, teamId] = key.split(":");
    const record = playerId && teamId ? records.get(`${playerId}:${teamId}`) : undefined;
    if (!record) continue;
    if (goals >= 3) record.hattricks += 1;
    else if (goals === 2) record.braces += 1;
  }

  return [...records.values()]
    .filter((record) => record.hattricks > 0 || record.braces > 0)
    .sort(
      (left, right) =>
        right.hattricks - left.hattricks ||
        right.braces - left.braces ||
        right.goals - left.goals ||
        left.player_name.localeCompare(right.player_name) ||
        left.team_name.localeCompare(right.team_name),
    );
}

function calculateGoalkeeperRecords(
  fixtures: Fixture[],
  appearances: FixtureAppearance[],
  players: Player[],
  teams: Team[],
): GoalkeeperRecord[] {
  const fixturesById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const playersById = new Map(players.map((player) => [player.id, player]));
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const records = new Map<string, GoalkeeperRecord>();
  const recordedAppearances = new Set<string>();

  for (const appearance of appearances) {
    const fixture = fixturesById.get(appearance.fixture_id);
    const player = playersById.get(appearance.player_id);
    const team = teamsById.get(appearance.team_id);
    if (
      !fixture ||
      !player ||
      !team ||
      (!player.position.trim().toLowerCase().includes("goalkeeper") &&
        player.position.trim().toLowerCase() !== "gk") ||
      (appearance.team_id !== fixture.home_team_id && appearance.team_id !== fixture.away_team_id)
    ) {
      continue;
    }

    const key = `${fixture.id}:${player.id}:${team.id}`;
    if (recordedAppearances.has(key)) continue;
    recordedAppearances.add(key);

    const recordKey = `${player.id}:${team.id}`;
    let record = records.get(recordKey);
    if (!record) {
      record = {
        player_id: player.id,
        player_name: player.name,
        team_id: team.id,
        team_name: team.name,
        clean_sheets: 0,
      };
      records.set(recordKey, record);
    }

    const conceded =
      team.id === fixture.home_team_id
        ? fixture.away_score
        : team.id === fixture.away_team_id
          ? fixture.home_score
          : null;
    if (fixture.status === "Full Time" && conceded === 0) record.clean_sheets += 1;
  }

  return [...records.values()].sort(
    (left, right) =>
      right.clean_sheets - left.clean_sheets ||
      left.player_name.localeCompare(right.player_name) ||
      left.team_name.localeCompare(right.team_name),
  );
}

function StatisticsTable({
  headers,
  children,
  emptyMessage,
  isEmpty,
}: {
  headers: string[];
  children: ReactNode;
  emptyMessage: string;
  isEmpty: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                className={`px-4 py-3 font-semibold ${index > 1 ? "text-center" : "text-left"}`}
                scope="col"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatPill({ value }: { value: number }) {
  return (
    <span className="inline-flex min-w-9 justify-center rounded-lg border border-primary/15 bg-primary/[0.07] px-2.5 py-1 font-bold tabular-nums text-primary">
      {value}
    </span>
  );
}

function contributionRate(player: ScorerRow) {
  return (player.goals + player.assists) / Math.max(player.matches, 1);
}

function fixtureTeams(fixture: Fixture, standings: StandingRow[]) {
  const homeName = standings.find((team) => team.team_id === fixture.home_team_id)?.team_name;
  const awayName = standings.find((team) => team.team_id === fixture.away_team_id)?.team_name;
  return `${homeName ?? "Home"} vs ${awayName ?? "Away"}`;
}

function fixtureWinner(fixture: Fixture, standings: StandingRow[]) {
  const homeName = standings.find((team) => team.team_id === fixture.home_team_id)?.team_name;
  const awayName = standings.find((team) => team.team_id === fixture.away_team_id)?.team_name;
  const homeWon = (fixture.home_score ?? 0) > (fixture.away_score ?? 0);
  return `${homeWon ? (homeName ?? "Home") : (awayName ?? "Away")} beat ${homeWon ? (awayName ?? "Away") : (homeName ?? "Home")}`;
}

type AwardPlayer = Pick<ScorerRow, "player_name"> & { team_name?: string };

function SectionHeading({
  eyebrow,
  title,
  icon: Icon,
  id,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  id: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.19em] text-primary">{eyebrow}</p>
        <h2 id={id} className="mt-1 font-display text-2xl font-bold sm:text-3xl">
          {title}
        </h2>
      </div>
      <span className="mb-1 hidden size-10 place-items-center rounded-xl bg-primary/10 text-primary sm:grid">
        <Icon className="size-5" />
      </span>
    </div>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <Icon className={`size-5 ${color}`} />
      </div>
      <p className="mt-4 font-display text-4xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function AwardCard({
  icon: Icon,
  title,
  player,
  stat,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  player?: AwardPlayer;
  stat?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </span>
        <span className={`grid size-10 place-items-center rounded-xl ${accent}`}>
          <Icon className="size-5" />
        </span>
      </div>
      {player ? (
        <>
          <p className="mt-5 truncate font-display text-2xl font-bold">{player.player_name}</p>
          {player.team_name && (
            <p className="mt-1 truncate text-sm text-muted-foreground">{player.team_name}</p>
          )}
          <p className="mt-4 border-t border-border/60 pt-3 text-sm font-semibold tabular-nums text-primary">
            {stat}
          </p>
        </>
      ) : (
        <>
          <p className="mt-5 font-display text-xl font-bold">Not recorded</p>
          <p className="mt-1 text-sm text-muted-foreground">No player stats available yet</p>
          <p className="mt-4 border-t border-border/60 pt-3 text-sm text-muted-foreground">—</p>
        </>
      )}
    </div>
  );
}

function RecordCard({
  icon: Icon,
  title,
  primary,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  primary: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-36 flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 text-primary" />
        <p className="text-xs font-bold uppercase tracking-[0.13em]">{title}</p>
      </div>
      <div className="mt-5">
        <p className="truncate font-display text-2xl font-bold tabular-nums">{primary}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
