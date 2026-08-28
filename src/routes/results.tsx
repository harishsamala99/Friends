import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, TeamBadge, ListSkeleton, EmptyState, formatKickoff } from "@/components/football-ui";
import { Card, CardContent } from "@/components/ui/card";
import { fetchFixtures, fetchTeams, type Team } from "@/lib/football";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results — FRIENDS LEAGUE" },
      { name: "description", content: "Final scores from every completed FRIENDS LEAGUE match." },
      { property: "og:title", content: "Results — FRIENDS LEAGUE" },
      { property: "og:description", content: "Final scores from every completed match this season." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const fixtures = useQuery({ queryKey: ["fixtures"], queryFn: () => fetchFixtures() });
  const byId = new Map((teams.data ?? []).map((t: Team) => [t.id, t]));

  const played = (fixtures.data ?? [])
    .filter((f) => f.home_score != null)
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff));

  return (
    <SiteLayout>
      <PageHeader title="Results" subtitle="Completed matches with final scores." />
      <div className="mx-auto max-w-4xl px-4 py-10">
        {fixtures.isLoading ? (
          <ListSkeleton rows={8} />
        ) : played.length === 0 ? (
          <EmptyState message="No matches have been played yet." />
        ) : (
          <div className="space-y-3">
            {played.map((f) => {
              const home = byId.get(f.home_team_id);
              const away = byId.get(f.away_team_id);
              return (
                <Link key={f.id} to="/match/$fixtureId" params={{ fixtureId: f.id }}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex flex-1 items-center gap-2">
                        {home && <TeamBadge team={home} size={30} />}
                        <span className="truncate font-medium">{home?.name}</span>
                      </div>
                      <div className="shrink-0 text-center">
                        <div className="rounded-md bg-secondary px-3 py-1 font-semibold tabular-nums">
                          {f.home_score} - {f.away_score}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {formatKickoff(f.kickoff)}
                        </div>
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
        )}
      </div>
    </SiteLayout>
  );
}
