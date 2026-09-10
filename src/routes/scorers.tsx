import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, ListSkeleton, EmptyState } from "@/components/football-ui";
import { fetchFixtures, fetchTopScorers, fetchTournaments, deletePlayerGoals, type Tournament } from "@/lib/football";
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
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const [tournamentId, setTournamentId] = useState("");
  const tournamentList: Tournament[] = Array.isArray(tournaments.data) ? tournaments.data : [];
  const selectedTournament = tournamentList.find((tournament) => tournament.id === tournamentId);
  const scorers = useQuery({
    queryKey: ["scorers", tournamentId],
    queryFn: () => fetchTopScorers(tournamentId),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const fixtures = useQuery({
    queryKey: ["fixtures", tournamentId],
    queryFn: () => fetchFixtures(undefined, tournamentId),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const totalGoals = (fixtures.data ?? [])
    .filter((fixture) => fixture.status === "Full Time" && fixture.home_score != null && fixture.away_score != null)
    .reduce((total, fixture) => total + (fixture.home_score ?? 0) + (fixture.away_score ?? 0), 0);
  const leadingGoals = Math.max(0, ...(scorers.data ?? []).map((scorer) => scorer.goals));

  useEffect(() => {
    const storedId = localStorage.getItem("current-tournament-id");
    const firstTournament = tournamentList[0];
    const selectedId = tournamentList.some((tournament) => tournament.id === storedId) ? storedId : firstTournament?.id ?? "";
    setTournamentId(selectedId);
  }, [tournamentList]);

  const removeGoals = useMutation({
    mutationFn: (playerId: string) => deletePlayerGoals(playerId, tournamentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scorers", tournamentId] });
      void queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
  });

  return (
    <SiteLayout>
      <PageHeader title="Top Scorers" subtitle={`Ranked by goals, then assists${selectedTournament ? ` in ${selectedTournament.tournament_name}` : ""}.`} />
      <div className="page-content mx-auto max-w-4xl px-4 py-10">
        {tournamentList.length > 0 && (
          <div className="tournament-switcher mb-6">
            <label htmlFor="scorers-tournament" className="text-sm font-medium">Tournament</label>
            <select
              id="scorers-tournament"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={tournamentId}
              onChange={(event) => {
                setTournamentId(event.target.value);
                localStorage.setItem("current-tournament-id", event.target.value);
              }}
            >
              {tournamentList.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>{tournament.tournament_name}</option>
              ))}
            </select>
          </div>
        )}
        {tournaments.isError ? (
          <EmptyState message="Unable to load tournaments. Refresh the page and try again." />
        ) : scorers.isError ? (
          <EmptyState message="Unable to load scorer statistics. Try returning to the page." />
        ) : scorers.isLoading ? (
          <ListSkeleton rows={10} />
        ) : (scorers.data ?? []).length === 0 ? (
          <EmptyState message="No goals recorded yet." />
        ) : (
          <div className="space-y-4">
            <div className="leaderboard-summary">
              <span className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Tournament goals</span>
              <span className="font-display text-3xl font-bold tabular-nums text-primary">{totalGoals}</span>
            </div>
            <div className="data-table-wrap overflow-x-auto">
              <table className="data-table w-full min-w-140 text-sm">
              <thead>
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
                    <td className="p-3 text-muted-foreground"><span className={`rank-badge ${i === 0 ? "rank-badge--gold" : ""}`}>{i + 1}</span></td>
                    <td className={`p-3 ${s.goals === leadingGoals ? "font-bold text-primary" : "font-medium"}`}>
                      {s.player_name}
                    </td>
                    <td className="p-3 text-muted-foreground">{s.team_name}</td>
                    <td className="p-3 text-center tabular-nums">{s.matches}</td>
                    <td className="p-3 text-center tabular-nums">{s.assists}</td>
                    <td className={`p-3 text-center tabular-nums ${s.goals === leadingGoals ? "font-bold text-primary" : "font-semibold"}`}>{s.goals}</td>
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
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
