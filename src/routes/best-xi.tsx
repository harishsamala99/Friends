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
  type Player,
  type Team,
  type Tournament,
} from "@/lib/football";

export const Route = createFileRoute("/best-xi")({
  head: () => ({
    meta: [
      { title: "TEAM OF THE LEAGUE — FRIENDS LEAGUE" },
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
const positionForGroup = {
  FORWARDS: "Forward",
  MIDFIELDERS: "Midfielder",
  DEFENDERS: "Defender",
  GOALKEEPER: "Goalkeeper",
} as const;

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
  const [savedBestXI, setSavedBestXI] = useState<BestXI | null>(null);
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
    setSelection(emptySelection());
    setSavedBestXI(null);
  }, [tournamentId]);

  useEffect(() => {
    if (!bestXI.data) return;
    setSelection(selectionFromBestXI(bestXI.data));
    setSavedBestXI(bestXI.data);
  }, [bestXI.data]);

  const save = useMutation({
    mutationFn: () => saveBestXI(tournamentId, selection),
    onSuccess: (saved) => {
      setSavedBestXI(saved);
      toast.success("Best XI saved and finalized");
      void queryClient.invalidateQueries({ queryKey: ["best-xi", tournamentId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to save Best XI"),
  });
  const allFilled = slots.every((slot) => selection[slot.key]);
  const finalized = Boolean(savedBestXI);
  const playerById = new Map(playerList.map((player) => [player.id, player]));

  function handleTournamentChange(nextId: string) {
    setTournamentId(nextId);
    localStorage.setItem("current-tournament-id", nextId);
  }

  function handleSave(): void {
    if (!tournamentId) {
      toast.error("Select a tournament first");
      return;
    }
    if (!allFilled) {
      toast.error("Fill all 11 player positions before saving");
      return;
    }
    if (new Set(Object.values(selection)).size !== slots.length) {
      toast.error("Each Best XI position must use a different player");
      return;
    }
    save.mutate();
  }

  return (
    <SiteLayout>
      <PageHeader title="TEAM OF THE LEAGUE" subtitle="Finalize one Best XI for each tournament." />
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
                {!finalized && (
                  <p className="mt-1 text-sm text-muted-foreground">Select your playing XI.</p>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
                <Check className="size-4" /> PLAYING XI
              </span>
            </CardHeader>
            <CardContent className="space-y-7">
              {finalized ? (
                <SavedPlayersList
                  savedBestXI={savedBestXI}
                  playerById={playerById}
                  teamById={teamById}
                />
              ) : (
                ["FORWARDS", "MIDFIELDERS", "DEFENDERS", "GOALKEEPER"].map((group) => (
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
                              disabled={save.isPending}
                              onChange={(event) =>
                                setSelection((current) => ({
                                  ...current,
                                  [slot.key]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Enter {slot.label}</option>
                              {playerList
                                .filter(
                                  (player) =>
                                    player.status === "Active" &&
                                    player.position?.trim().toLowerCase() ===
                                      positionForGroup[
                                        group as keyof typeof positionForGroup
                                      ].toLowerCase(),
                                )
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
                ))
              )}
              <PlayingXI selection={selection} playerById={playerById} teamById={teamById} />
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

function SavedPlayersList({
  savedBestXI,
  playerById,
  teamById,
}: {
  savedBestXI: BestXI | null;
  playerById: Map<string, Player>;
  teamById: Map<string, string>;
}) {
  return (
    <section className="space-y-3" aria-label="Saved Best XI players">
      <h2 className="text-xs font-black tracking-[0.18em] text-primary">SELECTED PLAYERS</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {slots.map((slot) => {
          const player = playerById.get(savedBestXI?.[slot.key] ?? "");
          return (
            <div
              key={slot.key}
              className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{slot.label}</p>
                <p className="font-semibold">{player?.name ?? "Player unavailable"}</p>
              </div>
              <span className="text-right text-xs text-muted-foreground">
                {player ? (teamById.get(player.team_id ?? "") ?? "Team unavailable") : ""}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function selectionFromBestXI(saved: BestXI): Selection {
  return Object.fromEntries(slots.map((slot) => [slot.key, saved[slot.key]])) as Selection;
}

function PlayingXI({
  selection,
  playerById,
  teamById,
}: {
  selection: Selection;
  playerById: Map<string, Player>;
  teamById: Map<string, string>;
}) {
  const rows = [
    ["FORWARDS", ["forward_1", "forward_2", "forward_3"]],
    ["MIDFIELDERS", ["midfielder_1", "midfielder_2", "midfielder_3"]],
    ["DEFENDERS", ["defender_1", "defender_2", "defender_3", "defender_4"]],
    ["GOALKEEPER", ["goalkeeper"]],
  ] as const;

  return (
    <section className="space-y-3" aria-label="Playing XI preview">
      <div>
        <h2 className="text-xs font-black tracking-[0.18em] text-primary">PLAYING XI</h2>
        <p className="mt-1 text-sm text-muted-foreground">4-3-3 formation</p>
      </div>
      <div className="overflow-x-auto rounded-xl">
        <div className="pitch-gradient relative grid min-w-3xl gap-7 overflow-hidden rounded-xl border border-white/20 p-8 shadow-elevated">
          <div className="pointer-events-none absolute inset-4 rounded-lg border border-white/35" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
          {rows.map(([label, row]) => (
            <div key={label} className="relative z-10 space-y-2 text-center">
              <p className="text-[10px] font-black tracking-[0.18em] text-white/75">{label}</p>
              <div className="flex flex-nowrap justify-center gap-4">
                {row.map((slotKey) => {
                  const player = playerById.get(selection[slotKey]);
                  return (
                    <div
                      key={slotKey}
                      className="flex min-h-16 w-36 shrink-0 flex-col items-center justify-center rounded-md border border-white/25 bg-black/25 px-2 py-2 text-white backdrop-blur-sm"
                    >
                      <span className="text-xs font-bold leading-tight">
                        {player?.name ?? "Awaiting player"}
                      </span>
                      <span className="mt-1 text-[10px] leading-tight text-white/75">
                        {player
                          ? (teamById.get(player.team_id ?? "") ?? "Team unavailable")
                          : "Select above"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
