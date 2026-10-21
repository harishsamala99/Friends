import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, ListSkeleton, EmptyState } from "@/components/football-ui";
import {
  fetchFixtures,
  fetchAllFixtureAppearances,
  fetchTopSaves,
  fetchTournaments,
  deletePlayerSaves,
  fetchPlayers,
  fetchTeams,
  type Tournament,
  type SavesRow,
} from "@/lib/football";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/saves")({
  head: () => ({
    meta: [
      { title: "Top Saves — FRIENDS LEAGUE" },
      {
        name: "description",
        content: "Golden gloves race: saves for every goalkeeper.",
      },
      { property: "og:title", content: "Top Saves — FRIENDS LEAGUE" },
      {
        property: "og:description",
        content: "Golden gloves race: saves for every goalkeeper.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SavesPage,
});

function SavesPage() {
  const queryClient = useQueryClient();
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const [tournamentId, setTournamentId] = useState("");
  const tournamentList: Tournament[] = Array.isArray(tournaments.data) ? tournaments.data : [];
  const selectedTournament = tournamentList.find((tournament) => tournament.id === tournamentId);
  const saves = useQuery({
    queryKey: ["saves", tournamentId],
    queryFn: () => fetchTopSaves(tournamentId),
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
  const appearances = useQuery({
    queryKey: ["appearances", tournamentId],
    queryFn: fetchAllFixtureAppearances,
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const players = useQuery({
    queryKey: ["players"],
    queryFn: () => fetchPlayers(),
    enabled: Boolean(tournamentId),
  });
  const teams = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeams(),
    enabled: Boolean(tournamentId),
  });
  const cleanSheetsByGoalkeeper = useMemo(() => {
    const fixturesById = new Map((fixtures.data ?? []).map((fixture) => [fixture.id, fixture]));
    const playersById = new Map((players.data ?? []).map((player) => [player.id, player]));
    const countedAppearances = new Set<string>();
    const cleanSheets = new Map<string, number>();

    for (const appearance of appearances.data ?? []) {
      const fixture = fixturesById.get(appearance.fixture_id);
      const player = playersById.get(appearance.player_id);
      const goalkeeperKey = `${appearance.player_id}:${appearance.team_id}`;
      if (
        !fixture ||
        !player ||
        (player.position.trim().toLowerCase() !== "gk" &&
          !player.position.trim().toLowerCase().includes("goalkeeper")) ||
        fixture.status !== "Full Time" ||
        fixture.home_score == null ||
        fixture.away_score == null ||
        (appearance.team_id !== fixture.home_team_id && appearance.team_id !== fixture.away_team_id)
      ) {
        continue;
      }

      const appearanceKey = `${fixture.id}:${goalkeeperKey}`;
      if (countedAppearances.has(appearanceKey)) continue;
      countedAppearances.add(appearanceKey);
      const conceded =
        appearance.team_id === fixture.home_team_id ? fixture.away_score : fixture.home_score;
      if (conceded === 0) {
        cleanSheets.set(goalkeeperKey, (cleanSheets.get(goalkeeperKey) ?? 0) + 1);
      }
    }

    return cleanSheets;
  }, [appearances.data, fixtures.data, players.data]);
  const goalkeeperRows = useMemo(() => {
    const rows = new Map<string, SavesRow>();
    const teamsById = new Map((teams.data ?? []).map((team) => [team.id, team]));

    for (const saveRow of saves.data ?? []) {
      const key = `${saveRow.player_id}:${saveRow.team_id}`;
      rows.set(key, {
        ...saveRow,
        clean_sheets: Math.max(cleanSheetsByGoalkeeper.get(key) ?? 0, saveRow.clean_sheets),
      });
    }

    for (const [key, cleanSheets] of cleanSheetsByGoalkeeper) {
      if (rows.has(key)) continue;
      const [playerId, teamId] = key.split(":");
      const player = players.data?.find((item) => item.id === playerId);
      const team = teamsById.get(teamId);
      if (!player || !team) continue;

      rows.set(key, {
        player_id: player.id,
        player_name: player.name,
        position: player.position,
        photo_url: player.photo_url,
        jersey_number: player.jersey_number,
        team_id: team.id,
        team_name: team.name,
        short_name: team.short_name,
        crest_color: team.crest_color,
        competition_id: team.competition_id,
        tournament_id: tournamentId,
        saves: 0,
        clean_sheets: cleanSheets,
        matches: 0,
      });
    }

    return [...rows.values()].sort(
      (left, right) =>
        right.saves - left.saves ||
        right.clean_sheets - left.clean_sheets ||
        right.matches - left.matches,
    );
  }, [cleanSheetsByGoalkeeper, players.data, saves.data, teams.data, tournamentId]);
  const leadingSaves = Math.max(0, ...goalkeeperRows.map((player) => player.saves));

  useEffect(() => {
    const storedId = localStorage.getItem("current-tournament-id");
    const firstTournament = tournamentList[0];
    const selectedId = tournamentList.some((tournament) => tournament.id === storedId)
      ? storedId
      : (firstTournament?.id ?? "");
    setTournamentId(selectedId);
  }, [tournamentList]);

  const removeSaves = useMutation({
    mutationFn: (playerId: string) => deletePlayerSaves(playerId, tournamentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saves", tournamentId] });
      void queryClient.invalidateQueries({ queryKey: ["standings"] });
      void queryClient.invalidateQueries({ queryKey: ["mr-icon-match-ratings"] });
      void queryClient.invalidateQueries({ queryKey: ["mr-icon-review-flags"] });
    },
  });

  return (
    <SiteLayout>
      <PageHeader
        title="Top Saves"
        subtitle={`Ranked by saves${selectedTournament ? ` in ${selectedTournament.tournament_name}` : ""}.`}
      />
      <div className="page-content mx-auto max-w-4xl px-4 py-10">
        {tournamentList.length > 0 && (
          <div className="tournament-switcher mb-6">
            <label htmlFor="saves-tournament" className="text-sm font-medium">
              Tournament
            </label>
            <select
              id="saves-tournament"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={tournamentId}
              onChange={(event) => {
                setTournamentId(event.target.value);
                localStorage.setItem("current-tournament-id", event.target.value);
              }}
            >
              {tournamentList.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.tournament_name}
                </option>
              ))}
            </select>
          </div>
        )}
        {tournaments.isError ? (
          <EmptyState message="Unable to load tournaments. Refresh the page and try again." />
        ) : saves.isError ? (
          <EmptyState message="Unable to load save statistics. Try returning to the page." />
        ) : fixtures.isError || appearances.isError || players.isError || teams.isError ? (
          <EmptyState message="Unable to load goalkeeper appearance statistics. Try returning to the page." />
        ) : saves.isLoading ? (
          <ListSkeleton rows={10} />
        ) : fixtures.isLoading || appearances.isLoading || players.isLoading || teams.isLoading ? (
          <ListSkeleton rows={10} />
        ) : goalkeeperRows.length === 0 ? (
          <EmptyState message="No saves recorded yet." />
        ) : (
          <div className="data-table-wrap overflow-x-auto">
            <table className="data-table w-full min-w-140 text-sm">
              <thead>
                <tr>
                  <th className="p-3 text-left font-medium">#</th>
                  <th className="p-3 text-left font-medium">Player</th>
                  <th className="p-3 text-left font-medium">Team</th>
                  <th className="p-3 text-center font-medium">Saves</th>
                  <th className="p-3 text-center font-medium">Clean Sheets</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {goalkeeperRows.map((s, i) => (
                  <tr key={`${s.player_id}:${s.team_id}`} className="border-t border-border/60">
                    <td className="p-3 text-muted-foreground">
                      <span className={`rank-badge ${i === 0 ? "rank-badge--gold" : ""}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td
                      className={`p-3 ${leadingSaves > 0 && s.saves === leadingSaves ? "font-bold text-primary" : "font-medium"}`}
                    >
                      {s.player_name}
                    </td>
                    <td className="p-3 text-muted-foreground">{s.team_name}</td>
                    <td
                      className={`p-3 text-center tabular-nums ${leadingSaves > 0 && s.saves === leadingSaves ? "font-bold text-primary" : "font-semibold"}`}
                    >
                      {s.saves}
                    </td>
                    <td className="p-3 text-center tabular-nums">
                      {Math.max(
                        cleanSheetsByGoalkeeper.get(`${s.player_id}:${s.team_id}`) ?? 0,
                        s.clean_sheets,
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {s.saves > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Delete ${s.player_name}'s saves for ${s.team_name}`}
                          aria-label={`Delete ${s.player_name} from ${s.team_name} top saves`}
                          disabled={removeSaves.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove all recorded saves for ${s.player_name} on ${s.team_name}?`,
                              )
                            ) {
                              removeSaves.mutate(s.player_id);
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
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
