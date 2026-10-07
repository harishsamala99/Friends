import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  ChartNoAxesCombined,
  Crown,
  Goal,
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
  fetchTopScorers,
  fetchTournamentStandings,
  fetchTournaments,
  type Fixture,
  type ScorerRow,
  type StandingRow,
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
  const standings = useQuery({
    queryKey: ["standings", tournamentId],
    queryFn: () => fetchTournamentStandings(tournamentId),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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
  const topPlaymaker = [...(scorers.data ?? [])].sort(
    (a, b) => b.assists - a.assists || b.goals - a.goals || a.matches - b.matches,
  )[0];
  const recordedPlaymakerName = tournament?.top_assister_name?.trim();
  const recordedPlaymakerAssists = tournament?.top_assister_assists ?? 0;
  const playmaker = topPlaymaker?.assists
    ? { player_name: topPlaymaker.player_name, team_name: topPlaymaker.team_name }
    : recordedPlaymakerName &&
        !["none", "tbd"].includes(recordedPlaymakerName.toLowerCase()) &&
        recordedPlaymakerAssists > 0
      ? { player_name: recordedPlaymakerName, team_name: "" }
      : undefined;
  const playmakerStat = topPlaymaker?.assists
    ? `${topPlaymaker.assists} assists`
    : playmaker
      ? `${recordedPlaymakerAssists} assists`
      : undefined;
  const topContribution = [...(scorers.data ?? [])].sort(
    (a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals,
  )[0];
  const mostValuablePlayer = [...(scorers.data ?? [])].sort(
    (a, b) =>
      contributionRate(b) - contributionRate(a) || b.goals + b.assists - (a.goals + a.assists),
  )[0];
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
    (Boolean(tournamentId) && (fixtures.isLoading || scorers.isLoading || standings.isLoading)) ||
    (tournamentList.length > 0 && !tournamentId);
  const hasError = tournaments.isError || fixtures.isError || scorers.isError || standings.isError;

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
                  icon={Sparkles}
                  title="Playmaker"
                  player={playmaker}
                  stat={playmakerStat}
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
