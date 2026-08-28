import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, ListSkeleton, EmptyState } from "@/components/football-ui";
import { fetchTopScorers } from "@/lib/football";

export const Route = createFileRoute("/scorers")({
  head: () => ({
    meta: [
      { title: "Top Scorers — FRIENDS LEAGUE" },
      { name: "description", content: "Golden boot race: goals, assists and appearances for every scorer." },
      { property: "og:title", content: "Top Scorers — FRIENDS LEAGUE" },
      { property: "og:description", content: "Golden boot race: goals, assists and appearances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScorersPage,
});

function ScorersPage() {
  const scorers = useQuery({ queryKey: ["scorers"], queryFn: () => fetchTopScorers() });

  return (
    <SiteLayout>
      <PageHeader title="Top Scorers" subtitle="Ranked by goals, then assists." />
      <div className="mx-auto max-w-4xl px-4 py-10">
        {scorers.isLoading ? (
          <ListSkeleton rows={10} />
        ) : (scorers.data ?? []).length === 0 ? (
          <EmptyState message="No goals recorded yet." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-3 text-left font-medium">#</th>
                  <th className="p-3 text-left font-medium">Player</th>
                  <th className="p-3 text-left font-medium">Team</th>
                  <th className="p-3 text-center font-medium">Apps</th>
                  <th className="p-3 text-center font-medium">Assists</th>
                  <th className="p-3 text-center font-medium">Goals</th>
                </tr>
              </thead>
              <tbody>
                {(scorers.data ?? []).map((s, i) => (
                  <tr key={s.player_id} className="border-t border-border/60">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3 font-medium">{s.player_name}</td>
                    <td className="p-3 text-muted-foreground">{s.team_name}</td>
                    <td className="p-3 text-center tabular-nums">{s.matches}</td>
                    <td className="p-3 text-center tabular-nums">{s.assists}</td>
                    <td className="p-3 text-center font-semibold tabular-nums">{s.goals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
