import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, ListSkeleton, EmptyState } from "@/components/football-ui";
import { fetchTopScorers } from "@/lib/football";
import { deletePlayerGoals } from "@/lib/football";
import { Button } from "@/components/ui/button";

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
  const queryClient = useQueryClient();
  const scorers = useQuery({ queryKey: ["scorers"], queryFn: () => fetchTopScorers() });
  const removeGoals = useMutation({
    mutationFn: deletePlayerGoals,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scorers"] });
      void queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
  });

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
                  <th className="p-3 text-right font-medium">Actions</th>
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
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete scorer goals"
                        aria-label={`Delete ${s.player_name} from top scorers`}
                        disabled={removeGoals.isPending}
                        onClick={() => {
                          if (window.confirm(`Remove all recorded goals for ${s.player_name}?`)) {
                            removeGoals.mutate(s.player_id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
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
