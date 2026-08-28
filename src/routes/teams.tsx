import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, TeamBadge, ListSkeleton, EmptyState } from "@/components/football-ui";
import { Card, CardContent } from "@/components/ui/card";
import { fetchTeams, fetchPlayers } from "@/lib/football";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Teams — FRIENDS LEAGUE" },
      { name: "description", content: "All clubs in the competition with squads, stadiums and managers." },
      { property: "og:title", content: "Teams — FRIENDS LEAGUE" },
      { property: "og:description", content: "All clubs in the competition with squads and details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const players = useQuery({ queryKey: ["players"], queryFn: () => fetchPlayers() });

  const counts = new Map<string, number>();
  for (const p of players.data ?? []) {
    if (p.team_id) counts.set(p.team_id, (counts.get(p.team_id) ?? 0) + 1);
  }

  return (
    <SiteLayout>
      <PageHeader title="Teams" subtitle="Clubs competing this season." />
      <div className="mx-auto max-w-6xl px-4 py-10">
        {teams.isLoading ? (
          <ListSkeleton rows={6} />
        ) : (teams.data ?? []).length === 0 ? (
          <EmptyState message="No teams yet. Sign in and add your teams from the admin area." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(teams.data ?? []).map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: t.crest_color ?? "var(--primary)" }}
                />
                <CardContent className="flex items-start gap-4 p-5">
                  <TeamBadge team={t} size={48} />
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-xl font-bold">{t.name}</h2>
                    <p className="truncate text-sm text-muted-foreground">
                      {t.stadium ?? "Stadium TBD"}
                      {t.city ? ` · ${t.city}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.manager ? `Manager: ${t.manager}` : "Manager TBD"}
                    </p>
                    <p className="mt-2 text-xs font-medium text-primary">
                      {counts.get(t.id) ?? 0} players
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Manage teams in the{" "}
          <Link to="/admin" className="font-medium text-primary underline-offset-4 hover:underline">
            league editor
          </Link>
          .
        </p>
      </div>
    </SiteLayout>
  );
}
