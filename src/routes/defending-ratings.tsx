import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/football-ui";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import {
  deletePlayerTournamentDefensiveRatings,
  fetchAllFixturePlayerRatings,
  fetchFixtures,
  fetchPlayers,
  fetchTeams,
  fetchTournaments,
  type Tournament,
} from "@/lib/football";

export const Route = createFileRoute("/defending-ratings")({
  head: () => ({
    meta: [
      { title: "Defender Player Ratings — FRIENDS LEAGUE" },
      {
        name: "description",
        content: "Current tournament player ratings grouped by team.",
      },
    ],
  }),
  component: DefendingRatingsPage,
});

function DefendingRatingsPage() {
  const queryClient = useQueryClient();
  const [tournamentId, setTournamentId] = useState("");
  const tournamentsQuery = useQuery({
    queryKey: ["tournaments"],
    queryFn: fetchTournaments,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const playerRatingsQuery = useQuery({
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
  const tournamentList = useMemo(
    () => (Array.isArray(tournamentsQuery.data) ? tournamentsQuery.data : []) as Tournament[],
    [tournamentsQuery.data],
  );
  const currentTournament = tournamentList.find((tournament) => tournament.id === tournamentId);
  const fixturesQuery = useQuery({
    queryKey: ["fixtures", tournamentId],
    queryFn: () => fetchFixtures(undefined, tournamentId),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    const storedId = localStorage.getItem("current-tournament-id");
    const selectedId = tournamentList.some((tournament) => tournament.id === storedId)
      ? storedId
      : (tournamentList[0]?.id ?? "");
    setTournamentId(selectedId);
  }, [tournamentList]);
  const playerTotals = useMemo(() => {
    const fixtureIds = new Set((fixturesQuery.data ?? []).map((fixture) => fixture.id));
    const playerById = new Map((playersQuery.data ?? []).map((player) => [player.id, player]));
    const teamById = new Map((teamsQuery.data ?? []).map((team) => [team.id, team.name]));
    const totalsInTenths = new Map<string, number>();
    for (const rating of playerRatingsQuery.data ?? []) {
      if (!fixtureIds.has(rating.fixture_id)) continue;
      totalsInTenths.set(
        rating.player_id,
        (totalsInTenths.get(rating.player_id) ?? 0) + Math.round(rating.rating * 10),
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
      .sort(
        (a, b) =>
          (a.team_name === "—" ? 1 : 0) - (b.team_name === "—" ? 1 : 0) ||
          a.team_name.localeCompare(b.team_name) ||
          b.total_rating - a.total_rating ||
          a.name.localeCompare(b.name),
      );
  }, [fixturesQuery.data, playerRatingsQuery.data, playersQuery.data, teamsQuery.data]);
  const playersByTeam = useMemo(() => {
    const groups = new Map<
      string,
      { teamId: string; teamName: string; players: typeof playerTotals }
    >();
    for (const player of playerTotals) {
      const key = player.team_id ?? "unassigned";
      const group = groups.get(key);
      if (group) {
        group.players.push(player);
      } else {
        groups.set(key, {
          teamId: key,
          teamName: player.team_name === "—" ? "Unassigned players" : player.team_name,
          players: [player],
        });
      }
    }
    return [...groups.values()];
  }, [playerTotals]);
  const topDefenderId = playerTotals.reduce(
    (top, player) => (player.total_rating > (top?.total_rating ?? -Infinity) ? player : top),
    playerTotals[0],
  )?.id;
  const queryError =
    tournamentsQuery.error ??
    playerRatingsQuery.error ??
    playersQuery.error ??
    teamsQuery.error ??
    fixturesQuery.error;
  const isLoading =
    tournamentsQuery.isLoading ||
    playerRatingsQuery.isLoading ||
    playersQuery.isLoading ||
    teamsQuery.isLoading ||
    (Boolean(tournamentId) && fixturesQuery.isLoading);
  const deletePlayerRatings = useMutation({
    mutationFn: (playerId: string) =>
      deletePlayerTournamentDefensiveRatings(tournamentId, playerId),
    onSuccess: (_data, playerId) => {
      void queryClient.invalidateQueries({ queryKey: ["fixture-player-ratings"] });
      void queryClient.invalidateQueries({
        queryKey: ["tournament-team-defensive-ratings"],
      });
      const playerName = playerTotals.find((player) => player.id === playerId)?.name ?? "Player";
      toast.success(`${playerName}'s defender ratings deleted`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not delete player ratings");
    },
  });

  return (
    <SiteLayout>
      <PageHeader
        title="Defender Player Ratings"
        subtitle={`Player defensive ratings${currentTournament ? ` for ${currentTournament.tournament_name || currentTournament.type}` : " by tournament"}.`}
      />
      <div className="page-content mx-auto max-w-4xl space-y-10 px-4 py-10">
        {tournamentList.length > 0 && (
          <div className="tournament-switcher flex flex-wrap items-end gap-3">
            <label htmlFor="defending-ratings-tournament" className="text-sm font-medium">
              Tournament
            </label>
            <select
              id="defending-ratings-tournament"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={tournamentId}
              onChange={(event) => {
                setTournamentId(event.target.value);
                localStorage.setItem("current-tournament-id", event.target.value);
              }}
            >
              {tournamentList.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.tournament_name || tournament.type}
                </option>
              ))}
            </select>
          </div>
        )}
        {isLoading ? (
          <ListSkeleton rows={10} />
        ) : queryError ? (
          <EmptyState
            message={
              queryError instanceof Error
                ? queryError.message
                : "Unable to load defender ratings. Refresh the page and try again."
            }
          />
        ) : (
          <>
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold">
                  Player Ratings
                  {currentTournament
                    ? ` — ${currentTournament.tournament_name || currentTournament.type}`
                    : ""}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Total fixture ratings for players in the selected tournament.
                </p>
              </div>
              {playerTotals.length === 0 ? (
                <EmptyState message="No player ratings recorded for the selected tournament yet." />
              ) : (
                <div className="space-y-6">
                  {playersByTeam.map((group) => (
                    <section key={group.teamId} className="space-y-3">
                      <h3 className="font-display text-lg font-bold">{group.teamName}</h3>
                      <div className="data-table-wrap overflow-x-auto">
                        <table className="data-table w-full min-w-120 text-sm">
                          <thead>
                            <tr>
                              <th className="p-3 text-left font-medium">#</th>
                              <th className="p-3 text-left font-medium">Player</th>
                              <th className="p-3 text-left font-medium">Position</th>
                              <th className="p-3 text-right font-medium">Total Rating</th>
                              <th className="p-3 text-right font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.players.map((player, index) => (
                              <tr key={player.id} className="border-t border-border/60">
                                <td className="p-3 text-muted-foreground">{index + 1}</td>
                                <td className="p-3 font-medium">
                                  {player.name}
                                  {player.id === topDefenderId && (
                                    <span className="ml-2 text-xs font-semibold text-primary">
                                      Top defender
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-muted-foreground">{player.position}</td>
                                <td className="p-3 text-right font-semibold tabular-nums">
                                  {Number.isInteger(player.total_rating)
                                    ? player.total_rating
                                    : player.total_rating.toFixed(1)}
                                </td>
                                <td className="p-3 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Delete player ratings"
                                    aria-label={`Delete ${player.name}'s ratings`}
                                    disabled={deletePlayerRatings.isPending}
                                    onClick={() => {
                                      const tournamentName =
                                        currentTournament?.tournament_name ||
                                        currentTournament?.type ||
                                        "selected tournament";
                                      if (
                                        window.confirm(
                                          `Delete ${player.name}'s defender ratings from ${tournamentName}? The remaining team defensive rating will be recalculated.`,
                                        )
                                      ) {
                                        deletePlayerRatings.mutate(player.id);
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
                    </section>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
