import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, TeamBadge, ListSkeleton, EmptyState, formatKickoff } from "@/components/football-ui";
import { Card, CardContent } from "@/components/ui/card";
import { fetchFixtures, fetchTeams, type Team } from "@/lib/football";

export const Route = createFileRoute("/fixtures")({
  head: () => ({
    meta: [
      { title: "Fixtures — FRIENDS LEAGUE" },
      { name: "description", content: "Full fixture list by matchday with kickoff times and venues." },
      { property: "og:title", content: "Fixtures — FRIENDS LEAGUE" },
      { property: "og:description", content: "Full fixture list by matchday with kickoff times and venues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FixturesPage,
});

function FixturesPage() {
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const fixtures = useQuery({ queryKey: ["fixtures"], queryFn: () => fetchFixtures() });
  const byId = new Map((teams.data ?? []).map((t: Team) => [t.id, t]));

  const upcoming = (fixtures.data ?? []).filter((f) => f.status !== "Full Time");
  const groups = new Map<number, typeof upcoming>();
  for (const f of upcoming) {
    const list = groups.get(f.matchday) ?? [];
    list.push(f);
    groups.set(f.matchday, list);
  }

  return (
    <SiteLayout>
      <PageHeader title="Fixtures" subtitle="Every scheduled match, grouped by matchday." />
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        {fixtures.isLoading ? (
          <ListSkeleton rows={8} />
        ) : groups.size === 0 ? (
          <EmptyState message="No fixtures scheduled." />
        ) : (
          [...groups.entries()].map(([matchday, list]) => (
            <section key={matchday}>
              <h2 className="mb-3 font-display text-xl font-bold">Matchday {matchday}</h2>
              <div className="space-y-3">
                {list.map((f) => {
                  const home = byId.get(f.home_team_id);
                  const away = byId.get(f.away_team_id);
                  return (
                    <Link key={f.id} to="/match/$fixtureId" params={{ fixtureId: f.id }}>
                      <Card className="transition-shadow hover:shadow-md">
                        <CardContent className="flex flex-wrap items-center gap-3 p-4">
                          <div className="flex flex-1 items-center gap-2">
                            {home && <TeamBadge team={home} size={30} />}
                            <span className="truncate font-medium">{home?.name}</span>
                          </div>
                          <div className="shrink-0 text-center text-xs text-muted-foreground">
                            <div>{formatKickoff(f.kickoff)}</div>
                            {f.venue && <div className="truncate">{f.venue}</div>}
                          </div>
                          <div className="flex flex-1 items-center justify-end gap-2">
                            <span className="truncate font-medium">{away?.name}</span>
                            {away && <TeamBadge team={away} size={30} />}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </SiteLayout>
  );
}
