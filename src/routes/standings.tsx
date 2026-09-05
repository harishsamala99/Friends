import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, TeamBadge, ListSkeleton, EmptyState } from "@/components/football-ui";
import { fetchCompetitions, fetchTournamentStandings, fetchTournaments, type Tournament } from "@/lib/football";

export const Route = createFileRoute("/standings")({
  head: () => ({
    meta: [
      { title: "League Table — FRIENDS LEAGUE" },
      { name: "description", content: "Live league standings: played, won, drawn, lost, goal difference and points." },
      { property: "og:title", content: "League Table — FRIENDS LEAGUE" },
      { property: "og:description", content: "Auto-calculated standings for the FRIENDS LEAGUE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StandingsPage,
});

function StandingsPage() {
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const competitions = useQuery({ queryKey: ["competitions"], queryFn: fetchCompetitions });
  const [tournamentId, setTournamentId] = useState("");
  const tournamentList: Tournament[] = Array.isArray(tournaments.data) ? tournaments.data : [];
  const standings = useQuery({
    queryKey: ["standings", tournamentId, competitions.data?.[0]?.id],
    queryFn: () => fetchTournamentStandings(tournamentId, competitions.data?.[0]?.id),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const storedId = localStorage.getItem("current-tournament-id");
    const firstTournament = tournamentList[0];
    const selectedId = tournamentList.some((tournament) => tournament.id === storedId) ? storedId : firstTournament?.id ?? "";
    setTournamentId(selectedId);
  }, [tournamentList]);

  const selectedTournament = tournamentList.find((tournament) => tournament.id === tournamentId);

  return (
    <SiteLayout>
      <PageHeader
        title={selectedTournament?.tournament_name ?? "League Table"}
        subtitle="Standings update automatically from recorded results."
      />
      <div className="mx-auto max-w-5xl px-4 py-10">
        {tournamentList.length > 0 && (
          <div className="mb-6 flex items-center gap-3">
            <label htmlFor="standings-tournament" className="text-sm font-medium">Tournament</label>
            <select
              id="standings-tournament"
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
        ) : standings.isLoading ? (
          <ListSkeleton rows={10} />
        ) : (standings.data ?? []).length === 0 ? (
          <EmptyState message="No standings available yet." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-3 text-left font-medium">#</th>
                  <th className="p-3 text-left font-medium">Team</th>
                  <th className="p-3 text-center font-medium">P</th>
                  <th className="p-3 text-center font-medium">W</th>
                  <th className="p-3 text-center font-medium">D</th>
                  <th className="p-3 text-center font-medium">L</th>
                  <th className="p-3 text-center font-medium">GF</th>
                  <th className="p-3 text-center font-medium">GA</th>
                  <th className="p-3 text-center font-medium">GD</th>
                  <th className="p-3 text-center font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {(standings.data ?? []).map((r, i) => (
                  <tr key={r.team_id} className="border-t border-border/60">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <TeamBadge
                          team={{
                            name: r.team_name,
                            short_name: r.short_name,
                            crest_color: r.crest_color,
                            logo_url: r.logo_url,
                          }}
                          size={26}
                        />
                        <span className="font-medium">{r.team_name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center tabular-nums">{r.played}</td>
                    <td className="p-3 text-center tabular-nums">{r.won}</td>
                    <td className="p-3 text-center tabular-nums">{r.drawn}</td>
                    <td className="p-3 text-center tabular-nums">{r.lost}</td>
                    <td className="p-3 text-center tabular-nums">{r.goals_for}</td>
                    <td className="p-3 text-center tabular-nums">{r.goals_against}</td>
                    <td className="p-3 text-center tabular-nums">{r.goal_difference}</td>
                    <td className="p-3 text-center font-semibold tabular-nums">{r.points}</td>
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
