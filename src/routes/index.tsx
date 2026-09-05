import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Crown, Trophy } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { TeamBadge, ListSkeleton, EmptyState, formatKickoff } from "@/components/football-ui";
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
    // First try to fetch from database
    if (tournament.data) {
      const dbTournament: Tournament = {
        id: tournament.data.id,
        tournament_name: tournament.data.tournament_name,
        type: tournament.data.type,
        date: tournament.data.date,
        homeTeam: tournament.data.home_team,
        awayTeam: tournament.data.away_team,
        homeScore: tournament.data.home_score,
        awayScore: tournament.data.away_score,
        winner: tournament.data.winner,
        manager: tournament.data.manager,
        participants: tournament.data.participants,
        stats: {
          topScorer: { name: tournament.data.top_scorer_name || "None", goals: tournament.data.top_scorer_goals || 0 },
          topAssister: { name: tournament.data.top_assister_name || "None", assists: tournament.data.top_assister_assists || 0 },
          topSaver: { name: tournament.data.top_saver_name || "None", saves: tournament.data.top_saver_saves || 0 },
        },
      };
      setLatestTournament(dbTournament);
      return;
    }

    // Fallback to localStorage if no database record
    const saved = localStorage.getItem("tournaments");
    if (saved) {
      try {
        const tournaments: Tournament[] = JSON.parse(saved);
        if (tournaments.length > 0) {
          setLatestTournament(tournaments[0]);
        }
      } catch (e) {
        console.error("Failed to load tournaments", e);
      }
    }
  }, [tournament.data]);

  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const fixtures = useQuery({ queryKey: ["fixtures"], queryFn: () => fetchFixtures() });
  const standings = useQuery({ queryKey: ["standings"], queryFn: () => fetchStandings() });
  const scorers = useQuery({ queryKey: ["scorers"], queryFn: () => fetchTopScorers() });

  const byId = new Map((teams.data ?? []).map((t: Team) => [t.id, t]));
  const all = fixtures.data ?? [];
  const upcoming = all.filter((f) => f.status === "Scheduled").slice(0, 5);
  const recent = all
    .filter((f) => f.home_score != null)
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff))
    .slice(0, 5);

  return (
    <SiteLayout>
      <section className="matchday-grid border-b border-border/60 bg-gradient-to-br from-primary/15 via-background to-background">
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

      {/* Final Match Section */}
      {latestTournament && (
        <section className="border-b border-border/60 bg-gradient-to-r from-pitch via-pitch/95 to-pitch/90 py-12">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-8 flex items-center gap-3">
              <Trophy className="h-8 w-8 text-pitch-foreground" />
              <h2 className="font-display text-3xl font-bold text-pitch-foreground">Latest Final Match</h2>
            </div>

            <Card className="border-3 border-pitch-foreground/30 bg-gradient-to-br from-card/98 via-card/96 to-card/94 shadow-2xl">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-6 rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-sm font-semibold text-muted-foreground">Final of</p>
                  <p className="text-xl font-bold text-primary">
                    {latestTournament.tournament_name || latestTournament.tournamentName || latestTournament.type}
                  </p>
                </div>
                <div className="grid gap-8 md:grid-cols-2">
                  {/* Match Score Display */}
                  <div className="flex flex-col justify-between">
                    <div className="space-y-6">
                      {/* Home Team */}
                      <div className="text-center sm:text-left">
                        <p className="text-sm font-semibold text-muted-foreground mb-2">Home Team</p>
                        <p className="text-2xl font-bold text-card-foreground">{latestTournament.homeTeam}</p>
                      </div>

                      {/* Score Display */}
                      <div className="flex items-center justify-center sm:justify-start gap-6">
                        <div className="flex flex-col items-center">
                          <div className="text-5xl font-display font-black text-primary">
                            {latestTournament.homeScore}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Goals</p>
                        </div>
                        <div className="text-2xl font-bold text-muted-foreground">—</div>
                        <div className="flex flex-col items-center">
                          <div className="text-5xl font-display font-black text-primary">
                            {latestTournament.awayScore}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Goals</p>
                        </div>
                      </div>

                      {/* Away Team */}
                      <div className="text-center sm:text-left">
                        <p className="text-sm font-semibold text-muted-foreground mb-2">Away Team</p>
                        <p className="text-2xl font-bold text-card-foreground">{latestTournament.awayTeam}</p>
                      </div>
                    </div>
                  </div>

                  {/* Match Details */}
                  <div className="space-y-6 border-t pt-6 md:border-t-0 md:border-l md:pl-6 md:pt-0">
                    {/* Winner */}
                    <div className="rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 p-4 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="h-5 w-5 text-primary" />
                        <p className="text-sm font-semibold text-muted-foreground">Winner</p>
                      </div>
                      <p className="text-2xl font-bold text-primary">{latestTournament.winner}</p>
                    </div>

                    {/* Tournament Info */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Tournament Type</p>
                        <p className="font-medium text-card-foreground">{latestTournament.type}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Winning Manager</p>
                        <p className="font-medium text-card-foreground">{latestTournament.manager || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Participants</p>
                        <p className="font-medium text-card-foreground">{latestTournament.participants}</p>
                      </div>
                    </div>

                    {/* Top Stats */}
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/50">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">⚽ Top Scorer</p>
                        <p className="font-semibold text-sm truncate">{latestTournament.stats.topScorer.name}</p>
                        <p className="text-lg font-bold text-primary">{latestTournament.stats.topScorer.goals}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">🎯 Top Assister</p>
                        <p className="font-semibold text-sm truncate">{latestTournament.stats.topAssister.name}</p>
                        <p className="text-lg font-bold text-secondary">{latestTournament.stats.topAssister.assists}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">🥅 Top Saver</p>
                        <p className="font-semibold text-sm truncate">{latestTournament.stats.topSaver.name}</p>
                        <p className="text-lg font-bold text-accent">{latestTournament.stats.topSaver.saves}</p>
                      </div>
                    </div>

                    {/* View Details Button */}
                    <Button asChild className="w-full gap-2" variant="default">
                      <Link to="/final">
                        <Trophy className="h-4 w-4" />
                        View All Tournaments
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
                  <div key={r.team_id} className="flex items-center gap-3 border-b border-border/50 p-3 last:border-0">
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
                    <span className="text-sm text-muted-foreground tabular-nums">{r.played} PL</span>
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
                  <div key={s.player_id} className="flex items-center gap-3 border-b border-border/50 p-3 last:border-0">
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
