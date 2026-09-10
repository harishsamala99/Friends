import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, type CSSProperties } from "react";
import { Crown, Trophy, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { FinalFireworks } from "@/components/final-fireworks";
import { TeamBadge, ListSkeleton, EmptyState } from "@/components/football-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchFixtures,
  fetchStandings,
  fetchTeams,
  fetchTopScorers,
  fetchLatestTournament,
  type Team,
} from "@/lib/football";

interface Tournament {
  id?: string;
  tournamentName?: string;
  tournament_name?: string | null;
  type: string;
  date: string;
  homeTeam?: string;
  home_team?: string;
  awayTeam?: string;
  away_team?: string;
  homeScore?: number;
  home_score?: number;
  awayScore?: number;
  away_score?: number;
  winner: string;
  status?: "draft" | "completed";
  manager?: string | null;
  participants?: number | null;
  stats?: {
    topScorer: { name: string; goals: number };
    topAssister: { name: string; assists: number };
    topSaver: { name: string; saves: number };
  };
  top_scorer_name?: string | null;
  top_scorer_goals?: number | null;
  top_assister_name?: string | null;
  top_assister_assists?: number | null;
  top_saver_name?: string | null;
  top_saver_saves?: number | null;
}

const EMPTY_TOURNAMENT_STATS = {
  topScorer: { name: "None", goals: 0 },
  topAssister: { name: "None", assists: 0 },
  topSaver: { name: "None", saves: 0 },
};

function teamInitials(name?: string) {
  return (name || "Team")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function normalizeTournament(tournament: Tournament): Tournament {
  return {
    ...tournament,
    stats: {
      topScorer: tournament.stats?.topScorer ?? {
        name: tournament.top_scorer_name || EMPTY_TOURNAMENT_STATS.topScorer.name,
        goals: tournament.top_scorer_goals || 0,
      },
      topAssister: tournament.stats?.topAssister ?? {
        name: tournament.top_assister_name || EMPTY_TOURNAMENT_STATS.topAssister.name,
        assists: tournament.top_assister_assists || 0,
      },
      topSaver: tournament.stats?.topSaver ?? {
        name: tournament.top_saver_name || EMPTY_TOURNAMENT_STATS.topSaver.name,
        saves: tournament.top_saver_saves || 0,
      },
    },
  };
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FRIENDS LEAGUE — Fixtures, Results & Standings" },
      {
        name: "description",
        content:
          "Live football fixtures, results, league standings and top scorer rankings for the FRIENDS LEAGUE season.",
      },
      { property: "og:title", content: "FRIENDS LEAGUE — Fixtures, Results & Standings" },
      {
        property: "og:description",
        content: "Follow every matchday: fixtures, results, standings and top scorers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [latestTournament, setLatestTournament] = useState<Tournament | null>(null);
  const tournament = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => fetchLatestTournament(),
  });

  useEffect(() => {
    setLatestTournament(null);
    if (tournament.data) {
      const dbTournament = normalizeTournament({
        id: tournament.data.id,
        tournament_name: tournament.data.tournament_name,
        type: tournament.data.type,
        date: tournament.data.date,
        homeTeam: tournament.data.home_team,
        awayTeam: tournament.data.away_team,
        homeScore: tournament.data.home_score,
        awayScore: tournament.data.away_score,
        winner: tournament.data.winner,
        status: tournament.data.status,
        manager: tournament.data.manager,
        participants: tournament.data.participants,
        stats: {
          topScorer: {
            name: tournament.data.top_scorer_name || "None",
            goals: tournament.data.top_scorer_goals || 0,
          },
          topAssister: {
            name: tournament.data.top_assister_name || "None",
            assists: tournament.data.top_assister_assists || 0,
          },
          topSaver: {
            name: tournament.data.top_saver_name || "None",
            saves: tournament.data.top_saver_saves || 0,
          },
        },
      });
      setLatestTournament(dbTournament);
      return;
    }

    const saved = localStorage.getItem("tournaments");
    if (saved) {
      try {
        const tournaments: Tournament[] = JSON.parse(saved);
        if (tournaments.length > 0) {
          setLatestTournament(normalizeTournament(tournaments[0]));
        }
      } catch {
        setLatestTournament(null);
      }
    }
  }, [tournament.data]);

  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const fixtures = useQuery({ queryKey: ["fixtures"], queryFn: () => fetchFixtures() });
  const standings = useQuery({ queryKey: ["standings"], queryFn: () => fetchStandings() });
  const scorers = useQuery({ queryKey: ["scorers"], queryFn: () => fetchTopScorers() });

  const byId = new Map((teams.data ?? []).map((t: Team) => [t.id, t]));
  const all = fixtures.data ?? [];
  const scheduledFinal = all
    .filter(
      (fixture) =>
        fixture.tournament_id &&
        (!latestTournament?.id || fixture.tournament_id === latestTournament.id) &&
        (fixture.notes?.includes("completed league standings") ||
          fixture.notes?.includes("Final teams selected manually")) &&
        fixture.home_score == null &&
        fixture.away_score == null,
    )
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff))[0];
  const finalistRows = (standings.data ?? []).slice(0, 2);
  const hasFinalists = finalistRows.length === 2;
  const finalHomeName = scheduledFinal
    ? byId.get(scheduledFinal.home_team_id)?.name
    : latestTournament
      ? latestTournament.homeTeam
      : finalistRows[0]?.team_name;
  const finalAwayName = scheduledFinal
    ? byId.get(scheduledFinal.away_team_id)?.name
    : latestTournament
      ? latestTournament.awayTeam
      : finalistRows[1]?.team_name;
  const finalIsToBePlayed = Boolean(scheduledFinal || (!latestTournament && hasFinalists));
  const finalScoreRecorded = Boolean(
    latestTournament &&
    latestTournament.homeScore != null &&
    latestTournament.awayScore != null &&
    typeof latestTournament.homeScore === "number" &&
    typeof latestTournament.awayScore === "number",
  );
  const finalCompleted = Boolean(
    latestTournament &&
    latestTournament.status === "completed" &&
    finalScoreRecorded &&
    !finalIsToBePlayed &&
    latestTournament.winner &&
    latestTournament.winner !== "TBD",
  );
  const upcoming = all.filter((f) => f.status === "Scheduled").slice(0, 5);
  const recent = all
    .filter((f) => f.home_score != null)
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff))
    .slice(0, 5);

  return (
    <SiteLayout>
      <section className="matchday-grid border-b border-border/60 bg-linear-to-br from-primary/15 via-background to-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Season 2026/27
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-6xl">
            FRIENDS LEAGUE
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Every fixture, result, goal and league position — updated as matches are played.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/fixtures">View fixtures</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/standings">League table</Link>
            </Button>
          </div>
        </div>
      </section>

      {scheduledFinal && (
        <section className="border-b border-border/60 bg-accent/10 py-8 sm:py-10">
          <div className="mx-auto max-w-6xl px-4">
            <Card className="overflow-hidden border-2 border-accent/50 bg-card shadow-lg">
              <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-foreground">
                    Next final
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
                    Who is playing the final?
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    The league standings have selected the two finalists.
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center sm:min-w-90">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Team 1
                    </p>
                    <p className="mt-1 truncate font-display text-xl font-bold">
                      {byId.get(scheduledFinal.home_team_id)?.name ?? "Qualified team"}
                    </p>
                  </div>
                  <span className="font-display text-lg font-bold text-primary">VS</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Team 2
                    </p>
                    <p className="mt-1 truncate font-display text-xl font-bold">
                      {byId.get(scheduledFinal.away_team_id)?.name ?? "Qualified team"}
                    </p>
                  </div>
                </div>
                <Button asChild className="shrink-0">
                  <Link to="/scorecard">Add final score</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Final Match Section */}
      {(latestTournament || scheduledFinal || hasFinalists) && (
        <section className="relative overflow-hidden border-b border-border/60 bg-linear-to-br from-pitch via-pitch/95 to-[#173d35] py-10 sm:py-14">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_49.8%,currentColor_50%,transparent_50.2%),linear-gradient(currentColor_1px,transparent_1px)] bg-size-[50%_100%,100%_56px] opacity-20 text-pitch-foreground" />
          <div className="mx-auto max-w-6xl px-4">
            <div className="relative mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
              <div className="flex items-center gap-3 text-pitch-foreground">
                <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg">
                  <Trophy className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-pitch-foreground/70">
                    Matchday archive
                  </p>
                  <h2 className="font-display text-3xl font-bold sm:text-4xl">
                    Latest Final Match
                  </h2>
                </div>
              </div>
            </div>

            <Card className="latest-final-card relative isolate overflow-hidden border-0 bg-card shadow-2xl ring-1 ring-white/20">
              {finalCompleted && <FinalFireworks />}
              <CardContent className="relative z-10 p-0">
                <div className="latest-final-card__header border-b border-border/70 bg-linear-to-r from-primary/15 via-accent/10 to-transparent px-5 py-5 sm:px-8 sm:py-6">
                  <div className="flex items-center justify-between gap-4">
                    <p className="latest-final-card__eyebrow text-xs font-black uppercase tracking-[0.22em] text-primary">
                      Final of
                    </p>
                    <span className="latest-final-card__live-tag">
                      {finalIsToBePlayed ? "UPCOMING" : "RESULT"}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-display text-2xl font-bold text-card-foreground sm:text-3xl">
                    {latestTournament?.tournament_name ||
                      latestTournament?.tournamentName ||
                      latestTournament?.type ||
                      "League Final"}
                  </p>
                </div>

                <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
                  <div className="latest-final-card__score-stage p-5 sm:p-10">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
                      <div className="latest-final-card__team min-w-0 text-center">
                        <div className="latest-final-card__badge mx-auto grid size-16 place-items-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-lg shadow-primary/20 sm:size-20 sm:text-3xl">
                          {teamInitials(finalHomeName)}
                        </div>
                        <p className="mt-4 truncate font-display text-xl font-bold sm:text-2xl">
                          {finalHomeName || "Team 1"}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Team 1
                        </p>
                      </div>

                      <div className="latest-final-card__score text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                          {finalIsToBePlayed ? "TO BE PLAYED" : "Full time"}
                        </p>
                        <div className="latest-final-card__score-value mt-2 flex items-center gap-2 font-display text-5xl font-black tabular-nums text-primary drop-shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_35%,transparent)] dark:text-[#fff7e6] dark:drop-shadow-[0_0_18px_rgba(255,177,66,0.55)] sm:text-7xl sm:gap-3">
                          <span>
                            {finalIsToBePlayed ? "-" : (latestTournament?.homeScore ?? 0)}
                          </span>
                          <span className="text-2xl text-muted-foreground sm:text-3xl">:</span>
                          <span>
                            {finalIsToBePlayed ? "-" : (latestTournament?.awayScore ?? 0)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {finalIsToBePlayed ? "Awaiting final result" : "Final score"}
                        </p>
                      </div>

                      <div className="latest-final-card__team min-w-0 text-center">
                        <div className="latest-final-card__badge mx-auto grid size-16 place-items-center rounded-2xl bg-[#166b58] text-2xl font-black text-white shadow-lg shadow-[#166b58]/20 sm:size-20 sm:text-3xl">
                          {teamInitials(finalAwayName)}
                        </div>
                        <p className="mt-4 truncate font-display text-xl font-bold sm:text-2xl">
                          {finalAwayName || "Team 2"}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Team 2
                        </p>
                      </div>
                    </div>

                    <div className="latest-final-card__champion mt-8 flex items-center justify-center gap-2 rounded-xl bg-accent/20 px-4 py-3 text-center">
                      <Crown className="latest-final-card__champion-icon size-5 shrink-0" />
                      <span className="text-sm text-muted-foreground dark:text-[#fff0a8] dark:drop-shadow-[0_0_14px_rgba(255,214,102,0.8)]">
                        {finalIsToBePlayed ? "Status" : "Champion"}
                      </span>
                      <strong className="latest-final-card__champion-name truncate text-base font-black sm:text-lg">
                        {finalIsToBePlayed
                          ? "TO BE PLAYED"
                          : latestTournament?.winner || "Not recorded"}
                      </strong>
                    </div>
                  </div>

                  <div className="latest-final-card__rail border-t border-border/70 bg-muted/25 p-5 sm:p-8 lg:border-l lg:border-t-0">
                    {!finalIsToBePlayed && (
                      <div className="mb-4 grid gap-2 sm:grid-cols-2">
                        <div className="latest-final-card__award golden-award rounded-xl border border-[#D4AF37]/45 bg-[#D4AF37]/10 px-3 py-3 dark:shadow-[0_0_18px_rgba(255,214,102,0.35)]">
                          <div className="latest-final-card__award-heading flex items-center gap-2">
                            <Trophy className="latest-final-card__award-icon size-4 shrink-0" aria-hidden="true" />
                            <p className="text-[10px] font-black uppercase tracking-[0.16em]">
                              Golden Boot
                            </p>
                          </div>
                          <p className="latest-final-card__award-name mt-1 truncate text-sm font-bold">
                            {latestTournament?.stats.topScorer.name || "Not recorded"}
                          </p>
                          <p className="latest-final-card__award-value text-xs font-semibold">
                            {latestTournament?.stats.topScorer.goals ?? 0} goals
                          </p>
                        </div>
                        <div className="latest-final-card__award golden-award rounded-xl border border-[#D4AF37]/45 bg-[#D4AF37]/10 px-3 py-3">
                          <div className="latest-final-card__award-heading flex items-center gap-2">
                            <ShieldCheck className="latest-final-card__award-icon size-4 shrink-0" aria-hidden="true" />
                            <p className="text-[10px] font-black uppercase tracking-[0.16em]">
                              Golden Gloves
                            </p>
                          </div>
                          <p className="latest-final-card__award-name mt-1 truncate text-sm font-bold">
                            {latestTournament?.stats.topSaver.name || "Not recorded"}
                          </p>
                          <p className="latest-final-card__award-value text-xs font-semibold">
                            {latestTournament?.stats.topSaver.saves ?? 0} saves
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-1">
                      <div className="latest-final-card__stat latest-final-card__stat--gold rounded-xl border border-primary/25 bg-card p-3 text-center sm:p-4 lg:text-left">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {finalIsToBePlayed ? "Final status" : "Top scorer"}
                        </p>
                        <p className="latest-final-card__stat-name mt-1 truncate text-sm font-bold">
                          {finalIsToBePlayed
                            ? "TO BE PLAYED"
                            : latestTournament?.stats.topScorer.name}
                        </p>
                        <p className="latest-final-card__stat-value mt-1 font-display text-2xl font-black">
                          {finalIsToBePlayed ? "-" : latestTournament?.stats.topScorer.goals}
                        </p>
                        <p className="text-[10px] text-muted-foreground">goals</p>
                      </div>
                      <div className="latest-final-card__stat latest-final-card__stat--gold rounded-xl border border-accent/50 bg-card p-3 text-center sm:p-4 lg:text-left">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {finalIsToBePlayed ? "Next step" : "Top saver"}
                        </p>
                        <p className="latest-final-card__stat-name mt-1 truncate text-sm font-bold">
                          {finalIsToBePlayed ? "Add goals" : latestTournament?.stats.topSaver.name}
                        </p>
                        <p className="latest-final-card__stat-value mt-1 font-display text-2xl font-black">
                          {finalIsToBePlayed ? "-" : latestTournament?.stats.topSaver.saves}
                        </p>
                        <p className="text-[10px] text-muted-foreground">saves</p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border/70 pt-5 text-center lg:grid-cols-1 lg:gap-2 lg:text-left">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Format
                        </p>
                        <p className="truncate text-sm font-semibold">
                          {latestTournament?.type || "Final"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Manager
                        </p>
                        <p className="truncate text-sm font-semibold">
                          {latestTournament?.manager || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Players
                        </p>
                        <p className="text-sm font-semibold">
                          {latestTournament?.participants ?? "N/A"}
                        </p>
                      </div>
                    </div>

                    <Button asChild className="mt-5 w-full gap-2" variant="default">
                      <Link to="/final">
                        <Trophy className="size-4" />
                        View tournament history
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 font-display text-2xl font-bold">Upcoming fixtures</h2>
          {fixtures.isLoading ? (
            <ListSkeleton rows={4} />
          ) : upcoming.length === 0 ? (
            <EmptyState message="No upcoming fixtures scheduled." />
          ) : (
            <div className="space-y-3">
              {upcoming.map((f) => {
                const home = byId.get(f.home_team_id);
                const away = byId.get(f.away_team_id);
                return (
                  <Link key={f.id} to="/match/$fixtureId" params={{ fixtureId: f.id }}>
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex flex-1 items-center gap-2">
                          {home && <TeamBadge team={home} size={28} />}
                          <span className="truncate font-medium">{home?.name}</span>
                        </div>
                        <div className="flex flex-1 items-center justify-end gap-2">
                          <span className="truncate font-medium">{away?.name}</span>
                          {away && <TeamBadge team={away} size={28} />}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-display text-2xl font-bold">Latest results</h2>
          {fixtures.isLoading ? (
            <ListSkeleton rows={4} />
          ) : recent.length === 0 ? (
            <EmptyState message="No results yet." />
          ) : (
            <div className="space-y-3">
              {recent.map((f) => {
                const home = byId.get(f.home_team_id);
                const away = byId.get(f.away_team_id);
                return (
                  <Link key={f.id} to="/match/$fixtureId" params={{ fixtureId: f.id }}>
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex flex-1 items-center gap-2">
                          {home && <TeamBadge team={home} size={28} />}
                          <span className="truncate font-medium">{home?.name}</span>
                        </div>
                        <span className="shrink-0 rounded-md bg-secondary px-3 py-1 font-semibold tabular-nums">
                          {f.home_score} - {f.away_score}
                        </span>
                        <div className="flex flex-1 items-center justify-end gap-2">
                          <span className="truncate font-medium">{away?.name}</span>
                          {away && <TeamBadge team={away} size={28} />}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-display text-2xl font-bold">Table leaders</h2>
          {standings.isLoading ? (
            <ListSkeleton rows={5} />
          ) : (
            <Card>
              <CardContent className="p-0">
                {(standings.data ?? []).slice(0, 5).map((r, i) => (
                  <div
                    key={r.team_id}
                    className="flex items-center gap-3 border-b border-border/50 p-3 last:border-0"
                  >
                    <span className="w-5 text-center text-sm text-muted-foreground">{i + 1}</span>
                    <TeamBadge
                      team={{
                        name: r.team_name,
                        short_name: r.short_name,
                        crest_color: r.crest_color,
                        logo_url: r.logo_url,
                      }}
                      size={26}
                    />
                    <span className="flex-1 truncate font-medium">{r.team_name}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {r.played} PL
                    </span>
                    <span className="w-8 text-right font-semibold tabular-nums">{r.points}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-display text-2xl font-bold">Top scorers</h2>
          {scorers.isLoading ? (
            <ListSkeleton rows={5} />
          ) : (
            <Card>
              <CardContent className="p-0">
                {(scorers.data ?? []).slice(0, 5).map((s, i) => (
                  <div
                    key={s.player_id}
                    className="flex items-center gap-3 border-b border-border/50 p-3 last:border-0"
                  >
                    <span className="w-5 text-center text-sm text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 truncate font-medium">{s.player_name}</span>
                    <span className="truncate text-sm text-muted-foreground">{s.team_name}</span>
                    <span className="w-8 text-right font-semibold tabular-nums">{s.goals}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}
