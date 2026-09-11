import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Shield } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/football-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchBestXI,
  fetchPlayers,
  fetchTeams,
  fetchTournaments,
  saveBestXI,
  type BestXI,
  type Team,
  type Tournament,
} from "@/lib/football";

export const Route = createFileRoute("/best-xi")({
  head: () => ({
    meta: [
      { title: "The Best XI — FRIENDS LEAGUE" },
      { name: "description", content: "Select and preserve the Best XI for each tournament." },
    ],
  }),
  component: BestXIPage,
});

const slots = [
  { key: "forward_1", label: "Forward 1", group: "FORWARDS" },
  { key: "forward_2", label: "Forward 2", group: "FORWARDS" },
  { key: "forward_3", label: "Forward 3", group: "FORWARDS" },
  { key: "midfielder_1", label: "Midfielder 1", group: "MIDFIELDERS" },
  { key: "midfielder_2", label: "Midfielder 2", group: "MIDFIELDERS" },
  { key: "midfielder_3", label: "Midfielder 3", group: "MIDFIELDERS" },
  { key: "defender_1", label: "Defender 1", group: "DEFENDERS" },
  { key: "defender_2", label: "Defender 2", group: "DEFENDERS" },
  { key: "defender_3", label: "Defender 3", group: "DEFENDERS" },
  { key: "defender_4", label: "Defender 4", group: "DEFENDERS" },
  { key: "goalkeeper", label: "Goalkeeper", group: "GOALKEEPER" },
] as const;

type SlotKey = (typeof slots)[number]["key"];
type Selection = Record<SlotKey, string>;
const EMPTY_TOURNAMENTS: Tournament[] = [];

function getStoredTournamentId() {
  return typeof window === "undefined" ? "" : (localStorage.getItem("current-tournament-id") ?? "");
}

const emptySelection = (): Selection =>
  Object.fromEntries(slots.map((slot) => [slot.key, ""])) as Selection;

function BestXIPage() {
  const queryClient = useQueryClient();
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const players = useQuery({ queryKey: ["players"], queryFn: () => fetchPlayers() });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const tournamentList: Tournament[] = Array.isArray(tournaments.data)
    ? tournaments.data
    : EMPTY_TOURNAMENTS;
  const playerList = Array.isArray(players.data) ? players.data : [];
  const teamList = Array.isArray(teams.data) ? teams.data : [];
  const [tournamentId, setTournamentId] = useState("");
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const selectedTournament = tournamentList.find((tournament) => tournament.id === tournamentId);
  const teamById = new Map(teamList.map((team: Team) => [team.id, team.name]));
  const bestXI = useQuery({
    queryKey: ["best-xi", tournamentId],
    queryFn: () => fetchBestXI(tournamentId),
    enabled: Boolean(tournamentId),
  });

  useEffect(() => {
    const storedId = getStoredTournamentId();
    const firstTournament = tournamentList[0];
    if (tournamentList.some((tournament) => tournament.id === tournamentId)) return;
    const nextId = tournamentList.some((tournament) => tournament.id === storedId)
      ? storedId
      : (firstTournament?.id ?? "");
    setTournamentId(nextId);
    if (nextId) localStorage.setItem("current-tournament-id", nextId);
  }, [tournamentId, tournamentList]);

  useEffect(() => {
    const saved = bestXI.data;
    setSelection(saved ? selectionFromBestXI(saved) : emptySelection());
  }, [bestXI.data]);

  const save = useMutation({
    mutationFn: () => saveBestXI(tournamentId, selection),
    onSuccess: () => {
      toast.success("Best XI saved and finalized");
      void queryClient.invalidateQueries({ queryKey: ["best-xi", tournamentId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to save Best XI"),
  });
  const finalized = Boolean(bestXI.data);
  const allFilled = slots.every((slot) => selection[slot.key]);

  function handleTournamentChange(nextId: string) {
    setTournamentId(nextId);
    localStorage.setItem("current-tournament-id", nextId);
  }

  function handleSave() {
    if (!tournamentId) return toast.error("Select a tournament first");
    if (!allFilled) return toast.error("Fill all 11 player positions before saving");
    if (new Set(Object.values(selection)).size !== slots.length) {
      return toast.error("Each Best XI position must use a different player");
    }
    save.mutate();
  }

  return (
    <SiteLayout>
      <PageHeader title="THE BEST XI" subtitle="Finalize one Best XI for each tournament." />
      <div className="page-content mx-auto max-w-4xl space-y-6 px-4 py-10">
        <div className="tournament-switcher space-y-2">
          <label
            htmlFor="best-xi-tournament"
            className="text-sm font-semibold uppercase tracking-wider"
          >
            SELECT TOURNAMENT
          </label>
          <select
            id="best-xi-tournament"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-md"
            value={tournamentId}
            onChange={(event) => handleTournamentChange(event.target.value)}
            disabled={tournaments.isLoading || tournamentList.length === 0}
          >
            <option value="">Select Tournament</option>
            {tournamentList.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.tournament_name}
              </option>
            ))}
          </select>
        </div>

        {tournaments.isError ? (
          <EmptyState message="Unable to load tournaments. Refresh the page and try again." />
        ) : tournaments.isLoading ? (
          <ListSkeleton rows={6} />
        ) : tournamentList.length === 0 ? (
          <EmptyState message="No tournaments are available yet." />
        ) : bestXI.isError ? (
          <EmptyState message="Unable to load this tournament's Best XI. Refresh the page and try again." />
        ) : players.isError ? (
          <EmptyState message="Unable to load players. Refresh the page and try again." />
        ) : teams.isError ? (
          <EmptyState message="Unable to load teams. Refresh the page and try again." />
        ) : bestXI.isLoading || players.isLoading || teams.isLoading ? (
          <ListSkeleton rows={6} />
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>{selectedTournament?.tournament_name ?? "Best XI"}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {finalized
                    ? "This selection is read-only."
                    : "Choose existing players for every position."}
                </p>
              </div>
              {finalized && (
                <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
                  <Check className="size-4" /> BEST XI FINALIZED
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-7">
              {["FORWARDS", "MIDFIELDERS", "DEFENDERS", "GOALKEEPER"].map((group) => (
                <section key={group} className="space-y-3">
                  <h2 className="flex items-center gap-2 text-xs font-black tracking-[0.18em] text-primary">
                    <Shield className="size-4" /> {group}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {slots
                      .filter((slot) => slot.group === group)
                      .map((slot) => (
                        <label key={slot.key} className="space-y-1 text-sm font-medium">
                          {slot.label}
                          <select
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                            value={selection[slot.key]}
                            disabled={finalized || save.isPending}
                            onChange={(event) =>
                              setSelection((current) => ({
                                ...current,
                                [slot.key]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Enter {slot.label}</option>
                            {playerList
                              .filter((player) => player.status === "Active")
                              .map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.name} —{" "}
                                  {teamById.get(player.team_id ?? "") ?? "Team unavailable"}
                                </option>
                              ))}
                          </select>
                        </label>
                      ))}
                  </div>
                </section>
              ))}
              {!finalized && (
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                  onClick={handleSave}
                  disabled={!tournamentId || !allFilled || save.isPending}
                >
                  {save.isPending ? "Saving..." : "SAVE BEST XI"}
                </button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </SiteLayout>
  );
}

function selectionFromBestXI(saved: BestXI): Selection {
  return Object.fromEntries(slots.map((slot) => [slot.key, saved[slot.key]])) as Selection;
}
