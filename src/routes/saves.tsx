import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, ListSkeleton, EmptyState } from "@/components/football-ui";
import { fetchTopSaves } from "@/lib/football";
import { deletePlayerSaves } from "@/lib/football";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/saves")({
  head: () => ({
    meta: [
      { title: "Top Saves — FRIENDS LEAGUE" },
      { name: "description", content: "Golden gloves race: saves and clean sheets for every goalkeeper." },
      { property: "og:title", content: "Top Saves — FRIENDS LEAGUE" },
      { property: "og:description", content: "Golden gloves race: saves, clean sheets and goalkeeper stats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SavesPage,
});

function SavesPage() {
  const queryClient = useQueryClient();
  const saves = useQuery({ queryKey: ["saves"], queryFn: () => fetchTopSaves() });
  const removeSaves = useMutation({
    mutationFn: deletePlayerSaves,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saves"] });
      void queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
  });

  return (
    <SiteLayout>
      <PageHeader title="Top Saves" subtitle="Ranked by saves, then clean sheets." />
      <div className="mx-auto max-w-4xl px-4 py-10">
        {saves.isLoading ? (
          <ListSkeleton rows={10} />
        ) : (saves.data ?? []).length === 0 ? (
          <EmptyState message="No saves recorded yet." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-140 text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-3 text-left font-medium">#</th>
                  <th className="p-3 text-left font-medium">Player</th>
                  <th className="p-3 text-left font-medium">Team</th>
                  <th className="p-3 text-center font-medium">Apps</th>
                  <th className="p-3 text-center font-medium">Clean Sheets</th>
                  <th className="p-3 text-center font-medium">Saves</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(saves.data ?? []).map((s, i) => (
                  <tr key={s.player_id} className="border-t border-border/60">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3 font-medium">{s.player_name}</td>
                    <td className="p-3 text-muted-foreground">{s.team_name}</td>
                    <td className="p-3 text-center tabular-nums">{s.matches}</td>
                    <td className="p-3 text-center tabular-nums">{s.clean_sheets}</td>
                    <td className="p-3 text-center font-semibold tabular-nums">{s.saves}</td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete goalkeeper saves"
                        aria-label={`Delete ${s.player_name} from top saves`}
                        disabled={removeSaves.isPending}
                        onClick={() => {
                          if (window.confirm(`Remove all recorded saves for ${s.player_name}?`)) {
                            removeSaves.mutate(s.player_id);
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
