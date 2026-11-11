import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Shield } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/football-ui";
import { PlayerPicker } from "@/components/player-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { syncHouseOfIcons } from "@/lib/house-of-icons";
import {
  fetchBestXI,
  fetchPlayers,
  fetchTeams,
  fetchTournaments,
  BEST_XI_FORMATIONS,
  BEST_XI_OUTFIELD_KEYS,
  getBestXISlots,
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

type SlotKey = (typeof BEST_XI_OUTFIELD_KEYS)[number] | "goalkeeper";
type Selection = Record<SlotKey, string>;
const EMPTY_TOURNAMENTS: Tournament[] = [];
const positionsForGroup = {
  FORWARDS: ["Forward", "Winger"],
  MIDFIELDERS: [
    "Midfielder",
    "Center Midfielder",
    "Defensive Midfielder",
    "Attacking Midfielder",
    "Left Midfielder",
    "Right Midfielder",
  ],
  DEFENDERS: ["Defender", "Left Back", "Right Back"],
  GOALKEEPER: ["Goalkeeper"],
} as const;

function getStoredTournamentId() {
  return typeof window === "undefined" ? "" : (localStorage.getItem("current-tournament-id") ?? "");
}

const emptySelection = (): Selection =>
  Object.fromEntries([...BEST_XI_OUTFIELD_KEYS, "goalkeeper"].map((key) => [key, ""])) as Selection;

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
  const [formation, setFormation] = useState("4-3-3");
  const [savedBestXI, setSavedBestXI] = useState<BestXI | null>(null);
  const slots = getBestXISlots(formation);
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
    setFormation("4-3-3");
    setSavedBestXI(null);
  }, [tournamentId]);

  useEffect(() => {
    if (!bestXI.data) return;
    setFormation(bestXI.data.formation || "4-3-3");
    setSelection(selectionFromBestXI(bestXI.data));
    setSavedBestXI(bestXI.data);
  }, [bestXI.data]);

  const save = useMutation({
    mutationFn: () => saveBestXI(tournamentId, formation, selection),
    onSuccess: async (saved) => {
      setSavedBestXI(saved);
      toast.success("Best XI saved and finalized");
      void queryClient.invalidateQueries({ queryKey: ["best-xi", tournamentId] });
      try {
        await syncHouseOfIcons();
        void queryClient.invalidateQueries({ queryKey: ["house-of-icons"] });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Best XI was saved, but HOUSE OF THE ICONS could not be refreshed: ${error.message}`
            : "Best XI was saved, but HOUSE OF THE ICONS could not be refreshed.",
        );
      }
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

  function handleFormationChange(nextFormation: string) {
    if (slots.some((slot) => selection[slot.key])) {
      toast.info("Formation changed. Select players again for the new positions.");
      setSelection(emptySelection());
    }
    setFormation(nextFormation);
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
    if (new Set(slots.map((slot) => selection[slot.key])).size !== slots.length) {
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
              {!finalized && (
                <label className="block space-y-2 text-sm font-medium">
                  Formation
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-xs"
                    value={formation}
                    onChange={(event) => handleFormationChange(event.target.value)}
                  >
                    {BEST_XI_FORMATIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.value}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {finalized ? (
                <SavedPlayersList
                  savedBestXI={savedBestXI}
                  playerById={playerById}
                  teamById={teamById}
                  slots={slots}
                  formation={formation}
                />
              ) : (
                [...new Set(slots.map((slot) => slot.line))].map((line) => (
                  <section key={line} className="space-y-3">
                    <h2 className="flex items-center gap-2 text-xs font-black tracking-[0.18em] text-primary">
                      <Shield className="size-4" /> {line}
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {slots
                        .filter((slot) => slot.line === line)
                        .map((slot) => (
                          <label key={slot.key} className="space-y-1 text-sm font-medium">
                            {slot.label}
                            <PlayerPicker
                              className="w-full"
                              players={playerList
                                .filter((player) => {
                                  const position = player.position?.trim().toLowerCase();
                                  return (
                                    player.status === "Active" &&
                                    position !== undefined &&
                                    positionsForGroup[slot.group].some(
                                      (allowedPosition) =>
                                        allowedPosition.toLowerCase() === position,
                                    )
                                  );
                                })
                                .map((player) => ({
                                  id: player.id,
                                  name: `${player.name} — ${teamById.get(player.team_id ?? "") ?? "Team unavailable"}`,
                                }))}
                              value={selection[slot.key]}
                              placeholder={`Enter ${slot.label}`}
                              disabled={save.isPending}
                              onValueChange={(playerId) =>
                                setSelection((current) => ({
                                  ...current,
                                  [slot.key]: playerId,
                                }))
                              }
                            />
                          </label>
                        ))}
                    </div>
                  </section>
                ))
              )}
              <PlayingXI
                formation={formation}
                slots={slots}
                selection={selection}
                playerById={playerById}
                teamById={teamById}
              />
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
  slots,
  formation,
}: {
  savedBestXI: BestXI | null;
  playerById: Map<string, Player>;
  teamById: Map<string, string>;
  slots: ReturnType<typeof getBestXISlots>;
  formation: string;
}) {
  return (
    <section className="space-y-3" aria-label="Saved Best XI players">
      <div>
        <h2 className="text-xs font-black tracking-[0.18em] text-primary">SELECTED PLAYERS</h2>
        <p className="mt-1 text-sm text-muted-foreground">{formation} formation</p>
      </div>
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
  return Object.fromEntries(
    [...BEST_XI_OUTFIELD_KEYS, "goalkeeper"].map((key) => [key, saved[key]]),
  ) as Selection;
}

function PlayingXI({
  formation,
  slots,
  selection,
  playerById,
  teamById,
}: {
  formation: string;
  slots: ReturnType<typeof getBestXISlots>;
  selection: Selection;
  playerById: Map<string, Player>;
  teamById: Map<string, string>;
}) {
  const rows = [...new Set(slots.map((slot) => slot.line))].map((line) => ({
    line,
    slots: slots.filter((slot) => slot.line === line),
  }));

  return (
    <section className="space-y-3" aria-label="Playing XI preview">
      <div>
        <h2 className="text-xs font-black tracking-[0.18em] text-primary">PLAYING XI</h2>
        <p className="mt-1 text-sm text-muted-foreground">{formation} formation</p>
      </div>
      <div className="overflow-x-auto rounded-xl">
        <div className="pitch-gradient relative grid min-w-3xl gap-7 overflow-hidden rounded-xl border border-white/20 p-8 shadow-elevated">
          <div className="pointer-events-none absolute inset-4 rounded-lg border border-white/35" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
          {rows.map(({ line, slots: lineSlots }) => (
            <div key={line} className="relative z-10 space-y-2 text-center">
              <p className="text-[10px] font-black tracking-[0.18em] text-white/75">{line}</p>
              <div className="flex flex-nowrap justify-center gap-4">
                {lineSlots.map((slot) => {
                  const player = playerById.get(selection[slot.key]);
                  return (
                    <div
                      key={slot.key}
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
