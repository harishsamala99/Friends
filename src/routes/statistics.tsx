import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Award,
  ChartNoAxesCombined,
  Check,
  Crown,
  Diamond,
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
  correctMrIconAward,
  fetchMrIconAwards,
  fetchMrIconPeriodLeaderboard,
  finalizeMrIconAward,
  fetchPlayers,
  recalculateMrIconAward,
  fetchTeams,
  fetchTopScorers,
  fetchTopSaves,
  fetchTournamentStandings,
  fetchTournaments,
  type FixtureAppearance,
  type Fixture,
  type MrIconAward,
  type MrIconLeaderboardEntry,
  type MrIconPeriodLeaderboard,
  type MatchEvent,
  type Player,
  type ScorerRow,
  type StandingRow,
  type Team,
  type Tournament,
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
          <>
            <EmptyState message="No tournaments are available yet." />
            <MrIconAwardsSection tournaments={tournamentList} />
          </>
        ) : (
          <>
            <MrIconAwardsSection tournaments={tournamentList} />
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

function MrIconAwardsSection({ tournaments }: { tournaments: Tournament[] }) {
  const queryClient = useQueryClient();
  const awards = useQuery({ queryKey: ["mr-icon-awards"], queryFn: fetchMrIconAwards });
  const chronologicalTournaments = useMemo(
    () =>
      [...tournaments].sort(
        (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id),
      ),
    [tournaments],
  );
  const finalizedEditions = new Set((awards.data ?? []).map((award) => award.edition));
  const availableEditionCount = Math.ceil(chronologicalTournaments.length / 10);
  let currentEdition = 1;
  while (currentEdition <= availableEditionCount && finalizedEditions.has(currentEdition)) {
    currentEdition += 1;
  }
  if (currentEdition > availableEditionCount) {
    currentEdition = Math.floor(chronologicalTournaments.length / 10) + 1;
  }
  const currentPeriod = chronologicalTournaments.slice(
    (currentEdition - 1) * 10,
    currentEdition * 10,
  );
  const currentPeriodIds = currentPeriod.map((tournament) => tournament.id);
  const [chosenEdition, setChosenEdition] = useState<number | null>(null);
  const selectedEdition = chosenEdition ?? currentEdition;
  const [correctionPlayerId, setCorrectionPlayerId] = useState("");
  const [reason, setReason] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const award = (awards.data ?? []).find((item) => item.edition === selectedEdition);
  const periodFixtures = useQuery({
    queryKey: ["mr-icon-current-period-fixtures", currentEdition, currentPeriodIds.join(",")],
    queryFn: async () =>
      (
        await Promise.all(
          currentPeriod.map((tournament) => fetchFixtures(undefined, tournament.id)),
        )
      ).flat(),
    enabled: currentPeriod.length === 10,
  });
  const currentPeriodComplete =
    currentPeriod.length === 10 &&
    currentPeriod.every((tournament) => tournament.status === "completed") &&
    currentPeriod.every((tournament) => {
      const tournamentFixtures = (periodFixtures.data ?? []).filter(
        (fixture) => fixture.tournament_id === tournament.id,
      );
      return (
        tournamentFixtures.length > 0 &&
        tournamentFixtures.every(
          (fixture) =>
            fixture.status === "Full Time" &&
            fixture.home_score != null &&
            fixture.away_score != null,
        )
      );
    });
  const liveLeaderboard = useQuery({
    queryKey: ["mr-icon-leaderboard", selectedEdition],
    queryFn: () => fetchMrIconPeriodLeaderboard(selectedEdition),
    enabled: !award,
  });
  const leaderboard: MrIconLeaderboardEntry[] = award
    ? award.leaderboard
    : (liveLeaderboard.data?.leaderboard ?? []);
  const selectedCorrectionPlayerId =
    correctionPlayerId && leaderboard.some((entry) => entry.player_id === correctionPlayerId)
      ? correctionPlayerId
      : (award?.winning_player_id ?? "");
  const maxEdition = Math.max(currentEdition, ...(awards.data ?? []).map((item) => item.edition));
  const editions = Array.from({ length: maxEdition }, (_, index) => index + 1);

  const awardSaved = async () => {
    await queryClient.invalidateQueries({ queryKey: ["mr-icon-awards"] });
    setActionMessage("MR. ICON award updated successfully.");
  };
  const finalize = useMutation({
    mutationFn: () => finalizeMrIconAward(currentEdition),
    onSuccess: awardSaved,
  });
  const correct = useMutation({
    mutationFn: () => {
      if (!award) throw new Error("Select a finalized award to correct.");
      return correctMrIconAward(award.id, selectedCorrectionPlayerId, reason.trim());
    },
    onSuccess: awardSaved,
  });
  const recalculate = useMutation({
    mutationFn: () => {
      if (!award) throw new Error("Select a finalized award to recalculate.");
      return recalculateMrIconAward(award.id, reason.trim());
    },
    onSuccess: awardSaved,
  });
  const actionError = finalize.error ?? correct.error ?? recalculate.error;
  const migrationSetupMessage =
    "The MR. ICON database migration is not available in Supabase yet. Apply the project's Supabase migrations, then reload this page.";
  const displayMrIconError = (error: Error) =>
    /schema cache|could not find (the )?(table|function)|does not exist/i.test(error.message)
      ? migrationSetupMessage
      : error.message;

  return (
    <section aria-labelledby="mr-icon-heading" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="The 10-tournament crown"
          title="MR. ICON"
          icon={Diamond}
          id="mr-icon-heading"
        />
        <label className="flex w-full flex-col gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground sm:w-64">
          Inspect award edition
          <select
            aria-label="Inspect MR. ICON award edition"
            className="h-11 rounded-xl border border-sky-300/30 bg-card px-3 text-sm font-semibold normal-case tracking-normal text-foreground outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-300/20"
            value={selectedEdition}
            onChange={(event) => {
              setChosenEdition(Number(event.target.value));
              setActionMessage("");
            }}
          >
            {editions.map((edition) => (
              <option key={edition} value={edition} className="bg-card text-foreground">
                MR. ICON #{edition}
                {finalizedEditions.has(edition) ? " · Finalized" : " · Pending"}
              </option>
            ))}
          </select>
        </label>
      </div>
      {awards.isError && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          Unable to load MR. ICON history: {displayMrIconError(awards.error)}
        </p>
      )}

      <div className="relative overflow-hidden rounded-3xl border border-sky-200/20 bg-[radial-gradient(ellipse_at_top_right,rgba(186,230,253,0.17),transparent_45%),linear-gradient(135deg,#101827,#17253a_55%,#101827)] p-5 text-slate-100 shadow-2xl sm:p-8">
        <div
          aria-hidden="true"
          className="mr-icon-shimmer pointer-events-none absolute inset-0 opacity-35"
        />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3 text-sky-200">
              <Crown className="size-6" strokeWidth={1.5} />
              <p className="text-xs font-bold uppercase tracking-[0.24em]">MR. ICON</p>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Edition #{selectedEdition} <span className="px-1 text-slate-500">·</span>
              Tournaments {(selectedEdition - 1) * 10 + 1}–{selectedEdition * 10}
            </p>
            {award ? (
              <>
                <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200/80">
                  PLAYER
                </p>
                <h3 className="mt-1 break-words font-display text-4xl font-bold tracking-wide text-white sm:text-5xl">
                  {award.winner_player_name}
                </h3>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  TEAM
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {award.winner_team_name}
                </p>
                <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-sky-200/25 bg-sky-200/10 px-4 py-2 text-sm font-bold text-sky-100">
                  <Sparkles className="size-4" />
                  {award.overall_score.toLocaleString()} points
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ["Goals", award.statistics.goals],
                    ["Assists", award.statistics.assists],
                    ["Saves", award.statistics.saves],
                    ["Hat-tricks", award.statistics.hattricks],
                    ["Braces", award.statistics.braces],
                    ["Appearances", award.statistics.appearances],
                    ["Clean sheets", award.statistics.clean_sheets],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        {label}
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-white">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Finalized {new Date(award.finalized_at).toLocaleDateString()} ·{" "}
                  {award.formula_version}
                </p>
              </>
            ) : (
              <>
                <h3 className="mt-7 font-display text-3xl font-bold text-white sm:text-4xl">
                  Awaiting completion
                </h3>
                <p className="mt-2 text-sm text-slate-300">
                  {currentPeriod.length} of 10 tournaments are in this award period.
                  {currentEdition !== selectedEdition
                    ? ` Edition #${selectedEdition} is not available yet.`
                    : " The official title is awarded only after all ten tournaments and fixtures are complete."}
                </p>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
            <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
              Period score breakdown
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Goals ×4 · Assists ×3 · Saves ×1 · Hat-tricks ×2 · Braces ×1 · Appearances ×1 · Clean
              sheets ×2
            </p>
            {liveLeaderboard.isLoading ? (
              <p className="mt-5 text-sm text-slate-400">Calculating period leaderboard…</p>
            ) : liveLeaderboard.isError && !award ? (
              <p className="mt-5 text-sm text-rose-200" role="alert">
                Unable to calculate this period: {displayMrIconError(liveLeaderboard.error)}
              </p>
            ) : leaderboard.length > 0 ? (
              <div className="mt-4 max-h-72 space-y-2 overflow-auto">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.player_id}
                    className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl border border-white/5 bg-white/[0.035] px-3 py-2 transition-colors hover:bg-white/[0.08]"
                  >
                    <span className="text-sm font-bold text-sky-200">#{index + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {entry.player_name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {entry.team_name || "Team not recorded"} · {entry.goals} G · {entry.assists}{" "}
                        A · {entry.saves} SV · {entry.hattricks} H · {entry.braces} B ·{" "}
                        {entry.appearances} apps · {entry.clean_sheets} CS
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-sky-100">
                      {entry.overall_score}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-sm text-slate-400">
                No player records are available for this period yet.
              </p>
            )}
          </div>
        </div>

        <div className="relative mt-6 border-t border-white/10 pt-5">
          {periodFixtures.isError && selectedEdition === currentEdition && !award && (
            <p className="mb-3 text-sm text-rose-200" role="alert">
              Unable to verify tournament completion: {periodFixtures.error.message}
            </p>
          )}
          {!award && selectedEdition === currentEdition ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-300">
                {currentPeriodComplete
                  ? "All ten tournaments and their fixtures are complete. The award can be finalized."
                  : "Finalization unlocks when all ten tournaments and their fixtures are complete."}
              </p>
              <button
                type="button"
                disabled={!currentPeriodComplete || finalize.isPending}
                onClick={() => {
                  setActionMessage("");
                  finalize.mutate();
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-200 px-4 text-sm font-bold text-slate-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Check className="size-4" />
                {finalize.isPending ? "Finalizing…" : "Finalize MR. ICON"}
              </button>
            </div>
          ) : award ? (
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
              <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Correction winner
                <select
                  className="h-10 rounded-lg border border-white/15 bg-slate-900 px-3 text-sm font-medium normal-case tracking-normal text-white"
                  value={selectedCorrectionPlayerId}
                  onChange={(event) => setCorrectionPlayerId(event.target.value)}
                >
                  {leaderboard.map((entry) => (
                    <option key={entry.player_id} value={entry.player_id}>
                      {entry.player_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Audit reason
                <input
                  className="h-10 rounded-lg border border-white/15 bg-slate-900 px-3 text-sm font-medium normal-case tracking-normal text-white placeholder:text-slate-500"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Required for correction or recalculation"
                />
              </label>
              <button
                type="button"
                disabled={!reason.trim() || correct.isPending}
                onClick={() => {
                  setActionMessage("");
                  correct.mutate();
                }}
                className="mt-auto h-10 rounded-xl border border-sky-100/25 px-4 text-sm font-bold text-sky-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {correct.isPending ? "Saving…" : "Correct winner"}
              </button>
              <button
                type="button"
                disabled={!reason.trim() || recalculate.isPending}
                onClick={() => {
                  setActionMessage("");
                  recalculate.mutate();
                }}
                className="mt-auto h-10 rounded-xl border border-sky-100/25 px-4 text-sm font-bold text-sky-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {recalculate.isPending ? "Recalculating…" : "Recalculate"}
              </button>
            </div>
          ) : null}
          {actionMessage && (
            <p className="mt-3 text-sm text-emerald-200" role="status">
              {actionMessage}
            </p>
          )}
          {actionError && (
            <p className="mt-3 text-sm text-rose-200" role="alert">
              {displayMrIconError(actionError)}
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-foreground">
          THE MR. ICON LEGACY
        </h3>
        {(awards.data ?? []).length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...(awards.data ?? [])]
              .sort((a, b) => a.edition - b.edition)
              .map((history) => (
                <button
                  key={history.id}
                  type="button"
                  onClick={() => {
                    setChosenEdition(history.edition);
                    setActionMessage("");
                  }}
                  aria-pressed={selectedEdition === history.edition}
                  className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-300/50 ${
                    selectedEdition === history.edition
                      ? "border-sky-300/50 bg-sky-300/[0.08]"
                      : "border-border/70 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-200">
                      MR. ICON #{history.edition}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Tournaments {(history.edition - 1) * 10 + 1}–{history.edition * 10}
                    </span>
                  </div>
                  <p className="mt-3 font-display text-2xl font-bold text-foreground">
                    {history.winner_player_name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    TEAM: {history.winner_team_name}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {history.overall_score} points ·{" "}
                    {new Date(history.finalized_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No official MR. ICON editions have been finalized yet. The next award period is{" "}
            {currentPeriod.length} of 10 tournaments complete.
          </p>
        )}
      </div>
    </section>
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
