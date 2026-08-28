import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { TeamBadge, ListSkeleton, EmptyState, formatKickoff } from "@/components/football-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchFixtures,
  fetchStandings,
  fetchTeams,
  fetchTopScorers,
  type Team,
} from "@/lib/football";

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
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatKickoff(f.kickoff)}
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
