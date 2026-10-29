import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/football-ui";
import { SiteLayout } from "@/components/SiteLayout";
import { fetchAllFixturePlayerRatings, fetchPlayers, fetchTeams } from "@/lib/football";

export const Route = createFileRoute("/defending-ratings")({
  head: () => ({
    meta: [
      { title: "Defender Player Ratings — FRIENDS LEAGUE" },
      {
        name: "description",
        content: "Total fixture ratings for players, with their positions and teams.",
      },
    ],
  }),
  component: DefendingRatingsPage,
});

function DefendingRatingsPage() {
  const ratings = useQuery({
    queryKey: ["fixture-player-ratings"],
    queryFn: fetchAllFixturePlayerRatings,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const playersQuery = useQuery({
    queryKey: ["players"],
    queryFn: () => fetchPlayers(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeams(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const playerTotals = useMemo(() => {
    const playerById = new Map((playersQuery.data ?? []).map((player) => [player.id, player]));
    const teamById = new Map((teamsQuery.data ?? []).map((team) => [team.id, team.name]));
    const totalsInTenths = new Map<string, number>();
    for (const matchRating of ratings.data ?? []) {
      totalsInTenths.set(
        matchRating.player_id,
        (totalsInTenths.get(matchRating.player_id) ?? 0) + Math.round(matchRating.rating * 10),
      );
    }

    return [...totalsInTenths.entries()]
      .flatMap(([playerId, tenths]) => {
        const player = playerById.get(playerId);
        return player
          ? [
              {
                ...player,
                team_name: player.team_id ? (teamById.get(player.team_id) ?? "—") : "—",
                total_rating: tenths / 10,
              },
            ]
          : [];
      })
      .sort((a, b) => b.total_rating - a.total_rating || a.name.localeCompare(b.name));
  }, [playersQuery.data, ratings.data, teamsQuery.data]);
  const queryError = ratings.error ?? playersQuery.error ?? teamsQuery.error;
  const isLoading = ratings.isLoading || playersQuery.isLoading || teamsQuery.isLoading;

  return (
    <SiteLayout>
      <PageHeader
        title="Defender Player Ratings"
        subtitle="Total fixture ratings for each player, with their position and team."
      />
      <div className="page-content mx-auto max-w-4xl px-4 py-10">
        {isLoading ? (
          <ListSkeleton rows={10} />
        ) : queryError ? (
          <EmptyState
            message={
              queryError instanceof Error
                ? queryError.message
                : "Unable to load defender player ratings. Refresh the page and try again."
            }
          />
        ) : playerTotals.length === 0 ? (
          <EmptyState message="No defender player ratings recorded yet." />
        ) : (
          <div className="data-table-wrap overflow-x-auto">
            <table className="data-table w-full min-w-140 text-sm">
              <thead>
                <tr>
                  <th className="p-3 text-left font-medium">Player</th>
                  <th className="p-3 text-left font-medium">Position</th>
                  <th className="p-3 text-left font-medium">Team</th>
                  <th className="p-3 text-right font-medium">Total Rating</th>
                </tr>
              </thead>
              <tbody>
                {playerTotals.map((player) => (
                  <tr key={player.id} className="border-t border-border/60">
                    <td className="p-3 font-medium">{player.name}</td>
                    <td className="p-3 text-muted-foreground">{player.position}</td>
                    <td className="p-3 text-muted-foreground">{player.team_name}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">
                      {Number.isInteger(player.total_rating)
                        ? player.total_rating
                        : player.total_rating.toFixed(1)}
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
